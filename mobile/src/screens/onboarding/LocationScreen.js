import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, Card, Button, Pill, Toggle } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function LocationScreen({ navigation }) {
  const { t } = useI18n();
  const [bg, setBg] = useState(false);
  return (
    <Screen footer={<Button title={t('allow')} onPress={() => navigation.navigate('RoleSelect')} />}>
      <View style={{ paddingHorizontal: 18, paddingTop: 18, gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
          <Text style={{ fontSize: 30 }}>📍</Text>
        </View>
        <Text style={[type.h1, { textAlign: 'center' }]}>{t('enableLocation')}</Text>
        <Text style={[type.lead, { textAlign: 'center' }]}>{t('locationBody')}</Text>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.body}>Pendant l'usage — requis</Text>
          <Pill label="ACTIVÉ" tone="ok" />
        </Card>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.body}>Arrière-plan (livreur)</Text>
          <Toggle value={bg} onValueChange={setBg} />
        </Card>
      </View>
    </Screen>
  );
}
