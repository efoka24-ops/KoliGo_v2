import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

// Renders the 4 (or n) code boxes. tone tints the filled border.
export default function CodeBoxes({ value = '', length = 4, tone = 'ink' }) {
  const border = tone === 'green' ? colors.green : tone === 'orange' ? colors.orange : colors.ink;
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        return (
          <View key={i} style={[styles.box, { borderColor: filled ? border : colors.line }]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  box: {
    width: 52,
    height: 60,
    borderWidth: 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 26, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
});
