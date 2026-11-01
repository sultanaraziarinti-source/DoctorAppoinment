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
  Alert,
  BackHandler,
} from 'react-native';
import { Colors } from '../theme/colors';
import DoctorCard from '../components/DoctorCard';
import LanguageSwitcher from '../components/LanguageSwitcher';
import DepartmentIcon from '../components/DepartmentIcon';
import PatientTabBar from '../components/PatientTabBar';
import RegistrarTabBar from '../components/RegistrarTabBar';
import { deptIconFor } from '../components/departmentLogos';
import { departmentsData } from '../data/doctorsData';
import BookAppointmentScreen from './BookAppointmentScreen';

export default function DoctorListScreen({
  department,
  user,
  lang = 'bn',
  onChangeLang,
  onBack,
  departments = departmentsData,
  onTabPress, // patient bottom bar: 'home' | 'appointments' | 'profile'
  onRegistrarTab, // registrar bottom bar: 'doctors' | 'appointments' | 'home'
}) {
  const allDepts = departments && departments.length > 0 ? departments : departmentsData;
  const [selectedDeptId, setSelectedDeptId] = useState(department?.id || 'medicine');
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Android Hardware / Phone Back Button Handler
  useEffect(() => {
    const onHardwareBack = () => {
      // 1. If in appointment booking modal/view, return to doctor list
      if (selectedDoctorForBooking) {
        setSelectedDoctorForBooking(null);
        return true;
      }
      // 2. If search query is active, clear search
      if (searchQuery.trim().length > 0) {
        setSearchQuery('');
        return true;
      }
      // 3. Navigate back to previous screen
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [selectedDoctorForBooking, searchQuery, onBack]);

  const isBn = lang === 'bn';
  const currentDept =
    allDepts.find((d) => d.id === selectedDeptId) || allDepts[0];

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

    if (normBn.includes(normQ) || normEn.includes(normQ)) return true;

    const qWords = normQ.split(' ').filter((w) => w.length > 0 && !TITLE_WORDS.has(w));
    if (qWords.length === 0) {
      return normBn.includes(normQ) || normEn.includes(normQ);
    }

    const matchesBn = qWords.every((w) => normBn.includes(w));
    const matchesEn = qWords.every((w) => normEn.includes(w));
    return matchesBn || matchesEn;
  };

  // Departments whose name matches the search, so typing a department name finds it from here too
  const deptQuery = searchQuery.trim().toLowerCase();
  const matchingDepts = deptQuery
    ? allDepts.filter(
        (d) => d.id !== currentDept.id &&
          [d.nameBn, d.nameEn].some((v) => String(v || '').toLowerCase().includes(deptQuery))
      )
    : [];
  const openDepartment = (id) => {
    setSelectedDeptId(id);
    setSearchQuery('');
  };

  const doctorsList = currentDept.doctors || [];
  const filteredDoctors = doctorsList.filter((doc) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    if (matchesDoctorName(doc, q)) return true;

    return (
      (doc.designationBn && doc.designationBn.toLowerCase().includes(q)) ||
      (doc.designationEn && doc.designationEn.toLowerCase().includes(q)) ||
      (doc.degreesBn && doc.degreesBn.toLowerCase().includes(q)) ||
      (doc.degreesEn && doc.degreesEn.toLowerCase().includes(q)) ||
      (doc.hospitalBn && doc.hospitalBn.toLowerCase().includes(q)) ||
      (doc.hospitalEn && doc.hospitalEn.toLowerCase().includes(q))
    );
  });

  const handleBook = (doctor) => {
    setSelectedDoctorForBooking(doctor);
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
          <RegistrarTabBar active="doctors" lang={lang} onPress={onRegistrarTab} />
        ) : (
          <PatientTabBar active="home" lang={lang} onPress={onTabPress} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0E747F" />

      {/* Header Banner with Medical Pattern */}
      <ImageBackground
        source={require('../../assets/medical_pattern.jpg')}
        style={styles.headerBackground}
        resizeMode="cover"
      >
        <View style={styles.headerOverlay}>
          {/* Top navigation row */}
          <View style={styles.topNavRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backIcon}>←</Text>
              <Text style={styles.backText}>{isBn ? 'ফিরে যান' : 'Back'}</Text>
            </TouchableOpacity>

            <LanguageSwitcher
              lang={lang}
              onChangeLang={onChangeLang}
              style={styles.langPill}
            />
          </View>

          {/* Department Info */}
          <View style={styles.deptHeader}>
            <View
              style={[
                styles.deptIconBadge,
                { backgroundColor: 'rgba(255, 255, 255, 0.22)' },
              ]}
            >
              <DepartmentIcon icon={deptIconFor(currentDept)} size={28} textStyle={styles.deptIcon} />
            </View>
            <View style={styles.deptInfo}>
              <Text style={styles.deptTitle}>
                {isBn ? currentDept.nameBn : currentDept.nameEn}
              </Text>
              <Text style={styles.deptDesc}>
                {isBn ? currentDept.descriptionBn : currentDept.descriptionEn}
              </Text>
              <Text style={styles.deptCount}>
                {isBn
                  ? `${currentDept.doctors?.length || 0} জন বিশেষজ্ঞ ডাক্তার উপলব্ধ`
                  : `${currentDept.doctors?.length || 0} Specialist Doctors Available`}
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* Quick Department Selector (Horizontal Tabs) */}
      <View style={styles.deptTabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deptTabsList}
        >
          {allDepts.map((dept) => {
            const isActive = dept.id === selectedDeptId;
            return (
              <TouchableOpacity
                key={dept.id}
                style={[styles.deptChip, isActive && styles.deptChipActive]}
                onPress={() => setSelectedDeptId(dept.id)}
                activeOpacity={0.8}
              >
                <DepartmentIcon icon={deptIconFor(dept)} size={14} textStyle={styles.chipIcon} />
                <Text
                  style={[
                    styles.chipText,
                    isActive && styles.chipTextActive,
                  ]}
                >
                  {isBn ? dept.nameBn : dept.nameEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Input for Doctors */}
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
              ? 'ডাক্তারের নাম বা পদবী দিয়ে খুঁজুন...'
              : 'Search doctor name or specialty...'
          }
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity
            style={styles.clearSearchBtn}
            onPress={() => setSearchQuery('')}
            activeOpacity={0.7}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Doctor Cards ScrollView */}
      <ScrollView
        contentContainerStyle={styles.cardsContainer}
        showsVerticalScrollIndicator={false}
      >
        {matchingDepts.length > 0 && (
          <View style={styles.matchDeptBox}>
            <Text style={styles.matchDeptTitle}>
              {isBn ? '🏥 মিলে যাওয়া বিভাগ' : '🏥 Matching departments'}
            </Text>
            <View style={styles.matchDeptRow}>
              {matchingDepts.map((dept) => (
                <TouchableOpacity
                  key={dept.id}
                  style={styles.deptChip}
                  onPress={() => openDepartment(dept.id)}
                  activeOpacity={0.8}
                >
                  <DepartmentIcon icon={deptIconFor(dept)} size={14} textStyle={styles.chipIcon} />
                  <Text style={styles.chipText}>{isBn ? dept.nameBn : dept.nameEn}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>
            {isBn ? 'উপলব্ধ ডাক্তার তালিকা' : 'Available Doctors'}
          </Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>
              {filteredDoctors.length} {isBn ? 'জন' : 'Doctors'}
            </Text>
          </View>
        </View>

        {filteredDoctors.length > 0 ? (
          filteredDoctors.map((doctor) => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              lang={lang}
              onBook={handleBook}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>👨‍⚕️</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? isBn
                  ? `"${searchQuery}" নামে কোনো ডাক্তার পাওয়া যায়নি।`
                  : `No doctors found matching "${searchQuery}".`
                : isBn
                ? 'এই বিভাগে বর্তমানে কোনো ডাক্তার পাওয়া যায়নি।'
                : 'No doctors available in this department.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {user?.isRegistrar ? (
        <RegistrarTabBar active="doctors" lang={lang} onPress={onRegistrarTab} />
      ) : (
        <PatientTabBar active="home" lang={lang} onPress={onTabPress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBackground: {
    width: '100%',
  },
  headerOverlay: {
    backgroundColor: 'rgba(14, 116, 127, 0.90)',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 18,
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  backIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginRight: 6,
    fontWeight: 'bold',
  },
  backText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  langPill: {
    alignSelf: 'auto',
  },
  deptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deptIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  deptIcon: {
    fontSize: 32,
  },
  deptInfo: {
    flex: 1,
  },
  deptTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  deptDesc: {
    fontSize: 12,
    color: '#D1FAF5',
    lineHeight: 16,
    marginBottom: 4,
  },
  deptCount: {
    fontSize: 11,
    color: '#A7F3D0',
    fontWeight: '700',
  },
  deptTabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  deptTabsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  deptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deptChipActive: {
    backgroundColor: '#0E747F',
    borderColor: '#0E747F',
  },
  matchDeptBox: {
    backgroundColor: '#E6F5F6',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  matchDeptTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0E747F',
    marginBottom: 8,
  },
  matchDeptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  cardsContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalBody: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  modalDoctorRow: {
    marginBottom: 8,
  },
  modalDoctorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0E747F',
  },
  modalDoctorDesignation: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  modalInfoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  modalInfoValue: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  confirmBtn: {
    backgroundColor: '#0E747F',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successCheck: {
    color: '#0E747F',
    fontSize: 32,
    fontWeight: '900',
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  serialBox: {
    width: '100%',
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    marginBottom: 20,
  },
  serialBoxLabel: {
    fontSize: 10,
    color: '#0E747F',
    fontWeight: '800',
    letterSpacing: 1,
  },
  serialBoxNum: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0E747F',
    marginVertical: 4,
  },
  serialBoxDate: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: '#0E747F',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0E747F',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  // same magnifier and size as the Home search bar
  searchGlassImage: {
    width: 20,
    height: 20,
    marginRight: 9,
  },
  searchGlassIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeCount: {
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0E747F',
  },
});
