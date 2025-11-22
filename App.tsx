// App.tsx - Updated with new navigation routes
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthProvider';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, Modal, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Device from 'expo-device';
// import { deepLinkHandler } from './src/utils/deepLinking'; // No longer used; rely on Navigation linking prop
import { supabase } from './src/supabaseClient';

// Import all screens

import WelcomeScreen from './src/screens/WelcomeScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import SignInScreen from './src/screens/SignInScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import NewPasswordScreen from './src/screens/NewPasswordScreen';
import EnhancedHomeScreen from './src/screens/EnhancedHomeScreen';
import RecordVoiceScreen from './src/screens/RecordVoiceScreen';
import RecordVideoScreen from './src/screens/RecordVideoScreen';
import TellStoryScreen from './src/screens/TellStoryScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import RewardsScreen from './src/screens/RewardsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ValidationScreen from './src/screens/ValidationScreen';

// Import new Chat screens
import ChatListScreen from './src/screens/ChatListScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';
import VoiceCallScreen from './src/screens/VoiceCallScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import GroupCallScreen from './src/screens/GroupCallScreen';

// Import new feature screens
import TurnVerseScreen from './src/screens/TurnVerseScreen';
import LiveStreamingScreen from './src/screens/LiveStreamingScreen';
import LiveViewerScreen from './src/screens/LiveViewerScreen';
import ContactDiscoveryScreen from './src/screens/ContactDiscoveryScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import AuthCallbackScreen from './src/screens/AuthCallbackScreen';
import InterestSelectionScreen from './src/screens/InterestSelectionScreen';
import CreateStoryScreen from './src/screens/CreateStoryScreen';
import StoryViewScreen from './src/screens/StoryViewScreen';

// Import navigation types
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Define shared contact interface
interface Contact {
  id: string;
  name: string;
  username: string;
  avatar: string;
  language: string;
  isOnline: boolean;
}

interface Group {
  id: string;
  name: string;
  description: string;
  avatar: string;
  members: number;
  language: string;
  lastActivity: string;
  isPrivate: boolean;
  unreadCount: number;
}

interface Story {
  id: string;
  user: Contact;
  thumbnail: string;
  timestamp: string;
  viewed: boolean;
}

export type RootStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  SignIn: undefined;
  ForgotPassword: undefined;
  NewPassword: { resetCode?: string } | undefined;
  VerifyEmail: { email?: string } | undefined;
  OTPVerification: { email: string };
  AuthCallback: { code?: string } | undefined;
  InterestSelection: undefined;
  MainTabs: undefined;
  RecordVoice: {
    mode?: 'record' | 'upload';
    isDuet?: boolean;
    originalClip?: {
      id: string;
      phrase: string;
      user: string;
      language: string;
    };
  } | undefined;
  RecordVideo: {
    mode?: 'record' | 'upload';
    isDuet?: boolean;
    originalClip?: {
      id: string;
      phrase: string;
      user: string;
      language: string;
    };
  } | undefined;
  TellStory: undefined;
  Settings: undefined;
  UserProfile: {
    userId: string;
  };
  Validation: {
    clipId?: string;
    language?: string;
  } | undefined;
  Rewards: undefined;

  // Chat routes
  Groups: undefined;
  ChatDetail: {
    contact: Contact;
  };
  VoiceCall: {
    contact: Contact;
  };
  VideoCall: {
    contact: Contact;
  };
  GroupChat: {
    group: Group;
  };
  GroupCall: {
    group: Group;
  };

  // New feature routes
  TurnVerse: undefined;
  WordChain: undefined;
  StartLive: undefined;
  LiveStream: {
    isHost?: boolean;
    roomId?: string;
  };
  LiveViewer: {
    roomId: string;
  };
  CreateGroup: undefined;
  CreateStory: undefined;
  StoryView: {
    story: Story;
  };
  ContactDiscovery: undefined;
};

export type TabParamList = {
  Home: undefined;
  Library: undefined;
  Create: undefined;
  Chat: undefined;
  Profile: undefined;
};

// Export navigation prop types for use in components
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Create a context for the modal
const CreateModalContext = React.createContext<{
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
}>({
  showCreateModal: false,
  setShowCreateModal: () => {},
});

// Empty component for Create tab since we're using modal
const CreateComponent = () => {
  return <View />;
};

