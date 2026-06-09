import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/colors';

const kindBg = {
  plain:   '#fff',
  cream:   colors.cream,
  green:   colors.greenLight,
  orange:  colors.orangeLight,
  dark:    colors.ink,
};

export default function KGCard({ children, padding = 16, style, onPress, kind = 'plain' }) {
  const bg = kindBg[kind] || '#fff';
  const baseStyle = {
    backgroundColor: bg,
    borderRadius: 18,
    padding,
    ...(kind === 'plain' && { borderWidth: 1, borderColor: colors.ink06 }),
    overflow: 'hidden',
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[baseStyle, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[baseStyle, style]}>{children}</View>;
}
