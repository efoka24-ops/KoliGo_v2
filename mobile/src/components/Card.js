import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../theme';

// tone: 'default' | 'soft' | 'green' | 'orange'
export default function Card({ children, tone = 'default', style, padded = true }) {
  const t = TONES[tone] || TONES.default;
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: t.bg, borderColor: t.border },
        padded && styles.padded,
        shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const TONES = {
  default: { bg: colors.surface, border: colors.line },
  soft: { bg: colors.surface2, border: colors.line },
  green: { bg: colors.green50, border: colors.green100 },
  orange: { bg: colors.orange50, border: '#F6D9C9' },
};

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, borderWidth: 1 },
  padded: { padding: 14 },
});
