import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Pill } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

const DATA = [
  { id: 'KG-2841', route: 'Bonapriso', amt: '2 500', status: 'delivered' },
  { id: 'KG-2838', route: 'Deïdo', amt: '1 800', status: 'delivered' },
  { id: 'KG-2835', route: 'Akwa', amt: '—', status: 'cancelled' },
  { id: 'KG-2830', route: 'New-Bell', amt: '3 200', status: 'delivered' },
];

export default function HistoryScreen() {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const filters = [['all', t('history')], ['delivered', t('delivered')], ['cancelled', t('cancelled')]];
  const rows = DATA.filter((d) => filter === 'all' || d.status === filter);

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('history')} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {filters.map(([k, label]) => (
            <Pressable key={k} onPress={() => setFilter(k)}>
              <View style={[styles.chip, filter === k && styles.chipOn]}>
                <Text style={[styles.chipTxt, filter === k && { color: '#fff' }]}>{label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {rows.map((d) => (
          <Card key={d.id} style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.ic, { backgroundColor: d.status === 'delivered' ? colors.green50 : '#EFEFEA' }]}>
                <Text>{d.status === 'delivered' ? '✓' : '✕'}</Text>
              </View>
              <View>
                <Text style={type.h3}>{d.id}</Text>
                <Text style={type.lead}>Akwa → {d.route}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.amt}>{d.amt}</Text>
              <Pill label={d.status === 'delivered' ? t('delivered') : t('cancelled')} tone={d.status === 'delivered' ? 'ok' : 'muted'} />
            </View>
          </Card>
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
  ic: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  amt: { fontSize: 15, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
});
