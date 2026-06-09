import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Logo, Numpad, Card } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../store';

export default function SigninScreen({ navigation }) {
  const { t } = useI18n();
  const { role } = useApp();
  const [pin, setPin] = useState('');

  const go = () => navigation.reset({ index: 0, routes: [{ name: role === 'deliverer' ? 'DelivererApp' : 'VendorApp' }] });

  const onKey = (k) => {
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    if (pin.length < 4) {
      const next = pin + k;
      setPin(next);
      if (next.length === 4) setTimeout(go, 180);
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ flex: 1, padding: 18, paddingTop: 60 }}>
        <Logo size={46} />
        <Text style={[type.h1, { marginTop: 16 }]}>{t('welcomeBack')}</Text>
        <Text style={type.lead}>{t('enterPin')}</Text>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < pin.length ? colors.green : colors.line }]} />
          ))}
        </View>
        <Card tone="soft" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.faceIcon}><Text>☺</Text></View>
          <Text style={type.lead}>{t('faceId')}</Text>
        </Card>
        <View style={{ flex: 1 }} />
        <Numpad onKey={onKey} />
        <Text style={[type.eyebrow, { textAlign: 'center', marginTop: 14 }]}>{t('forgotPin')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 13, justifyContent: 'center', marginVertical: 16 },
  dot: { width: 13, height: 13, borderRadius: 7 },
  faceIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
});
