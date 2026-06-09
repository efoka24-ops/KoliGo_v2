import React from 'react';
import { View, Text } from 'react-native';
import { Screen, ScreenHeader, Placeholder, Card, Button, Pill } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';

export default function KycScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen footer={<Button title={t('submit')} onPress={() => navigation.navigate('RoleSelect')} />}>
      <ScreenHeader title={t('identityCheck')} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.eyebrow}>Documents</Text>
          <Pill label="EN ATTENTE" tone="orange" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Placeholder height={70} label={t('idFront')} style={{ flex: 1 }} />
          <Placeholder height={70} label={t('idBack')} style={{ flex: 1 }} />
        </View>
        <Placeholder height={80} label={t('selfie')} />
        <Card tone="soft" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8551C' }} />
          <Text style={type.lead}>{t('reviewed24h')}</Text>
        </Card>
      </View>
    </Screen>
  );
}
