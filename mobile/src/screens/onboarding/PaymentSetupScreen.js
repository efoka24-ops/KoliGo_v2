import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, ScreenHeader, Field, Button, Card } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../context/AppContext';

const OPERATORS = [
  { id: 'mtn', label: 'MTN MoMo', color: '#FFCC00', icon: 'phone-portrait' },
  { id: 'om', label: 'Orange Money', color: '#FF6600', icon: 'phone-portrait' },
];

export default function PaymentSetupScreen({ navigation }) {
  const { t } = useI18n();
  const { role } = useApp();
  const [op, setOp] = useState('mtn');

  const finish = () => navigation.reset({ index: 0, routes: [{ name: role === 'deliverer' ? 'DelivererApp' : 'VendorApp' }] });

  return (
    <Screen footer={<Button title={t('save')} onPress={finish} />}>
      <ScreenHeader title={t('paymentAccount')} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 14 }}>
        <Text style={type.eyebrow}>{t('operator')}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {OPERATORS.map(({ id, label, color }) => (
            <Pressable key={id} style={{ flex: 1 }} onPress={() => setOp(id)}>
              <Card tone={op === id ? 'orange' : 'default'} style={styles.op}>
                <View style={[styles.opDot, { backgroundColor: color }]} />
                <Text style={[type.h3, op === id && { color: colors.orangeDark }]}>{label}</Text>
                {op === id && <Ionicons name="checkmark-circle" size={16} color={colors.orangeDark} />}
              </Card>
            </Pressable>
          ))}
        </View>
        <Field label={t('number')} placeholder="+237 6•• ••• •12" keyboardType="phone-pad" />
        <Field label={t('holder')} placeholder="Awa N." />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  op: { alignItems: 'center', paddingVertical: 14, gap: 6 },
  opDot: { width: 32, height: 32, borderRadius: 16 },
});
