import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Button, Pill, Placeholder } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function OfferDetailScreen({ navigation, route }) {
  const { t } = useI18n();
  const o = route?.params?.offer || { type: 'Express', tone: 'orange', amt: '3 200', from: 'Akwa', to: 'Bonapriso', km: '2.4 km · 3 kg', rating: '4.8' };

  return (
    <Screen
      padded={false}
      footer={
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={t('decline')} variant="outline" style={{ flex: 1 }} onPress={() => navigation.goBack()} />
            <Button title={t('accept')} style={{ flex: 1 }} onPress={() => navigation.navigate('ConfirmCode')} />
          </View>
          <Button title={t('atVendor')} variant="accent" onPress={() => navigation.navigate('ConfirmCode')} />
        </View>
      }
    >
      <ScreenHeader title={`${o.from} → ${o.to}`} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, gap: 12 }}>
        <Placeholder map height={140} />
        <View style={styles.row}>
          <Pill label={o.type} tone={o.tone} />
          <Text style={styles.amt}>{o.amt} <Text style={{ fontSize: 13, color: colors.muted }}>XAF</Text></Text>
        </View>
        <Card tone="soft">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={[styles.dot, { backgroundColor: colors.orange }]} />
            <Text style={type.body}>{o.from}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}>
            <View style={[styles.dot, { backgroundColor: colors.green }]} />
            <Text style={type.body}>{o.to}</Text>
          </View>
        </Card>
        <View style={styles.row}>
          <Text style={type.lead}>{o.km}</Text>
          <Pill label={`Vendeur ★${o.rating}`} tone="ok" dot={false} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amt: { fontSize: 22, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
