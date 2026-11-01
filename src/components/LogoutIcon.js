import React from 'react';
import { Image } from 'react-native';

// Door-with-arrow logout icon, drawn in the given colour (the picture is a transparent outline)
export default function LogoutIcon({ size = 14, color = '#FFFFFF', style }) {
  return (
    <Image
      source={require('../../assets/logout_icon.png')}
      style={[{ width: size, height: size, tintColor: color }, style]}
      resizeMode="contain"
    />
  );
}
