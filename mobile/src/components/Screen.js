import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

// Standard page scaffold. Use `scroll` for content pages, `center` for hero/empty states.
export default function Screen({ children, scroll = true, center = false, padded = true, footer, style, bg }) {
  const body = (
    <View style={[padded && styles.pad, center && styles.center, { flex: center ? 1 : undefined }, style]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, bg && { backgroundColor: bg }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ flexGrow: 1 }, center && styles.center]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.app },
  pad: { padding: 18, gap: 14 },
  center: { justifyContent: 'center', alignItems: 'center' },
  footer: { padding: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.app },
});
