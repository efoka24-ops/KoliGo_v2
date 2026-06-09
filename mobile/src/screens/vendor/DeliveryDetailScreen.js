import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Button, Pill, Placeholder } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

function Step({ done, current, title, time }) {
  return (
    <View style={styles.step}>
      <View style={[styles.node, done && { backgroundColor: colors.green }, current && { backgroundColor: colors.orange }]} />
      <View style={{ flex: 1 }}>
        <Text style={[type.h3, !done && !current && { color: colors.muted }]}>{title}</Text>
        <Text style={styles.ts}>{time}</Text>
      </View>
    </View>
  );
}

export default function DeliveryDetailScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('deliveryDetail')} subtitle="KG-2841" onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, gap: 12 }}>
        <Placeholder map height={150} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pill label={t('inTransit')} tone="ok" />
          <Text style={styles.amt}>2 500 XAF</Text>
        </View>
        <Card>
          <Step done title="Créée par le vendeur" time="14:02:11" />
          <Step done title="Acceptée par le livreur" time="14:05:48" />
          <Step done title="Collectée (code 7304)" time="14:14:02" />
          <Step current title="Livrée (code 2916)" time="14:32:30" />
        </Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={type.lead}>3 kg · 2.4 km</Text>
          <Text style={type.lead}>Akwa → Bonapriso</Text>
        </View>
        <Button title={t('cancel')} variant="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 13, paddingBottom: 16 },
  node: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.muted2, marginTop: 3 },
  ts: { fontSize: 11.5, color: colors.muted, fontVariant: ['tabular-nums'], marginTop: 1 },
  amt: { fontSize: 16, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
});
