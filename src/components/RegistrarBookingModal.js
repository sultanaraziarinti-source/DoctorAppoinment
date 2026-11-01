import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Alert,
  Linking,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DoctorPhoto from './DoctorPhoto';
import RegistrarTabBar from './RegistrarTabBar';
import DepartmentIcon from './DepartmentIcon';
import { deptIconFor } from './departmentLogos';
import { saveAppointment } from '../services/appointmentsStorage';
import { scheduleAppointmentReminder } from '../services/reminders';
import {
  buildDateOptions,
  appointmentStartISO,
  parseAvailability,
  slotsFromAvailability,
  parseSlotTime,
} from '../services/appointmentTime';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toEnDigits = (text) => String(text || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
// Bangladeshi mobile number: 01XXXXXXXXX, optionally with +88 / 88 in front
const cleanPhone = (text) => toEnDigits(text).replace(/[\s\-()]/g, '');
const isValidPhone = (text) => /^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone(text));

const availabilityOf = (doc) => {
  if (!doc) return { days: null, ranges: [] };
  const fromEn = parseAvailability(doc.availableEn || doc.available);
  return fromEn.ranges.length > 0 ? fromEn : parseAvailability(doc.availableBn);
};

// Registrar books a serial for a patient (by phone). The appointment is saved against that
// phone number, so it shows in the patient's "My Appointments" when they open the app.
export default function RegistrarBookingModal({
  visible,
  onClose,
  departments = [],
  lang = 'bn',
  onBooked,
  activeTab = 'doctors', // registrar bottom bar shown under the form
  onTabPress,
}) {
  const isBn = lang === 'bn';
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [deptId, setDeptId] = useState(null);
  const [doctorId, setDoctorId] = useState(null);
  const [dateOptions, setDateOptions] = useState(() => buildDateOptions(new Date(), 7));
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [booked, setBooked] = useState(null); // the saved appointment, shown on the success view

  const resetForm = () => {
    setPhone('');
    setName('');
    setAge('');
    setDeptId(null);
    setDoctorId(null);
    setDateOptions(buildDateOptions(new Date(), 7));
    setSelectedDate(null);
    setSelectedSlot(null);
    setBooked(null);
  };

  // Fresh form each time it opens
  useEffect(() => {
    if (visible) resetForm();
  }, [visible]);

  const depts = (departments || []).filter((d) => d && d.id);
  const dept = depts.find((d) => d.id === deptId) || null;
  const doctors = dept ? dept.doctors || [] : [];
  const doctor = doctors.find((d) => d.id === doctorId) || null;

  const availability = useMemo(() => availabilityOf(doctor), [doctor]);
  const hasHours = availability.ranges.length > 0;
  const isOpenOn = (d) => !availability.days || availability.days.includes(d.weekday);
  const hoursText = doctor
    ? (isBn ? doctor.availableBn || doctor.availableEn : doctor.availableEn || doctor.availableBn) || ''
    : '';

  const slots = useMemo(() => {
    if (!doctor || !selectedDate || !hasHours || !isOpenOn(selectedDate)) return [];
    const all = slotsFromAvailability(availability);
    if (!selectedDate.isToday) return all;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return all.filter((slot) => {
      const t = parseSlotTime(slot);
      return t && t.hours * 60 + t.minutes > nowMinutes;
    });
  }, [doctor, selectedDate, availability]);

  const pickDept = (id) => {
    setDeptId(id);
    setDoctorId(null);
    setSelectedDate(null);
    setSelectedSlot(null);
  };
  const pickDoctor = (doc) => {
    setDoctorId(doc.id);
    const av = availabilityOf(doc);
    setSelectedDate(dateOptions.find((d) => !av.days || av.days.includes(d.weekday)) || null);
    setSelectedSlot(null);
  };
  const pickDate = (d) => {
    setSelectedDate(d);
    setSelectedSlot(null);
  };

  const handleSave = async () => {
    const problems = [];
    if (!isValidPhone(phone)) problems.push(isBn ? 'সঠিক মোবাইল নম্বর (০১XXXXXXXXX)' : 'a valid mobile number (01XXXXXXXXX)');
    if (!name.trim()) problems.push(isBn ? 'রোগীর নাম' : "the patient's name");
    const ageNum = Number(toEnDigits(age));
    if (!age.trim() || !Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) problems.push(isBn ? 'বয়স (১–১২০)' : 'age (1–120)');
    if (!doctor) problems.push(isBn ? 'একজন ডাক্তার' : 'a doctor');
    else if (!selectedSlot) problems.push(isBn ? 'তারিখ ও সময়' : 'a date and time slot');
    if (problems.length > 0) {
      Alert.alert(isBn ? 'তথ্য অসম্পূর্ণ' : 'Missing details', (isBn ? 'দয়া করে দিন: ' : 'Please add ') + problems.join(', ') + '.');
      return;
    }

    setSaving(true);
    try {
      const booking = {
        doctor,
        date: isBn ? selectedDate.cardDateBn : selectedDate.cardDateEn,
        timeSlot: `${selectedSlot} (${isBn ? '১৫ মিনিট' : '15 mins'})`,
        startsAt: appointmentStartISO(selectedDate.dateKey, selectedSlot),
        patientName: name.trim(),
        patientPhone: cleanPhone(phone),
        patientAge: String(ageNum),
        deviceId: null, // booked at the desk, not from the patient's phone
        fee: isBn ? doctor.feeBn : doctor.feeEn,
        reason: isBn ? 'রেজিস্ট্রার ডেস্ক থেকে বুক করা' : 'Booked at the registrar desk',
      };
      const { newAppointment } = await saveAppointment(booking);
      setBooked({ ...booking, serialNumber: newAppointment.serialNumber, appointment: newAppointment });
      if (onBooked) onBooked(newAppointment);
    } catch (e) {
      console.warn('Registrar booking failed:', e);
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'অ্যাপয়েন্টমেন্ট সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।' : 'Could not save the appointment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const messageText = () => {
    if (!booked) return '';
    const doc = booked.doctor;
    if (isBn) {
      return (
        `প্রিয় ${booked.patientName}, ${doc.nameBn || doc.nameEn}-এর সাথে আপনার অ্যাপয়েন্টমেন্ট নিশ্চিত হয়েছে।\n` +
        `তারিখ: ${booked.date}\nসময়: ${booked.timeSlot}\nসিরিয়াল নং: ${booked.serialNumber}\n` +
        `চেম্বার: ${doc.chamberBn || doc.chamberEn || ''}\n` +
        `এই নম্বর (${booked.patientPhone}) দিয়ে অ্যাপে প্রবেশ করলে অ্যাপয়েন্টমেন্টটি দেখতে পাবেন।`
      );
    }
    return (
      `Dear ${booked.patientName}, your appointment with ${doc.nameEn || doc.nameBn} is confirmed.\n` +
      `Date: ${booked.date}\nTime: ${booked.timeSlot}\nSerial No: ${booked.serialNumber}\n` +
      `Chamber: ${doc.chamberEn || doc.chamberBn || ''}\n` +
      `Open the app with this number (${booked.patientPhone}) to see your appointment.`
    );
  };

  // Opens this phone's SMS app with the message ready; the registrar presses send there
  const handleSendMessage = async () => {
    const url = `sms:${booked.patientPhone}?body=${encodeURIComponent(messageText())}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(isBn ? 'মেসেজ খোলা যায়নি' : "Couldn't open messages", isBn ? 'এই ফোনে মেসেজ অ্যাপ খোলা যায়নি।' : 'No messaging app could be opened on this phone.');
    }
  };

  const label = (bn, en) => <Text style={styles.label}>{isBn ? bn : en}</Text>;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0E747F" />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>← {isBn ? 'বন্ধ' : 'Close'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isBn ? 'অ্যাপয়েন্টমেন্ট করুন' : 'Make Appointment'}</Text>
          <View style={styles.headerBtn} />
        </View>

        {booked ? (
          /* ---- Saved ---- */
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>{isBn ? 'অ্যাপয়েন্টমেন্ট সংরক্ষিত হয়েছে' : 'Appointment saved'}</Text>
              <Text style={styles.serialText}>{isBn ? 'সিরিয়াল নং' : 'Serial No'} #{booked.serialNumber}</Text>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLine}>👤 {booked.patientName} · {booked.patientAge} {isBn ? 'বছর' : 'yrs'}</Text>
                <Text style={styles.summaryLine}>📞 {booked.patientPhone}</Text>
                <Text style={styles.summaryLine}>🩺 {isBn ? booked.doctor.nameBn : booked.doctor.nameEn}</Text>
                <Text style={styles.summaryLine}>📅 {booked.date} · {booked.timeSlot}</Text>
              </View>
              <Text style={styles.successNote}>
                {isBn
                  ? 'রোগী এই নম্বর দিয়ে অ্যাপ খুললে "আমার সিরিয়াল"-এ এটি দেখতে পাবেন।'
                  : 'The patient will see this in "My Appointments" when they open the app with this number.'}
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSendMessage} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>📩 {isBn ? 'রোগীকে মেসেজ পাঠান' : 'Send message to patient'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={resetForm} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>➕ {isBn ? 'আরেকটি অ্যাপয়েন্টমেন্ট' : 'Make another appointment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtn} onPress={onClose}>
              <Text style={styles.linkBtnText}>{isBn ? 'সম্পন্ন' : 'Done'}</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* ---- Form ---- */
          <KeyboardAvoidingView style={styles.flex} behavior="padding">
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionTitle}>👤 {isBn ? 'রোগীর তথ্য' : 'Patient details'}</Text>
              {label('মোবাইল নম্বর *', 'Phone number *')}
              <TextInput
                style={styles.input}
                placeholder="01XXXXXXXXX"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={14}
                value={phone}
                onChangeText={setPhone}
              />
              {label('নাম *', 'Name *')}
              <TextInput
                style={styles.input}
                placeholder={isBn ? 'রোগীর পুরো নাম' : "Patient's full name"}
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
              {label('বয়স *', 'Age *')}
              <TextInput
                style={styles.input}
                placeholder={isBn ? 'যেমন ৩৫' : 'e.g. 35'}
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={3}
                value={age}
                onChangeText={setAge}
              />

              <Text style={styles.sectionTitle}>🏥 {isBn ? 'বিভাগ ও ডাক্তার' : 'Department & doctor'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {depts.map((d) => {
                  const active = d.id === deptId;
                  return (
                    <TouchableOpacity key={d.id} style={[styles.chip, active && styles.chipActive]} onPress={() => pickDept(d.id)}>
                      <DepartmentIcon icon={deptIconFor(d)} size={13} textStyle={styles.chipIcon} />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{isBn ? d.nameBn : d.nameEn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {dept && doctors.length === 0 && (
                <Text style={styles.emptyText}>{isBn ? 'এই বিভাগে কোনো ডাক্তার নেই।' : 'No doctors in this department.'}</Text>
              )}
              {doctors.map((doc) => {
                const active = doc.id === doctorId;
                return (
                  <TouchableOpacity key={doc.id} style={[styles.doctorRow, active && styles.doctorRowActive]} onPress={() => pickDoctor(doc)}>
                    <DoctorPhoto uri={doc.image} style={styles.doctorPhoto} />
                    <View style={styles.flex}>
                      <Text style={styles.doctorName} numberOfLines={1}>{isBn ? doc.nameBn || doc.nameEn : doc.nameEn || doc.nameBn}</Text>
                      <Text style={styles.doctorSub} numberOfLines={1}>
                        🕒 {(isBn ? doc.availableBn || doc.availableEn : doc.availableEn || doc.availableBn) || (isBn ? 'সময় নির্ধারিত নেই' : 'Hours not set')}
                      </Text>
                    </View>
                    {active && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              {doctor && (
                <>
                  <Text style={styles.sectionTitle}>📅 {isBn ? 'তারিখ ও সময়' : 'Date & time'}</Text>
                  <Text style={styles.hoursText}>🕒 {hoursText || (isBn ? 'সময় নির্ধারিত নেই' : 'Hours not set')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {dateOptions.map((d) => {
                      const open = isOpenOn(d);
                      const active = selectedDate && selectedDate.id === d.id;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[styles.chip, active && styles.chipActive, !open && styles.chipOff]}
                          onPress={() => open && pickDate(d)}
                          disabled={!open}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive, !open && styles.chipTextOff]}>
                            {isBn ? d.titleBn : d.titleEn}
                            {!open ? (isBn ? ' • বন্ধ' : ' • Off') : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {slots.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {!hasHours
                        ? isBn ? 'এই ডাক্তারের রোগী দেখার সময় নির্ধারণ করা নেই।' : "This doctor's visiting hours aren't set."
                        : isBn ? 'এই দিনে আর কোনো স্লট খালি নেই।' : 'No slots left on this day.'}
                    </Text>
                  ) : (
                    <View style={styles.slotGrid}>
                      {slots.map((slot) => {
                        const active = slot === selectedSlot;
                        return (
                          <TouchableOpacity key={slot} style={[styles.slot, active && styles.slotActive]} onPress={() => setSelectedSlot(slot)}>
                            <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (saving || !selectedSlot) && styles.primaryBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>✓ {isBn ? 'অ্যাপয়েন্টমেন্ট সংরক্ষণ করুন' : 'Save Appointment'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
        {onTabPress && (
          <RegistrarTabBar
            active={activeTab}
            lang={lang}
            onPress={onTabPress}
            style={{ height: 64 + insets.bottom, paddingBottom: insets.bottom }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#0E747F',
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { width: 70 },
  headerBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  body: { padding: 16, paddingBottom: 96 },
  sectionTitle: { fontSize: 14.5, fontWeight: '800', color: '#0F172A', marginTop: 14, marginBottom: 4 },
  label: { fontSize: 12.5, fontWeight: '700', color: '#475569', marginTop: 8, marginBottom: 5 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  chipRow: { gap: 8, paddingVertical: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: '#0E747F', borderColor: '#0E747F' },
  chipOff: { backgroundColor: '#F8FAFC', borderStyle: 'dashed' },
  chipIcon: { fontSize: 13, marginRight: 6 },
  chipText: { fontSize: 12.5, fontWeight: '700', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  chipTextOff: { color: '#CBD5E1' },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 10,
    marginTop: 8,
  },
  doctorRowActive: { borderColor: '#0E747F', backgroundColor: '#E6F5F6' },
  doctorPhoto: { width: 44, height: 44, borderRadius: 12 },
  doctorName: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  doctorSub: { fontSize: 11.5, color: '#64748B', marginTop: 2 },
  check: { fontSize: 18, color: '#0E747F', fontWeight: '900' },
  hoursText: { fontSize: 12, color: '#0E747F', fontWeight: '700', marginTop: 4 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  slot: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  slotActive: { backgroundColor: '#0E747F', borderColor: '#0E747F' },
  slotText: { fontSize: 12, fontWeight: '800', color: '#92400E' },
  slotTextActive: { color: '#FFFFFF' },
  emptyText: { fontSize: 12.5, color: '#64748B', textAlign: 'center', paddingVertical: 14 },
  primaryBtn: {
    backgroundColor: '#0E747F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnDisabled: { backgroundColor: '#94A3B8' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: '#0E747F',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { color: '#0E747F', fontSize: 14, fontWeight: '800' },
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkBtnText: { color: '#64748B', fontSize: 13.5, fontWeight: '700' },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    alignItems: 'center',
  },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginTop: 6 },
  serialText: { fontSize: 22, fontWeight: '900', color: '#0E747F', marginTop: 6 },
  summaryBox: {
    alignSelf: 'stretch',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 4,
  },
  summaryLine: { fontSize: 13, color: '#334155', fontWeight: '600' },
  successNote: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
