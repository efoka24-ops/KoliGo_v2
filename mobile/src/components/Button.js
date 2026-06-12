import React from 'react';
import { Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, shadow } from '../theme';

// variant: 'primary' | 'accent' | 'outline' | 'ghost'
export default function Button({ title, onPress, variant = 'primary', size = 'md', style, loading, disabled }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = size === 'sm' ? { paddingVertical: 8, paddingHorizontal: 14 } : { paddingVertical: 13, paddingHorizontal: 18 };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        s,
        { backgroundColor: v.bg, borderColor: v.border },
        variant === 'primary' || variant === 'accent' ? shadow.sm : null,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.txt, { color: v.fg, fontSize: size === 'sm' ? 12 : 14 }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: colors.green, border: colors.green, fg: colors.white },
  accent: { bg: colors.orange, border: colors.orange, fg: colors.white },
  outline: { bg: 'transparent', border: colors.line, fg: colors.ink },
  ghost: { bg: 'transparent', border: 'transparent', fg: colors.ink },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: { fontWeight: '700' },
});
