import React from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../constants/colors';

const STATUS_MAP = {
  en_attente: { bg: colors.orangeLight, color: colors.orange, label: 'En attente' },
  accepte:    { bg: '#E8EEF8', color: '#1F5BB0', label: 'Accepté' },
  collecte:   { bg: colors.greenLight, color: colors.greenDark, label: 'Collecté' },
  en_route:   { bg: colors.greenLight, color: colors.greenDark, label: 'En route' },
  livre:      { bg: colors.greenLight, color: colors.greenDark, label: 'Livré' },
  annule:     { bg: '#FCE8E8', color: '#B43A1B', label: 'Annulé' },
};

export default function KGStatusPill({ status }) {
  const m = STATUS_MAP[status] || STATUS_MAP.en_attente;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      height: 24, paddingHorizontal: 10, borderRadius: 999,
      backgroundColor: m.bg,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: m.color }}>{m.label}</Text>
    </View>
  );
}
