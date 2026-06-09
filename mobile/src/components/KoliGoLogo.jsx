import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../constants/colors';

export function KoliGoLogo({ size = 48, mono = false }) {
  const primary = mono ? '#fff' : colors.green;
  const accent  = mono ? '#fff' : colors.orange;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 6 8 16v32l24 10 24-10V16z" fill={primary}/>
      <Path d="M8 16 32 26l24-10M32 26v32" stroke="rgba(255,255,255,.45)" strokeWidth="2" fill="none"/>
      <Path d="M22 38h16M32 31l8 7-8 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <Circle cx="49" cy="14" r="6" fill={accent}/>
    </Svg>
  );
}

export function KoliGoWordmark({ size = 28, color }) {
  const c = color || colors.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 0 }}>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: size, color: c, letterSpacing: -0.02 * size, lineHeight: size * 1.2 }}>
        Koli
      </Text>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: size, color: colors.orange, letterSpacing: -0.02 * size, lineHeight: size * 1.2 }}>
        Go
      </Text>
      <View style={{ width: size * 0.18, height: size * 0.18, borderRadius: size * 0.09, backgroundColor: colors.orange, marginLeft: 4, alignSelf: 'center' }}/>
    </View>
  );
}
