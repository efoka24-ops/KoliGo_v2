import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Numpad } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function PinScreen({ navigation }) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');

  const onKey = (k) => {
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    if (pin.length < 4) {
      const next = pin + k;
      setPin(next);
      if (next.length === 4) setTimeout(() => navigation.navigate('Location'), 180);
    }
  };

  return (
    <Screen scroll={false}>
      <ScreenHeader title={t('yourPin')} subtitle="4 chiffres" onBack={() => navigation.goBack()} />
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 6 }}>
        <Text style={type.lead}>{t('pinHint')}</Text>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < pin.length ? colors.green : colors.line }]} />
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Numpad onKey={onKey} />
        <View style={{ height: 12 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 14, justifyContent: 'center', marginVertical: 18 },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
