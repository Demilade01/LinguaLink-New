// src/screens/HomeScreen.tsx
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
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { getPlayableAudioUrl } from '../utils/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../../App';

const { width, height } = Dimensions.get('window');

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

interface VoiceClip {
  id: string;
  type: 'voice';
  user: {
    name: string;
    username: string;
    avatar: string;
    language: string;
  };
  phrase: string;
  translation: string;
  audioWaveform: number[];
  audio_url?: string;
  likes: number;
  comments: number;
  shares: number;
  validations: number;
  needsValidation: boolean;
  timeAgo: string;
  isValidated: boolean;
  userLanguages: string[];
}

interface Story {
  id: string;
  type: 'story';
  user: {
    name: string;
    username: string;
    avatar: string;
    language: string;
  };
  title: string;
  thumbnail: string;
  duration: string;
  likes: number;
  comments: number;
  shares: number;
  timeAgo: string;
  isAIStory: boolean;
}

const mockVoiceClips: VoiceClip[] = [
  {
    id: 'voice_1',
    type: 'voice',
    user: {
      name: 'Adunni Lagos',
      username: 'Adur',
      avatar: '🌱',
      language: 'Yoruba / Ekiti Dialect'
    },
    phrase: 'E kààrọ́',
    translation: 'This means "Good Morning" in Yoruba',
    audioWaveform: [20, 40, 60, 80, 60, 40, 70, 90, 50, 30, 60, 80, 40, 20, 50, 70],
    likes: 342,
    comments: 28,
    shares: 156,
    validations: 23,
    needsValidation: false,
    timeAgo: '2h',
    isValidated: true,
    userLanguages: ['Yoruba / Ekiti Dialect']
  },
  {
    id: 'voice_2',
    type: 'voice',
    user: {
      name: 'Chidi Okafor',
      username: 'ChidiIgbo',
      avatar: '👨🏾',
      language: 'Igbo / Nsukka'
    },
    phrase: 'Ndewo',
    translation: 'Hello in Igbo',
    audioWaveform: [30, 50, 70, 40, 60, 80, 90, 70, 40, 20, 50, 60, 30, 40, 60, 50],
    likes: 189,
    comments: 15,
    shares: 67,
    validations: 8,
    needsValidation: true,
    timeAgo: '4h',
    isValidated: false,
    userLanguages: ['Igbo / Nsukka', 'Igbo / Owerri']
  }
];

