import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, Card, Field, ListItem, Avatar } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../store';

export default function DelivererProfileScreen({ navigation }) {
  const { t } = useI18n();
  const { setRole } = useApp();
  const [vehicle, setVehicle] = useState('moto');
  const vehicles = [['moto', 'Moto', '🛵'], ['tri', 'Tricycle', '🛺'], ['car', 'Voiture', '🚗']];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar label="J" tone="orange" size={64} />
        <View>
          <Text style={type.h1}>Jean K.</Text>
          <Text style={type.lead}>{t('deliverer')} · ★4.9</Text>
        </View>
      </View>
      <Text style={type.eyebrow}>{t('vehicle')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {vehicles.map(([k, label, glyph]) => (
          <Pressable key={k} style={{ flex: 1 }} onPress={() => setVehicle(k)}>
            <Card tone={vehicle === k ? 'orange' : 'default'} style={styles.veh}>
              <Text style={{ fontSize: 22 }}>{glyph}</Text>
              <Text style={type.lead}>{label}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
      <Field placeholder="CE 482 AB" />
      <Card padded={false} style={{ paddingHorizontal: 14 }}>
        <ListItem icon="↺" label={t('switchRole')} onPress={() => { setRole('vendor'); navigation.reset({ index: 0, routes: [{ name: 'VendorApp' }] }); }} />
        <ListItem icon="🪪" label="Statut KYC" onPress={() => navigation.navigate('KycStatus')} />
        <ListItem icon="⚠" label={t('reportIssue')} onPress={() => navigation.navigate('ReportIssue')} />
        <ListItem icon="⚙" label={t('settings')} onPress={() => navigation.navigate('Settings')} last />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  veh: { alignItems: 'center', gap: 4, paddingVertical: 12 },
});
