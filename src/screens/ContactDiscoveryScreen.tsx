// src/screens/ContactDiscoveryScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Dimensions,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface SuggestedUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  language: string;
  followers: number;
  mutualFriends: number;
  isFollowing: boolean;
  isVerified: boolean;
  bio: string;
  posts: number;
  reason: string;
  recentActivity: string;
}

interface InfluentialUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  language: string;
  followers: number;
  isFollowing: boolean;
  isVerified: boolean;
  specialty: string;
  engagement: number;
  weeklyViews: number;
}

const mockSuggestedUsers: SuggestedUser[] = [
  {
    id: '1',
    name: 'Chioma Adebayo',
    username: 'chioma_igbo',
    avatar: '👩🏾‍🏫',
    language: 'Igbo',
    followers: 2340,
    mutualFriends: 5,
    isFollowing: false,
    isVerified: true,
    bio: 'Igbo language teacher | Cultural enthusiast 🇳🇬',
    posts: 123,
    reason: 'Popular in your area',
    recentActivity: 'Posted 2 hours ago',
  },
  {
    id: '2',
    name: 'Tunde Yoruba',
    username: 'tunde_teacher',
    avatar: '👨🏾‍🎓',
    language: 'Yoruba',
    followers: 1890,
    mutualFriends: 3,
    isFollowing: false,
    isVerified: false,
    bio: 'Teaching Yoruba to the world 🌍',
    posts: 89,
    reason: 'Similar interests',
    recentActivity: 'Active yesterday',
  },
  {
    id: '3',
    name: 'Fatima Hassan',
    username: 'fatima_hausa',
    avatar: '👩🏾‍💼',
    language: 'Hausa',
    followers: 3240,
    mutualFriends: 8,
    isFollowing: false,
    isVerified: true,
    bio: 'Hausa storyteller | Northern Nigerian culture',
    posts: 156,
    reason: 'Followed by friends',
    recentActivity: 'Live now',
  },
];

const mockInfluentialUsers: InfluentialUser[] = [
  {
    id: '1',
    name: 'Dr. Ngozi Okafor',
    username: 'dr_ngozi',
    avatar: '👩🏾‍⚕️',
    language: 'Multi-language',
    followers: 45600,
    isFollowing: false,
    isVerified: true,
    specialty: 'Language Preservation',
    engagement: 89,
    weeklyViews: 125000,
  },
  {
    id: '2',
    name: 'Adekunle Gold',
    username: 'adekunle_musician',
    avatar: '👨🏾‍🎤',
    language: 'Yoruba',
    followers: 89400,
    isFollowing: false,
    isVerified: true,
    specialty: 'Music & Culture',
    engagement: 95,
    weeklyViews: 340000,
  },
];

