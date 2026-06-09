import React from 'react';
import { View, Text } from 'react-native';
import { Screen, Card, StatCard, ListItem, Avatar, Pill } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../store';

export default function VendorProfileScreen({ navigation }) {
  const { t } = useI18n();
  const { setRole } = useApp();
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar label="A" tone="green" size={64} />
        <View>
          <Text style={type.h1}>Awa N.</Text>
          <Text style={type.lead}>{t('vendor')}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatCard value="128" label="Envoyés" />
        <StatCard value="4.8★" label={t('rating')} />
        <StatCard value="97%" label={t('delivered')} />
      </View>
      <Card padded={false} style={{ paddingHorizontal: 14 }}>
        <ListItem icon="↺" label={t('switchRole')} onPress={() => { setRole('deliverer'); navigation.reset({ index: 0, routes: [{ name: 'DelivererApp' }] }); }} />
        <ListItem icon="✓" label="KYC — vérifié" right={<Pill label="✓" tone="ok" dot={false} />} />
        <ListItem icon="🔔" label={t('notifications')} onPress={() => navigation.navigate('Notifications')} />
        <ListItem icon="⚙" label={t('settings')} onPress={() => navigation.navigate('Settings')} last />
      </Card>
    </Screen>
  );
}