const mockStories: Story[] = [
  {
    id: 'story_1',
    type: 'story',
    user: {
      name: 'Aisha Mohammed',
      username: 'aisha_storyteller',
      avatar: '👩🏾',
      language: 'Hausa'
    },
    title: 'The Wise Old Baobab Tree',
    thumbnail: '/api/placeholder/300/200',
    duration: '3:12',
    likes: 98,
    comments: 7,
    shares: 12,
    timeAgo: '1d',
    isAIStory: true
  },
  {
    id: 'story_2',
    type: 'story',
    user: {
      name: 'Kemi Adebayo',
      username: 'kemi_tales',
      avatar: '👸🏾',
      language: 'Yoruba'
    },
    title: 'How the Tortoise Got Its Shell',
    thumbnail: '/api/placeholder/300/200',
    duration: '4:45',
    likes: 156,
    comments: 23,
    shares: 31,
    timeAgo: '3d',
    isAIStory: true
  }
];

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'All' | 'Voice' | 'Stories' | 'Lab'>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState<string | null>(null);

  const userLanguages = ['Yoruba / Ekiti Dialect', 'English'];

  const renderWaveform = (waveform: number[]) => (
    <View style={styles.waveformContainer}>
      {waveform.map((height, index) => (
        <View
          key={index}
          style={[
            styles.waveformBar,
            { height: height * 0.8 }
          ]}
        />
      ))}
    </View>
  );

  const playAudio = async (clipId: string, audioUrl?: string) => {
    try {
      if (!audioUrl) {
        return;
      }

      // If this clip is already playing, stop it
      if (isPlaying === clipId && sound) {
        await sound.stopAsync();
        setIsPlaying(null);
        return;
      }

      // Stop any currently playing audio
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      setIsLoadingAudio(clipId);

      const resolvedUrl = await getPlayableAudioUrl(audioUrl);
      if (!resolvedUrl) {
        setIsLoadingAudio(null);
        return;
      }

      // Create and play the audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: resolvedUrl },
        { shouldPlay: true }
      );

      setSound(newSound);
      setIsPlaying(clipId);
      setIsLoadingAudio(null);

      // Set up cleanup when audio finishes
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(null);
          setSound(null);
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsLoadingAudio(null);
    }
  };

  const stopAudio = async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
      setIsPlaying(null);
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handleValidate = (clipId: string, isCorrect: boolean) => {
    const validationType = isCorrect ? 'correct' : 'incorrect';
    Alert.alert(
      'Validation Submitted',
      `Thank you for validating this pronunciation as ${validationType}. Your feedback helps improve the community!`
    );
    setShowMoreOptions(null);
  };

  const handleDuet = (clip: VoiceClip) => {
    navigation.navigate('RecordVoice', {
      isDuet: true,
      originalClip: {
        id: clip.id,
        phrase: clip.phrase,
        user: clip.user.name,
        language: clip.user.language
      }
    });
  };

  const handleRemix = (clip: VoiceClip) => {
    navigation.navigate('RecordVoice', {

      originalClip: {
        id: clip.id,
        phrase: clip.phrase,
        user: clip.user.name,
        language: clip.user.language
      }
    });
  };

  const handleLike = (itemId: string, type: 'voice' | 'story') => {
    Alert.alert('Liked!', `You liked this ${type === 'voice' ? 'voice clip' : 'story'}`);
  };

  const handleComment = (itemId: string, type: 'voice' | 'story') => {
    Alert.alert('Comment', `Comment feature coming soon for ${type === 'voice' ? 'voice clips' : 'stories'}!`);
  };

  const handleShare = (itemId: string, type: 'voice' | 'story') => {
    Alert.alert('Share', `Share this ${type === 'voice' ? 'voice clip' : 'story'} with friends!`);
  };

  const canValidate = (clip: VoiceClip) => {
    return userLanguages.some(lang => clip.userLanguages.includes(lang));
  };

  const MoreOptionsModal = ({ clip }: { clip: VoiceClip }) => (
    <Modal
      visible={showMoreOptions === clip.id}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMoreOptions(null)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackground}
          onPress={() => setShowMoreOptions(null)}
        />
        <View style={styles.moreOptionsContent}>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              setShowMoreOptions(null);
              handleDuet(clip);
            }}
          >
            <Ionicons name="people" size={20} color="#10B981" />
            <Text style={styles.optionText}>Create Duet</Text>
            <Text style={styles.optionDescription}>Respond to this clip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              setShowMoreOptions(null);
              handleRemix(clip);
            }}
          >
            <Ionicons name="repeat" size={20} color="#8B5CF6" />
            <Text style={styles.optionText}>Remix</Text>
            <Text style={styles.optionDescription}>Your version of this phrase</Text>
          </TouchableOpacity>

          {canValidate(clip) && clip.needsValidation && (
            <>
              <View style={styles.optionDivider} />
              <Text style={styles.validationHeader}>Validate Pronunciation</Text>
              <TouchableOpacity
                style={[styles.optionItem, styles.validationOption]}
                onPress={() => handleValidate(clip.id, true)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.optionText}>Correct</Text>
                <Text style={styles.optionDescription}>Pronunciation is accurate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionItem, styles.validationOption]}
                onPress={() => handleValidate(clip.id, false)}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={styles.optionText}>Needs Work</Text>
                <Text style={styles.optionDescription}>Could be improved</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.optionDivider} />
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              setShowMoreOptions(null);
              Alert.alert('Report', 'Report functionality would be implemented here.');
            }}
          >
            <Ionicons name="flag" size={20} color="#EF4444" />
            <Text style={styles.optionText}>Report</Text>
            <Text style={styles.optionDescription}>Report inappropriate content</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderVoiceClip = (clip: VoiceClip) => (
    <View key={clip.id} style={styles.voiceClipCard}>
      <View style={styles.voiceClipHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{clip.user.avatar}</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{clip.user.name}</Text>
            <View style={styles.languageTag}>
              <Text style={styles.languageText}>{clip.user.language}</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {clip.needsValidation && (
            <View style={styles.validationBadge}>
              <Ionicons name="help-circle" size={12} color="#F59E0B" />
              <Text style={styles.validationBadgeText}>Needs Validation</Text>
            </View>
          )}
          {clip.isValidated && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          )}
          <Text style={styles.timeAgo}>{clip.timeAgo}</Text>
        </View>
      </View>

      <View style={styles.phraseContainer}>
        <Text style={styles.phrase}>{clip.phrase}</Text>
        <Text style={styles.translation}>{clip.translation}</Text>
      </View>

      {renderWaveform(clip.audioWaveform)}

      <TouchableOpacity
        style={styles.playButton}
        onPress={() => {
          if (isPlaying === clip.id) {
            stopAudio();
          } else {
            playAudio(clip.id, clip.audio_url);
          }
        }}
      >
        {isLoadingAudio === clip.id ? (
          <Ionicons name="sync" size={24} color="#FFFFFF" />
        ) : isPlaying === clip.id ? (
          <Ionicons name="pause" size={24} color="#FFFFFF" />
        ) : (
          <Ionicons name="play" size={24} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      <View style={styles.voiceClipActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(clip.id, 'voice')}
        >
          <Ionicons name="heart-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{clip.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleComment(clip.id, 'voice')}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{clip.comments}</Text>
        </TouchableOpacity>
        {canValidate(clip) && (
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={clip.needsValidation ? "#F59E0B" : "#10B981"}
            />
            <Text style={styles.actionText}>{clip.validations}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShare(clip.id, 'voice')}
        >
          <Ionicons name="share-outline" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setShowMoreOptions(clip.id)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <MoreOptionsModal clip={clip} />
    </View>
  );

  const renderStory = (story: Story) => (
    <View key={story.id} style={styles.storyCard}>
      <View style={styles.storyHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{story.user.avatar}</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{story.user.name}</Text>
            <View style={styles.storyTypeContainer}>
              {story.isAIStory && (
                <Ionicons name="sparkles" size={12} color="#8B5CF6" />
              )}
              <Text style={styles.storyType}>
                {story.isAIStory ? 'AI Story' : 'Story'} • {story.user.language}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.timeAgo}>{story.timeAgo}</Text>
      </View>

      <View style={styles.storyContent}>
        <View style={styles.storyThumbnail}>
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.storyTitle}>{story.title}</Text>
          </View>
          <TouchableOpacity style={styles.storyPlayButton}>
            <Ionicons name="play" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{story.duration}</Text>
          </View>
        </View>
      </View>

      <View style={styles.storyActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(story.id, 'story')}
        >
          <Ionicons name="heart-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{story.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleComment(story.id, 'story')}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{story.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShare(story.id, 'story')}
        >
          <Ionicons name="share-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{story.shares}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const CreateModal = () => (
    <Modal
      visible={showCreateModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackground}
          onPress={() => setShowCreateModal(false)}
        />
        <View style={styles.createModalContent}>
          <Text style={styles.createModalTitle}>What would you like to create?</Text>

          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('RecordVoice');
            }}
          >
            <View style={styles.createOptionIcon}>
              <Ionicons name="mic" size={24} color="#FF8A00" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Share a phrase or read a prompt</Text>
              <Text style={styles.createOptionDescription}>Record in your language</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('TellStory');
            }}
          >
            <View style={[styles.createOptionIcon, styles.purpleIcon]}>
              <Ionicons name="book" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Turn your voice into life</Text>
              <Text style={styles.createOptionDescription}>Create animated stories</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const getFilteredContent = () => {
    const allContent = [...mockVoiceClips, ...mockStories];

    switch (activeTab) {
      case 'Voice':
        return mockVoiceClips;
      case 'Stories':
        return mockStories;
      case 'All':
      default:
        return allContent.sort((a, b) => {
          // Sort by time, most recent first
          const timeOrder = ['1h', '2h', '4h', '1d', '3d'];
          return timeOrder.indexOf(a.timeAgo) - timeOrder.indexOf(b.timeAgo);
        });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + height * 0.02 }]}>
        <View style={styles.headerContent}>
          <Ionicons name="mic" size={24} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Lingualink AI</Text>
          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['All', 'Voice', 'Stories', 'Lab'].map((tab) => (
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
      >
        {getFilteredContent().map((item) =>
          item.type === 'voice' ? renderVoiceClip(item) : renderStory(item)
        )}
      </ScrollView>

      {/* Floating Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <CreateModal />
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
    paddingBottom: height * 0.02,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: width * 0.05,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: width * 0.05,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 16,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#FF8A00',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: width * 0.05,
    paddingTop: 16,
  },
  voiceClipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  voiceClipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  languageTag: {
    backgroundColor: '#FEF3E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  languageText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '500',
  },
  storyTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyType: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
    marginLeft: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  validationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  validationBadgeText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '500',
    marginLeft: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  verifiedBadgeText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 2,
  },
  timeAgo: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  phraseContainer: {
    marginBottom: 16,
  },
  phrase: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  translation: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginBottom: 16,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#FF8A00',
    marginHorizontal: 1,
    borderRadius: 2,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  storyContent: {
    marginBottom: 12,
  },
  storyThumbnail: {
    height: 200,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  storyPlayButton: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  voiceClipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
  moreButton: {
    padding: 4,
  },
  createButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FF8A00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  createModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  createModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  createOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  purpleIcon: {
    backgroundColor: '#F3E8FF',
  },
  createOptionContent: {
    flex: 1,
  },
  createOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  createOptionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  moreOptionsContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 12,
    flex: 1,
  },
  optionDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 12,
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  validationHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  validationOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginVertical: 2,
  },
});

// Make sure to export as default
export default HomeScreen;