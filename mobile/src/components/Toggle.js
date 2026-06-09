import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function Toggle({ value, onValueChange }) {
  return (
    <Pressable onPress={() => onValueChange && onValueChange(!value)} style={[styles.track, !value && styles.off]}>
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 42, height: 24, borderRadius: radius.pill, backgroundColor: colors.green, justifyContent: 'center' },
  off: { backgroundColor: '#D6D6CE' },
  knob: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.white, position: 'absolute' },
  knobOn: { right: 2.5 },
  knobOff: { left: 2.5 },
});
