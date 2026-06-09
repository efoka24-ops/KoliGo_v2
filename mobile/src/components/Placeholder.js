import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

// Striped/hatched placeholder used for maps, image uploads, etc.
export default function Placeholder({ height = 80, label, style, map }) {
  return (
    <View style={[styles.box, map ? styles.map : styles.hatch, { height }, style]}>
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
    overflow: 'hidden',
  },
  hatch: { backgroundColor: '#ECECE6', borderStyle: 'dashed' },
  map: { backgroundColor: '#EFF2EC', borderColor: '#CBD8CC' },
  label: { fontSize: 11, letterSpacing: 0.5, color: colors.muted2, fontWeight: '600' },
});
