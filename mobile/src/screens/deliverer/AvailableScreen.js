import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Pill } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

const OFFERS = [
  { type: 'Express', tone: 'orange', amt: '3 200', from: 'Akwa', to: 'Bonapriso', km: '2.4 km · 3 kg', rating: '4.8' },
  { type: 'Standard', tone: 'muted', amt: '1 800', from: 'Deïdo', to: 'Akwa', km: '1.1 km · 1 kg', rating: '4.9' },
  { type: 'VVIP', tone: 'info', amt: '4 200', from: 'Bonapriso', to: 'Deïdo', km: '3.0 km · 5 kg', rating: '4.7' },
];

export default function AvailableScreen({ navigation }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('Tous');

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('available')} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {['Tous', 'Express', 'VVIP', 'Permanent'].map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)}>
              <View style={[styles.chip, filter === f && styles.chipOn]}>
                <Text style={[styles.chipTxt, filter === f && { color: '#fff' }]}>{f}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {OFFERS.map((o, i) => (
          <Pressable key={i} onPress={() => navigation.navigate('OfferDetail', { offer: o })}>
            <Card style={{ gap: 8 }}>
              <View style={styles.row}>
                <Pill label={o.type} tone={o.tone} />
                <Text style={styles.amt}>{o.amt} <Text style={{ fontSize: 12, color: colors.muted }}>XAF</Text></Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={[styles.dot, { backgroundColor: colors.orange }]} />
                <Text style={type.body}>{o.from}</Text>
                <Text style={{ color: colors.muted2 }}>→</Text>
                <View style={[styles.dot, { backgroundColor: colors.green }]} />
                <Text style={type.body}>{o.to}</Text>
              </View>
              <View style={styles.row}>
                <Text style={type.lead}>{o.km}</Text>
                <Pill label={`★ ${o.rating}`} tone="ok" dot={false} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.green, borderColor: colors.greenDark },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amt: { fontSize: 16, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
