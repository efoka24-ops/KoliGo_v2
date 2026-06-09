import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Button, StatCard } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

function Tx({ icon, tone, label, amt, positive }) {
  return (
    <View style={styles.tx}>
      <View style={[styles.ic, { backgroundColor: tone === 'orange' ? colors.orange50 : colors.green50 }]}>
        <Text>{icon}</Text>
      </View>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Text style={[styles.amt, { color: positive ? colors.greenDark : colors.orangeDark }]}>{amt}</Text>
    </View>
  );
}

export default function WalletScreen() {
  const { t } = useI18n();
  return (
    <Screen padded={false} footer={<Button title={t('withdraw')} />}>
      <ScreenHeader tone="green" title={t('wallet')} subtitle={`${t('balance')} · 128 500 XAF`} />
      <View style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatCard value="+12 000" label={t('today')} />
          <StatCard value="+64 500" label="Semaine" />
        </View>
        <Text style={type.eyebrow}>{t('transactions')}</Text>
        <Card padded={false} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          <Tx icon="↑" label="Course KG-2841" amt="+2 500" positive />
          <Tx icon="↓" tone="orange" label="Retrait MTN MoMo" amt="−20 000" />
          <Tx icon="🎁" label="Bonus quotidien" amt="+1 000" positive />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tx: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  ic: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  amt: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
