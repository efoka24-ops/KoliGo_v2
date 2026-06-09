import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Field, Card, Button, Pill } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function PostDeliveryScreen({ navigation }) {
  const { t } = useI18n();
  const [weight, setWeight] = useState('3 kg');
  const [urgency, setUrgency] = useState('Standard');

  const Chip = ({ label, active, onPress, tone }) => (
    <Pressable onPress={onPress}>
      <View style={[styles.chip, active && (tone === 'orange' ? styles.chipOrange : styles.chipOn)]}>
        <Text style={[styles.chipTxt, active && { color: '#fff' }]}>{label}</Text>
      </View>
    </Pressable>
  );

  return (
    <Screen footer={<Button title={t('confirm')} onPress={() => navigation.navigate('VendorCodes')} />}>
      <ScreenHeader title={t('theParcel')} subtitle="Étape 2 / 2" onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 14 }}>
        <Text style={type.eyebrow}>{t('weight')}</Text>
        <View style={styles.row}>
          {['1 kg', '3 kg', '5 kg', '10 kg+'].map((w) => (
            <Chip key={w} label={w} active={weight === w} onPress={() => setWeight(w)} />
          ))}
        </View>
        <Field placeholder={t('description')} />
        <Text style={type.eyebrow}>{t('urgency')}</Text>
        <View style={styles.row}>
          {['Standard', 'Express', 'VVIP'].map((u) => (
            <Chip key={u} label={u} active={urgency === u} onPress={() => setUrgency(u)} tone={u !== 'Standard' ? 'orange' : null} />
          ))}
        </View>
        <Field placeholder={t('destination')} prefix="📍" />
        <Card tone="green" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[type.eyebrow, { color: colors.greenDark }]}>{t('dynamicPrice')}</Text>
          <Text style={styles.price}>2 500 <Text style={{ fontSize: 13, color: colors.muted }}>XAF</Text></Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.green, borderColor: colors.greenDark },
  chipOrange: { backgroundColor: colors.orange, borderColor: colors.orangeDark },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  price: { fontSize: 24, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
});
