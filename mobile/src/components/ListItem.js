import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

// Reusable settings/profile row. Left icon (emoji or node), label, right node.
export default function ListItem({ icon, label, right, onPress, last }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && onPress && { opacity: 0.6 }]}
    >
      <View style={styles.left}>
        {icon != null ? (
          typeof icon === 'string' ? (
            <View style={styles.iconBox}>
              <Text style={{ fontSize: 14 }}>{icon}</Text>
            </View>
          ) : (
            icon
          )
        ) : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      {right != null ? right : onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted2} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.line2 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconBox: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: '#EFEFEA',
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  chev: { fontSize: 20, color: colors.muted2 },
});
