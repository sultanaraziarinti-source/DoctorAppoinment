import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  StatusBar,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { translations } from '../i18n/translations';
import LanguageSwitcher from '../components/LanguageSwitcher';
import CustomInput from '../components/CustomInput';

const { width } = Dimensions.get('window');

export default function GetStartedScreen({
  lang = 'bn',
  onChangeLang,
  onGetStarted,
  onNavigateToSignup,
}) {
  const t = translations[lang]?.welcome || translations.bn.welcome;
  const tLogin = translations[lang]?.login || translations.bn.login;
  const isBn = lang === 'bn';
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const scrollRef = useRef(null);

  // The phone field sits near the bottom: when the keyboard opens, scroll so the field and button stay visible
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const handleGetStarted = () => {
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone) {
      setPhoneError(tLogin.errors.phoneRequired);
      return;
    }
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
      setPhoneError(tLogin.errors.phoneInvalid);
      return;
    }
    onGetStarted(cleanPhone);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Medical Pattern Doodle Background with White Wash Overlay */}
      <ImageBackground
        source={require('../../assets/medical_pattern.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.whiteOverlay}>
          {/* Top Bar with Language Switcher */}
          <View style={styles.topBar}>
            <View style={styles.topBarPlaceholder} />
            <LanguageSwitcher lang={lang} onChangeLang={onChangeLang} />
          </View>

          {/* Shrinks the scroll area above the keyboard (edge-to-edge Android no longer resizes the window) */}
          <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo Row: Heart with people and sparkles */}
            <View style={styles.logoContainer}>
              <View style={styles.sparkleRow}>
                <Text style={styles.sparkleLeft}>- -</Text>
                <View style={styles.logoHeartCircle}>
                  <View style={styles.logoPeopleRow}>
                    <View style={styles.purplePersonDot} />
                    <View style={styles.tealPersonDot} />
                  </View>
                  <View style={styles.logoHeartShape}>
                    <Text style={styles.logoHeartIcon}>💜</Text>
                    <Text style={styles.logoCrossIcon}>➕</Text>
                  </View>
                </View>
                <Text style={styles.sparkleRight}>- -</Text>
              </View>

              {/* Title Header */}
              <Text style={styles.welcomeToText}>{t.welcomeTo}</Text>
              <Text style={styles.appNameText}>
                {t.appName || 'Doctor Appoinment'}
              </Text>
              <Text style={styles.taglineText}>{t.tagline}</Text>
            </View>

            {/* Center Main White Card Container */}
            <View style={styles.mainCard}>
              {/* Doctor Illustration Image from assets */}
              <View style={styles.imageWrapper}>
                <Image
                  source={require('../../assets/doctor_illustration.jpg')}
                  style={styles.doctorImage}
                  resizeMode="contain"
                />
              </View>

              {/* Phone Number - must be valid before continuing to login */}
              <View style={styles.phoneField}>
                <CustomInput
                  label={tLogin.phoneLabel}
                  placeholder={tLogin.phonePlaceholder}
                  icon="📞"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (phoneError) setPhoneError(null);
                  }}
                  keyboardType="phone-pad"
                  maxLength={14}
                  error={phoneError}
                />
              </View>

              {/* Main "Get Started →" Purple Pill Button inside card */}
              <TouchableOpacity
                style={styles.getStartedBtn}
                onPress={handleGetStarted}
                activeOpacity={0.88}
              >
                <Text style={styles.getStartedText}>{t.getStartedBtn}</Text>
              </TouchableOpacity>
            </View>

            {/* Helper Links for New and Existing Users */}
            <View style={styles.signupPromptRow}>
              <Text style={styles.promptMutedText}>{t.newPatientPrompt}</Text>
              <TouchableOpacity
                onPress={onNavigateToSignup}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.signupLinkText}>{t.signupFirstLink}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  whiteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.88)', // Clean white wash allowing doodle pattern to show
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight : 12,
    paddingBottom: 0,
  },
  keyboardView: {
    flex: 1,
  },
  topBarPlaceholder: {
    width: 60,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 4,
  },
  sparkleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  sparkleLeft: {
    color: '#8B5CF6',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
    marginRight: 8,
  },
  sparkleRight: {
    color: '#8B5CF6',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
    marginLeft: 8,
  },
  logoHeartCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPeopleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: -4,
    zIndex: 2,
  },
  purplePersonDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#502888',
  },
  tealPersonDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#0E747F',
  },
  logoHeartShape: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHeartIcon: {
    fontSize: 28,
  },
  logoCrossIcon: {
    position: 'absolute',
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '900',
    top: 10,
  },
  welcomeToText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#282561',
    letterSpacing: -0.2,
    marginBottom: 0,
  },
  appNameText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#4B2882',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  taglineText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 0,
  },
  mainCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 10,
    shadowColor: '#4A2882',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    alignItems: 'center',
    marginVertical: 4,
  },
  imageWrapper: {
    width: '100%',
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorImage: {
    width: '100%',
    height: '100%',
  },
  phoneField: {
    width: '100%',
    marginTop: 8,
  },
  getStartedBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#4B2882', // Rich royal purple as in screenshot
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#4B2882',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    marginTop: 0,
    marginBottom: 2,
  },
  getStartedText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  signupPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  promptMutedText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  signupLinkText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#4B2882',
    textDecorationLine: 'underline',
  },
});
