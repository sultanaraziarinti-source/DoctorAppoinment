import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  StatusBar,
  Alert,
  BackHandler,
} from 'react-native';
import { Colors } from '../theme/colors';
import LanguageSwitcher from '../components/LanguageSwitcher';
import DoctorPhoto from '../components/DoctorPhoto';
import { saveAppointment } from '../services/appointmentsStorage';
import {
  buildDateOptions,
  appointmentStartISO,
  parseAvailability,
  slotsFromAvailability,
  parseSlotTime,
} from '../services/appointmentTime';
import { scheduleAppointmentReminder } from '../services/reminders';

export default function BookAppointmentScreen({
  doctor,
  user,
  lang = 'bn',
  onChangeLang,
  onBack,
  onBookingSuccess,
}) {
  const isBn = lang === 'bn';

  // Android Hardware / Phone Back Button Handler
  useEffect(() => {
    const onHardwareBack = () => {
      // 1. If confirmation popup is visible, dismiss it and return
      if (confirmedBooking) {
        setConfirmedBooking(null);
        if (onBack) onBack();
        return true;
      }
      // 2. Return to doctor details / list
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [confirmedBooking, onBack]);

  // Sample or provided doctor data fallback
  const doc = doctor || {
    id: 'default-doc',
    nameBn: 'ডাঃ সামিয়া করিম',
    nameEn: 'Dr. Samia Karim, MD',
    designationBn: 'সহযোগী অধ্যাপক - হৃদরোগ বিভাগ',
    designationEn: 'Associate Professor - Cardiology',
    degreesBn: 'এমবিবিএস, এফসিপিএস, এমডি',
    degreesEn: 'MBBS, FCPS, MD (Cardiology)',
    hospitalBn: 'জাতীয় হৃদরোগ ইনস্টিটিউট ও হাসপাতাল',
    hospitalEn: 'National Institute of Cardiovascular Diseases',
    chamberBn: 'পপুলার ডায়াগনস্টিক সেন্টার, শান্তিনগর, ঢাকা',
    chamberEn: 'Popular Diagnostic Centre, Shantinagar, Dhaka',
    feeBn: '৳১,২০০',
    feeEn: '৳1,200',
    rating: '4.8',
    reviews: 927,
    image:
      'https://images.unsplash.com/photo-1594824813576-0c0b89bf80f6?w=400&auto=format&fit=crop&q=80',
  };

  // The doctor's visiting days and hours, read from their availability text
  const availability = useMemo(() => {
    const fromEn = parseAvailability(doc.availableEn || doc.available);
    return fromEn.ranges.length > 0 ? fromEn : parseAvailability(doc.availableBn);
  }, [doc.availableEn, doc.availableBn, doc.available]);
  const availabilityText = (isBn ? doc.availableBn || doc.availableEn : doc.availableEn || doc.availableBn) || doc.available || '';
  const hasHours = availability.ranges.length > 0;
  const isOpenOn = (d) => !availability.days || availability.days.includes(d.weekday);

  // The coming week (real dates, so reminders know when the visit is)
  const [dateOptions] = useState(() => buildDateOptions(new Date(), 7));
  const [selectedDate, setSelectedDate] = useState(
    () => dateOptions.find((d) => !availability.days || availability.days.includes(d.weekday)) || dateOptions[0]
  );
  // No slot is chosen until the patient taps one
  const [selectedSlot, setSelectedSlot] = useState(null);

  // 15-minute slots inside the doctor's hours; for today, only the ones still ahead
  const currentSlots = useMemo(() => {
    if (!hasHours || !isOpenOn(selectedDate)) return [];
    const all = slotsFromAvailability(availability);
    if (!selectedDate.isToday) return all;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return all.filter((slot) => {
      const t = parseSlotTime(slot);
      return t && t.hours * 60 + t.minutes > nowMinutes;
    });
  }, [availability, selectedDate]);

  const handlePickDate = (d) => {
    setSelectedDate(d);
    setSelectedSlot(null);
  };
  const canConfirm = !!selectedSlot && currentSlots.includes(selectedSlot);

  // Success dialog
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const handleConfirmAppointment = async () => {
    if (!canConfirm) return;
    const booking = {
      doctor: doc,
      date: isBn ? selectedDate.cardDateBn : selectedDate.cardDateEn,
      timeSlot: `${selectedSlot} (${isBn ? '১৫ মিনিট' : '15 mins'})`,
      startsAt: appointmentStartISO(selectedDate.dateKey, selectedSlot),
      patientName: user?.name || (isBn ? 'রোগী' : 'Patient'),
      patientPhone: user?.phone || '',
      patientAge: user?.age || '',
      deviceId: user?.deviceId || null,
      fee: isBn ? doc.feeBn : doc.feeEn,
    };
    let confirmed = { ...booking, serialNumber: '--' };
    try {
      // Serial number comes from the doctor's queue for that day
      const { newAppointment } = await saveAppointment(booking);
      confirmed = { ...booking, serialNumber: newAppointment.serialNumber };
      // Remind the patient on this phone 2 hours before the visit
      scheduleAppointmentReminder(newAppointment, lang);
    } catch (e) {
      console.warn('Save apt error:', e);
    }
    setConfirmedBooking(confirmed);
    if (onBookingSuccess) {
      onBookingSuccess(confirmed);
    }
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F5" />

      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>{isBn ? 'ফিরে যান' : 'Back'}</Text>
        </TouchableOpacity>

        <LanguageSwitcher lang={lang} onChangeLang={onChangeLang} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Big Top Headline as seen in the screenshot */}
        <Text style={styles.mainTitle}>
          {isBn
            ? 'সময়সূচি দেখুন এবং\nতাৎক্ষণিক বুক করুন'
            : 'See availability and\nbook instantly'}
        </Text>

        {/* Main Floating Card Container */}
        <View style={styles.mainCard}>
          {/* Card Title */}
          <Text style={styles.cardHeaderTitle}>
            {isBn ? 'অ্যাপয়েন্টমেন্ট বুকিং' : 'Book an appointment'}
          </Text>

          {/* Doctor Profile Row */}
          <View style={styles.doctorRow}>
            <View style={styles.avatarWrapper}>
              <DoctorPhoto uri={doc.image} style={styles.doctorAvatar} />
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedCheck}>✓</Text>
              </View>
            </View>

            <View style={styles.doctorInfoCol}>
              <Text style={styles.doctorName}>
                {isBn ? doc.nameBn : doc.nameEn}
              </Text>
              <Text style={styles.doctorSpecialty}>
                {isBn ? doc.designationBn : doc.designationEn}
              </Text>

              {/* Location Row */}
              <View style={styles.metaRow}>
                <Text style={styles.metaIcon}>📍</Text>
                <Text style={styles.metaText} numberOfLines={2}>
                  {isBn
                    ? `৪.১ কিমি • ${doc.chamberBn}`
                    : `4.1 mi · ${doc.chamberEn}`}
                </Text>
              </View>

              {/* In-Network Status */}
              <View style={styles.networkRow}>
                <View style={styles.networkDot} />
                <Text style={styles.networkText}>
                  {isBn
                    ? 'ইন-নেটওয়ার্ক • চেম্বার ভেরিফাইড'
                    : 'In-network · Cigna'}
                </Text>
              </View>
            </View>
          </View>

          {/* Scheduling Details Header with 15-Minute Division Badge */}
          <View style={styles.schedulingHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>
              {isBn ? 'সময় নির্ধারণের বিবরণ' : 'Scheduling details'}
            </Text>
            <View style={styles.intervalDurationBadge}>
              <Text style={styles.intervalDurationText}>
                ⏱️ {isBn ? 'প্রতিটি ১৫ মিনিট' : '15 mins / slot'}
              </Text>
            </View>
          </View>

          {/* The doctor's visiting hours */}
          <View style={styles.hoursNote}>
            <Text style={styles.hoursNoteText}>
              🕒 {isBn ? 'রোগী দেখার সময়: ' : 'Visiting hours: '}
              <Text style={styles.hoursNoteValue}>{availabilityText || (isBn ? 'নির্ধারিত নেই' : 'Not set')}</Text>
            </Text>
          </View>

          {/* Date Selector Chips (days the doctor doesn't sit are off) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateChipsRow}>
            {dateOptions.map((d) => {
              const isSelected = selectedDate.id === d.id;
              const open = isOpenOn(d);
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.dateChip,
                    isSelected && styles.dateChipActive,
                    !open && styles.dateChipOff,
                  ]}
                  onPress={() => open && handlePickDate(d)}
                  disabled={!open}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      isSelected && styles.dateChipTextActive,
                      !open && styles.dateChipTextOff,
                    ]}
                  >
                    {isBn ? d.titleBn : d.titleEn}
                    {!open ? (isBn ? ' • বন্ধ' : ' • Off') : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time Slot Stack / Card Container with 15-Minute Intervals */}
          <View style={styles.slotCardContainer}>
            {/* Background stack shadow layer mimicking the layered cards in image */}
            <View style={styles.slotCardUnderlay}>
              <View style={styles.underlaySlotsPreview}>
                {currentSlots.slice(0, 8).map((time, idx) => (
                  <View key={idx} style={styles.underlaySlotBox} />
                ))}
              </View>
            </View>

            {/* Foreground Main Interactive Time Slot Card */}
            <View style={styles.slotCard}>
              {/* Date Header inside Slot Card */}
              <View style={styles.slotDateRow}>
                <View>
                  <Text style={styles.slotDateHeader}>
                    {isBn ? selectedDate.cardDateBn : selectedDate.cardDateEn}
                  </Text>
                  <Text style={styles.slotDurationSub}>
                    {isBn ? '১৫ মিনিট ব্যবধানের সময়সূচি' : '15-minute slot intervals'}
                  </Text>
                </View>
                <View style={styles.availableBadge}>
                  <Text style={styles.availableBadgeText}>
                    {isBn ? `${currentSlots.length}টি স্লট (১৫ মি.)` : `${currentSlots.length} slots (15m)`}
                  </Text>
                </View>
              </View>

              {currentSlots.length === 0 && (
                <Text style={styles.noSlotsText}>
                  {!hasHours
                    ? isBn
                      ? 'এই ডাক্তারের রোগী দেখার সময় নির্ধারণ করা নেই। দয়া করে চেম্বারে যোগাযোগ করুন।'
                      : "This doctor's visiting hours aren't set. Please contact the chamber."
                    : isBn
                      ? 'এই দিনে আর কোনো স্লট খালি নেই। অন্য দিন বেছে নিন।'
                      : 'No slots left on this day. Please pick another day.'}
                </Text>
              )}

              {/* 15-minute slots inside the doctor's hours */}
              <View style={styles.slotsGrid}>
                {currentSlots.map((time, index) => {
                  const isSelected = selectedSlot === time;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.slotBtn,
                        isSelected
                          ? styles.slotBtnActive
                          : styles.slotBtnInactive,
                      ]}
                      onPress={() => setSelectedSlot(time)}
                      activeOpacity={0.78}
                    >
                      <Text
                        style={[
                          styles.slotBtnText,
                          isSelected
                            ? styles.slotBtnTextActive
                            : styles.slotBtnTextInactive,
                        ]}
                      >
                        {time}
                      </Text>
                      <Text
                        style={[
                          styles.slotDurationSmall,
                          isSelected && styles.slotDurationSmallActive,
                        ]}
                      >
                        {isBn ? '১৫ মি.' : '15m'}
                      </Text>
                      {isSelected && (
                        <View style={styles.slotSelectedCheckDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Booking Summary Box */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {isBn ? 'নির্বাচিত সময়:' : 'Selected Time:'}
              </Text>
              <Text style={styles.summaryValue}>
                {selectedSlot
                  ? `${isBn ? selectedDate.cardDateBn : selectedDate.cardDateEn} • ${selectedSlot} (${isBn ? '১৫ মিনিট' : '15 mins'})`
                  : isBn ? 'একটি সময় বেছে নিন' : 'Pick a time slot'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {isBn ? 'পরামর্শ ফি:' : 'Consultation Fee:'}
              </Text>
              <Text style={styles.summaryFee}>
                {isBn ? doc.feeBn : doc.feeEn}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {isBn ? 'রোগীর বিবরণ:' : 'Patient Info:'}
              </Text>
              <Text style={styles.summaryPatient}>
                {user?.name || (isBn ? 'রেজিস্টার্ড রোগী' : 'Registered Patient')} (
                {user?.phone || '01XXXXXXXXX'})
              </Text>
            </View>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={handleConfirmAppointment}
            disabled={!canConfirm}
            activeOpacity={0.88}
          >
            <Text style={styles.confirmButtonIcon}>📅</Text>
            <Text style={styles.confirmButtonText}>
              {isBn ? 'অ্যাপয়েন্টমেন্ট নিশ্চিত করুন' : 'Confirm Appointment'}
            </Text>
            <Text style={styles.confirmButtonArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Booking Confirmed Serial Popup Modal */}
      <Modal
        visible={!!confirmedBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmedBooking(null)}
      >
        <View style={styles.successModalBackdrop}>
          <View style={styles.successModalCard}>
            <View style={styles.successCircle}>
              <Text style={styles.successTick}>✓</Text>
            </View>

            <Text style={styles.successHeading}>
              {isBn ? 'সিরিয়াল বুকিং নিশ্চিত হয়েছে!' : 'Booking Confirmed!'}
            </Text>

            <Text style={styles.successSub}>
              {isBn
                ? 'আপনার বুকিং সফলভাবে গৃহীত হয়েছে। চেম্বার রিসেপশনে সিরিয়াল নম্বরটি প্রদর্শন করুন।'
                : 'Your serial number has been reserved. Please show this to the chamber reception.'}
            </Text>

            {confirmedBooking && (
              <View style={styles.serialCard}>
                <Text style={styles.serialHeading}>
                  {isBn ? 'আপনার সিরিয়াল নম্বর' : 'YOUR SERIAL NUMBER'}
                </Text>
                <Text style={styles.serialBigNum}>
                  #{String(confirmedBooking.serialNumber).padStart(2, '0')}
                </Text>

                <View style={styles.serialDivider} />

                <View style={styles.serialInfoRow}>
                  <Text style={styles.serialLabel}>
                    {isBn ? 'ডাক্তার:' : 'Doctor:'}
                  </Text>
                  <Text style={styles.serialValue}>
                    {isBn
                      ? confirmedBooking.doctor.nameBn
                      : confirmedBooking.doctor.nameEn}
                  </Text>
                </View>

                <View style={styles.serialInfoRow}>
                  <Text style={styles.serialLabel}>
                    {isBn ? 'তারিখ ও সময়:' : 'Date & Time:'}
                  </Text>
                  <Text style={styles.serialValue}>
                    {confirmedBooking.date} • {confirmedBooking.timeSlot}
                  </Text>
                </View>

                <View style={styles.serialInfoRow}>
                  <Text style={styles.serialLabel}>
                    {isBn ? 'সময়কাল:' : 'Duration:'}
                  </Text>
                  <Text style={styles.serialValue}>
                    ⏱️ {isBn ? '১৫ মিনিট (নির্ধারিত পরামর্শ)' : '15 Minutes (Scheduled slot)'}
                  </Text>
                </View>

                <View style={styles.serialInfoRow}>
                  <Text style={styles.serialLabel}>
                    {isBn ? 'চেম্বার:' : 'Chamber:'}
                  </Text>
                  <Text style={styles.serialValue} numberOfLines={1}>
                    {isBn
                      ? confirmedBooking.doctor.chamberBn
                      : confirmedBooking.doctor.chamberEn}
                  </Text>
                </View>

                <View style={styles.serialInfoRow}>
                  <Text style={styles.serialLabel}>
                    {isBn ? 'ফি:' : 'Fee:'}
                  </Text>
                  <Text
                    style={[
                      styles.serialValue,
                      { color: Colors.primary, fontWeight: '800' },
                    ]}
                  >
                    {confirmedBooking.fee}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                setConfirmedBooking(null);
                if (onBack) onBack();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.doneButtonText}>
                {isBn ? 'সম্পন্ন (হোমে ফিরুন)' : 'Done (Back to Home)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F5', // Soft warm background matching image
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 4 : 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  backIcon: {
    fontSize: 16,
    color: '#0E747F',
    fontWeight: 'bold',
    marginRight: 6,
  },
  backText: {
    fontSize: 13,
    color: '#0E747F',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  mainTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 20,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 8,
    shadowColor: '#0E747F',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  cardHeaderTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  doctorAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#2EC4B6',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0E747F',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedCheck: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  doctorInfoCol: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  doctorSpecialty: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  metaText: {
    fontSize: 11.5,
    color: '#64748B',
    flexShrink: 1,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  networkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0E747F',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 10,
  },
  schedulingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  intervalDurationBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  intervalDurationText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
  },
  periodSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  periodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  periodTabActive: {
    backgroundColor: '#0E747F',
    borderColor: '#0E747F',
  },
  periodTabIcon: {
    fontSize: 13,
  },
  periodTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
  },
  slotDurationSub: {
    fontSize: 10.5,
    color: '#0F766E',
    fontWeight: '600',
    marginTop: 2,
  },
  slotDurationSmall: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#A16207',
    marginTop: 1,
  },
  slotDurationSmallActive: {
    color: '#CCFBF1',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dropdownIcon: {
    fontSize: 15,
    marginRight: 10,
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownChevron: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: 'bold',
  },
  dateChipsRow: {
    flexDirection: 'row',
    marginVertical: 12,
    gap: 8,
    paddingRight: 8,
  },
  dateChipOff: {
    backgroundColor: '#F8FAFC',
    borderStyle: 'dashed',
  },
  dateChipTextOff: {
    color: '#CBD5E1',
  },
  hoursNote: {
    backgroundColor: '#E6F5F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  hoursNoteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E747F',
  },
  hoursNoteValue: {
    fontWeight: '600',
    color: '#334155',
  },
  noSlotsText: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 18,
    lineHeight: 18,
  },
  confirmButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateChipActive: {
    backgroundColor: '#0E747F',
    borderColor: '#0E747F',
  },
  dateChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
  },
  slotCardContainer: {
    position: 'relative',
    marginVertical: 10,
  },
  // Underlay effect matching the floating layered cards in screenshot
  slotCardUnderlay: {
    position: 'absolute',
    bottom: -16,
    left: 8,
    right: 8,
    height: 70,
    backgroundColor: '#FFFBEB', // Subtle warm accent underlay
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
    opacity: 0.85,
    padding: 8,
    overflow: 'hidden',
  },
  underlaySlotsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    opacity: 0.4,
  },
  underlaySlotBox: {
    width: '22%',
    height: 18,
    backgroundColor: '#FCD34D',
    borderRadius: 4,
  },
  // Main Foreground Card
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    elevation: 6,
    shadowColor: '#0E747F',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  slotDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  slotDateHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  availableBadge: {
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  availableBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E747F',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 7,
  },
  // App Color Contrast: Medical Teal Palette
  slotBtn: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Inactive Slot: Crisp soft medical mint/teal with dark teal border
  slotBtnInactive: {
    backgroundColor: '#FEF08A', // Warm golden tone matching user image layout
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  // Active Selected Slot: Bold Deep Medical Teal
  slotBtnActive: {
    backgroundColor: '#0E747F',
    borderWidth: 1.5,
    borderColor: '#084C53',
    elevation: 3,
    shadowColor: '#0E747F',
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  slotBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  slotBtnTextInactive: {
    color: '#854D0E', // High contrast readable dark amber on golden slot
  },
  slotBtnTextActive: {
    color: '#FFFFFF',
  },
  slotSelectedCheckDot: {
    position: 'absolute',
    top: 3,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2EC4B6',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 24,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryFee: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0E747F',
  },
  summaryPatient: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  confirmButton: {
    backgroundColor: '#0E747F', // Deep medical teal
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#0E747F',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  confirmButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 6,
  },
  confirmButtonArrow: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2EC4B6',
  },

  // Dropdown Modal
  dropdownModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    elevation: 10,
  },
  dropdownModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownOptionRowActive: {
    backgroundColor: '#E6F5F6',
    borderRadius: 8,
  },
  dropdownOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownOptionTextActive: {
    color: '#0E747F',
    fontWeight: '800',
  },
  checkMark: {
    color: '#0E747F',
    fontSize: 14,
    fontWeight: '900',
  },

  // Success Modal
  successModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 12,
  },
  successCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E6F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTick: {
    color: '#0E747F',
    fontSize: 28,
    fontWeight: '900',
  },
  successHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  serialCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  serialHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 2,
  },
  serialBigNum: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0E747F',
    textAlign: 'center',
    marginVertical: 4,
  },
  serialDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  serialInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  serialLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  serialValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: '65%',
    textAlign: 'right',
  },
  doneButton: {
    width: '100%',
    backgroundColor: '#0E747F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
});
