import React from 'react';
import { View, Text } from 'react-native';
import { Screen, Button } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function MaintenanceScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen center>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.orange50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30 }}>🛠</Text>
      </View>
      <Text style={[type.h1, { textAlign: 'center', marginTop: 12 }]}>{t('maintenance')}</Text>
      <Text style={[type.lead, { textAlign: 'center', maxWidth: 300 }]}>{t('maintenanceBody')}</Text>
      <Button title={t('retry')} onPress={() => navigation.goBack()} style={{ marginTop: 8, alignSelf: 'stretch' }} />
      <Text style={[type.eyebrow, { marginTop: 8 }]}>flag platform_settings</Text>
    </Screen>
  );
}
