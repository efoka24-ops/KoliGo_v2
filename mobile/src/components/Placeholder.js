import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

// Dashed placeholder for maps or upload zones.
export default function Placeholder({ height = 80, label, style, map, upload }) {
  return (
    <View style={[styles.box, map ? styles.map : styles.hatch, { height }, style]}>
      {upload && <Ionicons name="cloud-upload-outline" size={22} color={colors.muted2} />}
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  hatch: { backgroundColor: '#ECECE6', borderStyle: 'dashed' },
  map: { backgroundColor: '#EFF2EC', borderColor: '#CBD8CC' },
  label: { fontSize: 11, letterSpacing: 0.5, color: colors.muted2, fontWeight: '600' },
});
