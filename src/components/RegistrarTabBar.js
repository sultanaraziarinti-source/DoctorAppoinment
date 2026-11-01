import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

// Order: Home, Doctor Management, Appointment List
const TABS = [
  // same house logo as the patient bar
  { id: 'home', image: require('../../assets/home_tab_icon.png'), bn: 'হোম', en: 'Home' },
  { id: 'doctors', icon: '👨‍⚕️', bn: 'ডাক্তার ব্যবস্থাপনা', en: 'Doctor Management' },
  { id: 'appointments', image: require('../../assets/appointment_list_tab_icon.png'), bn: 'সিরিয়াল তালিকা', en: 'Appointment List' },
];

// Registrar bottom navigation (Home / Doctor Management / Appointment List), shown on every registrar page
export default function RegistrarTabBar({ active = 'doctors', lang = 'bn', onPress, style }) {
  const isBn = lang === 'bn';
  return (
    <View style={[styles.bar, style]}>
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.item}
            onPress={() => onPress && onPress(tab.id)}
            activeOpacity={0.8}
          >
            {tab.image ? (
              <Image source={tab.image} style={styles.iconImage} resizeMode="contain" />
            ) : (
              <Text style={styles.icon}>{tab.icon}</Text>
            )}
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {isBn ? tab.bn : tab.en}
            </Text>
            {isActive && <View style={styles.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
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
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: '100%',
  },
  icon: {
    fontSize: 20,
    marginBottom: 2,
  },
  iconImage: {
    width: 24,
    height: 24,
    marginBottom: 2,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  labelActive: {
    color: '#0E747F',
  },
  indicator: {
    position: 'absolute',
    bottom: 6,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#0E747F',
  },
});
