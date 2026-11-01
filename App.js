import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, BackHandler, ToastAndroid, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import DoctorListScreen from './src/screens/DoctorListScreen';
import GetStartedScreen from './src/screens/GetStartedScreen';
import DoctorsInfoScreen from './src/screens/DoctorsInfoScreen';
import AppointmentListScreen from './src/screens/AppointmentListScreen';
import { loadDepartmentsData } from './src/services/doctorsStorage';
import { startWithPhone, normalizePhone } from './src/services/authStorage';
import { saveSession, loadSession, clearSession } from './src/services/sessionStorage';
import { cancelAllAppointmentReminders } from './src/services/reminders';

const isRegistrarUser = (user) => !!(user?.isRegistrar || user?.phone === '01718183957');

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  // Height of Android's navigation buttons; the installed app draws edge-to-edge underneath them
  const insets = useSafeAreaInsets();
  const [currentScreen, setCurrentScreen] = useState('get-started'); // 'get-started', 'login', 'signup', 'home', 'doctor-list', 'doctors-info', 'appointment-list'
  const [screenHistory, setScreenHistory] = useState(['get-started']);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  // Popup Home should open with when reached from another page's bottom bar
  const [homeInitialTab, setHomeInitialTab] = useState(null);
  const [lang, setLang] = useState('bn'); // Default is Bangla
  const [departments, setDepartments] = useState([]);
  const [selectedDoctorForAppointments, setSelectedDoctorForAppointments] = useState(null);
  const [startPhone, setStartPhone] = useState(''); // Phone entered on Get Started, prefilled on Login
  const [restoringSession, setRestoringSession] = useState(true);
  const lastBackPressRef = useRef(0);

  // Stay logged in: reopen on the user's landing page until they log out
  useEffect(() => {
    loadSession().then((user) => {
      if (user) {
        setCurrentUser(user);
        const landing = isRegistrarUser(user) ? 'doctors-info' : 'home';
        setScreenHistory([landing]);
        setCurrentScreen(landing);
      }
      setRestoringSession(false);
    });
  }, []);

  useEffect(() => {
    loadDepartmentsData().then((data) => {
      if (data && data.length > 0) {
        setDepartments(data);
      }
    });
  }, []);

  const navigateTo = (screen, options = {}) => {
    if (options.replace) {
      setScreenHistory([screen]);
    } else {
      setScreenHistory((prev) => {
        if (prev[prev.length - 1] === screen) return prev;
        // If returning to doctors-info or home when it's already in the stack, collapse to it
        if ((screen === 'doctors-info' || screen === 'home') && prev.includes(screen)) {
          const idx = prev.lastIndexOf(screen);
          return prev.slice(0, idx + 1);
        }
        return [...prev, screen];
      });
    }
    setCurrentScreen(screen);
  };

  const goBack = () => {
    if (screenHistory.length > 1) {
      const newHistory = screenHistory.slice(0, -1);
      const prevScreen = newHistory[newHistory.length - 1];
      setScreenHistory(newHistory);
      setCurrentScreen(prevScreen);
      return true;
    }
    return false;
  };

  useEffect(() => {
    const onHardwareBack = () => {
      // 1. Pop history if we have previous screens
      if (screenHistory.length > 1) {
        const newHistory = screenHistory.slice(0, -1);
        const prevScreen = newHistory[newHistory.length - 1];
        setScreenHistory(newHistory);
        setCurrentScreen(prevScreen);
        return true;
      }

      // 2. Root screen: Double-press back within 2000ms to exit app
      const now = Date.now();
      if (lastBackPressRef.current && now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        const exitMsg =
          lang === 'bn'
            ? 'অ্যাপ বন্ধ করতে আবার ব্যাক চাপুন'
            : 'Press back again to exit';
        ToastAndroid.show(exitMsg, ToastAndroid.SHORT);
      }
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [screenHistory, lang]);

  const startSession = (user) => {
    setCurrentUser(user);
    saveSession(user);
  };

  const handleLoginSuccess = (user) => {
    startSession(user);
    // When logged in with 01718183957 and pass 123456 (Registrar):
    if (isRegistrarUser(user)) {
      navigateTo('doctors-info', { replace: true });
    } else {
      // For all others: existing page as it is!
      navigateTo('home', { replace: true });
    }
  };

  // Get Started with a valid phone opens Home directly; the registrar still needs a password.
  const handleGetStarted = async (phone) => {
    setStartPhone(normalizePhone(phone));
    const result = await startWithPhone(phone);
    if (result.needsLogin) {
      navigateTo('login');
      return;
    }
    startSession(result.user);
    navigateTo('home', { replace: true });
  };

  const handleSignupSuccess = (user) => {
    startSession(user);
    navigateTo('home', { replace: true });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearSession();
    cancelAllAppointmentReminders();
    navigateTo('get-started', { replace: true });
  };

  // Home reads homeInitialTab once when it opens; clear it so a later visit opens plainly
  useEffect(() => {
    if (currentScreen === 'home' && homeInitialTab) setHomeInitialTab(null);
  }, [currentScreen, homeInitialTab]);

  // Registrar bottom bar
  const handleRegistrarTab = (tab) => {
    if (tab === 'doctors') navigateTo('doctors-info');
    else if (tab === 'appointments') {
      setSelectedDoctorForAppointments(null);
      navigateTo('appointment-list');
    } else if (tab === 'home') navigateTo('home');
  };

  const handleSelectDepartment = (dept) => {
    setHomeInitialTab(null);
    setSelectedDepartment(dept);
    navigateTo('doctor-list');
  };

  // Blank teal screen for the moment the saved session is read, so Get Started doesn't flash
  if (restoringSession) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {/* Screens end above the system navigation buttons, so bottom bars stay visible */}
      <View style={styles.screenArea}>
      {currentScreen === 'get-started' && (
        <GetStartedScreen
          lang={lang}
          onChangeLang={setLang}
          onGetStarted={handleGetStarted}
          onNavigateToSignup={() => navigateTo('signup')}
        />
      )}

      {currentScreen === 'login' && (
        <LoginScreen
          lang={lang}
          onChangeLang={setLang}
          onNavigateToSignup={() => navigateTo('signup')}
          onLoginSuccess={handleLoginSuccess}
          onBack={goBack}
          initialPhone={startPhone}
        />
      )}

      {currentScreen === 'signup' && (
        <SignupScreen
          lang={lang}
          onChangeLang={setLang}
          onNavigateToLogin={() => navigateTo('login')}
          onSignupSuccess={handleSignupSuccess}
          onBack={goBack}
        />
      )}

      {/* Existing Home Page: Used for normal patients, and also accessible to registrar */}
      {currentScreen === 'home' && (
        <HomeScreen
          user={currentUser}
          lang={lang}
          onChangeLang={setLang}
          onLogout={handleLogout}
          onSelectDepartment={handleSelectDepartment}
          departments={departments}
          onNavigateToDoctorsInfo={() => navigateTo('doctors-info')}
          onNavigateToAppointments={() => {
            setSelectedDoctorForAppointments(null);
            navigateTo('appointment-list');
          }}
          initialTab={homeInitialTab}
          onRegistrarTab={handleRegistrarTab}
          onUpdateUser={(changes) => startSession({ ...currentUser, ...changes })}
        />
      )}

      {/* Available Doctors List Screen */}
      {currentScreen === 'doctor-list' && (
        <DoctorListScreen
          department={selectedDepartment}
          user={currentUser}
          lang={lang}
          onChangeLang={setLang}
          departments={departments}
          onRegistrarTab={handleRegistrarTab}
          onTabPress={(tab) => {
            setHomeInitialTab(tab === 'home' ? null : tab);
            navigateTo('home');
          }}
          onBack={() => {
            if (!goBack()) {
              if (currentUser?.isRegistrar) {
                navigateTo('doctors-info', { replace: true });
              } else {
                navigateTo('home', { replace: true });
              }
            }
          }}
        />
      )}

      {/* Registrar: Doctors Info Page (CRUD: Add, Update, Delete Doctors) */}
      {currentScreen === 'doctors-info' && (
        <DoctorsInfoScreen
          departments={departments}
          onUpdateDepartments={(updated) => setDepartments(updated)}
          lang={lang}
          onChangeLang={setLang}
          onNavigateToHome={() => navigateTo('home')}
          onRegistrarTab={handleRegistrarTab}
          onSelectDepartment={handleSelectDepartment}
          onNavigateToAppointments={(doc) => {
            const validDoc = doc && doc.id && typeof doc.id === 'string' ? doc : null;
            setSelectedDoctorForAppointments(validDoc);
            navigateTo('appointment-list');
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Registrar: Appointment List Page */}
      {currentScreen === 'appointment-list' && (
        <AppointmentListScreen
          departments={departments}
          initialDoctor={selectedDoctorForAppointments}
          lang={lang}
          onChangeLang={setLang}
          onNavigateToDoctorsInfo={() => navigateTo('doctors-info')}
          onNavigateToHome={() => navigateTo('home')}
          onRegistrarTab={handleRegistrarTab}
          onLogout={handleLogout}
        />
      )}
      </View>
      <View style={[styles.systemNavSpacer, { height: insets.bottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E747F',
  },
  screenArea: {
    flex: 1,
  },
  systemNavSpacer: {
    backgroundColor: '#FFFFFF',
  },
});

