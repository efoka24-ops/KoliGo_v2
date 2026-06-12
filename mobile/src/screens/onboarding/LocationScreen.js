import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
          <Ionicons name="location" size={30} color={colors.green} />
        </View>
        <Text style={[type.h1, { textAlign: 'center' }]}>{t('enableLocation')}</Text>
        <Text style={[type.lead, { textAlign: 'center' }]}>{t('locationBody')}</Text>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={type.body}>Pendant l'usage</Text>
            <Text style={[type.lead, { fontSize: 11 }]}>Requis pour toutes les courses</Text>
          </View>
          <Pill label="ACTIVÉ" tone="ok" />
        </Card>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={type.body}>Arrière-plan</Text>
            <Text style={[type.lead, { fontSize: 11 }]}>Livreur — GPS streaming 8s</Text>
          </View>
          <Toggle value={bg} onValueChange={setBg} />
        </Card>
      </View>
    </Screen>
  );
}
