import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Field, Button, Card } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../store';

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
          <Pressable style={{ flex: 1 }} onPress={() => setOp('mtn')}>
            <Card tone={op === 'mtn' ? 'orange' : 'default'} style={styles.op}>
              <Text style={[type.h3, op === 'mtn' && { color: colors.orangeDark }]}>MTN MoMo</Text>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setOp('om')}>
            <Card tone={op === 'om' ? 'orange' : 'default'} style={styles.op}>
              <Text style={[type.h3, op === 'om' && { color: colors.orangeDark }]}>Orange Money</Text>
            </Card>
          </Pressable>
        </View>
        <Field label={t('number')} placeholder="+237 6•• ••• •12" keyboardType="phone-pad" />
        <Field label={t('holder')} placeholder="Awa N." />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  op: { alignItems: 'center', paddingVertical: 16 },
});
