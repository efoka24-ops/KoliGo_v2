import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function Stars({ value = 0, max = 5, size = 22, onRate }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < value;
        const star = <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? colors.orange : colors.muted2} />;
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
});
