import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
        green ? { backgroundColor: colors.green } : { backgroundColor: colors.app, borderBottomColor: colors.line, borderBottomWidth: 1 },
      ]}
    >
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
          <Text style={[styles.backTxt, { color: green ? colors.white : colors.ink }]}>‹</Text>
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
  backTxt: { fontSize: 30, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 11.5, marginTop: 1 },
});
