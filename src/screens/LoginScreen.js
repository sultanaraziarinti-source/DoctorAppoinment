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
  Alert,
  BackHandler,
} from 'react-native';
import { Colors } from '../theme/colors';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { translations } from '../i18n/translations';

import { authenticateUser } from '../services/authStorage';

export default function LoginScreen({
  lang = 'bn',
  onChangeLang,
  onNavigateToSignup,
  onLoginSuccess,
  onBack,
  initialPhone = '',
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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

  const t = translations[lang]?.login || translations.bn.login;
  const isBn = lang === 'bn';

  const validate = () => {
    const newErrors = {};
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');

    if (!cleanPhone) {
      newErrors.phone = t.errors.phoneRequired;
    } else if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
      newErrors.phone = t.errors.phoneInvalid;
    }

    if (!password) {
      newErrors.password = t.errors.passwordRequired;
    } else if (password.length < 6) {
      newErrors.password = t.errors.passwordTooShort;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const authResult = await authenticateUser(phone, password);
      setLoading(false);

      if (!authResult.success) {
        if (authResult.error === 'NOT_FOUND') {
          const alertTitle = isBn ? 'অ্যাকাউন্ট পাওয়া যায়নি' : 'Account Not Found';
          const alertMsg = isBn
            ? 'এই ফোন নম্বরে কোনো অ্যাকাউন্ট নিবন্ধিত নেই। লগইন করার পূর্বে অনুগ্রহ করে সাইন আপ করুন।'
            : 'No registered account found with this phone number. Please sign up first to continue.';
          
          setErrors({
            phone: isBn
              ? 'এই নম্বরে কোনো অ্যাকাউন্ট নেই। সাইন আপ করুন।'
              : 'No account with this number. Please sign up.',
          });

          Alert.alert(alertTitle, alertMsg, [
            { text: isBn ? 'বাতিল' : 'Cancel', style: 'cancel' },
            {
              text: isBn ? 'এখনই সাইন আপ করুন' : 'Sign Up Now',
              onPress: onNavigateToSignup,
            },
          ]);
          return;
        }

        if (authResult.error === 'WRONG_PASSWORD') {
          const alertTitle = isBn ? 'ভুল পাসওয়ার্ড' : 'Incorrect Password';
          const alertMsg = isBn
            ? 'আপনার দেওয়া পাসওয়ার্ডটি সঠিক নয়। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
            : 'The password you entered is incorrect. Please try again.';

          setErrors({
            password: isBn
              ? 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন।'
              : 'Incorrect password. Try again.',
          });

          Alert.alert(alertTitle, alertMsg);
          return;
        }

        Alert.alert(
          isBn ? 'লগইন ব্যর্থ' : 'Login Failed',
          isBn ? authResult.messageBn : authResult.messageEn
        );
        return;
      }

      // Success: Registered user authenticated!
      onLoginSuccess(authResult.user);
    } catch (err) {
      setLoading(false);
      Alert.alert(
        isBn ? 'ত্রুটি' : 'Error',
        isBn ? 'লগইন করতে সমস্যা হচ্ছে। আবার চেষ্টা করুন।' : 'Failed to login. Please try again.'
      );
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
                  <Text style={styles.logoEmoji}>🩺</Text>
                </View>
                <Text style={styles.brandTitle}>{t.brandTitle}</Text>
                <Text style={styles.brandSubtitle}>{t.brandSubtitle}</Text>
              </View>

              {/* Login Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t.cardTitle}</Text>
                <Text style={styles.cardSubtitle}>{t.cardSubtitle}</Text>

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

                {/* Password - clean input without left/right icons */}
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

                {/* Remember Me & Forgot Password */}
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={styles.rememberMeContainer}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe && styles.checkboxChecked,
                      ]}
                    >
                      {rememberMe && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <Text style={styles.rememberMeText}>{t.rememberMe}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => Alert.alert(t.forgotAlertTitle, t.forgotAlertMsg)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotText}>{t.forgot}</Text>
                  </TouchableOpacity>
                </View>

                {/* Login Button */}
                <CustomButton
                  title={t.loginBtn}
                  onPress={handleLogin}
                  loading={loading}
                  icon="🏥"
                  style={styles.loginBtn}
                />

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t.or}</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Signup Switch Link */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>{t.noAccount}</Text>
                  <TouchableOpacity onPress={onNavigateToSignup} activeOpacity={0.7}>
                    <Text style={styles.signupLink}>{t.signupLink}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Emergency Chamber Helpline */}
              <View style={styles.emergencyBanner}>
                <Text style={styles.emergencyText}>
                  🚨 {t.helpline}
                  <Text style={styles.emergencyNumber}>{t.helplineNumber}</Text>
                </Text>
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
    backgroundColor: 'rgba(14, 116, 127, 0.42)', // Teal translucent tint
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
    marginBottom: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 28,
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
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  rememberMeText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 13,
    color: Colors.secondary,
    fontWeight: '700',
  },
  loginBtn: {
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  emergencyBanner: {
    marginTop: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  emergencyText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
  },
  emergencyNumber: {
    fontWeight: '800',
    color: Colors.accentRed,
  },
});
