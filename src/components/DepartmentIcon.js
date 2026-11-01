import React from 'react';
import { Text, Image, StyleSheet } from 'react-native';

// Spacing set for the emoji (e.g. marginRight beside a label) applies to a picture too
const marginsOf = (textStyle) => {
  const flat = StyleSheet.flatten(textStyle) || {};
  const out = {};
  ['margin', 'marginHorizontal', 'marginVertical', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom']
    .forEach((key) => { if (flat[key] !== undefined) out[key] = flat[key]; });
  return out;
};

// A department's icon is an emoji (the built-in departments), an image link (added ones)
// or a picture bundled with the app (a require(...) result, which is a number)
export const isImageIcon = (icon) =>
  typeof icon === 'number' || /^(https?:|file:|content:|data:image)/i.test(String(icon || '').trim());

// For icons written inside a line of text, where an image can't go: an image becomes 🏥
export const iconAsText = (icon, fallback = '🩺') =>
  !icon ? fallback : isImageIcon(icon) ? '🏥' : icon;

export default function DepartmentIcon({ icon, size = 22, fallback = '🩺', textStyle }) {
  if (isImageIcon(icon)) {
    return (
      <Image
        source={typeof icon === 'number' ? icon : { uri: String(icon).trim() }}
        style={[{ width: size * 1.25, height: size * 1.25, borderRadius: size * 0.3 }, marginsOf(textStyle)]}
        resizeMode="cover"
      />
    );
  }
  return <Text style={[{ fontSize: size }, textStyle]}>{icon || fallback}</Text>;
}
