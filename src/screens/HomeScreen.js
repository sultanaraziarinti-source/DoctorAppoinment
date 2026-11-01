import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ImageBackground,
  Image,
  TextInput,
  Modal,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LogoutIcon from '../components/LogoutIcon';
import DoctorCard from '../components/DoctorCard';
import DoctorPhoto from '../components/DoctorPhoto';
import PatientTabBar from '../components/PatientTabBar';
import RegistrarTabBar from '../components/RegistrarTabBar';
import DepartmentIcon from '../components/DepartmentIcon';
import { deptIconFor } from '../components/departmentLogos';
import BookAppointmentScreen from './BookAppointmentScreen';
import { translations } from '../i18n/translations';
import { departmentsData } from '../data/doctorsData';
import { getAppointmentsForPhone, updateAppointmentStatus } from '../services/appointmentsStorage';
import { updatePatientAge } from '../services/authStorage';
import {
  dueReminders,
  loadSeenNotifications,
  markNotificationsSeen,
} from '../services/inAppNotifications';
import { syncAppointmentReminders, cancelAppointmentReminder } from '../services/reminders';
import { appointmentStartTime } from '../services/appointmentTime';

export default function HomeScreen({
  user,
  onLogout,
  lang = 'bn',
  onChangeLang,
  onSelectDepartment,
  departments = departmentsData,
  onNavigateToDoctorsInfo,
  onNavigateToAppointments,
  onUpdateUser, // (changes) => saves them on the logged-in user and the session
  onRegistrarTab, // registrar bottom bar: 'doctors' | 'appointments' | 'home'
  initialTab = null, // 'appointments' or 'profile': open that popup when the page opens
}) {
  const t = translations[lang]?.home || translations.bn.home;
  const isBn = lang === 'bn';
  // Only the part of the status bar that actually covers the screen (none in Expo Go, all of it in the APK)
  const insets = useSafeAreaInsets();
  const allDepts = departments && departments.length > 0 ? departments : departmentsData;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab || 'home'); // 'home', 'appointments', 'profile'
  const [showProfileModal, setShowProfileModal] = useState(initialTab === 'profile');
  // Profile age editing
  const [editingAge, setEditingAge] = useState(false);
  const [ageInput, setAgeInput] = useState('');
  const [savingAge, setSavingAge] = useState(false);
  const [ageError, setAgeError] = useState('');
  const [showAppointmentDetailsModal, setShowAppointmentDetailsModal] = useState(initialTab === 'appointments');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  // Bell: 2-hour reminders not yet seen on this phone
  const [seenNotificationIds, setSeenNotificationIds] = useState([]);
  const [shownNotifications, setShownNotifications] = useState([]); // what the open bell is showing
  const [nowTick, setNowTick] = useState(Date.now());
  const [myAppointments, setMyAppointments] = useState([]);

  // Cancelled serials drop out of the patient's list; the record stays (marked cancelled)
  // so the registrar still sees it
  const withoutCancelled = (list) => list.filter((apt) => apt.status !== 'cancelled');

  // My Appointments: bookings saved against the logged-in phone number.
  // Reloads after a booking closes and whenever the list is opened.
  useEffect(() => {
    if (!user?.phone || user?.isRegistrar || selectedDoctorForBooking) return;
    setConfirmCancelId(null);
    if (showAppointmentDetailsModal) setShowHistory(false);
    let active = true;
    getAppointmentsForPhone(user.phone)
      .then((list) => {
        if (active) setMyAppointments(withoutCancelled(list));
        // Keep this phone's 2-hour reminders in step with the bookings
        // (e.g. drop the reminder for a serial the registrar cancelled)
        syncAppointmentReminders(list, lang);
      })
      .catch((e) => console.warn('Load my appointments error:', e));
    return () => {
      active = false;
    };
  }, [user?.phone, user?.isRegistrar, selectedDoctorForBooking, showAppointmentDetailsModal]);

  // A serial is history once its date and time have passed (or the registrar marked it completed);
  // bookings whose time can't be read stay current
  const isPast = (apt) => {
    if (apt.status === 'completed') return true;
    const start = appointmentStartTime(apt);
    return start !== null && start < Date.now();
  };
  const currentAppointments = myAppointments.filter((apt) => !isPast(apt));

  useEffect(() => {
    if (!user?.phone || user?.isRegistrar) return;
    loadSeenNotifications(user.phone).then(setSeenNotificationIds);
  }, [user?.phone, user?.isRegistrar]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadReminders = user?.isRegistrar
    ? []
    : dueReminders(myAppointments, nowTick).filter((n) => !seenNotificationIds.includes(n.id));

  // Opening the bell shows the new reminders once and remembers them as seen
  const handleOpenNotifications = async () => {
    setShownNotifications(unreadReminders);
    setShowNotificationModal(true);
    if (unreadReminders.length > 0 && user?.phone) {
      setSeenNotificationIds(await markNotificationsSeen(user.phone, unreadReminders.map((n) => n.id)));
    }
  };
  const historyAppointments = myAppointments
    .filter(isPast)
    .sort((a, b) => (appointmentStartTime(b) || 0) - (appointmentStartTime(a) || 0)); // latest first
  const [showHistory, setShowHistory] = useState(false);
  const shownAppointments = showHistory ? historyAppointments : currentAppointments;

  const nextAppointment = currentAppointments.find((apt) => apt.status === 'confirmed') || null;
  const statusLabel = (apt) => {
    if (apt.status === 'completed') return isBn ? 'সম্পন্ন' : 'Completed';
    if (apt.status === 'cancelled') return isBn ? 'বাতিল' : 'Cancelled';
    if (isPast(apt)) return isBn ? 'সময় শেষ' : 'Past';
    return isBn ? 'নিশ্চিত' : 'Confirmed';
  };

  // Patient cancelling their own pending serial (asked to confirm inside the card first)
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState(null);

  // Pending = still confirmed and not yet in the past (bookings without a start time count as pending)
  const isPending = (apt) => apt.status === 'confirmed' && !isPast(apt);

  const handleCancelAppointment = async (apt) => {
    setCancellingId(apt.id);
    setCancelError(null);
    try {
      await updateAppointmentStatus(apt.id, 'cancelled');
      await cancelAppointmentReminder(apt.id);
      setMyAppointments(withoutCancelled(await getAppointmentsForPhone(user.phone)));
      setConfirmCancelId(null);
    } catch (e) {
      console.warn('Cancel appointment error:', e);
      setCancelError(apt.id);
    } finally {
      setCancellingId(null);
    }
  };

  // Android Hardware / Phone Back Button Handler
  useEffect(() => {
    const onHardwareBack = () => {
      // 1. If currently in booking flow, close it
      if (selectedDoctorForBooking) {
        setSelectedDoctorForBooking(null);
        return true;
      }
      // 2. If any popup modals are open, close them
      if (showProfileModal) {
        setShowProfileModal(false);
        return true;
      }
      if (showAppointmentDetailsModal) {
        setShowAppointmentDetailsModal(false);
        return true;
      }
      if (showNotificationModal) {
        setShowNotificationModal(false);
        return true;
      }
      // 3. If in another tab, return to 'home' tab
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      // 4. If search query is active, clear search
      if (searchQuery.trim().length > 0) {
        setSearchQuery('');
        return true;
      }
      // 5. Otherwise bubble to App.js (prompts double-tap exit or pops history)
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [
    selectedDoctorForBooking,
    showProfileModal,
    showAppointmentDetailsModal,
    showNotificationModal,
    activeTab,
    searchQuery,
  ]);

  // Flatten all doctors with department details
  const allDoctors = allDepts.flatMap((dept) =>
    (dept.doctors || []).map((doc) => ({
      ...doc,
      departmentId: dept.id,
      departmentNameBn: dept.nameBn,
      departmentNameEn: dept.nameEn,
      deptIcon: deptIconFor(dept),
      deptDescBn: dept.descriptionBn,
      deptDescEn: dept.descriptionEn,
    }))
  );

  // Synonyms dictionary for doctor types, symptoms, and medical fields
  const typeSynonyms = {
    'heart': ['cardiology', 'cardio', 'হার্ট', 'কার্ডিওলজিস্ট', 'হৃদরোগ'],
    'হার্ট': ['cardiology', 'cardio', 'হার্ট', 'কার্ডিওলজিস্ট', 'হৃদরোগ'],
    'হৃদরোগ': ['cardiology', 'cardio', 'হার্ট', 'কার্ডিওলজিস্ট', 'হৃদরোগ'],
    'cardio': ['cardiology', 'cardio', 'হার্ট', 'কার্ডিওলজিস্ট', 'হৃদরোগ'],
    'cardiology': ['cardiology', 'cardio', 'হার্ট', 'কার্ডিওলজিস্ট', 'হৃদরোগ'],
    'cardiologist': ['cardiology', 'cardio', 'হার্ট', 'কার্ডিওলজিস্ট', 'হৃদরোগ'],
    'medicine': ['medicine', 'মেডিসিন', 'general', 'physician', 'জ্বর', 'fever', 'ডায়াবেটিস', 'diabetes'],
    'মেডিসিন': ['medicine', 'মেডিসিন', 'general', 'physician', 'জ্বর', 'fever', 'ডায়াবেটিস', 'diabetes'],
    'fever': ['medicine', 'মেডিসিন'],
    'জ্বর': ['medicine', 'মেডিসিন'],
    'ডায়াবেটিস': ['medicine', 'মেডিসিন', 'diabetes'],
    'diabetes': ['medicine', 'মেডিসিন', 'diabetes'],
    'child': ['pediatrics', 'pediatrician', 'শিশু', 'বাচ্চা', 'নবজাতক'],
    'baby': ['pediatrics', 'pediatrician', 'শিশু', 'বাচ্চা', 'নবজাতক'],
    'শিশু': ['pediatrics', 'pediatrician', 'শিশু', 'বাচ্চা', 'নবজাতক'],
    'বাচ্চা': ['pediatrics', 'pediatrician', 'শিশু', 'বাচ্চা', 'নবজাতক'],
    'pediatrician': ['pediatrics', 'pediatrician', 'শিশু'],
    'pediatrics': ['pediatrics', 'pediatrician', 'শিশু'],
    'skin': ['dermatology', 'skin', 'ত্বক', 'চর্ম', 'চর্মরোগ'],
    'ত্বক': ['dermatology', 'skin', 'ত্বক', 'চর্ম', 'চর্মরোগ'],
    'চর্ম': ['dermatology', 'skin', 'ত্বক', 'চর্ম', 'চর্মরোগ'],
    'চর্মরোগ': ['dermatology', 'skin', 'ত্বক', 'চর্ম', 'চর্মরোগ'],
    'dermatologist': ['dermatology', 'skin', 'ত্বক', 'চর্ম', 'চর্মরোগ'],
    'dermatology': ['dermatology', 'skin', 'ত্বক', 'চর্ম', 'চর্মরোগ'],
    'women': ['gynecology', 'গাইনী', 'প্রসূতি', 'women'],
    'gynae': ['gynecology', 'গাইনী', 'প্রসূতি', 'women', 'gynaecologist'],
    'gynecology': ['gynecology', 'গাইনী', 'প্রসূতি', 'women', 'gynaecologist'],
    'গাইনী': ['gynecology', 'গাইনী', 'প্রসূতি', 'women', 'gynaecologist'],
    'প্রসূতি': ['gynecology', 'গাইনী', 'প্রসূতি', 'women', 'gynaecologist'],
    'bone': ['orthopedics', 'orthopedic', 'হাড়', 'অর্থোপেডিক', 'জয়েন্ট'],
    'হাড়': ['orthopedics', 'orthopedic', 'হাড়', 'অর্থোপেডিক', 'জয়েন্ট'],
    'orthopedic': ['orthopedics', 'orthopedic', 'হাড়', 'অর্থোপেডিক', 'জয়েন্ট'],
    'orthopedics': ['orthopedics', 'orthopedic', 'হাড়', 'অর্থোপেডিক', 'জয়েন্ট'],
    'অর্থোপেডিক': ['orthopedics', 'orthopedic', 'হাড়', 'অর্থোপেডিক', 'জয়েন্ট'],
    'eye': ['ophthalmology', 'eye', 'চোখ', 'চক্ষু'],
    'চোখ': ['ophthalmology', 'eye', 'চোখ', 'চক্ষু'],
    'চক্ষু': ['ophthalmology', 'eye', 'চোখ', 'চক্ষু'],
    'dentist': ['dentistry', 'dental', 'dentist', 'দাঁত', 'দন্ত'],
    'dental': ['dentistry', 'dental', 'dentist', 'দাঁত', 'দন্ত'],
    'dentistry': ['dentistry', 'dental', 'dentist', 'দাঁত', 'দন্ত'],
    'দাঁত': ['dentistry', 'dental', 'dentist', 'দাঁত', 'দন্ত'],
    'দন্ত': ['dentistry', 'dental', 'dentist', 'দাঁত', 'দন্ত'],
    'ent': ['ent', 'নাক', 'কান', 'গলা', 'ear', 'nose', 'throat'],
    'ear': ['ent', 'নাক', 'কান', 'গলা', 'ear'],
    'nose': ['ent', 'নাক', 'কান', 'গলা', 'nose'],
    'throat': ['ent', 'নাক', 'কান', 'গলা', 'throat'],
    'গলা': ['ent', 'নাক', 'কান', 'গলা', 'throat'],
    'নাক': ['ent', 'নাক', 'কান', 'গলা', 'nose'],
    'কান': ['ent', 'নাক', 'কান', 'গলা', 'ear'],
    'brain': ['neurology', 'nerve', 'স্নায়ু', 'মাথা', 'নিউরোলজি', 'নিউরোলজিস্ট'],
    'মাথা': ['neurology', 'nerve', 'স্নায়ু', 'মাথা', 'নিউরোলজি', 'নিউরোলজিস্ট'],
    'নিউরোলজি': ['neurology', 'nerve', 'স্নায়ু', 'মাথা', 'নিউরোলজি', 'নিউরোলজিস্ট'],
    'neurology': ['neurology', 'nerve', 'স্নায়ু', 'মাথা', 'নিউরোলজি', 'নিউরোলজিস্ট'],
    'stomach': ['gastroenterology', 'stomach', 'liver', 'লিভার', 'গ্যাস্ট্রিক', 'পেট', 'গ্যাস্ট্রোএন্টারোলজি'],
    'পেট': ['gastroenterology', 'stomach', 'liver', 'লিভার', 'গ্যাস্ট্রিক', 'পেট', 'গ্যাস্ট্রোএন্টারোলজি'],
    'গ্যাস্ট্রিক': ['gastroenterology', 'stomach', 'liver', 'লিভার', 'গ্যাস্ট্রিক', 'পেট', 'গ্যাস্ট্রোএন্টারোলজি'],
    'surgery': ['surgery', 'surgeon', 'সার্জারি', 'অপারেশন'],
    'surgeon': ['surgery', 'surgeon', 'সার্জারি', 'অপারেশন'],
    'সার্জারি': ['surgery', 'surgeon', 'সার্জারি', 'অপারেশন'],
    'mental': ['psychiatry', 'mental', 'মনোরোগ', 'মানসিক'],
    'মন': ['psychiatry', 'mental', 'মনোরোগ', 'মানসিক'],
    'মানসিক': ['psychiatry', 'mental', 'মনোরোগ', 'মানসিক'],
    'psychiatry': ['psychiatry', 'mental', 'মনোরোগ', 'মানসিক'],
  };

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const normalize = (str) =>
    (str || '')
      .toLowerCase()
      .replace(/[.,:;।\-_#()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const TITLE_WORDS = new Set([
    'dr', 'doctor', 'prof', 'professor', 'md',
    'ডাঃ', 'ডা', 'ডাক্তার', 'প্রফেসর', 'অধ্যাপক', 'মোঃ'
  ]);

  const matchesDoctorName = (doc, query) => {
    const normQ = normalize(query);
    if (!normQ) return false;

    const normBn = normalize(doc.nameBn);
    const normEn = normalize(doc.nameEn);

    // Direct match
    if (normBn.includes(normQ) || normEn.includes(normQ)) return true;

    // Filter out title words for multi-word matching
    const qWords = normQ.split(' ').filter((w) => w.length > 0 && !TITLE_WORDS.has(w));
    if (qWords.length === 0) {
      return normBn.includes(normQ) || normEn.includes(normQ);
    }

    const matchesBn = qWords.every((w) => normBn.includes(w));
    const matchesEn = qWords.every((w) => normEn.includes(w));
    return matchesBn || matchesEn;
  };

  // Filter doctors based on doctor name, type, specialty, designation, degrees
  const matchingDoctors = isSearching
    ? allDoctors
        .map((doc) => {
          const isNameMatch = matchesDoctorName(doc, trimmedQuery);
          let isTypeMatch = false;

          const q = trimmedQuery;

          // Department / doc type match
          if (
            (doc.departmentId && doc.departmentId.toLowerCase().includes(q)) ||
            (doc.departmentNameBn && doc.departmentNameBn.toLowerCase().includes(q)) ||
            (doc.departmentNameEn && doc.departmentNameEn.toLowerCase().includes(q)) ||
            (doc.deptDescBn && doc.deptDescBn.toLowerCase().includes(q)) ||
            (doc.deptDescEn && doc.deptDescEn.toLowerCase().includes(q))
          ) {
            isTypeMatch = true;
          } else if (
            (doc.designationBn && doc.designationBn.toLowerCase().includes(q)) ||
            (doc.designationEn && doc.designationEn.toLowerCase().includes(q)) ||
            (doc.degreesBn && doc.degreesBn.toLowerCase().includes(q)) ||
            (doc.degreesEn && doc.degreesEn.toLowerCase().includes(q)) ||
            (doc.hospitalBn && doc.hospitalBn.toLowerCase().includes(q)) ||
            (doc.hospitalEn && doc.hospitalEn.toLowerCase().includes(q)) ||
            (doc.chamberBn && doc.chamberBn.toLowerCase().includes(q)) ||
            (doc.chamberEn && doc.chamberEn.toLowerCase().includes(q))
          ) {
            isTypeMatch = true;
          } else {
            for (const [key, aliases] of Object.entries(typeSynonyms)) {
              if (q === key || q.includes(key) || key.includes(q)) {
                const hasMatch = aliases.some(
                  (a) =>
                    (doc.departmentId && doc.departmentId.toLowerCase().includes(a)) ||
                    (doc.departmentNameEn && doc.departmentNameEn.toLowerCase().includes(a)) ||
                    (doc.departmentNameBn && doc.departmentNameBn.toLowerCase().includes(a)) ||
                    (doc.designationEn && doc.designationEn.toLowerCase().includes(a)) ||
                    (doc.designationBn && doc.designationBn.toLowerCase().includes(a))
                );
                if (hasMatch) {
                  isTypeMatch = true;
                  break;
                }
              }
            }
          }

          const matched = isNameMatch || isTypeMatch;

          return { ...doc, isNameMatch, matched };
        })
        .filter((doc) => doc.matched)
        // Doctor name matches appear first!
        .sort((a, b) => (b.isNameMatch ? 1 : 0) - (a.isNameMatch ? 1 : 0))
    : [];

  // Every doctor department, shown in the home grid
  const departmentList = allDepts.map((dept) => ({
    id: dept.id,
    nameBn: dept.nameBn || dept.nameEn || '',
    // Full saved name, the same as Doctor Details and the doctor cards show
    nameEn: dept.nameEn || dept.nameBn || '',
    icon: deptIconFor(dept) || '🏥',
    bgColor: /^#[0-9a-f]{6}$/i.test(dept.color || '') ? `${dept.color}1A` : '#E6F5F6',
  }));

  // Filtered department list when searching
  const filteredSpecialties = departmentList.filter((item) => {
    if (!trimmedQuery) return true;
    return (
      item.nameBn.toLowerCase().includes(trimmedQuery) ||
      item.nameEn.toLowerCase().includes(trimmedQuery) ||
      item.id.toLowerCase().includes(trimmedQuery)
    );
  });

  const handleSpecialtyPress = (item) => {
    const fullDept =
      allDepts.find((d) => d.id === item.id) || allDepts[0];
    if (onSelectDepartment) {
      onSelectDepartment(fullDept);
    }
  };

  // Appointments / Profile are popups over Home: once closed, Home is the selected tab again
  useEffect(() => {
    if (!showProfileModal && !showAppointmentDetailsModal && activeTab !== 'home') setActiveTab('home');
  }, [showProfileModal, showAppointmentDetailsModal]);

  const handleSaveAge = async () => {
    const bnDigits = '০১২৩৪৫৬৭৮৯';
    const value = Number(ageInput.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d))));
    if (!ageInput || !Number.isInteger(value) || value < 1 || value > 120) {
      setAgeError(isBn ? 'সঠিক বয়স দিন (১–১২০)।' : 'Enter a valid age (1–120).');
      return;
    }
    setSavingAge(true);
    try {
      const saved = await updatePatientAge(user?.phone, value);
      if (onUpdateUser) onUpdateUser({ age: saved });
      setEditingAge(false);
    } catch (e) {
      console.warn('Saving age failed:', e);
      setAgeError(isBn ? 'বয়স সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।' : "Couldn't save the age. Please try again.");
    } finally {
      setSavingAge(false);
    }
  };

  const handleTabPress = (tab) => {
    setSelectedDoctorForBooking(null);
    setActiveTab(tab);
    if (tab === 'appointments') {
      if (user?.isRegistrar && onNavigateToAppointments) onNavigateToAppointments(null);
      else setShowAppointmentDetailsModal(true);
    } else if (tab === 'profile') {
      setShowProfileModal(true);
    }
  };

  if (selectedDoctorForBooking) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <BookAppointmentScreen
            doctor={selectedDoctorForBooking}
            user={user}
            lang={lang}
            onChangeLang={onChangeLang}
            onBack={() => setSelectedDoctorForBooking(null)}
          />
        </View>
        {user?.isRegistrar ? (
          <RegistrarTabBar
            active="home"
            lang={lang}
            onPress={(tab) => (tab === 'home' ? setSelectedDoctorForBooking(null) : onRegistrarTab && onRegistrarTab(tab))}
          />
        ) : (
          <PatientTabBar active={activeTab} lang={lang} onPress={handleTabPress} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Banner with Medical Pattern Background Wash */}
        <ImageBackground
          source={require('../../assets/medical_pattern.jpg')}
          style={styles.bannerBackground}
          resizeMode="cover"
        >
          <View style={[styles.bannerWhiteWash, { paddingTop: insets.top + 8 }]}>
            {/* Top Navigation Row */}
            <View style={styles.topNavRow}>
              {/* Same width as the bell, so the language switch sits in the exact middle */}
              <View style={styles.navSideSpacer} />

              {/* Language Switcher (centre) */}
              <LanguageSwitcher lang={lang} onChangeLang={onChangeLang} />

              {/* Notification Bell (right) */}
              <View style={styles.topRightActions}>
                <TouchableOpacity
                  style={styles.circleNavBtn}
                  onPress={handleOpenNotifications}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bellIcon}>🔔</Text>
                  {unreadReminders.length > 0 && <View style={styles.bellDot} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Banner Main Section: Text on Left + Doctor Image on Right */}
            <View style={styles.bannerContentRow}>
              <View style={styles.bannerTextCol}>
                <Text style={styles.helloGreeting}>
                  {t.hello} {user?.name ? user.name.split(' ')[0] : ''}
                </Text>
                <Text style={styles.takeCareHeading}>{t.takeCareTitle}</Text>
                <Text style={styles.takeCareSubtitle}>{t.takeCareSub}</Text>
              </View>

              <View style={styles.bannerImageCol}>
                <Image
                  source={require('../../assets/doctor_illustration.jpg')}
                  style={styles.bannerDoctorImage}
                  resizeMode="contain"
                />
                <View style={styles.floatingHeartBadge}>
                  <Text style={styles.floatingHeartText}>❤️</Text>
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>

        {/* Content Body */}
        <View style={styles.bodyContent}>

          {/* Search Bar Input */}
          <View style={styles.searchBarWrapper}>
            <Image
              source={require('../../assets/search_icon.png')}
              style={styles.searchGlassImage}
              resizeMode="contain"
            />
            <TextInput
              style={styles.searchInput}
              placeholder={
                isBn
                  ? 'ডাক্তারের নাম বা স্পেশালিটি খুঁজুন...'
                  : 'Search doctor name or specialty...'
              }
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity
                style={styles.filterBtn}
                activeOpacity={0.7}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.filterIcon}>✕</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.searchFilterBadge}>
                <Text style={styles.filterIcon}>🩺</Text>
              </View>
            )}
          </View>

          {isSearching ? (
            /* --- SEARCH RESULTS SECTION: Shows Doctor Names & Cards --- */
            <View style={styles.searchResultsSection}>
              {/* Results count header */}
              <View style={styles.searchResultsHeaderRow}>
                <View style={styles.resultsCountBadge}>
                  <Text style={styles.searchResultsTitle}>
                    {isBn ? 'ডাক্তারের তালিকা' : 'Available Doctors'}
                  </Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>
                      {matchingDoctors.length} {isBn ? 'জন' : 'found'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => setSearchQuery('')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearSearchBtnText}>
                    {isBn ? '✕ মুছুন' : '✕ Clear'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Departments whose name matches the search */}
              {filteredSpecialties.length > 0 && (
                <View style={styles.searchDeptSection}>
                  <Text style={styles.searchDeptTitle}>
                    {isBn ? `🏥 বিভাগ (${filteredSpecialties.length})` : `🏥 Departments (${filteredSpecialties.length})`}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.searchDeptRow}>
                    {filteredSpecialties.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.searchDeptChip}
                        onPress={() => handleSpecialtyPress(item)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.searchDeptIcon, { backgroundColor: item.bgColor }]}>
                          <DepartmentIcon icon={item.icon} size={18} />
                        </View>
                        <Text style={styles.searchDeptName} numberOfLines={2}>
                          {isBn ? item.nameBn : item.nameEn}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {matchingDoctors.length > 0 ? (
                matchingDoctors.map((doc) => (
                  <View
                    key={`${doc.departmentId}-${doc.id}`}
                    style={styles.searchDocCardContainer}
                  >
                    {/* Doctor Specialty / Department Tag & Name Match Tag */}
                    <View style={styles.doctorHeaderTagsRow}>
                      <View style={styles.doctorSpecialtyHeaderPill}>
                        <Text style={styles.doctorSpecialtyHeaderPillText}>
                          <DepartmentIcon icon={doc.deptIcon || '🩺'} size={12} textStyle={styles.doctorSpecialtyHeaderPillText} />{' '}
                          {isBn ? doc.departmentNameBn : doc.departmentNameEn}
                        </Text>
                      </View>
                      {doc.isNameMatch && (
                        <View style={styles.doctorNameMatchBadge}>
                          <Text style={styles.doctorNameMatchBadgeText}>
                            {isBn ? '✓ নাম মিলেছে' : '✓ Name Match'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <DoctorCard
                      doctor={doc}
                      lang={lang}
                      onBook={(d) => setSelectedDoctorForBooking(d)}
                    />
                  </View>
                ))
              ) : (
                /* Empty state when no doctor matches */
                <View style={styles.noSearchDoctorBox}>
                  <Text style={styles.noSearchEmoji}>👨‍⚕️</Text>
                  <Text style={styles.noSearchTitle}>
                    {isBn ? 'কোনো ডাক্তার পাওয়া যায়নি' : 'No Doctors Found'}
                  </Text>
                  <Text style={styles.noSearchSub}>
                    {isBn
                      ? `"${searchQuery}" বিষয়ে কোনো ডাক্তার খুঁজে পাওয়া যায়নি। নিচের যেকোনো বিষয়ে চাপ দিয়ে ডাক্তার খুঁজুন:`
                      : `No doctors matched "${searchQuery}". Tap any specialty below to view doctors:`}
                  </Text>

                  <View style={styles.quickSuggestedChips}>
                    {departmentList.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.suggestedChipBtn}
                        onPress={() => handleSpecialtyPress(item)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.suggestedChipBtnText}>
                          <DepartmentIcon icon={item.icon} size={12} textStyle={styles.suggestedChipBtnText} />{' '}
                          {isBn ? item.nameBn : item.nameEn}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* --- DEFAULT HOME VIEW --- */
            <>
              {/* 3 Quick Action Cards (patients only, hidden for registrar) */}
              {!user?.isRegistrar && (
              <View style={styles.quickActionsRow}>
                {/* 1. Find Doctor */}
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#E6F5F6', borderColor: '#BFE9ED' }]}
                  onPress={() => onSelectDepartment && onSelectDepartment(allDepts[0])}
                  activeOpacity={0.82}
                >
                  <View style={[styles.actionIconCircle, { backgroundColor: '#FFFFFF' }]}>
                    <Image
                      source={require('../../assets/find_doctor_icon.png')}
                      style={styles.actionIconImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[styles.actionCardTitle, { color: '#0E747F' }]}>
                    {t.findDoctor}
                  </Text>
                </TouchableOpacity>

                {/* 2. Book Appointment */}
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
                  onPress={() => onSelectDepartment && onSelectDepartment(allDepts[0])}
                  activeOpacity={0.82}
                >
                  <View style={[styles.actionIconCircle, { backgroundColor: '#FFFFFF' }]}>
                    <Image
                      source={require('../../assets/book_appointment_icon.png')}
                      style={styles.actionIconImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[styles.actionCardTitle, { color: '#B45309' }]}>
                    {t.bookAppointment}
                  </Text>
                </TouchableOpacity>

                {/* 3. My Appointments */}
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                  onPress={() => setShowAppointmentDetailsModal(true)}
                  activeOpacity={0.82}
                >
                  <View style={[styles.actionIconCircle, { backgroundColor: '#FFFFFF' }]}>
                    <Image
                      source={require('../../assets/my_appointments_icon.png')}
                      style={[styles.actionIconImage, { tintColor: '#DC2626' }]}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[styles.actionCardTitle, { color: '#DC2626' }]}>
                    {t.myAppointments}
                  </Text>
                </TouchableOpacity>
              </View>
              )}

              {/* Popular Specialties Section */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t.popularSpecialties}</Text>
              </View>

              {/* All departments, 3 per row */}
              <View style={styles.specialtiesGrid}>
                {[
                  ...filteredSpecialties,
                  // empty cells keep the last row's cards in their columns
                  ...Array.from({ length: (3 - (filteredSpecialties.length % 3)) % 3 }, (_, i) => ({
                    id: `filler-${i}`,
                    filler: true,
                  })),
                ].map((item) => item.filler ? (
                  <View key={item.id} style={styles.specialtyFiller} />
                ) : (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.specialtyItemCard}
                    onPress={() => handleSpecialtyPress(item)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.specialtyIconCircle, { backgroundColor: item.bgColor }]}>
                      <DepartmentIcon icon={item.icon} size={30} textStyle={styles.specialtyIcon} />
                    </View>
                    <Text style={styles.specialtyItemTitle} numberOfLines={3}>
                      {isBn ? item.nameBn : item.nameEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Upcoming Appointment Card (Only for patients, hidden for registrar) */}
              {!user?.isRegistrar && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>{t.upcomingAppointment}</Text>
                    <TouchableOpacity
                      onPress={() => setShowAppointmentDetailsModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.seeAllText}>{t.seeAll}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.upcomingCard}
                    onPress={() => setShowAppointmentDetailsModal(true)}
                    activeOpacity={0.9}
                  >
                    {nextAppointment ? (
                      <DoctorPhoto uri={nextAppointment.doctorImage} style={styles.upcomingAvatar} />
                    ) : (
                      <Image
                        source={require('../../assets/doctor_illustration.jpg')}
                        style={styles.upcomingAvatar}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.upcomingInfoCol}>
                      {nextAppointment ? (
                        <>
                          <Text style={styles.upcomingDocName}>
                            {isBn ? nextAppointment.doctorNameBn : nextAppointment.doctorNameEn}
                          </Text>
                          <Text style={styles.upcomingSpecialty}>
                            {isBn ? nextAppointment.departmentNameBn : nextAppointment.departmentNameEn}
                            {` • #${nextAppointment.serialNumber}`}
                          </Text>
                          <View style={styles.upcomingTimeRow}>
                            <Text style={styles.calendarIcon}>📅</Text>
                            <Text style={styles.upcomingTimeText}>
                              {nextAppointment.date} • {nextAppointment.timeSlot}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.upcomingDocName}>
                            {isBn ? 'কোনো সিরিয়াল নেই' : 'No upcoming appointment'}
                          </Text>
                          <Text style={styles.upcomingSpecialty}>
                            {isBn
                              ? 'একজন ডাক্তার বেছে নিয়ে সিরিয়াল বুক করুন'
                              : 'Pick a doctor to book a serial'}
                          </Text>
                        </>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.viewDetailsBtn}
                      onPress={() => setShowAppointmentDetailsModal(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.viewDetailsBtnText}>
                        {isBn ? 'বিস্তারিত >' : 'View Details >'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>


      {/* Bottom navigation, shared with the other patient pages */}
      {user?.isRegistrar ? (
        <RegistrarTabBar
          active="home"
          lang={lang}
          onPress={(tab) => tab !== 'home' && onRegistrarTab && onRegistrarTab(tab)}
          style={styles.bottomTabBar}
        />
      ) : (
        <PatientTabBar
          active={activeTab}
          lang={lang}
          onPress={handleTabPress}
          style={styles.bottomTabBar}
        />
      )}

      {/* Profile & Logout Modal */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <View style={styles.profileModalCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatarCircle}>
                <Image
                  source={require('../../assets/profile_tab_icon.png')}
                  style={styles.profileAvatarImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.profileHeaderInfo}>
                <Text style={styles.profileNameText}>
                  {user?.name || (isBn ? 'সম্মানিত রোগী' : 'Registered Patient')}
                </Text>
                <Text style={styles.profilePhoneText}>
                  {user?.phone || '01XXXXXXXXX'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowProfileModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfoBox}>
              {/* Age: tap to type it in (saved on the patient's record) */}
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{t.ageLabel}:</Text>
                {editingAge ? (
                  <View style={styles.ageEditRow}>
                    <TextInput
                      style={styles.ageInput}
                      value={ageInput}
                      onChangeText={(text) => {
                        setAgeInput(text.replace(/[^0-9০-৯]/g, ''));
                        setAgeError('');
                      }}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder={isBn ? 'বয়স' : 'Age'}
                      placeholderTextColor="#94A3B8"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.ageSaveBtn} onPress={handleSaveAge} disabled={savingAge}>
                      <Text style={styles.ageSaveText}>{savingAge ? '…' : isBn ? 'সংরক্ষণ' : 'Save'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingAge(false); setAgeError(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.ageCancelText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.ageValueBtn}
                    onPress={() => {
                      setAgeInput(user?.age ? String(user.age) : '');
                      setAgeError('');
                      setEditingAge(true);
                    }}
                  >
                    <Text style={styles.profileRowValue}>
                      {user?.age ? `${user.age} ${t.ageSuffix}` : isBn ? 'যোগ করুন' : 'Add'}
                    </Text>
                    <Text style={styles.ageEditIcon}>✏️</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!!ageError && <Text style={styles.ageErrorText}>{ageError}</Text>}
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{t.statusLabel}:</Text>
                <Text style={[styles.profileRowValue, { color: '#10B981', fontWeight: '800' }]}>
                  {t.activeStatus}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalLogoutBtn}
              onPress={() => {
                setShowProfileModal(false);
                if (onLogout) onLogout();
              }}
              activeOpacity={0.85}
            >
              <LogoutIcon size={16} color="#DC2626" style={styles.modalLogoutIcon} />
              <Text style={styles.modalLogoutText}>{t.signOutBtn}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Upcoming Appointment Details Modal */}
      <Modal
        visible={showAppointmentDetailsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAppointmentDetailsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAppointmentDetailsModal(false)}
        >
          <View style={styles.appointmentModalCard}>
            <View style={styles.appointmentModalHeader}>
              <Text style={styles.appointmentModalTitle}>
                {showHistory
                  ? isBn ? 'সিরিয়াল ইতিহাস' : 'Serial History'
                  : isBn ? 'আমার সিরিয়াল' : 'My Appointments'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAppointmentDetailsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.myAptPhoneNote}>
              📞 {user?.phone || ''}
            </Text>

            {/* Switch between current serials and past ones */}
            <TouchableOpacity
              style={styles.historyToggleBtn}
              onPress={() => {
                setShowHistory(!showHistory);
                setConfirmCancelId(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.historyToggleText}>
                {showHistory
                  ? `← ${isBn ? 'বর্তমান সিরিয়াল' : 'Current serials'} (${currentAppointments.length})`
                  : `🕘 ${isBn ? 'সিরিয়াল ইতিহাস' : 'Serial history'} (${historyAppointments.length})`}
              </Text>
            </TouchableOpacity>

            {shownAppointments.length === 0 ? (
              <View style={styles.serialBadgeCard}>
                <Text style={styles.serialBadgeLabel}>
                  {showHistory
                    ? isBn ? 'কোনো পুরনো সিরিয়াল নেই' : 'NO PAST SERIALS'
                    : isBn ? 'কোনো চলতি সিরিয়াল নেই' : 'NO UPCOMING SERIALS'}
                </Text>
                <Text style={styles.serialBadgeTime}>
                  {showHistory
                    ? isBn
                      ? 'তারিখ ও সময় পেরিয়ে যাওয়া সিরিয়াল এখানে দেখাবে।'
                      : 'Serials whose date and time have passed will show here.'
                    : isBn
                    ? 'এই ফোন নম্বরে বুক করা সিরিয়াল এখানে দেখাবে।'
                    : 'Serials booked with this phone number will show here.'}
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.myAptList} nestedScrollEnabled>
                {shownAppointments.map((apt) => (
                  <View key={apt.id} style={styles.myAptItem}>
                    <View style={[styles.serialBadgeCard, showHistory && styles.historyBadgeCard]}>
                      <Text style={[styles.serialBadgeLabel, showHistory && styles.historyBadgeLabel]}>
                        {isBn ? 'সিরিয়াল নম্বর' : 'SERIAL'} • {statusLabel(apt)}
                      </Text>
                      <Text style={styles.serialBadgeNumber}>
                        #{String(apt.serialNumber).padStart(2, '0')}
                      </Text>
                      <Text style={styles.serialBadgeTime}>
                        {apt.date} • {apt.timeSlot}
                      </Text>
                    </View>

                    <View style={styles.appointmentDetailRow}>
                      <Text style={styles.detailLabel}>{isBn ? 'ডাক্তার:' : 'Doctor:'}</Text>
                      <Text style={styles.detailValue}>
                        {isBn ? apt.doctorNameBn : apt.doctorNameEn}
                      </Text>
                    </View>

                    <View style={styles.appointmentDetailRow}>
                      <Text style={styles.detailLabel}>{isBn ? 'চেম্বার:' : 'Chamber:'}</Text>
                      <Text style={styles.detailValue}>{apt.chamber}</Text>
                    </View>

                    <View style={styles.appointmentDetailRow}>
                      <Text style={styles.detailLabel}>{isBn ? 'রোগী:' : 'Patient:'}</Text>
                      <Text style={styles.detailValue}>{apt.patientName}</Text>
                    </View>

                    {/* Cancel a pending serial: first tap asks, second tap cancels */}
                    {isPending(apt) &&
                      (confirmCancelId === apt.id ? (
                        <View style={styles.cancelConfirmBox}>
                          <Text style={styles.cancelConfirmText}>
                            {isBn
                              ? `সিরিয়াল #${apt.serialNumber} বাতিল করবেন?`
                              : `Cancel serial #${apt.serialNumber}?`}
                          </Text>
                          <View style={styles.cancelConfirmRow}>
                            <TouchableOpacity
                              style={styles.cancelKeepBtn}
                              onPress={() => setConfirmCancelId(null)}
                              disabled={cancellingId === apt.id}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.cancelKeepText}>{isBn ? 'না, রাখুন' : 'No, keep it'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.cancelYesBtn}
                              onPress={() => handleCancelAppointment(apt)}
                              disabled={cancellingId === apt.id}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.cancelYesText}>
                                {cancellingId === apt.id
                                  ? isBn ? 'বাতিল হচ্ছে…' : 'Cancelling…'
                                  : isBn ? 'হ্যাঁ, বাতিল' : 'Yes, cancel'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          {cancelError === apt.id && (
                            <Text style={styles.cancelErrorText}>
                              {isBn
                                ? 'বাতিল করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'
                                : "Couldn't cancel. Check your internet connection and try again."}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.cancelAptBtn}
                          onPress={() => {
                            setConfirmCancelId(apt.id);
                            setCancelError(null);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.cancelAptText}>
                            ✕ {isBn ? 'সিরিয়াল বাতিল করুন' : 'Cancel appointment'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.confirmModalBtn}
              onPress={() => setShowAppointmentDetailsModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmModalBtnText}>
                {isBn ? 'ঠিক আছে' : 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowNotificationModal(false)}
        >
          <View style={styles.appointmentModalCard}>
            <View style={styles.appointmentModalHeader}>
              <Text style={styles.appointmentModalTitle}>
                {isBn ? 'নোটিফিকেশন' : 'Notifications'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowNotificationModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            {shownNotifications.length === 0 ? (
              <Text style={styles.notificationEmpty}>
                {isBn ? 'কোনো নতুন নোটিফিকেশন নেই।' : 'No new notifications.'}
              </Text>
            ) : (
              shownNotifications.map(({ id, appointment: apt }) => {
                const doctorName = isBn ? apt.doctorNameBn || apt.doctorNameEn : apt.doctorNameEn || apt.doctorNameBn;
                const time = String(apt.timeSlot || apt.time || '').replace(/\s*\(.*\)\s*$/, '');
                const serial = apt.serialNumber || apt.serialNo;
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.notificationItem}
                    activeOpacity={0.85}
                    onPress={() => {
                      setShowNotificationModal(false);
                      setShowAppointmentDetailsModal(true);
                    }}
                  >
                    <Text style={styles.notificationDot}>⏰</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notificationTitle}>
                        {isBn ? 'সিরিয়াল রিমাইন্ডার' : 'Appointment reminder'}
                      </Text>
                      <Text style={styles.notificationSub}>
                        {isBn
                          ? `${doctorName} এর সাথে আপনার সিরিয়াল #${serial} আজ ${time}-এ। সময়মতো চেম্বারে পৌঁছান।`
                          : `Your serial #${serial} with ${doctorName} is today at ${time}. Please reach the chamber on time.`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity
              style={styles.confirmModalBtn}
              onPress={() => setShowNotificationModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmModalBtnText}>
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 90, // Leave room for fixed bottom tab bar
  },
  bannerBackground: {
    width: '100%',
  },
  bannerWhiteWash: {
    backgroundColor: 'rgba(255, 255, 255, 0.90)', // Soft white doodle pattern wash
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  // Spacer | language switch | bell: the switch stays centred
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  circleNavBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
  },
  menuIcon: {
    fontSize: 18,
    color: '#1E293B',
    fontWeight: 'bold',
  },
  navSideSpacer: {
    width: 42,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellIcon: {
    fontSize: 17,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  bannerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  bannerTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  helloGreeting: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  takeCareHeading: {
    fontSize: 23,
    fontWeight: '900',
    color: '#1E293B',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  takeCareSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    fontWeight: '500',
  },
  bannerImageCol: {
    width: 125,
    height: 135,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDoctorImage: {
    width: 125,
    height: 135,
    borderRadius: 18,
  },
  floatingHeartBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  floatingHeartText: {
    fontSize: 14,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#0E747F',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    marginBottom: 18,
  },
  searchGlassImage: {
    width: 20,
    height: 20,
    marginRight: 9,
  },
  searchGlassIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  filterBtn: {
    padding: 6,
  },
  filterIcon: {
    fontSize: 16,
    color: '#64748B',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionIconImage: {
    width: 28,
    height: 28,
  },
  actionCardTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0E747F',
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 20,
  },
  specialtyItemCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  searchDeptSection: {
    marginBottom: 14,
  },
  searchDeptTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  searchDeptRow: {
    gap: 10,
    paddingRight: 8,
  },
  searchDeptChip: {
    width: 104,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  searchDeptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  searchDeptName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  specialtyFiller: {
    width: '31%',
  },
  specialtyIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  specialtyIcon: {
    fontSize: 22,
  },
  specialtyItemTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F5F6',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CCECEF',
    marginBottom: 16,
  },
  upcomingAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#2EC4B6',
    marginRight: 12,
  },
  upcomingInfoCol: {
    flex: 1,
  },
  upcomingDocName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  upcomingSpecialty: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  upcomingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  upcomingTimeText: {
    fontSize: 10.5,
    color: '#0E747F',
    fontWeight: '700',
  },
  viewDetailsBtn: {
    backgroundColor: '#0E747F',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: '100%',
  },
  tabIcon: {
    fontSize: 18,
    color: '#94A3B8',
    marginBottom: 2,
  },
  tabIconActive: {
    color: '#0E747F',
  },
  tabIconImage: {
    width: 24,
    height: 24,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#0E747F',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 6,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#0E747F',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    elevation: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  profileAvatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E6F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileAvatarImage: {
    width: 28,
    height: 28,
  },
  profileHeaderInfo: {
    flex: 1,
  },
  profileNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  profilePhoneText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  closeModalText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: 'bold',
    padding: 4,
  },
  profileInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileRowLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  ageValueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ageEditIcon: {
    fontSize: 12,
  },
  ageEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ageInput: {
    width: 64,
    borderWidth: 1,
    borderColor: '#0E747F',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  ageSaveBtn: {
    backgroundColor: '#0E747F',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ageSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  ageCancelText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '800',
  },
  ageErrorText: {
    fontSize: 11.5,
    color: '#DC2626',
    marginBottom: 6,
    textAlign: 'right',
  },
  profileRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalLogoutBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  modalLogoutIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  modalLogoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  appointmentModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    elevation: 12,
  },
  appointmentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  appointmentModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  myAptPhoneNote: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
  },
  myAptList: {
    maxHeight: 420,
  },
  myAptItem: {
    marginBottom: 18,
  },
  historyToggleBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  historyToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  historyBadgeCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  historyBadgeLabel: {
    color: '#64748B',
  },
  cancelAptBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  cancelAptText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  cancelConfirmBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelConfirmText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#7F1D1D',
    textAlign: 'center',
    marginBottom: 10,
  },
  cancelConfirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelKeepBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelKeepText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  cancelYesBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  cancelYesText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
  },
  serialBadgeCard: {
    backgroundColor: '#E6F5F6',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFE9ED',
    marginBottom: 16,
  },
  serialBadgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E747F',
    letterSpacing: 1,
    marginBottom: 4,
  },
  serialBadgeNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0E747F',
  },
  serialBadgeTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  appointmentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailLabel: {
    fontSize: 12.5,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: '65%',
    textAlign: 'right',
  },
  confirmModalBtn: {
    backgroundColor: '#0E747F',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  notificationDot: {
    fontSize: 12,
    marginRight: 8,
    marginTop: 2,
  },
  notificationEmpty: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 18,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  notificationSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },

  /* Search & Filter Styles */
  searchFilterBadge: {
    padding: 6,
  },
  quickChipsScroll: {
    paddingBottom: 16,
    gap: 8,
  },
  quickChipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  quickChipItemSelected: {
    backgroundColor: '#0E747F',
    borderColor: '#0E747F',
  },
  quickChipIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  quickChipTextSelected: {
    color: '#FFFFFF',
  },
  searchResultsSection: {
    marginTop: 4,
    marginBottom: 24,
  },
  searchResultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  resultsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 8,
  },
  countPill: {
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0E747F',
  },
  clearSearchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  clearSearchBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  searchDocCardContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  doctorSpecialtyHeaderPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#BFE9ED',
  },
  doctorSpecialtyHeaderPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0E747F',
  },
  noSearchDoctorBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  noSearchEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  noSearchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  noSearchSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  quickSuggestedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestedChipBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestedChipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E747F',
  },
  doctorHeaderTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  doctorNameMatchBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  doctorNameMatchBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  registrarHomeBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  regBannerLeft: {
    marginBottom: 8,
  },
  regBannerTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  regBannerSub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  regBannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  regDocBtn: {
    backgroundColor: '#0E747F',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  regDocBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  regAptBtn: {
    backgroundColor: '#334155',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  regAptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
