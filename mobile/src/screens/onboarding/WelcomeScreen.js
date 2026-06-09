import React from 'react';
import { View, Text } from 'react-native';
import { Screen, Logo, Button, Pill } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';

export default function WelcomeScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen center>
      <Logo size={64} />
      <Text style={[type.h1, { textAlign: 'center', marginTop: 12 }]}>{t('welcomeTitle')}</Text>
      <Text style={[type.lead, { textAlign: 'center', maxWidth: 300 }]}>{t('welcomeBody')}</Text>
      <View style={{ width: '100%', gap: 10, marginTop: 10 }}>
        <Button title={t('createAccount')} onPress={() => navigation.navigate('Signup')} />
        <Button title={t('signIn')} variant="outline" onPress={() => navigation.navigate('Signin')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Pill label={t('kycVerified')} tone="ok" />
        <Pill label="MoMo / Orange" tone="muted" />
      </View>
    </Screen>
  );
}
