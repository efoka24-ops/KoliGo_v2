import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Screen, ScreenHeader, Field, Button, Card } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function SignupScreen({ navigation }) {
  const { t } = useI18n();
  const [accepted, setAccepted] = useState(false);
  return (
    <Screen
      footer={<Button title={t('getCode')} onPress={() => navigation.navigate('Otp')} />}
    >
      <ScreenHeader title={t('createAccount')} subtitle="Étape 1 / 3" onBack={() => navigation.goBack()} />
      <View style={{ gap: 14, paddingHorizontal: 18, paddingTop: 6 }}>
        <Field label={t('fullName')} placeholder="Awa N." />
        <Field label={t('phone')} prefix="+237" placeholder="6•• ••• •12" keyboardType="phone-pad" />
        <Pressable onPress={() => setAccepted((a) => !a)}>
          <Card tone="soft" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: accepted ? colors.green : colors.line, backgroundColor: accepted ? colors.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {accepted ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text> : null}
            </View>
            <Text style={[type.lead, { flex: 1 }]}>{t('acceptTerms')}</Text>
          </Card>
        </Pressable>
      </View>
    </Screen>
  );
}