// Enhanced Create Modal Component
const CreateModal = () => {
  const navigation = useNavigation<any>();
  const { showCreateModal, setShowCreateModal } = React.useContext(CreateModalContext);

  return (
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
              <Text style={styles.createOptionTitle}>Play TurnVerse</Text>
              <Text style={styles.createOptionDescription}>Join language learning games</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createOption}
            onPress={() => {
              setShowCreateModal(false);
              navigation.navigate('Rewards');
            }}
          >
            <View style={[styles.createOptionIcon, styles.blueIcon]}>
              <Ionicons name="trophy" size={24} color="#3B82F6" />
            </View>
            <View style={styles.createOptionContent}>
              <Text style={styles.createOptionTitle}>View Rewards</Text>
              <Text style={styles.createOptionDescription}>Check leaderboard and rewards</Text>
            </View>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const MainTabs = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState<number>(0);

  // Compute unread badge count using RPC and keep it updated via realtime
  useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase.rpc('get_conversations_with_unread');
        if (!mounted) return;
        if (error) return;
        const total = (data || []).reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0);
        setUnreadTotal(total);
      } catch {}
    };
    fetchUnread();
    const channel = supabase
      .channel('tabs-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new;
        if (m.sender_id !== user?.id) {
          setUnreadTotal(prev => prev + 1);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads' }, (payload: any) => {
        const r = payload.new;
        if (r.user_id === user?.id) {
          setUnreadTotal(prev => Math.max(0, prev - 1));
        }
      })
      .subscribe();
    return () => { mounted = false; channel.unsubscribe(); };
  }, [user?.id]);

  return (
    <CreateModalContext.Provider value={{ showCreateModal, setShowCreateModal }}>
      <Tab.Navigator
        key={user?.id || 'tabs'}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Library') {
              iconName = focused ? 'library' : 'library-outline';
            } else if (route.name === 'Create') {
              iconName = 'add';
            } else if (route.name === 'Chat') {
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            } else {
              iconName = 'home-outline';
            }

            if (route.name === 'Create') {
              return (
                <View style={styles.createTabIcon}>
                  <Ionicons name={iconName} size={24} color="white" />
                </View>
              );
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#FF8A00',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E5E5',
            height: 80,
            paddingBottom: 20,
            paddingTop: 10,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        })}
        screenListeners={({ navigation }) => ({
          tabPress: (e) => {
            if (e.target?.includes('Create')) {
              e.preventDefault();
              setShowCreateModal(true);
            }
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={EnhancedHomeScreen}
          options={{ tabBarLabel: 'Home' }}
        />
        <Tab.Screen
          name="Library"
          component={LibraryScreen}
          options={{ tabBarLabel: 'Library' }}
        />
        <Tab.Screen
          name="Create"
          component={CreateComponent}
          options={{
            tabBarLabel: '',
          }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatListScreen}
          options={{
            tabBarLabel: 'Chat',
            tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarLabel: 'Profile' }}
        />
      </Tab.Navigator>
      <CreateModal />
    </CreateModalContext.Provider>
  );
};

const AuthStack = () => (
  <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
        {/* Authentication Screens */}
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="NewPassword"
          component={NewPasswordScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="AuthCallback"
          component={AuthCallbackScreen}
          options={{
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="VerifyEmail"
          component={VerifyEmailScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

  </Stack.Navigator>
);

const MainStack = ({ initialRouteName = 'MainTabs' as keyof RootStackParamList }: { initialRouteName?: keyof RootStackParamList }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{
            gestureEnabled: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="InterestSelection"
          component={InterestSelectionScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Content Creation Screens */}
        <Stack.Screen
          name="RecordVoice"
          component={RecordVoiceScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="RecordVideo"
          component={RecordVideoScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="TellStory"
          component={TellStoryScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />

        {/* Validation Screen */}
        <Stack.Screen
          name="Validation"
          component={ValidationScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Settings Screen */}
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />


        {/* Rewards Screen */}
        <Stack.Screen
          name="Rewards"
          component={RewardsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Chat Screens */}
        <Stack.Screen
          name="Groups"
          component={GroupsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ChatDetail"
          component={ChatDetailScreen}
          options={{
            animation: 'slide_from_right',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="GroupChat"
          component={GroupChatScreen}
          options={{
            animation: 'slide_from_right',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="VoiceCall"
          component={VoiceCallScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="VideoCall"
          component={VideoCallScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="GroupCall"
          component={GroupCallScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />

        {/* Games and Entertainment */}
        <Stack.Screen
          name="TurnVerse"
          component={TurnVerseScreen}
          options={{
            animation: 'slide_from_right',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="WordChain"
          component={TurnVerseScreen} // Can reuse or create separate WordChainScreen
          options={{
            animation: 'slide_from_right',
            headerShown: false,
          }}
        />

        {/* Live Streaming */}
        <Stack.Screen
          name="StartLive"
          component={LiveStreamingScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="LiveStream"
          component={LiveStreamingScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="LiveViewer"
          component={LiveViewerScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />

        {/* Social Features */}
        <Stack.Screen
          name="ContactDiscovery"
          component={ContactDiscoveryScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Story Features */}
        <Stack.Screen
          name="CreateStory"
          component={CreateStoryScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="StoryView"
          component={StoryViewScreen}
          options={{
            animation: 'fade',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />

        {/* Group Management */}
        <Stack.Screen
          name="CreateGroup"
          component={ContactDiscoveryScreen} // Can create separate CreateGroupScreen
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
  </Stack.Navigator>
);


const AuthGate = () => {
  const { session, loading } = useAuth();
  const [checking, setChecking] = React.useState(false);
  const [onboardingComplete, setOnboardingComplete] = React.useState<boolean | null>(null);


  const checkOnboarding = React.useCallback(async () => {
    if (!session) {
      setOnboardingComplete(null);
      return;
    }
    setChecking(true);
    try {
      // Try profiles flag first
      const { data, error } = await supabase
        .from('profiles')
        .select('has_completed_onboarding')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('AuthGate: profile fetch error', error);
        setOnboardingComplete(false);
        return;
      }

      let completed = data?.has_completed_onboarding === true;

      // Fallback: if flag missing, infer from user_interests or interests array
      if (!completed) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('interests')
          .eq('id', session.user.id)
          .single();

        if (!profileError && profileData?.interests && Array.isArray(profileData.interests) && profileData.interests.length > 0) {
          completed = true;
        }
      }

      setOnboardingComplete(completed);
    } catch (e) {
      console.error('AuthGate: onboarding check failed', e);
      setOnboardingComplete(false);
    } finally {
      setChecking(false);
    }
  }, [session]);

  React.useEffect(() => {
    if (session && !loading) {
      checkOnboarding();
    }
  }, [session, loading, checkOnboarding]);


  // Listen for changes to the profiles table to detect when onboarding is completed
  React.useEffect(() => {
    if (!session) return;

    const subscription = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          console.log('Profile updated:', payload);
          if (payload.new.has_completed_onboarding === true) {
            setOnboardingComplete(true);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session]);

  if (loading || (session && (checking || onboardingComplete === null))) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#FF8A00" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading...</Text>
      </View>
    );
  }

  // No session → auth flow
  if (!session) {
    return <AuthStack key="auth" />;
  }

  // Session present; route based on onboarding
  if (onboardingComplete === false) {
    return <MainStack initialRouteName="InterestSelection" />;
  }

  // Onboarding complete → main app
  return <MainStack key={session.user?.id || 'main'} />;
};

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [navigationReady, setNavigationReady] = useState(false);

  // Deep linking configuration
  const linking = {
    prefixes: ['exp://', 'exp+lingualink://', 'lingualink://'],
    config: {
      screens: {
        // Auth stack screens (shown when not authenticated)
        Welcome: 'welcome',
        SignUp: 'signup',
        SignIn: 'signin',
        ForgotPassword: 'forgot-password',
        NewPassword: 'new-password',
        VerifyEmail: 'verify-email',
        AuthCallback: {
          path: 'auth-callback',
          parse: {
            code: (code: string) => code,
            error: (error: string) => error,
          },
        },
        // Main stack screens (shown when authenticated)
        InterestSelection: 'interests',
        MainTabs: {
          path: 'main',
          screens: {
            Home: '',
            Library: 'library',
            Create: 'create',
            Chat: 'chat',
            Profile: 'profile',
          },
        },
        RecordVoice: 'record-voice',
        RecordVideo: 'record-video',
        TellStory: 'tell-story',
        Validation: 'validation',
        Settings: 'settings',
        Rewards: 'rewards',
        Groups: 'groups',
        ChatDetail: {
          path: 'chat/:id',
          parse: {
            id: (id: string) => id,
          },
        },
        GroupChat: {
          path: 'group/:id',
          parse: {
            id: (id: string) => id,
          },
        },
        VoiceCall: {
          path: 'call/voice/:id',
          parse: {
            id: (id: string) => id,
          },
        },
        VideoCall: {
          path: 'call/video/:id',
          parse: {
            id: (id: string) => id,
          },
        },
        GroupCall: {
          path: 'call/group/:id',
          parse: {
            id: (id: string) => id,
          },
        },
        TurnVerse: 'games/turnverse',
        WordChain: 'games/wordchain',
        StartLive: 'live/start',
        LiveStream: {
          path: 'live/:roomId',
          parse: {
            roomId: (roomId: string) => roomId,
          },
        },
        LiveViewer: {
          path: 'live/viewer/:roomId',
          parse: {
            roomId: (roomId: string) => roomId,
          },
        },
        ContactDiscovery: 'discover',
        UserProfile: {
          path: 'user/:userId',
          parse: {
            userId: (userId: string) => userId,
          },
        },
        CreateStory: 'create-story',
        StoryView: {
          path: 'story/:storyId',
          parse: {
            storyId: (storyId: string) => storyId,
          },
        },
        CreateGroup: 'create-group',
      },
    },
    // Enable async state resolution for conditional stacks
    async getInitialURL() {
      const url = await Linking.getInitialURL();
      if (url != null) {
        return url;
      }
    },
    subscribe(listener: (url: string) => void) {
      const onReceiveURL = ({ url }: { url: string }) => {
        listener(url);
      };
      const subscription = Linking.addEventListener('url', onReceiveURL);
      return () => {
        subscription.remove();
      };
    },
  };

  return (
    <AuthProvider>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        onReady={() => setNavigationReady(true)}
      >
        <AuthGate />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  createTabIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FF8A00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF8A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    lineHeight: 18,
  },
});