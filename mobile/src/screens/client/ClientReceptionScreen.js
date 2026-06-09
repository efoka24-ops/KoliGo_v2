import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, ScreenHeader, CodeBoxes, Numpad, Field } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';

export default function ClientReceptionScreen({ navigation }) {
  const { t } = useI18n();
  const [code, setCode] = useState('29');

  const onKey = (k) => {
    if (k === '⌫') return setCode((c) => c.slice(0, -1));
    if (code.length < 4) {
      const next = code + k;
      setCode(next);
      if (next.length === 4) setTimeout(() => navigation.navigate('ReceptionSuccess'), 200);
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <ScreenHeader tone="green" title={t('reception')} subtitle="Saisir pour confirmer" />
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 12 }}>
        <Text style={type.lead}>{t('enterReception')}</Text>
        <View style={{ marginVertical: 18 }}>
          <CodeBoxes value={code} length={4} tone="green" />
        </View>
        <Field placeholder={t('momoRef')} />
        <View style={{ flex: 1 }} />
        <Numpad onKey={onKey} />
        <View style={{ height: 12 }} />
      </View>
    </Screen>
  );
}
