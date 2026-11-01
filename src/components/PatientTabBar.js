import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { translations } from '../i18n/translations';

const TABS = [
  { id: 'home', icon: require('../../assets/home_tab_icon.png'), labelKey: 'tabHome' },
  { id: 'appointments', icon: require('../../assets/appointments_tab_icon.png'), labelKey: 'tabAppointments' },
  { id: 'profile', icon: require('../../assets/profile_tab_icon.png'), labelKey: 'tabProfile' },
];

// Patient bottom navigation (Home / Appointments / Profile), shown on every patient page
export default function PatientTabBar({ active = 'home', lang = 'bn', onPress, style }) {
  const t = translations[lang]?.home || translations.bn.home;
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
            <Image source={tab.icon} style={styles.icon} resizeMode="contain" />
            <Text style={[styles.label, isActive && styles.labelActive]}>{t[tab.labelKey]}</Text>
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
