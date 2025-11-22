// src/screens/UserProfileScreen.tsx
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../supabaseClient';
import { submitValidation } from '../utils/content';

const { width, height } = Dimensions.get('window');

type UserProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  navigation: UserProfileScreenNavigationProp;
  route: {
    params: {
      userId: string;
    };
  };
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

const UserProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'Clips' | 'Badges' | 'Rewards'>('Clips');

  // State for real data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [voiceClips, setVoiceClips] = useState<VoiceClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow functionality state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mutualFollowersCount, setMutualFollowersCount] = useState<number | null>(null);
  const [videoStoriesCount, setVideoStoriesCount] = useState(0);

  const targetUserId = route.params.userId;

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
    if (!targetUserId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) {
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

  // Fetch user's voice clips from database
  const fetchVoiceClips = async () => {
    if (!targetUserId) return;

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
        .eq('user_id', targetUserId)
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
    if (!targetUserId) return;
    try {
      const { count, error } = await supabase
        .from('video_clips')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId);
      if (error) throw error;
      setVideoStoriesCount(count || 0);
    } catch (e) {
      console.error('Error fetching video stories count:', e);
    }
  };

  // Fetch follow status and counts
  const fetchFollowData = async () => {
    if (!authUser?.id || !targetUserId) return;

    try {
      // Check if current user is following target user
      const { data: followData, error: followError } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', authUser.id)
        .eq('following_id', targetUserId)
        .single();

      if (followError && followError.code !== 'PGRST116') {
        throw followError;
      }

      setIsFollowing(!!followData);

      // Get follower count
      const { count: followerCount, error: followerError } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetUserId);

      if (followerError) throw followerError;
      setFollowerCount(followerCount || 0);

      // Get following count
      const { count: followingCount, error: followingError } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', targetUserId);

      if (followingError) throw followingError;
      setFollowingCount(followingCount || 0);

      // Mutual followers between current viewer and target user
      const { data: mutualCount, error: mutualError } = await supabase
        .rpc('get_mutual_followers_count', { viewer: authUser.id, profile: targetUserId });
      if (mutualError) throw mutualError;
      setMutualFollowersCount(typeof mutualCount === 'number' ? mutualCount : 0);

    } catch (error) {
      console.error('Error fetching follow data:', error);
    }
  };

  // Follow/Unfollow functionality
  const toggleFollow = async () => {
    if (!authUser?.id || !targetUserId || followLoading) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', authUser.id)
          .eq('following_id', targetUserId);

        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: authUser.id,
            following_id: targetUserId
          });

        if (error) throw error;
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  // Quick validation functionality
  const handleQuickValidation = async (clipId: string, isCorrect: boolean) => {
    if (!authUser?.id) {
      Alert.alert('Error', 'Please sign in to validate clips');
      return;
    }

    try {
      const success = await submitValidation(
        clipId,
        'pronunciation', // Default to pronunciation validation
        isCorrect ? 4 : 2, // 4 for correct, 2 for needs improvement
        undefined, // No feedback for quick validation
        isCorrect
      );

      if (success) {
        // Update local state
        setVoiceClips(prevClips =>
          prevClips.map(clip =>
            clip.id === clipId
              ? {
                  ...clip,
                  validations: clip.validations + 1
                }
              : clip
          )
        );

        Alert.alert(
          'Validation Submitted',
          `Thank you for validating this pronunciation as ${isCorrect ? 'correct' : 'needs improvement'}.`
        );
      } else {
        Alert.alert('Error', 'Failed to submit validation. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting validation:', error);
      Alert.alert('Error', 'Failed to submit validation');
    }
  };

  // Duet functionality
  const handleDuet = (clip: VoiceClip) => {
    if (!authUser?.id) {
      Alert.alert('Error', 'Please sign in to create duets');
      return;
    }

    navigation.navigate('RecordVoice', {
      isDuet: true,
      originalClip: {
        id: clip.id,
        phrase: clip.phrase,
        user: userProfile?.full_name || 'User',
        language: userProfile?.primary_language || 'Unknown'
      }
    });
  };

  // Load all profile data
  const loadProfileData = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchUserProfile(),
        fetchVoiceClips(),
        fetchFollowData(),
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

  // Load data when component mounts
  useEffect(() => {
    if (targetUserId) {
      loadProfileData();
    }
  }, [targetUserId]);

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

      {/* Action Buttons */}
      <View style={styles.clipActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleQuickValidation(clip.id, true)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.actionText}>Correct</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleQuickValidation(clip.id, false)}
        >
          <Ionicons name="close-circle" size={20} color="#EF4444" />
          <Text style={styles.actionText}>Needs Work</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDuet(clip)}
        >
          <Ionicons name="people" size={20} color="#8B5CF6" />
          <Text style={styles.actionText}>Duet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Show loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />
        <View style={[styles.header, { paddingTop: insets.top + height * 0.02 }]}>
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
        <View style={[styles.header, { paddingTop: insets.top + height * 0.02 }]}>
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
      <View style={[styles.header, { paddingTop: insets.top + height * 0.02 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={async () => {
                if (!authUser?.id || !targetUserId) return;
                try {
                  const { data, error } = await supabase.rpc('create_or_get_dm', { target: targetUserId });
                  if (error) throw error;
                  navigation.navigate('ChatDetail', {
                    contact: {
                      id: targetUserId,
                      name: userProfile?.full_name || 'User',
                      username: userProfile?.username || 'user',
                      avatar: (userProfile?.full_name || 'U').trim().charAt(0).toUpperCase(),
                      language: userProfile?.primary_language || '—',
                      isOnline: false,
                    },
                    // @ts-ignore pass along conversation id for ChatDetail
                    conversationId: data,
                  });
                } catch (e) {
                  Alert.alert('Error', 'Failed to start chat');
                }
              }}
              style={[styles.followButton, { backgroundColor: 'rgba(255, 138, 0, 0.2)', borderColor: '#FF8A00' }]}
            >
              <Text style={[styles.followButtonText, { color: '#FFFFFF' }]}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleFollow}
              disabled={followLoading}
              style={styles.followButton}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.followButtonText}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
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
            </View>
          </View>
          <View style={styles.profileNameRow}>
            <Text style={styles.profileName}>{userProfile?.full_name || 'User'}</Text>
            <Ionicons name="checkmark-circle" size={16} color="#3B82F6" style={styles.verifiedIcon} />
          </View>
          <Text style={styles.profileUsername}>@{userProfile?.username || 'user'}</Text>
          {!!userProfile?.bio && (
            <Text style={styles.bioText}>{userProfile.bio}</Text>
          )}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color="#FFFFFF" />
              <Text style={styles.metaText}>{userProfile?.location || 'Unknown'}</Text>
            </View>
            <View style={styles.metaSeparator} />
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
              <Text style={styles.metaText}>Joined {formatJoinDate(userProfile?.created_at)}</Text>
            </View>
          </View>
          <View style={styles.languageTag}>
            <Text style={styles.languageText}>{userProfile?.primary_language || 'Unknown Language'}</Text>
          </View>

          {/* Follower/Following counts */}
          <View style={styles.followStats}>
            <View style={styles.followStatItem}>
              <Text style={styles.followStatNumber}>{followerCount}</Text>
              <Text style={styles.followStatLabel}>Followers</Text>
            {mutualFollowersCount !== null && (
              <Text style={styles.followStatSubLabel}>{mutualFollowersCount} mutual</Text>
            )}
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
        {['Clips', 'Badges', 'Rewards'].map((tab) => (
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
        {activeTab === 'Clips' && (
          <View style={styles.clipsSection}>
            {voiceClips.length > 0 ? (
              voiceClips.map(renderVoiceClip)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="mic-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No clips yet</Text>
                <Text style={styles.emptyStateDescription}>
                  This user hasn't shared any clips yet
                </Text>
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
  followButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  followStats: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 24,
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
  clipActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
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
});

export default UserProfileScreen;
