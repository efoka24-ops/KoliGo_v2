import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Card, Button, Pill } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

function SplitRow({ tone, label, amt }) {
  return (
    <View style={styles.split}>
      <Pill label={label} tone={tone} />
      <Text style={styles.amt}>{amt}</Text>
    </View>
  );
}

export default function ReceptionSuccessScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title={t('paymentReceipt')} variant="outline" size="sm" style={{ flex: 1 }} />
          <Button title={t('rate')} size="sm" style={{ flex: 1 }} onPress={() => navigation.navigate('ClientRating')} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.ic}><Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text></View>
        <Text style={type.h2}>{t('deliveryConfirmed')}</Text>
      </View>
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={type.eyebrow}>{t('totalPaid')}</Text>
        <Text style={[styles.amt, { fontSize: 24 }]}>2 500 <Text style={{ fontSize: 13, color: colors.muted }}>XAF</Text></Text>
      </Card>
      <Text style={type.eyebrow}>{t('autoSplit')}</Text>
      <Card>
        <SplitRow tone="ok" label={t('vendor')} amt="2 000" />
        <SplitRow tone="orange" label={t('deliverer')} amt="425" />
        <SplitRow tone="muted" label="KoliGo · 3%" amt="75" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ic: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  split: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  amt: { fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
});
