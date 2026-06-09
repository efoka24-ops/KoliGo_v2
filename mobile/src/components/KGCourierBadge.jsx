import React from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

const BADGE_MAP = {
  temporaire: { bg: colors.ink06,      color: colors.ink,       label: 'Temporaire', icon: null },
  permanent:  { bg: colors.greenLight, color: colors.greenDark, label: 'Permanent',  icon: null },
  vvip:       { bg: '#2A1B0E',         color: '#F7D78A',        label: 'VVIP',       icon: 'crown' },
  express:    { bg: colors.orangeLight,color: colors.orange,    label: 'Express',    icon: 'bolt' },
};

export default function KGCourierBadge({ type, size = 'sm' }) {
  const m = BADGE_MAP[type] || BADGE_MAP.temporaire;
  const h = size === 'lg' ? 30 : 22;
  const fs = size === 'lg' ? 13 : 11;
  const iconSize = size === 'lg' ? 14 : 11;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      height: h, paddingHorizontal: h * 0.4, borderRadius: 999,
      backgroundColor: m.bg,
    }}>
      {m.icon && <Icon name={m.icon} size={iconSize} color={m.color} strokeWidth={2} />}
      <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: fs, color: m.color }}>{m.label}</Text>
    </View>
  );
}
