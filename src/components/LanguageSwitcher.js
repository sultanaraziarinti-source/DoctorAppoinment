import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

export default function LanguageSwitcher({ currentLang, lang, onChangeLang, style }) {
  const activeLang = lang || currentLang || 'bn';

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.pill, activeLang === 'bn' && styles.pillActive]}
        onPress={() => onChangeLang && onChangeLang('bn')}
        activeOpacity={0.8}
      >
        <Text style={[styles.text, activeLang === 'bn' && styles.textActive]}>
          বাংলা
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.pill, activeLang === 'en' && styles.pillActive]}
        onPress={() => onChangeLang && onChangeLang('en')}
        activeOpacity={0.8}
      >
        <Text style={[styles.text, activeLang === 'en' && styles.textActive]}>
          English
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(14, 116, 127, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0E747F',
  },
  textActive: {
    color: '#FFFFFF',
  },
});
