import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

// tone: 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'orange'
export default function Pill({ label, tone = 'muted', dot = true }) {
  const t = TONES[tone] || TONES.muted;
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      {dot && <View style={[styles.dot, { backgroundColor: t.fg }]} />}
      <Text style={[styles.txt, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const TONES = {
  ok: { bg: colors.okBg, fg: colors.greenDeep },
  warn: { bg: colors.warnBg, fg: '#8A6608' },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  info: { bg: colors.infoBg, fg: colors.info },
  muted: { bg: '#EFEFEA', fg: colors.muted },
  orange: { bg: colors.orange50, fg: colors.orangeDark },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  txt: { fontSize: 11.5, fontWeight: '700' },
});
