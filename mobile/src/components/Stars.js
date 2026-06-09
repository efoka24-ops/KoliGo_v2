import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Inline star rating display / picker (read-only here; pass onRate to make tappable).
import { Pressable } from 'react-native';

export default function Stars({ value = 0, max = 5, size = 22, onRate }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < value;
        const star = (
          <Text style={[styles.star, { fontSize: size, color: filled ? colors.orange : colors.line }]}>★</Text>
        );
        return onRate ? (
          <Pressable key={i} onPress={() => onRate(i + 1)} hitSlop={6}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  star: { fontWeight: '700' },
});
