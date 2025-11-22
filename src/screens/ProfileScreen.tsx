// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { CompositeNavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../../App';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../supabaseClient';
import LanguagePicker from '../components/LanguagePicker';

const { width, height } = Dimensions.get('window');

type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: ProfileScreenNavigationProp;
}

interface VoiceClip {
  id: string;
  phrase: string;
  language: string;
  likes: number;
  comments: number;
  validations: number;
  duets: number;
  timeAgo: string;
  clip_type?: 'original' | 'duet';
  original_clip_id?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  primary_language: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  created_at: string;
}

interface Language {
  id: string;
  name: string;
  dialect?: string;
}

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user: authUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'My Clips' | 'Badges' | 'Rewards'>('My Clips');

  // State for real data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [voiceClips, setVoiceClips] = useState<VoiceClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoStoriesCount, setVideoStoriesCount] = useState(0);

  // Avatar editing state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Follow counts state
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Language picker state
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | undefined>(undefined);

  // Bio editor state
  const [showBioEditor, setShowBioEditor] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const BIO_CHAR_LIMIT = 200;

  // Location editor state
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [locationInput, setLocationInput] = useState('');

  // Helper function to format time ago
  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffInSeconds / 31536000)}y ago`;
  };

  const formatJoinDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
    return formatter.format(date);
  };

  // Fetch user profile from database
  const fetchUserProfile = async () => {
    if (!authUser?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...');
          await createUserProfile();
          return;
        }
        throw error;
      }

      if (data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError('Failed to load profile');
    }
  };

  // Create user profile if it doesn't exist
  const createUserProfile = async () => {
    if (!authUser?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
          username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user',
          primary_language: authUser.user_metadata?.primary_language || 'English',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        console.log('Profile created successfully:', data);
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
      setError('Failed to create profile');
    }
  };

  // Fetch user's voice clips from database
  const fetchVoiceClips = async () => {
    if (!authUser?.id) return;

    try {
      const { data, error } = await supabase
        .from('voice_clips')
        .select(`
          id,
          phrase,
          language,
          dialect,
          likes_count,
          comments_count,
          validations_count,
          duets_count,
          clip_type,
          original_clip_id,
          created_at
        `)
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Transform database data to match our interface
        const transformedClips: VoiceClip[] = data.map(clip => ({
          id: clip.id,
          phrase: clip.phrase,
          language: clip.dialect ? `${clip.language} / ${clip.dialect}` : clip.language || 'Unknown',
          likes: clip.likes_count || 0,
          comments: clip.comments_count || 0,
          validations: clip.validations_count || 0,
          duets: clip.duets_count || 0,
          timeAgo: getTimeAgo(clip.created_at),
          clip_type: clip.clip_type || 'original',
          original_clip_id: clip.original_clip_id
        }));

        setVoiceClips(transformedClips);
      }
    } catch (error) {
      console.error('Error fetching voice clips:', error);
    }
  };

  // Fetch user's video stories count (from video_clips)
  const fetchVideoStoriesCount = async () => {
    if (!authUser?.id) return;

    try {
      const { count, error } = await supabase
        .from('video_clips')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id);

      if (error) throw error;
      setVideoStoriesCount(count || 0);
    } catch (error) {
      console.error('Error fetching video stories count:', error);
    }
  };

  // Fetch follower/following counts
  const fetchFollowCounts = async () => {
    if (!authUser?.id) return;

    try {
      // Get follower count (people following this user)
      const { count: followerCount, error: followerError } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', authUser.id);

      if (followerError) throw followerError;
      setFollowerCount(followerCount || 0);

      // Get following count (people this user is following)
      const { count: followingCount, error: followingError } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', authUser.id);

      if (followingError) throw followingError;
      setFollowingCount(followingCount || 0);

    } catch (error) {
      console.error('Error fetching follow counts:', error);
    }
  };

  // Handle language selection
  const handleLanguageSelect = async (language: Language) => {
    if (!authUser?.id) return;

    try {
      // Update the profile with the new primary language
      const { error } = await supabase
        .from('profiles')
        .update({
          primary_language: language.dialect ? `${language.name} / ${language.dialect}` : language.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (error) throw error;

      // Update local state
      setUserProfile(prev => prev ? {
        ...prev,
        primary_language: language.dialect ? `${language.name} / ${language.dialect}` : language.name
      } : null);

      setShowLanguagePicker(false);
      Alert.alert('Success', 'Primary language updated successfully!');
    } catch (error) {
      console.error('Error updating primary language:', error);
      Alert.alert('Error', 'Failed to update primary language');
    }
  };

  // Open bio editor prefilled
  const openBioEditor = () => {
    setBioInput(userProfile?.bio || '');
    setShowBioEditor(true);
  };

  // Save bio to Supabase and local state
  const saveBio = async () => {
    if (!authUser?.id) return;
    const input = bioInput.trim();
    if (input.length > BIO_CHAR_LIMIT) {
      Alert.alert('Bio too long', `Please keep it under ${BIO_CHAR_LIMIT} characters.`);
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio: input, updated_at: new Date().toISOString() })
        .eq('id', authUser.id);
      if (error) throw error;
      setUserProfile(prev => prev ? { ...prev, bio: input } : prev);
      setShowBioEditor(false);
    } catch (e) {
      console.error('Error saving bio:', e);
      Alert.alert('Error', 'Failed to save bio. Please try again.');
    }
  };

  // Open location editor prefilled
  const openLocationEditor = () => {
    setLocationInput(userProfile?.location || '');
    setShowLocationEditor(true);
  };

  // Save location
  const saveLocation = async () => {
    if (!authUser?.id) return;
    const input = locationInput.trim();
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ location: input || null, updated_at: new Date().toISOString() })
        .eq('id', authUser.id);
      if (error) throw error;
      setUserProfile(prev => prev ? { ...prev, location: input || undefined } : prev);
      setShowLocationEditor(false);
    } catch (e) {
      console.error('Error saving location:', e);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    }
  };


  // Load all profile data
  const loadProfileData = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchUserProfile(),
        fetchVoiceClips(),
        fetchFollowCounts(),
        fetchVideoStoriesCount()
      ]);
    } catch (error) {
      console.error('Error loading profile data:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  // Avatar editing functions
  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      // Show action sheet
      Alert.alert(
        'Select Avatar',
        'Choose how you want to set your avatar',
        [
          {
            text: 'Camera',
            onPress: () => openCamera(),
          },
          {
            text: 'Photo Library',
            onPress: () => openImageLibrary(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to open image picker');
    }
  };

  const openCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const openImageLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error opening image library:', error);
      Alert.alert('Error', 'Failed to open image library');
    }
  };

  const uploadAvatar = async (imageUri: string) => {
    if (!authUser?.id) return;

    setUploadingAvatar(true);

    try {
      // Create a unique filename with user ID as folder
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${authUser.id}/${fileName}`;

      // Read file as base64 using FileSystem
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) {
        console.error('Supabase storage error:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setUserProfile(prev => prev ? {
        ...prev,
        avatar_url: urlData.publicUrl
      } : null);

      Alert.alert('Success', 'Avatar updated successfully!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to upload avatar: ${errorMessage}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    if (authUser?.id) {
      loadProfileData();
    }
  }, [authUser?.id]);

  const renderVoiceClip = (clip: VoiceClip) => (
    <View key={clip.id} style={styles.clipCard}>
      <View style={styles.clipHeader}>
        <View style={styles.clipHeaderLeft}>
          <Text style={styles.clipPhrase}>{clip.phrase}</Text>
          {clip.clip_type === 'duet' && (
            <View style={styles.duetBadge}>
              <Ionicons name="people" size={12} color="#8B5CF6" />
              <Text style={styles.duetBadgeText}>Duet</Text>
            </View>
          )}
        </View>
        <Text style={styles.clipTime}>{clip.timeAgo}</Text>
      </View>
      <Text style={styles.clipLanguage}>{clip.language}</Text>

      {clip.clip_type === 'duet' && (
        <View style={styles.duetInfo}>
          <Text style={styles.duetInfoText}>
            This is a duet response
          </Text>
        </View>
      )}

      <View style={styles.clipStats}>
        <View style={styles.statItem}>
          <Ionicons name="trophy" size={16} color="#FF8A00" />
          <Text style={styles.statText}>{clip.likes}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="chatbubble" size={16} color="#6B7280" />
          <Text style={styles.statText}>{clip.comments}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.statText}>{clip.validations}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="people" size={16} color="#8B5CF6" />
          <Text style={styles.statText}>{clip.duets}</Text>
        </View>
      </View>
    </View>
  );

  // Show loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#FF8A00" />
          <Text style={[styles.emptyStateTitle, { marginTop: 16 }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="alert-circle-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>{error}</Text>
          <TouchableOpacity style={styles.recordButton} onPress={loadProfileData}>
            <Text style={styles.recordButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={pickImage}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  {userProfile?.avatar_url && userProfile.avatar_url.startsWith('http') ? (
                    <Image
                      source={{ uri: userProfile.avatar_url }}
                      style={styles.avatarImage}
                      onError={() => console.log('Failed to load avatar image:', userProfile.avatar_url)}
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {userProfile?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  )}
                  <View style={styles.editIconOverlay}>
                    <Ionicons name="camera" size={16} color="#FFFFFF" />
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.profileNameRow}>
            <Text style={styles.profileName}>{userProfile?.full_name || 'User'}</Text>
            <Ionicons name="checkmark-circle" size={16} color="#3B82F6" style={styles.verifiedIcon} />
          </View>
          <Text style={styles.profileUsername}>@{userProfile?.username || 'user'}</Text>
          {!!userProfile?.bio ? (
            <TouchableOpacity onPress={openBioEditor} activeOpacity={0.8}>
              <Text style={styles.bioText}>{userProfile.bio}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={openBioEditor} activeOpacity={0.8}>
              <Text style={styles.bioPrompt}>Add a short bio…</Text>
            </TouchableOpacity>
          )}
          <View style={styles.metaRow}>
            <TouchableOpacity style={styles.metaItem} onPress={openLocationEditor} activeOpacity={0.8}>
              <Ionicons name="location-outline" size={14} color="#FFFFFF" />
              <Text style={styles.metaText}>{userProfile?.location || 'Add location'}</Text>
            </TouchableOpacity>
            <View style={styles.metaSeparator} />
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
              <Text style={styles.metaText}>Joined {formatJoinDate(userProfile?.created_at)}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.languageTag}
            onPress={() => setShowLanguagePicker(true)}
          >
            <Text style={styles.languageText}>{userProfile?.primary_language || 'Unknown Language'}</Text>
            <Ionicons name="chevron-down" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Follower/Following counts */}
          <View style={styles.followStats}>
            <View style={styles.followStatItem}>
              <Text style={styles.followStatNumber}>{followerCount}</Text>
            <Text style={styles.followStatLabel}>Followers</Text>
            </View>
            <View style={styles.followStatItem}>
              <Text style={styles.followStatNumber}>{followingCount}</Text>
              <Text style={styles.followStatLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {voiceClips.reduce((sum, clip) => sum + (clip.validations || 0), 0)}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} ellipsizeMode="clip">Validations</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{voiceClips.length}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} ellipsizeMode="clip">Clips</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{videoStoriesCount}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} ellipsizeMode="clip">Stories</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {voiceClips.filter(clip => clip.clip_type === 'duet').length}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} ellipsizeMode="clip">Duets</Text>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['My Clips', 'Badges', 'Rewards'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.activeTab
            ]}
            onPress={() => setActiveTab(tab as typeof activeTab)}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'My Clips' && (
          <View style={styles.clipsSection}>
            {voiceClips.length > 0 ? (
              voiceClips.map(renderVoiceClip)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="mic-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No clips yet</Text>
                <Text style={styles.emptyStateDescription}>
                  Start recording to share your voice with the world
                </Text>
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={() => navigation.navigate('RecordVoice')}
                >
                  <Ionicons name="mic" size={20} color="#FFFFFF" />
                  <Text style={styles.recordButtonText}>Record Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {activeTab === 'Badges' && (
          <View style={styles.badgesSection}>
            <View style={styles.badgeCard}>
              <View style={styles.badgeIcon}>
                <Ionicons name="sparkles" size={32} color="#FF8A00" />
              </View>
              <View style={styles.badgeContent}>
                <Text style={styles.badgeTitle}>Language Pioneer</Text>
                <Text style={styles.badgeDescription}>
                  Welcome to Lingualink AI! Ready to preserve languages.
                </Text>
                <Text style={styles.badgeDate}>Earned today</Text>
              </View>
            </View>

            <View style={styles.lockedBadgesContainer}>
              <Text style={styles.sectionTitle}>Locked Badges</Text>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={24} color="#9CA3AF" />
                <Text style={styles.lockedBadgeText}>First Recording</Text>
              </View>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={24} color="#9CA3AF" />
                <Text style={styles.lockedBadgeText}>Story Teller</Text>
              </View>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={24} color="#9CA3AF" />
                <Text style={styles.lockedBadgeText}>Community Helper</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'Rewards' && (
          <View style={styles.rewardsSection}>
            <View style={styles.emptyState}>
              <Ionicons name="gift-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No rewards yet</Text>
              <Text style={styles.emptyStateDescription}>
                Earn points by contributing to unlock rewards
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Language Picker Modal */}
      <LanguagePicker
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        onSelect={handleLanguageSelect}
        selectedLanguage={selectedLanguage}
      />

      {/* Bio Editor Modal */}
      <Modal
        visible={showBioEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBioEditor(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Bio</Text>
            <TextInput
              style={styles.bioInput}
              value={bioInput}
              onChangeText={setBioInput}
              placeholder="Tell others about your language interests"
              placeholderTextColor="#9CA3AF"
              maxLength={BIO_CHAR_LIMIT}
              multiline
            />
            <View style={styles.modalFooter}>
              <Text style={styles.charCount}>{bioInput.length}/{BIO_CHAR_LIMIT}</Text>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#E5E7EB' }]} onPress={() => setShowBioEditor(false)}>
                  <Text style={[styles.modalButtonText, { color: '#111827' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#FF8A00' }]} onPress={saveBio}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Editor Modal */}
      <Modal
        visible={showLocationEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationEditor(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Location</Text>
            <TextInput
              style={styles.bioInput}
              value={locationInput}
              onChangeText={setLocationInput}
              placeholder="City, Country"
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.modalFooter}>
              <View />
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#E5E7EB' }]} onPress={() => setShowLocationEditor(false)}>
                  <Text style={[styles.modalButtonText, { color: '#111827' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#FF8A00' }]} onPress={saveLocation}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FF8A00',
    paddingTop: height * 0.02,
    paddingBottom: height * 0.03,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  editIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF8A00',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  profileUsername: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.95,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  bioPrompt: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  metaSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  languageTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    flexShrink: 1,
    maxWidth: '100%',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: width * 0.05,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#FF8A00',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FF8A00',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  clipsSection: {
    paddingHorizontal: width * 0.05,
    paddingTop: 20,
  },
  clipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clipPhrase: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    maxWidth: '60%',
  },
  clipTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  clipLanguage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  clipStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  badgesSection: {
    paddingHorizontal: width * 0.05,
    paddingTop: 20,
  },
  badgeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  badgeContent: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  badgeDate: {
    fontSize: 12,
    color: '#FF8A00',
    fontWeight: '500',
  },
  lockedBadgesContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  lockedBadgeText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  bioInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  modalFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rewardsSection: {
    paddingHorizontal: width * 0.05,
    paddingTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 250,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  clipHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  duetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  duetBadgeText: {
    fontSize: 10,
    color: '#8B5CF6',
    fontWeight: '500',
    marginLeft: 2,
  },
  duetInfo: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  duetInfoText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  followStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 32,
  },
  followStatItem: {
    alignItems: 'center',
  },
  followStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  followStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  followStatSubLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default ProfileScreen;