import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
  BackHandler,
} from 'react-native';
import { Colors } from '../theme/colors';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { translations } from '../i18n/translations';

import { registerUser } from '../services/authStorage';

export default function SignupScreen({
  lang = 'bn',
  onChangeLang,
  onNavigateToLogin,
  onSignupSuccess,
  onBack,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onHardwareBack = () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [onBack]);

  const t = translations[lang]?.signup || translations.bn.signup;
  const isBn = lang === 'bn';

  const validate = () => {
    const newErrors = {};
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const numAge = parseInt(age.trim(), 10);

    if (!name.trim()) {
      newErrors.name = t.errors.nameRequired;
    } else if (name.trim().length < 2) {
      newErrors.name = t.errors.nameTooShort;
    }

    if (!cleanPhone) {
      newErrors.phone = t.errors.phoneRequired;
    } else if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
      newErrors.phone = t.errors.phoneInvalid;
    }

    if (!age.trim()) {
      newErrors.age = t.errors.ageRequired;
    } else if (isNaN(numAge) || numAge < 1 || numAge > 120) {
      newErrors.age = t.errors.ageInvalid;
    }

    if (!password) {
      newErrors.password = t.errors.passwordRequired;
    } else if (password.length < 6) {
      newErrors.password = t.errors.passwordTooShort;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const regResult = await registerUser({
        name: name.trim(),
        phone: phone.trim(),
        age: age.trim(),
        password: password.trim(),
      });
      setLoading(false);

      if (regResult.success) {
        onSignupSuccess(regResult.user);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background with Medical Pattern Image */}
      <ImageBackground
        source={require('../../assets/medical_pattern.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Language Switcher at Top Header */}
              <View style={styles.langRow}>
                <LanguageSwitcher currentLang={lang} onChangeLang={onChangeLang} />
              </View>

              {/* Header Branding */}
              <View style={styles.header}>
                <View style={styles.logoBadge}>
                  <Text style={styles.logoEmoji}>📋</Text>
                </View>
                <Text style={styles.brandTitle}>{t.headerTitle}</Text>
                <Text style={styles.brandSubtitle}>{t.headerSubtitle}</Text>
              </View>

              {/* Signup Form Card */}
              <View style={styles.card}>
                {/* Full Name */}
                <CustomInput
                  label={t.nameLabel}
                  placeholder={t.namePlaceholder}
                  icon="👤"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                  }}
                  autoCapitalize="words"
                  error={errors.name}
                />

                {/* Phone Number */}
                <CustomInput
                  label={t.phoneLabel}
                  placeholder={t.phonePlaceholder}
                  icon="📞"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
                  }}
                  keyboardType="phone-pad"
                  maxLength={14}
                  error={errors.phone}
                />

                {/* Age - no icon */}
                <CustomInput
                  label={t.ageLabel}
                  placeholder={t.agePlaceholder}
                  value={age}
                  onChangeText={(text) => {
                    setAge(text.replace(/[^0-9]/g, ''));
                    if (errors.age) setErrors((prev) => ({ ...prev, age: null }));
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                  error={errors.age}
                />

                {/* Password - no left icon, no right toggle */}
                <CustomInput
                  label={t.passwordLabel}
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  isPassword
                  error={errors.password}
                />

                {/* Signup Button */}
                <CustomButton
                  title={t.signupBtn}
                  onPress={handleSignup}
                  loading={loading}
                  icon="✨"
                  style={styles.signupBtn}
                />

                {/* Terms Note */}
                <Text style={styles.termsNote}>
                  {t.termsPre}
                  <Text style={styles.termsHighlight}>{t.termsLink1}</Text>
                  {t.termsMid}
                  <Text style={styles.termsHighlight}>{t.termsLink2}</Text>
                  {t.termsPost}
                </Text>

                {/* Login Switch Link */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>{t.hasAccount}</Text>
                  <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.7}>
                    <Text style={styles.loginLink}>{t.loginLink}</Text>
                  </TouchableOpacity>
                </View>
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
    backgroundColor: Colors.background,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(14, 116, 127, 0.42)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 55 : (StatusBar.currentHeight || 28) + 16,
    paddingBottom: 35,
  },
  langRow: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  logoEmoji: {
    fontSize: 32,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0E747F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  signupBtn: {
    marginTop: 6,
  },
  termsNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },
  termsHighlight: {
    color: Colors.primary,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
});
