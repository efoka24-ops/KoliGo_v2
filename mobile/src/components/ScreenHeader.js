import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// Generic top app bar. tone 'green' renders the brand header used on dashboards.
export default function ScreenHeader({ title, subtitle, onBack, right, tone = 'default' }) {
  const insets = useSafeAreaInsets();
  const green = tone === 'green';
  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 8 },
        green ? { backgroundColor: colors.green } : { backgroundColor: '#FFFFFF', borderBottomColor: colors.line, borderBottomWidth: 1 },
      ]}
    >
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={green ? colors.white : colors.ink} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: green ? colors.white : colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.sub, { color: green ? 'rgba(255,255,255,0.8)' : colors.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12 },
  back: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 11.5, marginTop: 1 },
});
