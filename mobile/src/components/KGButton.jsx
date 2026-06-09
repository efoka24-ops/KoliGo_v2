import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

const sizes = {
  sm: { h: 40, px: 14, fs: 14, r: 10, gap: 6, iconSize: 16 },
  md: { h: 52, px: 18, fs: 16, r: 14, gap: 8, iconSize: 18 },
  lg: { h: 58, px: 22, fs: 17, r: 16, gap: 10, iconSize: 18 },
};

const palettes = {
  primary:    { bg: colors.green, color: '#fff', border: 'transparent' },
  orange:     { bg: colors.orange, color: '#fff', border: 'transparent' },
  dark:       { bg: colors.ink, color: '#fff', border: 'transparent' },
  ghost:      { bg: 'transparent', color: colors.ink, border: colors.ink12 },
  soft:       { bg: colors.greenLight, color: colors.greenDark, border: 'transparent' },
  softOrange: { bg: colors.orangeLight, color: colors.orange, border: 'transparent' },
  danger:     { bg: '#FCE8E8', color: '#B43A1B', border: 'transparent' },
};

export default function KGButton({ children, kind = 'primary', size = 'md', full = true, icon, iconRight, onPress, disabled, style }) {
  const s = sizes[size];
  const p = palettes[kind] || palettes.primary;
  const elevated = kind === 'primary' || kind === 'orange' || kind === 'dark';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        {
          height: s.h,
          paddingHorizontal: s.px,
          borderRadius: s.r,
          backgroundColor: p.bg,
          borderWidth: p.border !== 'transparent' ? 1 : 0,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.gap,
          alignSelf: full ? 'stretch' : 'auto',
          opacity: disabled ? 0.45 : 1,
          ...(elevated && { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 0, elevation: 2 }),
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={s.iconSize} color={p.color} strokeWidth={1.8} />}
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: s.fs, color: p.color, letterSpacing: -0.01 }}>
        {children}
      </Text>
      {iconRight && <Icon name={iconRight} size={s.iconSize} color={p.color} strokeWidth={1.8} />}
    </TouchableOpacity>
  );
}
