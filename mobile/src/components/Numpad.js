import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function Numpad({ onKey }) {
  return (
    <View style={styles.grid}>
      {KEYS.map((k, i) => {
        if (k === '') return <View key={i} style={styles.key} />;
        return (
          <Pressable
            key={i}
            onPress={() => onKey && onKey(k)}
            style={({ pressed }) => [styles.key, styles.keyBox, pressed && { backgroundColor: colors.surface2 }]}
          >
            <Text style={styles.txt}>{k}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  key: { width: '31%', height: 56, alignItems: 'center', justifyContent: 'center' },
  keyBox: { borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  txt: { fontSize: 20, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
});
