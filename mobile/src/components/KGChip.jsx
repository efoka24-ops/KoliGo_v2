import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

const palettes = {
  green:  { bg: colors.greenLight, color: colors.greenDark, activeBg: colors.green, activeColor: '#fff' },
  orange: { bg: colors.orangeLight, color: colors.orange, activeBg: colors.orange, activeColor: '#fff' },
  ink:    { bg: colors.ink06, color: colors.ink, activeBg: colors.ink, activeColor: '#fff' },
};

export default function KGChip({ children, active, color = 'green', onPress, icon }) {
  const p = palettes[color] || palettes.green;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        height: 36, paddingHorizontal: 14, borderRadius: 999,
        backgroundColor: active ? p.activeBg : p.bg,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}
    >
      {icon && <Icon name={icon} size={14} color={active ? p.activeColor : p.color} strokeWidth={1.9} />}
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: active ? p.activeColor : p.color }}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}
