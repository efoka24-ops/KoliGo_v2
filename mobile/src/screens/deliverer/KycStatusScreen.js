import React from 'react';
import { View, Text } from 'react-native';
import { Screen, ScreenHeader, Button, Placeholder } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function KycStatusScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen center footer={<Button title="Resoumettre" onPress={() => navigation.goBack()} />}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.orange50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30 }}>⚠</Text>
      </View>
      <Text style={[type.h1, { textAlign: 'center', marginTop: 8 }]}>Vérification rejetée</Text>
      <Text style={[type.lead, { textAlign: 'center', maxWidth: 300 }]}>Photo CNI trop floue. Merci de resoumettre.</Text>
      <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 }}>
        <Placeholder height={64} label={t('idFront')} style={{ flex: 1 }} />
        <Placeholder height={64} label="SELFIE" style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
