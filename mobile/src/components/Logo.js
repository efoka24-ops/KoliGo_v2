import React from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// App wordmark + logo. Pass `size` for the mark.
export default function Logo({ size = 48, showText = false, light = false }) {
  return (
    <View style={styles.row}>
      <Image source={require('../../assets/koligo-logo-1024.png')} style={{ width: size, height: size, borderRadius: size * 0.22 }} />
      {showText ? (
        <Text style={[styles.wm, { color: light ? '#fff' : colors.ink }]}>
          Koli<Text style={{ color: light ? '#7FD79A' : colors.green }}>Go</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wm: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
});
