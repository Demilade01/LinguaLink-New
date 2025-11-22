// src/screens/SignUpScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import LanguagePicker from '../components/LanguagePicker';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../supabaseClient';

const { width, height } = Dimensions.get('window');

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignUp'
>;

interface Props {
  navigation: SignUpScreenNavigationProp;
}

interface User {
  fullName: string;
  username: string;
  email: string;
  password: string;
  primaryLanguage: string;
}

interface Language {
  id: string;
  name: string;
  dialect?: string;
}

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { signUp, signInWithGoogle, loading } = useAuth();
  const [user, setUser] = useState<User>({
    fullName: '',
    username: '',
    email: '',
    password: '',
    primaryLanguage: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | undefined>();

  // Real-time validation states
  const [emailError, setEmailError] = useState<string>('');
  const [usernameError, setUsernameError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);

  // Real-time email validation
  const validateEmail = async (email: string) => {
    if (!email) {
      setEmailError('');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsValidating(true);
    try {
      const { data: existingEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingEmail) {
        setEmailError('An account with this email already exists');
      } else {
        setEmailError('');
      }
    } catch (error) {
      setEmailError('Error checking email availability');
    } finally {
      setIsValidating(false);
    }
  };

  // Real-time username validation
  const validateUsername = async (username: string) => {
    if (!username) {
      setUsernameError('');
      return;
    }

    if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    setIsValidating(true);
    try {
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingUsername) {
        setUsernameError('Username is already taken');
      } else {
        setUsernameError('');
      }
    } catch (error) {
      setUsernameError('Error checking username availability');
    } finally {
      setIsValidating(false);
    }
  };

  // Debounced validation
  useEffect(() => {
    const emailTimer = setTimeout(() => {
      if (user.email) validateEmail(user.email);
    }, 500);
    return () => clearTimeout(emailTimer);
  }, [user.email]);

  useEffect(() => {
    const usernameTimer = setTimeout(() => {
      if (user.username) validateUsername(user.username);
    }, 500);
    return () => clearTimeout(usernameTimer);
  }, [user.username]);

  const handleSignUp = async () => {
    if (!user.fullName || !user.username || !user.email || !user.password || !user.primaryLanguage) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (user.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (emailError || usernameError) {
      Alert.alert('Error', 'Please fix the validation errors before continuing');
      return;
    }

    const err = await signUp({
      email: user.email,
      password: user.password,
      fullName: user.fullName,
      username: user.username,
      primaryLanguage: user.primaryLanguage,
    });
    if (err) {
      Alert.alert('Sign Up Failed', err);
      return;
    }
    Alert.alert('Success', 'Please check your email to verify your account.');
    navigation.navigate('VerifyEmail', { email: user.email });
  };

  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
    setUser({ ...user, primaryLanguage: `${language.name}${language.dialect ? ` / ${language.dialect}` : ''}` });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF8A00" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.formHeader, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.formTitle}>Join Lingualink AI</Text>
        </View>
        <Text style={styles.formSubtitle}>Preserve languages through voice and stories</Text>

        <ScrollView
          style={styles.formContent}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                value={user.fullName}
                onChangeText={(text) => setUser({ ...user, fullName: text })}
              />
            </View>
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={[
              styles.inputContainer,
              usernameError ? styles.inputContainerError : null,
              !usernameError && user.username ? styles.inputContainerSuccess : null
            ]}>
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                style={[styles.textInput, styles.usernameInput]}
                placeholder="Choose a unique username"
                placeholderTextColor="#999"
                value={user.username}
                onChangeText={(text) => setUser({ ...user, username: text })}
                autoCapitalize="none"
              />
              {isValidating && user.username ? (
                <Ionicons name="time-outline" size={16} color="#6B7280" />
              ) : usernameError ? (
                <Ionicons name="close-circle" size={16} color="#EF4444" />
              ) : !usernameError && user.username ? (
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              ) : null}
            </View>
            {usernameError ? (
              <Text style={styles.errorText}>{usernameError}</Text>
            ) : (
              <Text style={styles.inputHint}>This will be your public display name</Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={[
              styles.inputContainer,
              emailError ? styles.inputContainerError : null,
              !emailError && user.email ? styles.inputContainerSuccess : null
            ]}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                value={user.email}
                onChangeText={(text) => setUser({ ...user, email: text })}
              />
              {isValidating && user.email ? (
                <Ionicons name="time-outline" size={16} color="#6B7280" />
              ) : emailError ? (
                <Ionicons name="close-circle" size={16} color="#EF4444" />
              ) : !emailError && user.email ? (
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              ) : null}
            </View>
            {emailError ? (
              <Text style={styles.errorText}>{emailError}</Text>
            ) : null}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Create a strong password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={user.password}
                onChangeText={(text) => setUser({ ...user, password: text })}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHint}>Must be at least 6 characters</Text>
          </View>

          {/* Primary Language */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Primary Language</Text>
            <TouchableOpacity
              style={styles.dropdownContainer}
              onPress={() => setShowLanguagePicker(true)}
            >
              <Text style={[
                styles.dropdownText,
                selectedLanguage && styles.selectedDropdownText
              ]}>
                {user.primaryLanguage || 'Select your primary language...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>
            <Text style={styles.inputHint}>
              You can add more languages and create AI stories in any language
            </Text>
          </View>

          {/* Welcome Pack */}
          <View style={styles.welcomePack}>
            <View style={styles.welcomePackIcon}>
              <Ionicons name="sparkles" size={24} color="#FF8A00" />
            </View>
            <View style={styles.welcomePackContent}>
              <Text style={styles.welcomePackTitle}>Welcome Pack</Text>
              <Text style={styles.welcomePackText}>
                Get 100 points + Language Pioneer badge!
              </Text>
            </View>
          </View>

          {/* Join Button */
          }
          <TouchableOpacity style={styles.primaryButton} onPress={handleSignUp} disabled={loading}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>{loading ? 'Creating...' : 'Join Lingualink AI'}</Text>
          </TouchableOpacity>

          {/* Google Sign Up */}
          <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle} disabled={loading}>
            <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 8 }} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.linkButton}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Language Picker Modal */}
      <LanguagePicker
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        onSelect={handleLanguageSelect}
        selectedLanguage={selectedLanguage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF8A00',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.05,
    paddingBottom: height * 0.02,
  },
  formTitle: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 20,
  },
  formSubtitle: {
    fontSize: width * 0.04,
    color: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: width * 0.05,
    paddingBottom: height * 0.02,
  },
  formContent: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.03,
    paddingBottom: height * 0.05,
  },
  inputGroup: {
    marginBottom: height * 0.025,
  },
  inputLabel: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: height * 0.015,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: width * 0.04,
    color: '#1F2937',
  },
  usernameInput: {
    marginLeft: 8,
  },
  atSymbol: {
    fontSize: width * 0.04,
    color: '#999',
    marginRight: 4,
  },
  inputHint: {
    fontSize: width * 0.03,
    color: '#6B7280',
    marginTop: 4,
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: height * 0.02,
    minHeight: 50,
  },
  dropdownText: {
    fontSize: width * 0.04,
    color: '#999',
  },
  selectedDropdownText: {
    color: '#1F2937',
  },
  welcomePack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: height * 0.03,
  },
  welcomePackIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE4B6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  welcomePackContent: {
    flex: 1,
  },
  welcomePackTitle: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 2,
  },
  welcomePackText: {
    fontSize: width * 0.035,
    color: '#92400E',
  },
  primaryButton: {
    backgroundColor: '#FF8A00',
    paddingVertical: height * 0.02,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 50,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.04,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: height * 0.018,
    borderRadius: 12,
    marginBottom: 16,
  },
  googleButtonText: {
    color: '#111827',
    fontSize: width * 0.04,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  linkText: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  linkButton: {
    fontSize: width * 0.035,
    color: '#FF8A00',
    fontWeight: '600',
  },
  inputContainerError: {
    borderColor: '#EF4444',
    borderWidth: 1,
    backgroundColor: '#FEF2F2',
  },
  inputContainerSuccess: {
    borderColor: '#10B981',
    borderWidth: 1,
    backgroundColor: '#F0FDF4',
  },
  errorText: {
    fontSize: width * 0.03,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default SignUpScreen;