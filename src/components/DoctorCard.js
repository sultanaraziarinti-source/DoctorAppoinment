import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import DoctorPhoto from './DoctorPhoto';

export default function DoctorCard({ doctor, lang = 'bn', onBook }) {
  const isBn = lang === 'bn';
  const name = isBn ? doctor.nameBn : doctor.nameEn;
  const degrees = isBn ? doctor.degreesBn : doctor.degreesEn;
  const designation = isBn ? doctor.designationBn : doctor.designationEn;
  const hospital = isBn ? doctor.hospitalBn : doctor.hospitalEn;
  const chamber = isBn ? doctor.chamberBn : doctor.chamberEn;
  const experience =
    (isBn ? doctor.experienceBn || doctor.experienceEn : doctor.experienceEn || doctor.experienceBn) ||
    doctor.experience ||
    (isBn ? '১০+ বছরের অভিজ্ঞতা' : '10+ Years Exp.');
  const fee =
    (isBn ? doctor.feeBn || doctor.feeEn : doctor.feeEn || doctor.feeBn) ||
    doctor.fee ||
    (isBn ? '৳১,০০০' : '৳1,000');
  const available =
    (isBn ? doctor.availableBn || doctor.availableEn : doctor.availableEn || doctor.availableBn) ||
    doctor.available ||
    '';

  return (
    // The whole card opens booking, same as its button
    <TouchableOpacity style={styles.card} onPress={() => onBook && onBook(doctor)} activeOpacity={0.9}>
      {/* Top Section: Photo + Main Info */}
      <View style={styles.topRow}>
        <View style={styles.imageContainer}>
          <DoctorPhoto uri={doctor.image} style={styles.avatar} />
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓</Text>
          </View>
        </View>

        <View style={styles.mainInfo}>
          <View style={styles.expRow}>
            <View style={styles.expPill}>
              <Text style={styles.expText}>{experience}</Text>
            </View>
          </View>

          <Text style={styles.doctorName} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.designation} numberOfLines={2}>
            {designation}
          </Text>
          <Text style={styles.degrees} numberOfLines={1}>
            {degrees}
          </Text>
        </View>
      </View>

      {/* Hospital & Chamber Info */}
      <View style={styles.detailSection}>
        <View style={styles.infoLine}>
          <Text style={styles.infoIcon}>🏥</Text>
          <Text style={styles.infoText} numberOfLines={1}>
            {hospital}
          </Text>
        </View>

        <View style={styles.infoLine}>
          <Text style={styles.infoIcon}>📍</Text>
          <Text style={styles.infoText} numberOfLines={1}>
            {chamber}
          </Text>
        </View>

        <View style={styles.infoLine}>
          <Text style={styles.infoIcon}>🕒</Text>
          <Text style={styles.availableText} numberOfLines={1}>
            {available}
          </Text>
        </View>
      </View>

      {/* Bottom Footer: Fee & Action Button */}
      <View style={styles.footerRow}>
        <View style={styles.feeContainer}>
          <Text style={styles.feeLabel}>{isBn ? 'পরামর্শ ফি' : 'Consultation Fee'}</Text>
          <Text style={styles.feeAmount}>{fee}</Text>
        </View>

        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => onBook(doctor)}
          activeOpacity={0.85}
        >
          <Text style={styles.bookIcon}>📅</Text>
          <Text style={styles.bookText}>
            {isBn ? 'সিরিয়াল বুক করুন' : 'Book Appointment'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0E747F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 82,
    height: 92,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0E747F',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  mainInfo: {
    flex: 1,
  },
  expRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  expPill: {
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B2F5EA',
  },
  expText: {
    color: '#0E747F',
    fontSize: 10,
    fontWeight: '700',
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
    lineHeight: 22,
  },
  designation: {
    fontSize: 12,
    color: '#0E747F',
    fontWeight: '700',
    marginBottom: 2,
  },
  degrees: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  detailSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  infoIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  availableText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  feeContainer: {
    justifyContent: 'center',
  },
  feeLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  feeAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0E747F',
  },
  bookButton: {
    backgroundColor: '#0E747F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#0E747F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  bookIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  bookText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
