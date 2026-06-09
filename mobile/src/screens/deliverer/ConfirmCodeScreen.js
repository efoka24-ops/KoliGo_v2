import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, ScreenHeader, CodeBoxes, Numpad, Pill } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';

export default function ConfirmCodeScreen({ navigation }) {
  const { t } = useI18n();
  const [code, setCode] = useState('73');

  const onKey = (k) => {
    if (k === '⌫') return setCode((c) => c.slice(0, -1));
    if (code.length < 4) {
      const next = code + k;
      setCode(next);
      if (next.length === 4) setTimeout(() => navigation.navigate('Waiting'), 200);
    }
  };

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('pickupCode')}
        subtitle="Chez le vendeur"
        onBack={() => navigation.goBack()}
        right={<Pill label={t('pickup')} tone="orange" />}
      />
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 6 }}>
        <Text style={type.lead}>{t('enterPickup')}</Text>
        <View style={{ marginVertical: 18 }}>
          <CodeBoxes value={code} length={4} tone="orange" />
        </View>
        <View style={{ flex: 1 }} />
        <Numpad onKey={onKey} />
        <View style={{ height: 12 }} />
      </View>
    </Screen>
  );
}
