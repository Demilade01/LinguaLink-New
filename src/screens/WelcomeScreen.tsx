// src/screens/WelcomeScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

const { width, height } = Dimensions.get('window');

type WelcomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Welcome'
>;

interface Props {
  navigation: WelcomeScreenNavigationProp;
}

const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with microphone icon */}
        <View style={styles.headerSection}>
          <View style={styles.microphoneContainer}>
            <Ionicons name="mic" size={width * 0.1} color="#FFFFFF" />
            <View style={styles.sparkle}>
              <Ionicons name="sparkles" size={width * 0.04} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Lingualink AI</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Preserving languages,{'\n'}one voice at a time
          </Text>

          {/* AI-powered tagline */}
          <Text style={styles.tagline}>Now with AI-powered storytelling</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="mic"
            title="Share Your Voice"
            description="Record and share phrases in your native language or dialect"
          />
          <FeatureItem
            icon="videocam"
            title="Create AI Stories"
            description="Turn your voice into animated stories and cultural tales"
          />
          <FeatureItem
            icon="globe"
            title="Preserve Culture"
            description="Help build the world's largest archive of living languages"
          />
          <FeatureItem
            icon="trophy"
            title="Earn & Learn"
            description="Get rewarded for contributions and discover new languages"
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Ionicons name="sparkles" size={20} color="#FF8A00" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.secondaryButtonText}>I Already Have an Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Feature Item Component
const FeatureItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIcon}>
      <Ionicons name={icon} size={width * 0.06} color="#FFFFFF" />
    </View>
    <View style={styles.featureContent}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF8A00',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: width * 0.05,
    paddingBottom: 30,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: height * 0.05,
    marginBottom: height * 0.04,
  },
  microphoneContainer: {
    width: width * 0.2,
    height: width * 0.2,
    borderRadius: width * 0.1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: height * 0.03,
  },
  sparkle: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  title: {
    fontSize: width * 0.08,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: height * 0.02,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: width * 0.05,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: height * 0.01,
    lineHeight: width * 0.07,
  },
  tagline: {
    fontSize: width * 0.04,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: height * 0.02,
  },
  featuresContainer: {
    width: '100%',
    flex: 1,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: height * 0.025,
    paddingHorizontal: width * 0.02,
  },
  featureIcon: {
    width: width * 0.12,
    height: width * 0.12,
    borderRadius: width * 0.06,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: width * 0.04,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: width * 0.045,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: width * 0.035,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: width * 0.05,
  },
  buttonContainer: {
    width: '100%',
    marginTop: height * 0.02,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: height * 0.02,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FF8A00',
    fontSize: width * 0.04,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  secondaryButton: {
    paddingVertical: height * 0.02,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.04,
    fontWeight: '500',
  },
});

export default WelcomeScreen;