import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

// A doctor's photo, or a doctor icon in the same frame when no photo was saved
// or the saved link doesn't load
export default function DoctorPhoto({ uri, style, resizeMode = 'cover' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  if (uri && !failed) {
    return <Image source={{ uri }} style={style} resizeMode={resizeMode} onError={() => setFailed(true)} />;
  }
  const { width = 60 } = StyleSheet.flatten(style) || {};
  const iconSize = typeof width === 'number' ? Math.round(width * 0.5) : 28;
  return (
    <View style={[style, styles.placeholder]}>
      <Text style={{ fontSize: iconSize }}>🧑‍⚕️</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#E6F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
