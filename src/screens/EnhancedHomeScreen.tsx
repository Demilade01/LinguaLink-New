import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { getPlayableAudioUrl } from '../utils/storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Helper function to format time ago
const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
};

// Helper to format large counts like 14500 -> 14.5K
const formatCount = (count: number): string => {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(count % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(count % 1_000 === 0 ? 0 : 1)}K`;
  }
  return String(count);
};

// Helper to extract original prompt
const extractOriginalPrompt = (phrase: string) => {
  // If the phrase contains nested chain text, extract the original
  if (phrase.includes('"Create your own version of "') || phrase.includes('"Respond to "')) {
    // Find the innermost quoted text (the original prompt)
    const matches = phrase.match(/"([^"]*)"(?: by [^"]*)?$/);
    if (matches && matches[1]) {
      // Check if this is the actual original (not another nested layer)
      const extracted = matches[1];
      if (!extracted.includes('"Create your own version of "') && !extracted.includes('"Respond to "')) {
        return extracted;
      }
      // If it's still nested, try to find the deepest level
      return extractOriginalPrompt(extracted);
    }
  }
  // If no nested text found, return the phrase as-is
  return phrase;
};

interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarUrl?: string; // For real avatar URLs from Supabase
  language: string;
  isFollowing: boolean;
  followers: number;
  isVerified: boolean;
}

// Inside component, call hook to get badge count

// Unread notifications badge: fetch and subscribe
const useUnreadNotificationsCount = () => {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchCount = async () => {
      if (!user?.id) return;
      const { count: c } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (mounted && typeof c === 'number') setCount(c);
    };
    fetchCount();
    const channel = supabase
      .channel('notif-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` }, () => {
        setCount(prev => prev + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` }, (payload: any) => {
        // If is_read flipped true, decrement; if flipped false, increment
        const wasRead = payload.old?.is_read === true;
        const nowRead = payload.new?.is_read === true;
        if (!wasRead && nowRead) setCount(prev => Math.max(0, prev - 1));
        else if (wasRead && !nowRead) setCount(prev => prev + 1);
      })
      .subscribe();
    return () => { mounted = false; channel.unsubscribe(); };
  }, [user?.id]);

  return count;
};

interface Post {
  id: string;
  type: 'voice' | 'video' | 'story';
  user: User;
  content: {
    phrase?: string;
    translation?: string;
    audioWaveform?: number[];
    audioUrl?: string;
    videoThumbnail?: string;
    storyTitle?: string;
    duration?: string;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    validations: number;
    reposts: number;
    duets?: number;
    remixes?: number;
  };
  actions: {
    isLiked: boolean;
    isValidated: boolean;
    isReposted: boolean;
    needsValidation: boolean;
  };
  timeAgo: string;
  isAIGenerated?: boolean;
}

interface LiveStream {
  id: string;
  streamer_id: string;
  streamer_name: string;
  streamer_avatar: string;
  title: string;
  language: string;
  viewer_count: number;
  thumbnail_url?: string;
  is_live: boolean;
  started_at: string;
}



const EnhancedHomeScreen: React.FC<any> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'Following' | 'Discover' | 'Trending' | 'Live'>('Following');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const { user } = useAuth();

  // Fetch live streams from database
  const fetchLiveStreams = useCallback(async () => {
    try {
      const { data: liveStreamsData, error } = await supabase
        .from('live_streams')
        .select(`
          *,
          profiles!live_streams_streamer_id_fkey (
            id,
            full_name,
            username,
            avatar_url,
            primary_language
          )
        `)
        .eq('is_live', true)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching live streams:', error);
        return;
      }

      const formattedStreams: LiveStream[] = (liveStreamsData || []).map((stream) => {
        const streamer = stream.profiles;
        return {
          id: stream.id,
          streamer_id: stream.streamer_id,
          streamer_name: streamer?.full_name || 'Anonymous',
          streamer_avatar: streamer?.avatar_url ? '👤' : '👤', // Will be replaced with actual avatar
          title: stream.title,
          language: stream.language,
          viewer_count: stream.viewer_count || 0,
          thumbnail_url: stream.thumbnail_url,
          is_live: stream.is_live,
          started_at: stream.started_at,
        };
      });

      setLiveStreams(formattedStreams);
      console.log('Fetched live streams:', formattedStreams.length);
    } catch (error) {
      console.error('Error fetching live streams:', error);
    }
  }, [user]);

  // Fetch real voice and video clips with user information from database
  const fetchRealContent = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // Fetch voice clips with user information
      const { data: voiceClips, error: clipsError } = await supabase
        .from('voice_clips')
        .select(`
          *,
          profiles!voice_clips_user_id_fkey (
            id,
            full_name,
            username,
            primary_language,
            avatar_url,
            bio
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (clipsError) {
        console.error('Error fetching voice clips:', clipsError);
        return;
      }

      // Fetch video clips with user information
      const { data: videoClips, error: videosError } = await supabase
        .from('video_clips')
        .select(`
          *,
          profiles!video_clips_user_id_fkey (
            id,
            full_name,
            username,
            primary_language,
            avatar_url,
            bio
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (videosError) {
        console.error('Error fetching video clips:', videosError);
      }

      const voicePosts: Post[] = (voiceClips || []).map((clip) => {
          const user = clip.profiles;
          return {
            id: clip.id,
            type: 'voice' as const,
            user: {
              id: user?.id || 'unknown',
              name: user?.full_name || 'Anonymous',
              username: user?.username || 'user',
              avatar: '👤',
              avatarUrl: user?.avatar_url || undefined,
              language: user?.primary_language || 'English',
              isFollowing: false, // Will be updated below
              followers: Math.floor(Math.random() * 1000) + 10, // Random for demo
              isVerified: Math.random() > 0.7, // Random for demo
            },
            content: {
              phrase: clip.phrase || 'Audio clip',
              translation: clip.translation || '',
              audioWaveform: [20, 40, 60, 80, 60, 40, 70, 90, 50, 30, 60, 80, 40, 20, 50, 70], // Placeholder waveform
              audioUrl: clip.audio_url,
              duration: clip.duration ? `${Math.floor(clip.duration / 60)}:${(clip.duration % 60).toString().padStart(2, '0')}` : '0:00',
            },
            engagement: {
              likes: clip.likes_count || 0,
              comments: clip.comments_count || 0,
              shares: clip.shares_count || 0,
              validations: clip.validations_count || 0,
              reposts: 0,
              duets: clip.duets_count || 0,
              remixes: clip.remixes_count || 0,
            },
            actions: {
              isLiked: false, // Will be updated based on user's likes
              isValidated: clip.is_validated || false,
              isReposted: false, // Will be updated based on user's reposts
              needsValidation: !clip.is_validated,
            },
            timeAgo: getTimeAgo(clip.created_at),
            createdAt: clip.created_at as any,
          } as any;
        });

      const videoPosts: Post[] = (videoClips || []).map((clip) => {
        const user = clip.profiles;
        return {
          id: clip.id,
          type: 'video' as const,
          user: {
            id: user?.id || 'unknown',
            name: user?.full_name || 'Anonymous',
            username: user?.username || 'user',
            avatar: '👤',
            avatarUrl: user?.avatar_url || undefined,
            language: user?.primary_language || 'English',
            isFollowing: false,
            followers: Math.floor(Math.random() * 1000) + 10,
            isVerified: Math.random() > 0.7,
          },
          content: {
            phrase: clip.phrase || 'Video clip',
            translation: clip.translation || '',
            videoThumbnail: '🎬',
            duration: clip.duration ? `${Math.floor(clip.duration / 60)}:${(clip.duration % 60).toString().padStart(2, '0')}` : '0:00',
          },
          engagement: {
            likes: clip.likes_count || 0,
            comments: clip.comments_count || 0,
            shares: clip.shares_count || 0,
            validations: clip.validations_count || 0,
            reposts: 0,
            duets: clip.duets_count || 0,
            remixes: clip.remixes_count || 0,
          },
          actions: {
            isLiked: false,
            isValidated: clip.is_validated || false,
            isReposted: false,
            needsValidation: !clip.is_validated,
          },
          timeAgo: getTimeAgo(clip.created_at),
          createdAt: clip.created_at as any,
        } as any;
      });

      const combined: any[] = [...voicePosts, ...videoPosts];
      combined.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPosts(combined as Post[]);
      console.log('Fetched posts:', combined.length, `(voice ${voicePosts.length}, video ${videoPosts.length})`);
    } catch (error) {
      console.error('Error in fetchRealContent:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRealContent();
  }, [fetchRealContent]);

  // Fetch live streams when Live tab is active
  useEffect(() => {
    if (activeTab === 'Live') {
      fetchLiveStreams();
    }
  }, [activeTab, fetchLiveStreams]);

  // Real-time updates for live streams
  useEffect(() => {
    if (activeTab !== 'Live') return;

    const channel = supabase
      .channel('live-streams-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_streams' },
        (payload) => {
          console.log('Live stream change detected:', payload);
          // Refresh live streams when changes occur
          fetchLiveStreams();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [activeTab, fetchLiveStreams]);

  // Refresh when screen comes into focus (user returns from recording)
  useFocusEffect(
    useCallback(() => {
      fetchRealContent(true);
    }, [fetchRealContent])
  );

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Check follow status for current user
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || posts.length === 0) return;

      try {
        const { data: followData, error } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', user.id);

        if (error) {
          console.error('Error checking follow status:', error);
          return;
        }

        const followingIds = new Set(followData?.map(f => f.following_id) || []);

        // Update posts with correct follow status only if values change
        setPosts(prevPosts => {
          let changed = false;
          const updated = prevPosts.map(post => {
            const nextIsFollowing = followingIds.has(post.user.id);
            if (post.user.isFollowing !== nextIsFollowing) {
              changed = true;
              return {
                ...post,
                user: {
                  ...post.user,
                  isFollowing: nextIsFollowing,
                },
              } as typeof post;
            }
            return post;
          });
          return changed ? updated : prevPosts;
        });
      } catch (error) {
        console.error('Error in checkFollowStatus:', error);
      }
    };

    checkFollowStatus();
  }, [user, posts]);

  // Preload current user's likes to set isLiked
  useEffect(() => {
    const loadLikes = async () => {
      if (!user || posts.length === 0) return;
      try {
        const ids = posts.map(p => p.id);
        const { data, error } = await supabase
          .from('likes')
          .select('target_id')
          .eq('user_id', user.id)
          .eq('target_type', 'voice_clip')
          .in('target_id', ids);
        if (error) {
          console.error('Error loading likes:', error);
          return;
        }
        const likedIds = new Set((data || []).map(r => r.target_id));
        setPosts(prev => prev.map(post => ({
          ...post,
          actions: { ...post.actions, isLiked: likedIds.has(post.id) },
        })));
      } catch (e) {
        console.error('loadLikes exception:', e);
      }
    };
    loadLikes();
  }, [user, posts.length]);

  // Preload current user's validations to set isValidated
  useEffect(() => {
    const loadValidations = async () => {
      if (!user || posts.length === 0) return;
      try {
        const ids = posts.map(p => p.id);
        const { data, error } = await supabase
          .from('validations')
          .select('voice_clip_id')
          .eq('validator_id', user.id)
          .in('voice_clip_id', ids);
        if (error) {
          console.error('Error loading validations:', error);
          return;
        }
        const validatedIds = new Set((data || []).map(r => r.voice_clip_id));
        setPosts(prev => prev.map(post => ({
          ...post,
          actions: { ...post.actions, isValidated: validatedIds.has(post.id) },
        })));
      } catch (e) {
        console.error('loadValidations exception:', e);
      }
    };
    loadValidations();
  }, [user, posts.length]);

  // Live update counts and user state via realtime for visible clips
  useEffect(() => {
    if (posts.length === 0) return;
    const ids = posts.map(p => p.id);
    const channel = supabase
      .channel('likes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        (payload) => {
          const newRow: any = (payload as any).new || {};
          const oldRow: any = (payload as any).old || {};
          const targetId = newRow.target_id || oldRow.target_id;
          const targetType = newRow.target_type || oldRow.target_type;
          if (targetType !== 'voice_clip') return;
          if (!targetId || !ids.includes(targetId)) return;
          setPosts(prev => prev.map(post => {
            if (post.id !== targetId) return post;
            const delta = payload.eventType === 'INSERT' ? 1 : payload.eventType === 'DELETE' ? -1 : 0;
            return {
              ...post,
              engagement: {
                ...post.engagement,
                likes: Math.max(0, post.engagement.likes + delta),
              },
            };
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_clips' },
        (payload) => {
          const newRow: any = (payload as any).new || {};
          if (newRow.clip_type !== 'duet' || !newRow.original_clip_id) return;
          const originalId = newRow.original_clip_id as string;
          if (!ids.includes(originalId)) return;
          setPosts(prev => prev.map(post => post.id === originalId
            ? { ...post, engagement: { ...post.engagement, duets: (post.engagement.duets || 0) + 1 } }
            : post
          ));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'validations' },
        (payload) => {
          const newRow: any = (payload as any).new || {};
          const clipId = newRow.voice_clip_id as string;
          if (!clipId || !ids.includes(clipId)) return;
          setPosts(prev => prev.map(post => {
            if (post.id !== clipId) return post;
            return {
              ...post,
              engagement: { ...post.engagement, validations: (post.engagement.validations || 0) + 1 },
              actions: { ...post.actions, isValidated: newRow.validator_id === user?.id ? true : post.actions.isValidated },
            };
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'validations' },
        (payload) => {
          const oldRow: any = (payload as any).old || {};
          const clipId = oldRow.voice_clip_id as string;
          if (!clipId || !ids.includes(clipId)) return;
          setPosts(prev => prev.map(post => {
            if (post.id !== clipId) return post;
            return {
              ...post,
              engagement: { ...post.engagement, validations: Math.max(0, (post.engagement.validations || 0) - 1) },
              actions: { ...post.actions, isValidated: oldRow.validator_id === user?.id ? false : post.actions.isValidated },
            };
          }));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [posts.map(p => p.id).join(',')]);

  const handleLike = async (postId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to like posts');
      return;
    }

    // Find current state
    const targetPost = posts.find(p => p.id === postId);
    if (!targetPost) return;
    const currentlyLiked = targetPost.actions.isLiked;

    // Optimistic UI update
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? {
            ...post,
            actions: { ...post.actions, isLiked: !currentlyLiked },
            engagement: {
              ...post.engagement,
              likes: !currentlyLiked ? post.engagement.likes + 1 : Math.max(0, post.engagement.likes - 1),
            },
          }
        : post
    ));

    try {
      if (!currentlyLiked) {
        // Like → insert
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            target_type: 'voice_clip',
            target_id: postId,
          });
        if (error) throw error;
      } else {
        // Unlike → delete
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('target_type', 'voice_clip')
          .eq('target_id', postId);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Like toggle failed', e);
      // Revert optimistic UI on failure
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? {
              ...post,
              actions: { ...post.actions, isLiked: currentlyLiked },
              engagement: {
                ...post.engagement,
                likes: currentlyLiked ? post.engagement.likes + 1 : Math.max(0, post.engagement.likes - 1),
              },
            }
          : post
      ));
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleValidate = async (postId: string, isCorrect: boolean) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to validate clips');
      return;
    }

    // Optimistic UI using functional update
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? {
            ...post,
            actions: { ...post.actions, isValidated: true },
            engagement: {
              ...post.engagement,
              validations: post.engagement.validations + 1,
            },
          }
        : post
    ));

    try {
      const { error } = await supabase
        .from('validations')
        .insert({
          voice_clip_id: postId,
          validator_id: user.id,
          validation_type: 'pronunciation',
          rating: isCorrect ? 4 : 2,
          is_approved: isCorrect,
        });
      if (error) throw error;

      Alert.alert(
        'Validation Submitted',
        `Thank you for validating this pronunciation as ${isCorrect ? 'correct' : 'needs improvement'}.`
      );
    } catch (e) {
      // Revert on error
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? {
              ...post,
              actions: { ...post.actions, isValidated: false },
              engagement: {
                ...post.engagement,
                validations: Math.max(0, post.engagement.validations - 1),
              },
            }
          : post
      ));
      Alert.alert('Error', 'Failed to submit validation');
    } finally {
      setShowMoreOptions(null);
    }
  };

  const handleRepost = (postId: string) => {
    setPosts(posts.map(post =>
      post.id === postId
        ? {
            ...post,
            actions: { ...post.actions, isReposted: !post.actions.isReposted },
            engagement: {
              ...post.engagement,
              reposts: post.actions.isReposted
                ? post.engagement.reposts - 1
                : post.engagement.reposts + 1
            }
          }
        : post
    ));

    Alert.alert('Reposted!', 'Post shared to your profile');
  };

  const handleAudioPlay = async (postId: string, audioUrl?: string, phrase?: string) => {
    if (!audioUrl) {
      Alert.alert('No Audio', 'This post does not have an audio file');
      return;
    }

    try {
      // If this post is already playing, stop it
      if (currentPlayingId === postId && sound) {
        await sound.stopAsync();
        setCurrentPlayingId(null);
        return;
      }

      // Stop any currently playing audio
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      setIsLoadingAudio(postId);

      // Get playable URL
      const resolvedUrl = await getPlayableAudioUrl(audioUrl);
      if (!resolvedUrl) {
        setIsLoadingAudio(null);
        Alert.alert('Error', 'Failed to load audio file');
        return;
      }

      // Create and play the audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: resolvedUrl },
        { shouldPlay: true }
      );

      setSound(newSound);
      setCurrentPlayingId(postId);
      setIsLoadingAudio(null);

      // Set up cleanup when audio finishes
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setCurrentPlayingId(null);
          setSound(null);
        }
      });

      console.log('Playing audio:', resolvedUrl);
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsLoadingAudio(null);
      Alert.alert('Error', 'Failed to play audio file');
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to follow users');
      return;
    }

    try {
      // Update local state immediately for better UX
      setPosts(posts.map(post =>
        post.user.id === userId
          ? {
              ...post,
              user: {
                ...post.user,
                isFollowing: !post.user.isFollowing,
                followers: post.user.isFollowing
                  ? post.user.followers - 1
                  : post.user.followers + 1
              }
            }
          : post
      ));

      // Update database
      if (posts.find(p => p.user.id === userId)?.user.isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (error) {
          console.error('Error unfollowing:', error);
          // Revert local state on error
          setPosts(posts.map(post =>
            post.user.id === userId
              ? {
                  ...post,
                  user: {
                    ...post.user,
                    isFollowing: true,
                    followers: post.user.followers + 1
                  }
                }
              : post
          ));
        }
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: userId
          });

        if (error) {
          console.error('Error following:', error);
          // Revert local state on error
          setPosts(posts.map(post =>
            post.user.id === userId
              ? {
                  ...post,
                  user: {
                    ...post.user,
                    isFollowing: false,
                    followers: post.user.followers - 1
                  }
                }
              : post
          ));
        }
      }
    } catch (error) {
      console.error('Error in handleFollow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const CreatePostModal = () => (
    <Modal
      visible={showCreateModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackground}
          onPress={() => setShowCreateModal(false)}
        />
        <View style={[styles.createModalContent, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.createModalTitle}>Create New Post</Text>

          <ScrollView
            style={styles.createModalScroll}
            contentContainerStyle={styles.createModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('CreateStory');
            }}
          >
            <View style={[styles.createOptionIcon, styles.blueIcon]}>
              <Ionicons name="images" size={24} color="#3B82F6" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Create Story</Text>
              <Text style={styles.createOptionDescription}>Combine clips, text and media</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('RecordVoice', { mode: 'record' });
            }}
          >
            <View style={styles.createOptionIcon}>
              <Ionicons name="mic" size={24} color="#FF8A00" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Record Audio</Text>
              <Text style={styles.createOptionDescription}>Record audio in your local language</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('RecordVoice', { mode: 'upload' });
            }}
          >
            <View style={styles.createOptionIcon}>
              <Ionicons name="cloud-upload" size={24} color="#FF8A00" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Upload Audio</Text>
              <Text style={styles.createOptionDescription}>Upload audio from your device</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('RecordVideo', { mode: 'record' });
            }}
          >
            <View style={[styles.createOptionIcon, styles.purpleIcon]}>
              <Ionicons name="videocam" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Record Video</Text>
              <Text style={styles.createOptionDescription}>Record video content</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('RecordVideo', { mode: 'upload' });
            }}
          >
            <View style={[styles.createOptionIcon, styles.purpleIcon]}>
              <Ionicons name="cloud-upload" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Upload Video</Text>
              <Text style={styles.createOptionDescription}>Upload video from your device</Text>
            </View>
          </TouchableOpacity>



          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('LiveStream', { isHost: true });
            }}
          >
            <View style={[styles.createOptionIcon, styles.redIcon]}>
              <Ionicons name="radio" size={24} color="#EF4444" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Go Live</Text>
              <Text style={styles.createOptionDescription}>Start live streaming</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('TurnVerse');
            }}
          >
            <View style={[styles.createOptionIcon, styles.greenIcon]}>
              <Ionicons name="game-controller" size={24} color="#10B981" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>Start TurnVerse</Text>
              <Text style={styles.createOptionDescription}>Create interactive language games (up to 6 players)</Text>
            </View>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const ShareModal = ({ postId }: { postId: string }) => (
    <Modal
      visible={showShareModal === postId}
      transparent
      animationType="fade"
      onRequestClose={() => setShowShareModal(null)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackground}
          onPress={() => setShowShareModal(null)}
        />
        <View style={[styles.shareModalContent, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.shareModalTitle}>Share Post</Text>

          <TouchableOpacity
            style={styles.shareOption}
            onPress={() => {
              setShowShareModal(null);
              Alert.alert('Shared!', 'Post shared to your story');
            }}
          >
            <Ionicons name="add-circle" size={24} color="#10B981" />
            <Text style={styles.shareOptionText}>Add to Story</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareOption}
            onPress={() => {
              setShowShareModal(null);
              navigation.navigate('ChatList');
            }}
          >
            <Ionicons name="paper-plane" size={24} color="#3B82F6" />
            <Text style={styles.shareOptionText}>Send in DM</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareOption}
            onPress={() => {
              setShowShareModal(null);
              Alert.alert('Shared!', 'Post shared to selected groups');
            }}
          >
            <Ionicons name="people" size={24} color="#8B5CF6" />
            <Text style={styles.shareOptionText}>Share to Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareOption}
            onPress={() => {
              setShowShareModal(null);
              Alert.alert('Copied!', 'Link copied to clipboard');
            }}
          >
            <Ionicons name="link" size={24} color="#6B7280" />
            <Text style={styles.shareOptionText}>Copy Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const MoreOptionsModal = ({ post }: { post: Post }) => (
    <Modal
      visible={showMoreOptions === post.id}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMoreOptions(null)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackground}
          onPress={() => setShowMoreOptions(null)}
        />
        <View style={[styles.moreOptionsContent, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              handleFollow(post.user.id);
              setShowMoreOptions(null);
            }}
          >
            <Ionicons
              name={post.user.isFollowing ? "person-remove" : "person-add"}
              size={20}
              color={post.user.isFollowing ? "#EF4444" : "#10B981"}
            />
            <Text style={styles.optionText}>
              {post.user.isFollowing ? `Unfollow ${post.user.name}` : `Follow ${post.user.name}`}
            </Text>
          </TouchableOpacity>

          {post.type === 'voice' && (
            <>
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setShowMoreOptions(null);
                  navigation.navigate('RecordVoice', {
                    isDuet: true,
                    originalClip: {
                      id: post.id,
                      phrase: post.content.phrase,
                      user: post.user.name,
                      language: post.user.language
                    }
                  });
                }}
              >
                <Ionicons name="people" size={20} color="#10B981" />
                <Text style={styles.optionText}>Create Duet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setShowMoreOptions(null);
                  navigation.navigate('Validation', {
                    clipId: post.id,
                    language: post.user.language
                  });
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />
                <Text style={styles.optionText}>Validate Pronunciation</Text>
              </TouchableOpacity>
            </>
          )}

          {post.actions.needsValidation && (
            <>
              <View style={styles.optionDivider} />
              <Text style={styles.validationHeader}>Quick Validation</Text>
              <TouchableOpacity
                style={[styles.optionItem, styles.validationOption]}
                onPress={() => handleValidate(post.id, true)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.optionText}>Mark as Correct</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionItem, styles.validationOption]}
                onPress={() => handleValidate(post.id, false)}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={styles.optionText}>Needs Improvement</Text>
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
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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

  const renderPost = (post: Post) => (
    <View key={post.id} style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
    <TouchableOpacity
      style={styles.userInfo}
      onPress={() => {
        // Check if this is the authenticated user's own post
        if (user && post.user.id === user.id) {
          // Navigate to their own profile tab
          navigation.navigate('Profile');
        } else {
          // Navigate to other user's profile
          navigation.navigate('UserProfile', { userId: post.user.id });
        }
      }}
    >
          <View style={styles.avatar}>
            {post.user.avatarUrl ? (
              <Image
                source={{ uri: post.user.avatarUrl }}
                style={styles.avatarImage}
                defaultSource={{ uri: 'https://via.placeholder.com/40x40/FF8A00/FFFFFF?text=👤' }}
                onError={() => console.log('Failed to load avatar for user:', post.user.username)}
              />
            ) : (
              <Text style={styles.avatarText}>{post.user.avatar}</Text>
            )}
          </View>
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{post.user.name}</Text>
              {post.user.isVerified && (
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              )}
              {/* Only show follow button if this is not the authenticated user's own post */}
              {user && post.user.id !== user.id && (
                <TouchableOpacity
                  style={!post.user.isFollowing ? styles.followButton : [styles.followButton, styles.followingButton]}
                  onPress={(e) => {
                    e.stopPropagation(); // Prevent navigation when clicking follow button
                    handleFollow(post.user.id);
                  }}
                >
                  <Text style={!post.user.isFollowing ? styles.followButtonText : [styles.followButtonText, styles.followingButtonText]}>
                    {post.user.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.postMeta}>
              <View style={styles.languageTag}>
                <Text style={styles.languageText}>{post.user.language}</Text>
              </View>
              <Text style={styles.timeAgo}>• {post.timeAgo}</Text>
              {post.isAIGenerated && (
                <View style={styles.aiTag}>
                  <Ionicons name="sparkles" size={12} color="#8B5CF6" />
                  <Text style={styles.aiTagText}>AI</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowMoreOptions(post.id)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <View style={styles.postContent}>
        {post.type === 'voice' && (
          <>
            <View style={styles.phraseContainer}>
              <Text
                style={styles.phrase}
                numberOfLines={2}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {extractOriginalPrompt(post.content.phrase || '')}
              </Text>
              <Text style={styles.translation}>{post.content.translation}</Text>
            </View>
            {post.content.audioWaveform && renderWaveform(post.content.audioWaveform)}
              <TouchableOpacity
                style={[styles.playButton, !post.content.audioUrl && styles.playButtonDisabled]}
                onPress={() => handleAudioPlay(post.id, post.content.audioUrl, post.content.phrase)}
                disabled={!post.content.audioUrl}
              >
                {isLoadingAudio === post.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : currentPlayingId === post.id ? (
                  <Ionicons
                    name="pause"
                    size={24}
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="play"
                    size={24}
                    color={post.content.audioUrl ? "#FFFFFF" : "#9CA3AF"}
                  />
                )}
              </TouchableOpacity>
          </>
        )}

        {post.type === 'video' && (
          <View style={styles.videoContainer}>
            <View style={styles.videoThumbnail}>
              <Text style={styles.videoThumbnailText}>{post.content.videoThumbnail}</Text>
              <TouchableOpacity style={styles.videoPlayButton}>
                <Ionicons name="play" size={32} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.videoDuration}>
                <Text style={styles.videoDurationText}>{post.content.duration}</Text>
              </View>
            </View>
            <View style={styles.videoInfo}>
              <Text style={styles.videoPhrase}>{extractOriginalPrompt(post.content.phrase || '')}</Text>
              <Text style={styles.videoTranslation}>{post.content.translation}</Text>
            </View>
          </View>
        )}

        {post.type === 'story' && (
          <View style={styles.storyContainer}>
            <View style={styles.storyThumbnail}>
              <Text style={styles.storyThumbnailText}>{post.content.videoThumbnail}</Text>
              <TouchableOpacity style={styles.storyPlayButton}>
                <Ionicons name="play" size={32} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.storyDuration}>
                <Text style={styles.storyDurationText}>{post.content.duration}</Text>
              </View>
            </View>
            <Text style={styles.storyTitle}>{post.content.storyTitle}</Text>
          </View>
        )}
      </View>

      {/* Likes summary */}
      {(post.engagement.likes > 0 || (post.engagement.duets ?? 0) > 0 || post.engagement.validations > 0) && (
        <View style={styles.likesSummaryRow}>
          {post.engagement.likes > 0 && (
            <View style={styles.summaryItem}>
              <Ionicons name="thumbs-up" size={14} color="#2563EB" />
              <Text style={styles.likesSummaryText}>{formatCount(post.engagement.likes)}</Text>
            </View>
          )}
          {(post.engagement.duets ?? 0) > 0 && (
            <View style={styles.summaryItem}>
              <Ionicons name="people" size={14} color="#374151" />
              <Text style={styles.likesSummaryText}>{formatCount(post.engagement.duets ?? 0)}</Text>
            </View>
          )}
          {post.engagement.validations > 0 && (
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={14} color="#D97706" />
              <Text style={styles.likesSummaryText}>{formatCount(post.engagement.validations)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(post.id)}
        >
          <Ionicons
            name={post.actions.isLiked ? "thumbs-up" : "thumbs-up-outline"}
            size={20}
            color={post.actions.isLiked ? "#2563EB" : "#6B7280"}
          />
          <Text style={[styles.actionText, post.actions.isLiked && styles.likedText]}>Like</Text>
        </TouchableOpacity>


        {(post.type === 'voice' || post.type === 'video') && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              navigation.navigate('RecordVoice', {
                isDuet: true,
                originalClip: {
                  id: post.id,
                  phrase: post.content.phrase,
                  user: post.user.name,
                  language: post.user.language,
                },
              });
            }}
            accessibilityLabel="Create Duet"
          >
            <Ionicons
              name="people"
              size={20}
              color="#6B7280"
            />
            <Text style={styles.actionText}>Duet</Text>
          </TouchableOpacity>
        )}
        {(post.type === 'voice' || post.type === 'video') && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate('Validation', {
                clipId: post.id,
                language: post.user.language,
              })
            }
          >
            <Ionicons
              name={post.actions.isValidated ? "checkmark-circle" : "checkmark-circle-outline"}
              size={20}
              color={post.actions.needsValidation ? "#F59E0B" : "#10B981"}
            />
            <Text style={styles.actionText}>Validate</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowShareModal(post.id)}
        >
          <Ionicons name="share-outline" size={20} color="#6B7280" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      <MoreOptionsModal post={post} />
      <ShareModal postId={post.id} />
    </View>
  );

  const badgeCount = 0; // Notifications disabled

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + height * 0.01 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Lingualink AI</Text>
           <View style={styles.headerActions}>
            <TouchableOpacity>
              <Ionicons name="search" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <View style={{ position: 'relative' }}>
                <Ionicons name="notifications" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['Following', 'Discover', 'Trending', 'Live'].map((tab) => (
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
            {tab === 'Live' && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'Live' ? (
        <View style={styles.content}>
          <View style={styles.liveSection}>
            <View style={styles.liveSectionHeader}>
              <Text style={styles.liveSectionTitle}>Live Now</Text>
            </View>

            {liveStreams.length > 0 ? (
              <FlatList
                data={liveStreams}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.liveStreamCard}
                    onPress={() => navigation.navigate('LiveViewer', {
                      roomId: item.id
                    })}
                  >
                    <View style={styles.liveStreamContent}>
                      <View style={styles.liveStreamAvatar}>
                        <Text style={styles.liveStreamAvatarText}>{item.streamer_avatar}</Text>
                        <View style={styles.liveIndicator}>
                          <View style={styles.liveDot} />
                        </View>
                      </View>

                      <View style={styles.liveStreamInfo}>
                        <Text style={styles.liveStreamTitle}>{item.title}</Text>
                        <Text style={styles.liveStreamStreamer}>{item.streamer_name}</Text>
                        <View style={styles.liveStreamMeta}>
                          <Text style={styles.liveStreamLanguage}>{item.language}</Text>
                          <Text style={styles.liveStreamViewers}>{item.viewer_count} watching</Text>
                        </View>
                      </View>

                      <View style={styles.liveStreamActions}>
                        <View style={styles.liveStreamBadge}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveStreamBadgeText}>LIVE</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.liveStreamsList, { paddingBottom: insets.bottom + 100 }]}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchLiveStreams()}
                    colors={['#FF8A00']}
                    tintColor="#FF8A00"
                  />
                }
              />
            ) : (
              <View style={styles.noLiveStreams}>
                <Text style={styles.noLiveStreamsEmoji}>📺</Text>
                <Text style={styles.noLiveStreamsTitle}>No Live Streams</Text>
                <Text style={styles.noLiveStreamsDesc}>Be the first to go live!</Text>
                <TouchableOpacity
                  style={styles.startFirstLiveButton}
                  onPress={() => navigation.navigate('LiveStream', { isHost: true })}
                >
                  <Ionicons name="videocam" size={20} color="#FFFFFF" />
                  <Text style={styles.startFirstLiveButtonText}>Start Your Stream</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ) : (
        <FlatList
          style={styles.content}
          data={isLoading ? [] : posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderPost(item)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRealContent(true)}
              colors={['#FF8A00']}
              tintColor="#FF8A00"
            />
          }
          ListEmptyComponent={() => {
            if (isLoading) {
              return (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading posts...</Text>
                </View>
              );
            }
            if (posts.length === 0) {
              return (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No posts yet</Text>
                  <Text style={styles.emptySubtext}>Create your first post or follow users to see content</Text>
                </View>
              );
            }
            return null;
          }}
        />
      )}

      {/* Floating Create Button */}
      <TouchableOpacity
        style={[styles.createButton, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <CreatePostModal />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
  },
  notifBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: width * 0.05,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    justifyContent: 'space-around',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
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
  liveIndicator: {
    marginLeft: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  content: {
    flex: 1,
    paddingHorizontal: width * 0.05,
    paddingTop: 16,
  },
  liveSection: {
    marginBottom: 20,
  },
  liveSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  startLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  startLiveButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  liveStreamsList: {
    paddingBottom: 20,
  },
  liveStreamCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  liveStreamContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  liveStreamAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  liveStreamAvatarText: {
    fontSize: 32,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    textAlign: 'center',
    lineHeight: 48,
  },
  liveStreamInfo: {
    flex: 1,
  },
  liveStreamTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  liveStreamStreamer: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  liveStreamMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveStreamLanguage: {
    fontSize: 12,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  liveStreamViewers: {
    fontSize: 12,
    color: '#6B7280',
  },
  liveStreamActions: {
    alignItems: 'center',
  },
  liveStreamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  liveStreamBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  noLiveStreams: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noLiveStreamsEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  noLiveStreamsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  noLiveStreamsDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  startFirstLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startFirstLiveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  liveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  liveCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveCardEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  liveCardInfo: {
    flex: 1,
  },
  liveCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  liveCardDesc: {
    fontSize: 14,
    color: '#6B7280',
  },
  liveCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveCardBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  postCard: {
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
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  userInfoPressed: {
    backgroundColor: '#F3F4F6',
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
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 4,
  },
  followButton: {
    backgroundColor: '#FF8A00',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  followButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  followingButton: {
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  followingButtonText: {
    color: '#6B7280',
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageTag: {
    backgroundColor: '#FEF3E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  languageText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '500',
  },
  timeAgo: {
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 8,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiTagText: {
    fontSize: 10,
    color: '#8B5CF6',
    fontWeight: '500',
    marginLeft: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  postContent: {
    marginBottom: 16,
  },
  likesSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  likesSummaryText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  summaryDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 8,
  },
  phraseContainer: {
    marginBottom: 16,
    alignItems: 'center',
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
  },
  playButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  videoContainer: {
    alignItems: 'center',
  },
  videoThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  videoThumbnailText: {
    fontSize: 60,
  },
  videoPlayButton: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoDurationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  videoInfo: {
    alignItems: 'center',
  },
  videoPhrase: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  videoTranslation: {
    fontSize: 14,
    color: '#6B7280',
  },
  storyContainer: {
    alignItems: 'center',
  },
  storyThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  storyThumbnailText: {
    fontSize: 60,
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
  storyDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  storyDurationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  likedText: {
    color: '#2563EB',
  },
  repostedText: {
    color: '#10B981',
  },
  createButton: {
    position: 'absolute',
    bottom: 20,
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
    paddingBottom: 16,
  },
  createModalScroll: {
    maxHeight: 520,
  },
  createModalScrollContent: {
    paddingBottom: 24,
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
  greenIcon: {
    backgroundColor: '#ECFDF5',
  },
  redIcon: {
    backgroundColor: '#FEE2E2',
  },
  blueIcon: {
    backgroundColor: '#EFF6FF',
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
  shareModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  shareOptionText: {
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 16,
    fontWeight: '500',
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

export default EnhancedHomeScreen;