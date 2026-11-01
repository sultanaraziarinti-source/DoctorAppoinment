import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  Image,
  ImageBackground,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LogoutIcon from '../components/LogoutIcon';
import DoctorPhoto from '../components/DoctorPhoto';
import RegistrarBookingModal from '../components/RegistrarBookingModal';
import RegistrarTabBar from '../components/RegistrarTabBar';
import { iconAsText } from '../components/DepartmentIcon';
import {
  loadAppointments,
  updateAppointmentStatus,
  deleteAppointment,
} from '../services/appointmentsStorage';

export default function AppointmentListScreen({
  departments = [],
  initialDoctor = null,
  lang = 'bn',
  onChangeLang,
  onNavigateToDoctorsInfo,
  onNavigateToHome,
  onLogout,
  onRegistrarTab, // bottom bar: 'doctors' | 'appointments' | 'home'
}) {
  const isBn = lang === 'bn';
  // Only the part of the status bar that actually covers the screen (none in Expo Go, all of it in the APK)
  const insets = useSafeAreaInsets();

  const [appointments, setAppointments] = useState([]);
  // Registrar books a serial for a patient from the desk
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(
    initialDoctor && initialDoctor.id && typeof initialDoctor.id === 'string'
      ? initialDoctor
      : null
  );

  // Filters for Step 1: Doctor List
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Filters for Step 2: Patient Serials
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Android Hardware / Phone Back Button Handler
  useEffect(() => {
    const onHardwareBack = () => {
      // 1. If currently viewing a specific doctor's serials list, return to Doctor selection list
      if (selectedDoctor) {
        setSelectedDoctor(null);
        return true;
      }
      // 2. If searching/filtering doctors, clear search query
      if (doctorSearchQuery.trim().length > 0 || selectedCategory !== 'all') {
        setDoctorSearchQuery('');
        setSelectedCategory('all');
        return true;
      }
      // 3. Otherwise let it bubble to App.js (returns to doctors-info or home)
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [selectedDoctor, doctorSearchQuery, selectedCategory]);

  const fetchAppointments = async () => {
    const list = await loadAppointments();
    setAppointments(list);
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    if (initialDoctor && initialDoctor.id && typeof initialDoctor.id === 'string') {
      setSelectedDoctor(initialDoctor);
    } else {
      setSelectedDoctor(null);
    }
  }, [initialDoctor]);

  // Aggregate unique doctors list from departments & appointments
  const doctorsList = useMemo(() => {
    const map = new Map();

    (departments || []).forEach((dept) => {
      (dept.doctors || []).forEach((doc) => {
        if (doc && doc.id && !map.has(doc.id)) {
          map.set(doc.id, {
            ...doc,
            categoryId: dept.id,
            categoryNameBn: dept.nameBn,
            categoryNameEn: dept.nameEn,
            categoryIcon: dept.icon,
          });
        }
      });
    });

    appointments.forEach((apt) => {
      if (apt.doctorId && !map.has(apt.doctorId)) {
        map.set(apt.doctorId, {
          id: apt.doctorId,
          nameBn: apt.doctorNameBn || apt.doctorNameEn,
          nameEn: apt.doctorNameEn || apt.doctorNameBn,
          categoryId: 'medicine',
          categoryNameBn: apt.departmentNameBn || 'মেডিসিন',
          categoryNameEn: apt.departmentNameEn || 'Medicine',
          categoryIcon: '🩺',
          chamberBn: apt.chamber,
          chamberEn: apt.chamber,
          image: apt.doctorImage || '',
          designationBn: 'বিশেষজ্ঞ চিকিৎসক',
          designationEn: 'Specialist Physician',
          degreesBn: 'এমবিবিএস',
          degreesEn: 'MBBS',
          experienceBn: '১০+ বছরের অভিজ্ঞতা',
          experienceEn: '10+ Years Exp.',
          feeBn: apt.fee || '৳১,০০০',
          feeEn: apt.fee || '৳1,000',
        });
      }
    });

    return Array.from(map.values());
  }, [departments, appointments]);

  // Available categories for Step 1 filter
  const categoryOptions = useMemo(() => {
    const cats = [{ id: 'all', nameBn: 'সকল বিভাগ', nameEn: 'All Departments', icon: '🩺' }];
    const seen = new Set();
    (departments || []).forEach((d) => {
      if (d.id && !seen.has(d.id)) {
        seen.add(d.id);
        cats.push({
          id: d.id,
          nameBn: d.nameBn,
          nameEn: d.nameEn,
          icon: d.icon || '🩺',
        });
      }
    });
    return cats;
  }, [departments]);

  // Helper to count serials for a doctor
  const getDoctorAppointmentCount = (doc) => {
    if (!doc) return 0;
    return appointments.filter((apt) => {
      if (apt.doctorId && doc.id && apt.doctorId === doc.id) return true;
      if (doc.nameBn && apt.doctorNameBn && apt.doctorNameBn.trim() === doc.nameBn.trim())
        return true;
      if (
        doc.nameEn &&
        apt.doctorNameEn &&
        apt.doctorNameEn.trim().toLowerCase() === doc.nameEn.trim().toLowerCase()
      )
        return true;
      return false;
    }).length;
  };

  // Helper to get appointments list for a doctor
  const getDoctorAppointmentsList = (doc) => {
    if (!doc) return [];
    return appointments.filter((apt) => {
      if (apt.doctorId && doc.id && apt.doctorId === doc.id) return true;
      if (doc.nameBn && apt.doctorNameBn && apt.doctorNameBn.trim() === doc.nameBn.trim())
        return true;
      if (
        doc.nameEn &&
        apt.doctorNameEn &&
        apt.doctorNameEn.trim().toLowerCase() === doc.nameEn.trim().toLowerCase()
      )
        return true;
      return false;
    });
  };

  // Filtered doctors for Step 1
  const filteredDoctors = useMemo(() => {
    return doctorsList.filter((doc) => {
      if (selectedCategory !== 'all' && doc.categoryId !== selectedCategory) {
        return false;
      }
      const q = doctorSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (doc.nameBn && doc.nameBn.toLowerCase().includes(q)) ||
        (doc.nameEn && doc.nameEn.toLowerCase().includes(q)) ||
        (doc.categoryNameBn && doc.categoryNameBn.toLowerCase().includes(q)) ||
        (doc.categoryNameEn && doc.categoryNameEn.toLowerCase().includes(q)) ||
        (doc.designationBn && doc.designationBn.toLowerCase().includes(q)) ||
        (doc.designationEn && doc.designationEn.toLowerCase().includes(q)) ||
        (doc.hospitalBn && doc.hospitalBn.toLowerCase().includes(q)) ||
        (doc.chamberBn && doc.chamberBn.toLowerCase().includes(q))
      );
    });
  }, [doctorsList, selectedCategory, doctorSearchQuery]);

  // Appointments specifically belonging to selectedDoctor
  const doctorAppointments = useMemo(() => {
    if (!selectedDoctor) return [];
    return appointments.filter((apt) => {
      const matchId = apt.doctorId && selectedDoctor.id && apt.doctorId === selectedDoctor.id;
      const matchBn =
        selectedDoctor.nameBn &&
        apt.doctorNameBn &&
        apt.doctorNameBn.trim() === selectedDoctor.nameBn.trim();
      const matchEn =
        selectedDoctor.nameEn &&
        apt.doctorNameEn &&
        apt.doctorNameEn.trim().toLowerCase() === selectedDoctor.nameEn.trim().toLowerCase();

      return matchId || matchBn || matchEn;
    });
  }, [appointments, selectedDoctor]);

  // Filtered appointments for Step 2 by search query
  const filteredAppointments = useMemo(() => {
    return doctorAppointments.filter((apt) => {
      const q = patientSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (apt.patientName && apt.patientName.toLowerCase().includes(q)) ||
        (apt.patientPhone && apt.patientPhone.includes(q)) ||
        (apt.serialNumber && apt.serialNumber.toString().includes(q)) ||
        (apt.reason && apt.reason.toLowerCase().includes(q))
      );
    });
  }, [doctorAppointments, patientSearchQuery]);

  const handleStatusChange = async (aptId, newStatus) => {
    const updated = await updateAppointmentStatus(aptId, newStatus);
    setAppointments(updated);
  };

  const handleDelete = (apt) => {
    Alert.alert(
      isBn ? 'সিরিয়াল মুছে ফেলুন' : 'Delete Serial',
      isBn
        ? `আপনি কি #${apt.serialNumber} (${apt.patientName}) এর সিরিয়াল মুছে ফেলতে চান?`
        : `Delete appointment #${apt.serialNumber} for ${apt.patientName}?`,
      [
        { text: isBn ? 'না' : 'Cancel', style: 'cancel' },
        {
          text: isBn ? 'হ্যাঁ, মুছুন' : 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteAppointment(apt.id);
            setAppointments(updated);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ========================================================
          STEP 2: SPECIFIC DOCTOR'S SERIALS LIST VIEW
          ======================================================== */}
      {selectedDoctor ? (
        <ScrollView style={styles.mainScrollView} showsVerticalScrollIndicator={false}>
          {/* Top Bar for Selected Doctor with Back Button */}
          <View style={styles.detailTopBar}>
            <TouchableOpacity
              style={styles.backToDoctorListBtn}
              onPress={() => setSelectedDoctor(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.backArrowIcon}>←</Text>
              <Text style={styles.backBtnText}>
                {isBn ? 'সকল ডাক্তার তালিকা' : 'All Doctors List'}
              </Text>
            </TouchableOpacity>

            <View style={styles.topRightActions}>
              <LanguageSwitcher lang={lang} onChangeLang={onChangeLang} />
              <TouchableOpacity style={styles.logoutMiniBtn} onPress={onLogout} activeOpacity={0.8}>
                <LogoutIcon size={15} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Doctor Profile Card */}
          <View style={styles.activeDoctorCard}>
            <View style={styles.activeDoctorTopRow}>
              <DoctorPhoto uri={selectedDoctor.image} style={styles.activeDoctorAvatar} />
              <View style={styles.activeDoctorDetails}>
                <View style={styles.activeDoctorNameRow}>
                  <Text style={styles.activeDoctorName} numberOfLines={1}>
                    {isBn ? selectedDoctor.nameBn : selectedDoctor.nameEn}
                  </Text>
                  <View style={styles.verifiedTag}>
                    <Text style={styles.verifiedTagText}>✓</Text>
                  </View>
                </View>

                <Text style={styles.activeDoctorDesignation} numberOfLines={1}>
                  {isBn
                    ? selectedDoctor.designationBn || selectedDoctor.categoryNameBn || 'বিশেষজ্ঞ'
                    : selectedDoctor.designationEn || selectedDoctor.categoryNameEn || 'Specialist'}
                  {selectedDoctor.degreesBn
                    ? ` • ${isBn ? selectedDoctor.degreesBn : selectedDoctor.degreesEn}`
                    : ''}
                </Text>

                <Text style={styles.activeDoctorMetaItem} numberOfLines={1}>
                  🏥 {isBn ? selectedDoctor.chamberBn || selectedDoctor.hospitalBn || 'চেম্বার' : selectedDoctor.chamberEn || selectedDoctor.hospitalEn || 'Chamber'}
                </Text>

                <Text style={styles.activeDoctorTimeItem} numberOfLines={1}>
                  🕒 {isBn ? selectedDoctor.availableBn || 'শনি - বুধ' : selectedDoctor.availableEn || 'Sat - Wed'}
                </Text>
              </View>
            </View>

            {/* Queue Statistics Bar */}
            <View style={styles.activeDoctorQueueBar}>
              <View style={styles.queueStatItem}>
                <Text style={styles.queueStatNumber}>{doctorAppointments.length}</Text>
                <Text style={styles.queueStatLabel}>
                  {isBn ? 'মোট সিরিয়াল' : 'Total Serials'}
                </Text>
              </View>
              <View style={styles.queueStatDivider} />
              <View style={styles.queueStatItem}>
                <Text style={[styles.queueStatNumber, { color: '#16A34A' }]}>
                  {doctorAppointments.filter((a) => a.status === 'confirmed').length}
                </Text>
                <Text style={styles.queueStatLabel}>{isBn ? 'নিশ্চিত' : 'Confirmed'}</Text>
              </View>
              <View style={styles.queueStatDivider} />
              <View style={styles.queueStatItem}>
                <Text style={[styles.queueStatNumber, { color: '#4F46E5' }]}>
                  {doctorAppointments.filter((a) => a.status === 'completed').length}
                </Text>
                <Text style={styles.queueStatLabel}>{isBn ? 'সম্পন্ন' : 'Completed'}</Text>
              </View>
            </View>
          </View>

          {/* Search & Status Filters */}
          <View style={styles.filterSection}>
            <View style={styles.searchBar}>
              <Image
                source={require('../../assets/search_icon.png')}
                style={styles.searchIconImage}
                resizeMode="contain"
              />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  isBn
                    ? 'রোগীর নাম, মোবাইল বা সিরিয়াল নং...'
                    : 'Search patient name, phone, serial...'
                }
                placeholderTextColor="#94A3B8"
                value={patientSearchQuery}
                onChangeText={setPatientSearchQuery}
              />
              {patientSearchQuery ? (
                <TouchableOpacity onPress={() => setPatientSearchQuery('')}>
                  <Text style={styles.clearSearchIcon}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

          </View>

          {/* Serials List */}
          <View style={styles.listContainer}>
            {/* Queue header: teal card so the doctor's queue stands out */}
            <View style={styles.queueHeaderCard}>
              <View style={styles.queueHeaderIcon}>
                <Text style={styles.queueHeaderIconText}>📋</Text>
              </View>
              <View style={styles.listHeaderTitleCol}>
                <Text style={styles.queueHeaderTitle}>
                  {isBn
                    ? `${selectedDoctor.nameBn}-এর সিরিয়াল তালিকা`
                    : `Queue for ${selectedDoctor.nameEn}`}
                </Text>
                <Text style={styles.queueHeaderSub}>
                  {isBn
                    ? 'সিরিয়াল ক্রম অনুযায়ী রোগীদের উপস্থিতির তথ্য'
                    : 'Patient queue ordered by serial number'}
                </Text>
              </View>
              <View style={styles.queueCountBadge}>
                <Text style={styles.queueCountNumber}>{filteredAppointments.length}</Text>
                <Text style={styles.queueCountLabel}>{isBn ? 'সিরিয়াল' : 'Serials'}</Text>
              </View>
            </View>

            {filteredAppointments.length > 0 ? (
              filteredAppointments.map((apt) => (
                <View key={apt.id} style={styles.appointmentCard}>
                  {/* Top Row: Serial Badge & Status */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.serialBadge}>
                      <Text style={styles.serialBadgeLabel}>SERIAL</Text>
                      <Text style={styles.serialBadgeNum}>#{apt.serialNumber}</Text>
                    </View>

                    <View style={styles.statusCol}>
                      <View
                        style={[
                          styles.statusPill,
                          apt.status === 'confirmed'
                            ? styles.statusConfirmed
                            : apt.status === 'completed'
                            ? styles.statusCompleted
                            : styles.statusCancelled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            apt.status === 'confirmed'
                              ? styles.statusTextConfirmed
                              : apt.status === 'completed'
                              ? styles.statusTextCompleted
                              : styles.statusTextCancelled,
                          ]}
                        >
                          {apt.status === 'confirmed'
                            ? isBn
                              ? '✓ নিশ্চিত'
                              : 'Confirmed'
                            : apt.status === 'completed'
                            ? isBn
                              ? '✓ সম্পন্ন'
                              : 'Completed'
                            : isBn
                            ? '✕ বাতিল'
                            : 'Cancelled'}
                        </Text>
                      </View>
                      <Text style={styles.dateTimeText}>
                        📅 {apt.date} • {apt.timeSlot}
                      </Text>
                    </View>
                  </View>

                  {/* Patient Info */}
                  <View style={styles.patientInfoBox}>
                    <View style={styles.infoLine}>
                      <Text style={styles.infoIcon}>👤</Text>
                      <Text style={styles.infoLabelBold}>
                        {isBn ? 'রোগী:' : 'Patient:'}{' '}
                      </Text>
                      <Text style={styles.infoValueText}>{apt.patientName}</Text>
                      {apt.patientAge ? (
                        <Text style={styles.ageBadge}>
                          ({apt.patientAge} {isBn ? 'বছর' : 'yrs'})
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.infoLine}>
                      <Text style={styles.infoIcon}>📞</Text>
                      <Text style={styles.infoLabelBold}>
                        {isBn ? 'মোবাইল:' : 'Phone:'}{' '}
                      </Text>
                      <Text style={styles.infoValueText}>{apt.patientPhone}</Text>
                    </View>

                    {apt.reason ? (
                      <View style={styles.infoLine}>
                        <Text style={styles.infoIcon}>🩺</Text>
                        <Text style={styles.infoLabelBold}>
                          {isBn ? 'সমস্যা:' : 'Reason:'}{' '}
                        </Text>
                        <Text style={styles.infoValueText}>{apt.reason}</Text>
                      </View>
                    ) : null}

                    {apt.fee ? (
                      <View style={styles.infoLine}>
                        <Text style={styles.infoIcon}>💳</Text>
                        <Text style={styles.infoLabelBold}>
                          {isBn ? 'ফি:' : 'Fee:'}{' '}
                        </Text>
                        <Text
                          style={[
                            styles.infoValueText,
                            { color: '#0E747F', fontWeight: '800' },
                          ]}
                        >
                          {apt.fee}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.cardActionsRow}>
                    {apt.status !== 'cancelled' && (
                      <TouchableOpacity
                        style={styles.btnCancel}
                        onPress={() => handleStatusChange(apt.id, 'cancelled')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.btnCancelText}>
                          ✕ {isBn ? 'বাতিল করুন' : 'Cancel'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.btnDelete}
                      onPress={() => handleDelete(apt)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnDeleteText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>
                  {isBn
                    ? `${selectedDoctor.nameBn}-এর জন্য কোনো সিরিয়াল নেই`
                    : `No appointments found for ${selectedDoctor.nameEn}`}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isBn
                    ? 'এই ডাক্তারের জন্য বর্তমানে কোনো রোগী সিরিয়াল বুক করেননি। রোগীরা সিরিয়াল বুক করলে এখানে স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।'
                    : 'No patients have booked appointments for this doctor yet.'}
                </Text>
                <TouchableOpacity
                  style={styles.viewAllEmptyBtn}
                  onPress={() => setSelectedDoctor(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewAllEmptyBtnText}>
                    ← {isBn ? 'অন্য ডাক্তার নির্বাচন করুন' : 'Select Another Doctor'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        /* ========================================================
           STEP 1: DOCTOR LIST VIEW (Select doctor to view serials)
           ======================================================== */
        <ScrollView style={styles.mainScrollView} showsVerticalScrollIndicator={false}>
          {/* Top Banner Styled like Home Page View */}
          <ImageBackground
            source={require('../../assets/medical_pattern.jpg')}
            style={styles.bannerBackground}
            resizeMode="cover"
          >
            <View style={[styles.bannerWhiteWash, { paddingTop: insets.top + 8 }]}>
              {/* Language switch on its own line, above the portal badge and logout */}
              <View style={styles.langRow}>
                <LanguageSwitcher lang={lang} onChangeLang={onChangeLang} />
              </View>

              {/* Top Navigation Row */}
              <View style={styles.topNavRow}>
                <View style={styles.badgeRegistrar}>
                  <Text style={styles.badgeRegistrarText} numberOfLines={1} adjustsFontSizeToFit>
                    🛡️ {isBn ? 'রেজিস্ট্রার অ্যাডমিন পোর্টাল' : 'Registrar Admin Portal'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.logoutPill}
                  onPress={onLogout}
                  activeOpacity={0.8}
                >
                  <LogoutIcon size={15} />
                  <Text style={styles.logoutPillText}>
                    {isBn ? 'লগআউট' : 'Logout'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Banner Main Section */}
              <View style={styles.bannerContentRow}>
                <View style={styles.bannerTextCol}>
                  <Text style={styles.helloGreeting}>
                    {isBn ? 'স্বাগতম, রেজিস্টার' : 'Welcome, Registrar'}
                  </Text>
                  <Text style={styles.takeCareHeading}>
                    {isBn ? 'সিরিয়াল তালিকা ডেস্ক' : 'Appointment Desk'}
                  </Text>
                  <Text style={styles.takeCareSubtitle}>
                    {isBn
                      ? 'যেকোনো ডাক্তারের নামের ওপর ট্যাপ করে তাঁর নির্দিষ্ট সিরিয়াল ও রোগীর তালিকা দেখুন।'
                      : 'Tap on any doctor to view their specific patient serials & appointment queue.'}
                  </Text>

                  <TouchableOpacity
                    style={[styles.refreshBannerBtn, styles.makeAptBannerBtn]}
                    onPress={() => setShowBookingModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.makeAptBannerBtnText}>
                      ➕ {isBn ? 'অ্যাপয়েন্টমেন্ট করুন' : 'Make Appointment'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.bannerImageCol}>
                  <Image
                    source={require('../../assets/registrar_reception.png')}
                    style={styles.bannerReceptionImage}
                    resizeMode="cover"
                  />
                  <View style={styles.floatingHeartBadge}>
                    <Text style={styles.floatingHeartText}>📋</Text>
                  </View>
                </View>
              </View>

            </View>
          </ImageBackground>

          {/* Search & Category Filter Section */}
          <View style={styles.filterSection}>
            <View style={styles.searchBar}>
              <Image
                source={require('../../assets/search_icon.png')}
                style={styles.searchIconImage}
                resizeMode="contain"
              />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  isBn
                    ? 'ডাক্তার নাম বা বিভাগ দিয়ে খুঁজুন...'
                    : 'Search doctor name or department...'
                }
                placeholderTextColor="#94A3B8"
                value={doctorSearchQuery}
                onChangeText={setDoctorSearchQuery}
              />
              {doctorSearchQuery ? (
                <TouchableOpacity onPress={() => setDoctorSearchQuery('')}>
                  <Text style={styles.clearSearchIcon}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

          </View>

          {/* Doctors List */}
          <View style={styles.listContainer}>
            <View style={styles.listHeaderRow}>
              <View style={styles.listHeaderTitleCol}>
                <Text style={styles.listTitle}>
                  👨‍⚕️ {isBn ? 'সকল ডাক্তার তালিকা' : 'All Doctors List'}
                </Text>
                <Text style={styles.listSubTitle}>
                  {isBn
                    ? 'ডাক্তারের নামের কার্ডে চাপ দিলে ওই ডাক্তারের নির্দিষ্ট সিরিয়াল তালিকা খুলবে'
                    : 'Click any doctor to view their serial queue'}
                </Text>
              </View>

              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>
                  {filteredDoctors.length} {isBn ? 'জন ডাক্তার' : 'Doctors'}
                </Text>
              </View>
            </View>

            {filteredDoctors.length > 0 ? (
              filteredDoctors.map((doc) => {
                const count = getDoctorAppointmentCount(doc);

                return (
                  <TouchableOpacity
                    key={doc.id}
                    style={styles.doctorItemCard}
                    onPress={() => setSelectedDoctor(doc)}
                    activeOpacity={0.85}
                  >
                    {/* Top Row: Category Badge & Queue Counter */}
                    <View style={styles.docItemTopRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {iconAsText(doc.categoryIcon)} {isBn ? doc.categoryNameBn : doc.categoryNameEn}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.queueCountBadge,
                          count > 0 ? styles.queueCountBadgeActive : styles.queueCountBadgeZero,
                        ]}
                      >
                        <Text
                          style={[
                            styles.queueCountBadgeText,
                            count > 0
                              ? styles.queueCountBadgeTextActive
                              : styles.queueCountBadgeTextZero,
                          ]}
                        >
                          📋 {count > 0
                            ? `${count} ${isBn ? 'জন সিরিয়ালে' : 'in Queue'}`
                            : isBn
                            ? 'কোনো সিরিয়াল নেই'
                            : 'No Queue'}
                        </Text>
                      </View>
                    </View>

                    {/* Main Info Row */}
                    <View style={styles.docItemMainInfo}>
                      <DoctorPhoto uri={doc.image} style={styles.docItemAvatar} />

                      <View style={styles.docItemDetails}>
                        <Text style={styles.docItemName}>
                          {isBn ? doc.nameBn : doc.nameEn}
                        </Text>
                        <Text style={styles.docItemDesignation}>
                          {isBn
                            ? doc.designationBn || doc.categoryNameBn || 'বিশেষজ্ঞ'
                            : doc.designationEn || doc.categoryNameEn || 'Specialist'}
                        </Text>
                        {doc.degreesBn ? (
                          <Text style={styles.docItemDegrees}>
                            {isBn ? doc.degreesBn : doc.degreesEn}
                          </Text>
                        ) : null}

                        <View style={styles.docItemMetaBox}>
                          <Text style={styles.docItemMetaText} numberOfLines={1}>
                            🏥 {isBn ? doc.chamberBn || doc.hospitalBn || 'চেম্বার' : doc.chamberEn || doc.hospitalEn || 'Chamber'}
                          </Text>
                          <Text style={styles.docItemMetaText} numberOfLines={1}>
                            🕒 {isBn ? doc.availableBn || 'শনি - বুধ' : doc.availableEn || 'Sat - Wed'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Footer Action Row */}
                    <View style={styles.docItemFooterRow}>
                      <View style={styles.docItemFeeBox}>
                        <Text style={styles.docItemFeeText}>
                          💰 {isBn ? 'ফি:' : 'Fee:'} {(isBn ? doc.feeBn || doc.feeEn : doc.feeEn || doc.feeBn) || doc.fee || '৳১,০০০'}
                        </Text>
                      </View>

                      <View style={styles.viewQueueButton}>
                        <Text style={styles.viewQueueButtonText}>
                          {isBn ? 'সিরিয়াল তালিকা দেখুন' : 'View Patient Queue'} →
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>👨‍⚕️</Text>
                <Text style={styles.emptyTitle}>
                  {isBn ? 'কোনো ডাক্তার পাওয়া যায়নি' : 'No Doctors Found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isBn
                    ? 'অন্য নাম বা বিভাগ নির্বাচন করে পুনরায় চেষ্টা করুন।'
                    : 'Try searching with another doctor name or department.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Appointment List tab from inside a doctor's queue goes back to the doctor list */}
      <RegistrarTabBar
        active="appointments"
        lang={lang}
        onPress={(tab) => {
          if (tab === 'appointments') setSelectedDoctor(null);
          else if (onRegistrarTab) onRegistrarTab(tab);
        }}
      />

      <RegistrarBookingModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        departments={departments}
        lang={lang}
        onBooked={fetchAppointments}
        activeTab="appointments"
        onTabPress={(tab) => {
          setShowBookingModal(false);
          if (tab === 'appointments') setSelectedDoctor(null);
          else if (onRegistrarTab) onRegistrarTab(tab);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainScrollView: {
    flex: 1,
  },

  /* TOP BANNER STYLES */
  bannerBackground: {
    width: '100%',
  },
  bannerWhiteWash: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  langRow: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  // Portal badge and logout share the row equally, same width and height
  badgeRegistrar: {
    width: '48%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFE9ED',
  },
  badgeRegistrarText: {
    color: '#0E747F',
    fontSize: 11.5,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Same size and shape as the portal badge beside it
  logoutPill: {
    width: '48%',
    flexDirection: 'row',
    gap: 7,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  logoutPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  bannerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  bannerTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  helloGreeting: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  takeCareHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 25,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  takeCareSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    fontWeight: '500',
    marginBottom: 10,
  },
  // The desk's main action: large and bright so it stands out
  makeAptBannerBtn: {
    marginTop: 10,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D97706',
    elevation: 5,
    shadowColor: '#D97706',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  makeAptBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  refreshBannerBtn: {
    backgroundColor: '#0E747F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    alignSelf: 'flex-start',
    elevation: 2,
  },
  refreshBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  bannerImageCol: {
    width: 125,
    height: 140,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerReceptionImage: {
    width: 125,
    height: 140,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFE9ED',
  },
  floatingHeartBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  floatingHeartText: {
    fontSize: 12,
  },
  quickNavTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  navTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  navTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  navTabTextActive: {
    color: '#0E747F',
    fontWeight: '900',
  },

  /* STEP 2 TOP BAR */
  detailTopBar: {
    backgroundColor: '#FFFFFF',
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 42,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backToDoctorListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFE9ED',
  },
  backArrowIcon: {
    fontSize: 16,
    color: '#0E747F',
    fontWeight: '900',
    marginRight: 6,
  },
  backBtnText: {
    color: '#0E747F',
    fontSize: 12.5,
    fontWeight: '800',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutMiniBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  logoutMiniBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
  },

  /* SEARCH & FILTERS */
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  // same magnifier and size as the Home search bar
  searchIconImage: {
    width: 20,
    height: 20,
    marginRight: 9,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#1E293B',
    fontWeight: '500',
  },
  clearSearchIcon: {
    fontSize: 14,
    color: '#64748B',
    padding: 4,
  },
  categoryChipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#0E747F',
    borderColor: '#0E747F',
  },
  catChipIcon: {
    fontSize: 12,
    marginRight: 5,
  },
  catChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  statusFiltersRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipActive: {
    backgroundColor: '#0E747F',
    borderColor: '#0E747F',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },

  /* LIST COMMON STYLES */
  listContainer: {
    padding: 14,
    paddingBottom: 40,
  },
  queueHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E747F',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    gap: 12,
    elevation: 6,
    shadowColor: '#0E747F',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  queueHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueHeaderIconText: {
    fontSize: 22,
  },
  queueHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  queueHeaderSub: {
    fontSize: 11.5,
    color: '#CCFBF1',
    fontWeight: '600',
    marginTop: 3,
  },
  queueCountBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 64,
  },
  queueCountNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0E747F',
    lineHeight: 24,
  },
  queueCountLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0E747F',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  listHeaderTitleCol: {
    flex: 1,
    paddingRight: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  listSubTitle: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  badgePill: {
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFE9ED',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E747F',
  },

  /* STEP 1: DOCTOR ITEM CARD STYLES */
  doctorItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  docItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E747F',
  },
  queueCountBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  queueCountBadgeActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  queueCountBadgeZero: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  queueCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  queueCountBadgeTextActive: {
    color: '#15803D',
  },
  queueCountBadgeTextZero: {
    color: '#64748B',
  },
  docItemMainInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  docItemAvatar: {
    width: 62,
    height: 62,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  docItemDetails: {
    flex: 1,
  },
  docItemName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  docItemDesignation: {
    fontSize: 11.5,
    color: '#0E747F',
    fontWeight: '700',
    marginBottom: 2,
  },
  docItemDegrees: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 6,
  },
  docItemMetaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 6,
    gap: 3,
  },
  docItemMetaText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '500',
  },
  docItemFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  docItemFeeBox: {
    flex: 1,
  },
  docItemFeeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0E747F',
  },
  viewQueueButton: {
    backgroundColor: '#0E747F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewQueueButtonText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* STEP 2: ACTIVE DOCTOR CARD */
  activeDoctorCard: {
    margin: 14,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    elevation: 2,
    shadowColor: '#0E747F',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  activeDoctorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeDoctorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#0E747F',
  },
  activeDoctorDetails: {
    flex: 1,
  },
  activeDoctorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  activeDoctorName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    flexShrink: 1,
  },
  verifiedTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  activeDoctorDesignation: {
    fontSize: 11.5,
    color: '#0E747F',
    fontWeight: '700',
    marginBottom: 3,
  },
  activeDoctorMetaItem: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  activeDoctorTimeItem: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  activeDoctorQueueBar: {
    flexDirection: 'row',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  queueStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  queueStatNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0E747F',
  },
  queueStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  queueStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CCFBF1',
  },

  /* APPOINTMENT CARD */
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  serialBadge: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  serialBadgeLabel: {
    fontSize: 8.5,
    color: '#0E747F',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  serialBadgeNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0E747F',
  },
  statusCol: {
    alignItems: 'flex-end',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 3,
  },
  statusConfirmed: {
    backgroundColor: '#DCFCE7',
  },
  statusCompleted: {
    backgroundColor: '#E0E7FF',
  },
  statusCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextConfirmed: {
    color: '#15803D',
  },
  statusTextCompleted: {
    color: '#4338CA',
  },
  statusTextCancelled: {
    color: '#DC2626',
  },
  dateTimeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  patientInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 4,
    marginBottom: 10,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 12,
    marginRight: 5,
  },
  infoLabelBold: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  infoValueText: {
    fontSize: 11.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  ageBadge: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  btnComplete: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  btnCompleteText: {
    color: '#16A34A',
    fontSize: 11.5,
    fontWeight: '800',
  },
  btnCancel: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  btnCancelText: {
    color: '#DC2626',
    fontSize: 11.5,
    fontWeight: '800',
  },
  btnDelete: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  btnDeleteText: {
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  viewAllEmptyBtn: {
    backgroundColor: '#0E747F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  viewAllEmptyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Embedded Doctor Appointments in Doctor Card */
  docAppointmentsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  docAppointmentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  docAppointmentsHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickQueueManageBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickQueueManageBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0369A1',
  },
  docAppointmentsList: {
    gap: 6,
    marginBottom: 6,
  },
  embeddedPatientRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  embeddedPatientTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  embeddedSerialPill: {
    backgroundColor: '#0E747F',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 8,
  },
  embeddedSerialPillText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  embeddedPatientDetails: {
    flex: 1,
  },
  embeddedPatientName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  embeddedPatientSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  embeddedPatientDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0E747F',
    marginTop: 1,
  },
  embeddedStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  embeddedStatusBadgeConfirmed: {
    backgroundColor: '#EFF6FF',
  },
  embeddedStatusBadgeCompleted: {
    backgroundColor: '#DCFCE7',
  },
  embeddedStatusBadgeCancelled: {
    backgroundColor: '#FEE2E2',
  },
  embeddedStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  embeddedStatusTextConfirmed: {
    color: '#2563EB',
  },
  embeddedStatusTextCompleted: {
    color: '#15803D',
  },
  embeddedStatusTextCancelled: {
    color: '#DC2626',
  },
  embeddedActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
  },
  miniBtnDone: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  miniBtnDoneText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  miniBtnCancel: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  miniBtnCancelText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '800',
  },
  miniBtnDelete: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniBtnDeleteText: {
    fontSize: 10,
  },
  noAptsNotice: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  noAptsNoticeText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
