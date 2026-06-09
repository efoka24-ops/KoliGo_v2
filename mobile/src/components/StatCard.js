import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function StatCard({ value, label, style }) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
    backgroundColor: colors.surface,
  },
  value: { fontSize: 17, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  label: { fontSize: 10.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '600' },
});
