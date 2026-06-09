import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Brand avatar circle. tone picks a color; falls back to initials.
export default function Avatar({ label = '?', tone = 'green', size = 40 }) {
  const bg = TONES[tone] || TONES.green;
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.txt, { fontSize: size * 0.4 }]}>{String(label).charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const TONES = {
  green: '#2E9E55',
  orange: '#E8551C',
  blue: '#3B7FC4',
  purple: '#8A5BC4',
  gray: '#6B6960',
};

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  txt: { color: '#fff', fontWeight: '800' },
});