const ContactDiscoveryScreen: React.FC<any> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'Suggested' | 'Influencers' | 'Search' | 'Sync'>('Suggested');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState(mockSuggestedUsers);
  const [influentialUsers, setInfluentialUsers] = useState(mockInfluentialUsers);
  const [searchResults, setSearchResults] = useState<SuggestedUser[]>([]);

  const handleFollow = (userId: string, type: 'suggested' | 'influential') => {
    if (type === 'suggested') {
      setSuggestedUsers(users =>
        users.map(user =>
          user.id === userId
            ? {
                ...user,
                isFollowing: !user.isFollowing,
                followers: user.isFollowing ? user.followers - 1 : user.followers + 1
              }
            : user
        )
      );
    } else {
      setInfluentialUsers(users =>
        users.map(user =>
          user.id === userId
            ? {
                ...user,
                isFollowing: !user.isFollowing,
                followers: user.isFollowing ? user.followers - 1 : user.followers + 1
              }
            : user
        )
      );
    }
  };

  const performSearch = () => {
    if (searchQuery.trim()) {
      // Simulate search results
      const results = mockSuggestedUsers.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.language.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const syncContacts = () => {
    Alert.alert(
      'Sync Contacts',
      'Allow Lingualink AI to access your contacts to find friends who are already using the app?',
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Allow',
          onPress: () => {
            Alert.alert('Contacts Synced!', 'Found 12 friends on Lingualink AI');
          },
        },
      ]
    );
  };

  const renderSuggestedUser = ({ item }: { item: SuggestedUser }) => (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('UserProfile', { user: item })}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.avatar}</Text>
          </View>
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{item.name}</Text>
              {item.isVerified && (
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              )}
            </View>
            <Text style={styles.userUsername}>@{item.username}</Text>
            <View style={styles.userMeta}>
              <View style={styles.languageTag}>
                <Text style={styles.languageText}>{item.language}</Text>
              </View>
              <Text style={styles.metaText}>• {item.followers.toLocaleString()} followers</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.followButton,
            item.isFollowing && styles.followingButton
          ]}
          onPress={() => handleFollow(item.id, 'suggested')}
        >
          <Text style={[
            styles.followButtonText,
            item.isFollowing && styles.followingButtonText
          ]}>
            {item.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.userBio}>{item.bio}</Text>

      <View style={styles.userStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{item.posts}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{item.mutualFriends}</Text>
          <Text style={styles.statLabel}>Mutual</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.reasonText}>{item.reason}</Text>
          <Text style={styles.activityText}>{item.recentActivity}</Text>
        </View>
      </View>
    </View>
  );

  const renderInfluentialUser = ({ item }: { item: InfluentialUser }) => (
    <View style={styles.influencerCard}>
      <View style={styles.influencerHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('UserProfile', { user: item })}
        >
          <View style={[styles.avatar, styles.influencerAvatar]}>
            <Text style={styles.avatarText}>{item.avatar}</Text>
          </View>
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{item.name}</Text>
              {item.isVerified && (
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              )}
              <View style={styles.influencerBadge}>
                <Text style={styles.influencerBadgeText}>TOP</Text>
              </View>
            </View>
            <Text style={styles.userUsername}>@{item.username}</Text>
            <Text style={styles.specialtyText}>{item.specialty}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.followButton,
            item.isFollowing && styles.followingButton
          ]}
          onPress={() => handleFollow(item.id, 'influential')}
        >
          <Text style={[
            styles.followButtonText,
            item.isFollowing && styles.followingButtonText
          ]}>
            {item.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.influencerStats}>
        <View style={styles.influencerStatItem}>
          <Text style={styles.influencerStatNumber}>
            {item.followers > 1000 ? `${(item.followers / 1000).toFixed(1)}K` : item.followers}
          </Text>
          <Text style={styles.influencerStatLabel}>Followers</Text>
        </View>
        <View style={styles.influencerStatItem}>
          <Text style={styles.influencerStatNumber}>{item.engagement}%</Text>
          <Text style={styles.influencerStatLabel}>Engagement</Text>
        </View>
        <View style={styles.influencerStatItem}>
          <Text style={styles.influencerStatNumber}>
            {item.weeklyViews > 1000 ? `${(item.weeklyViews / 1000).toFixed(0)}K` : item.weeklyViews}
          </Text>
          <Text style={styles.influencerStatLabel}>Weekly Views</Text>
        </View>
      </View>
    </View>
  );

  const renderSyncSection = () => (
    <View style={styles.syncSection}>
      <View style={styles.syncCard}>
        <Ionicons name="people" size={48} color="#FF8A00" />
        <Text style={styles.syncTitle}>Find Your Friends</Text>
        <Text style={styles.syncDescription}>
          Sync your contacts to find friends who are already using Lingualink AI
        </Text>
        <TouchableOpacity style={styles.syncButton} onPress={syncContacts}>
          <Text style={styles.syncButtonText}>Sync Contacts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.syncCard}>
        <Ionicons name="share-social" size={48} color="#10B981" />
        <Text style={styles.syncTitle}>Invite Friends</Text>
        <Text style={styles.syncDescription}>
          Invite your friends to join you on your language learning journey
        </Text>
        <TouchableOpacity style={[styles.syncButton, styles.inviteButton]}>
          <Text style={[styles.syncButtonText, styles.inviteButtonText]}>
            Send Invites
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.syncCard}>
        <Ionicons name="scan" size={48} color="#8B5CF6" />
        <Text style={styles.syncTitle}>QR Code</Text>
        <Text style={styles.syncDescription}>
          Share your QR code or scan someone else's to connect instantly
        </Text>
        <TouchableOpacity style={[styles.syncButton, styles.qrButton]}>
          <Text style={[styles.syncButtonText, styles.qrButtonText]}>
            My QR Code
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discover People</Text>
        <TouchableOpacity>
          <Ionicons name="filter" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['Suggested', 'Influencers', 'Search', 'Sync'].map((tab) => (
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

      {/* Search Bar */}
      {activeTab === 'Search' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, username, or language..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={performSearch}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={performSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'Suggested' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested for You</Text>
              <Text style={styles.sectionSubtitle}>
                Based on your interests and activity
              </Text>
            </View>
            <FlatList
              data={suggestedUsers}
              renderItem={renderSuggestedUser}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.usersList}
            />
          </View>
        )}

        {activeTab === 'Influencers' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Language Influencers</Text>
              <Text style={styles.sectionSubtitle}>
                Follow the most influential language creators
              </Text>
            </View>
            <FlatList
              data={influentialUsers}
              renderItem={renderInfluentialUser}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.usersList}
            />
          </View>
        )}

        {activeTab === 'Search' && (
          <View>
            {searchResults.length > 0 ? (
              <View>
                <Text style={styles.searchResultsTitle}>
                  Search Results ({searchResults.length})
                </Text>
                <FlatList
                  data={searchResults}
                  renderItem={renderSuggestedUser}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={styles.usersList}
                />
              </View>
            ) : searchQuery.length > 0 ? (
              <View style={styles.noResults}>
                <Ionicons name="search" size={48} color="#9CA3AF" />
                <Text style={styles.noResultsTitle}>No results found</Text>
                <Text style={styles.noResultsText}>
                  Try searching for a different name, username, or language
                </Text>
              </View>
            ) : (
              <View style={styles.searchPrompt}>
                <Ionicons name="search" size={48} color="#FF8A00" />
                <Text style={styles.searchPromptTitle}>Discover New People</Text>
                <Text style={styles.searchPromptText}>
                  Search for users by name, username, or the language they speak
                </Text>
                <View style={styles.searchSuggestions}>
                  <Text style={styles.suggestionsTitle}>Popular searches:</Text>
                  {['Igbo', 'Yoruba', 'Hausa', 'teachers', 'storytellers'].map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      style={styles.suggestionTag}
                      onPress={() => {
                        setSearchQuery(suggestion);
                        performSearch();
                      }}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === 'Sync' && renderSyncSection()}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: width * 0.05,
    paddingVertical: 16,
    backgroundColor: '#FF8A00',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: width * 0.05,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: '#FF8A00',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.05,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1F2937',
  },
  searchButton: {
    backgroundColor: '#FF8A00',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: width * 0.05,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  usersList: {
    paddingHorizontal: width * 0.05,
    paddingTop: 8,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  influencerAvatar: {
    borderWidth: 2,
    borderColor: '#FF8A00',
  },
  avatarText: {
    fontSize: 24,
  },
  userDetails: {
    flex: 1,
  },
  nameRow: {
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
  userUsername: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  userMeta: {
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
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  followButton: {
    backgroundColor: '#FF8A00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: '#E5E7EB',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#6B7280',
  },
  userBio: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  reasonText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    textAlign: 'center',
  },
  activityText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
  },
  influencerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FF8A00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  influencerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  influencerBadge: {
    backgroundColor: '#FF8A00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  influencerBadgeText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  specialtyText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  influencerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 12,
  },
  influencerStatItem: {
    alignItems: 'center',
  },
  influencerStatNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  influencerStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: width * 0.05,
    paddingVertical: 12,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: width * 0.05,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  searchPrompt: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: width * 0.05,
  },
  searchPromptTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  searchPromptText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  searchSuggestions: {
    alignItems: 'center',
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 12,
  },
  suggestionTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  syncSection: {
    paddingHorizontal: width * 0.05,
    paddingVertical: 16,
  },
  syncCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  syncTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  syncDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  syncButton: {
    backgroundColor: '#FF8A00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  inviteButton: {
    backgroundColor: '#10B981',
  },
  qrButton: {
    backgroundColor: '#8B5CF6',
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  inviteButtonText: {
    color: '#FFFFFF',
  },
  qrButtonText: {
    color: '#FFFFFF',
  },
});

export default ContactDiscoveryScreen;