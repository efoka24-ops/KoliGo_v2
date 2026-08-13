import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

// Standard page scaffold. Use `scroll` for content pages, `center` for hero/empty states.
export default function Screen({ children, scroll = true, center = false, padded = true, footer, style, bg }) {
  // Without scroll the body is the only child of the SafeAreaView, so it has to
  // claim the height itself. Left unflexed, any `flex: 1` child collapses to
  // zero height and the whole page stacks on top of itself.
  const body = (
    <View style={[padded && styles.pad, center && styles.center, { flex: (center || !scroll) ? 1 : undefined }, style]}>
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
  footer: { paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.app },
});
