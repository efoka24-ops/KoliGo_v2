import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, ScreenHeader, CodeBoxes, Numpad, Button, Pill } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';

export default function OtpScreen({ navigation }) {
  const { t } = useI18n();
  const [code, setCode] = useState('49');

  const onKey = (k) => {
    if (k === '⌫') setCode((c) => c.slice(0, -1));
    else if (code.length < 4) setCode((c) => c + k);
  };

  return (
    <Screen footer={<Button title={t('verify')} onPress={() => navigation.navigate('Pin')} />}>
      <ScreenHeader title={t('verification')} subtitle="+237 6•• ••• •12" onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 18 }}>
        <Text style={type.lead}>{t('otpHint')}</Text>
        <CodeBoxes value={code} length={4} />
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          <Pill label="SMS" tone="ok" />
          <Pill label="WhatsApp" tone="muted" />
        </View>
        <Text style={[type.eyebrow, { textAlign: 'center' }]}>{t('resendIn')} 0:24</Text>
        <Numpad onKey={onKey} />
      </View>
    </Screen>
  );
}
