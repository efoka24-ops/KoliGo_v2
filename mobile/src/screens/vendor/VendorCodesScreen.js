import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Button, Pill } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function VendorCodesScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen>
      <ScreenHeader title={t('yourCodes')} subtitle="Actualisé il y a 3s · polling 5s" onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 12 }}>
        <Card tone="orange">
          <Text style={[type.eyebrow, { color: colors.orangeDark }]}>{t('pickupCode')}</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>7 3 0 4</Text>
            <Pill label={t('toDeliverer')} tone="orange" />
          </View>
        </Card>
        <Card tone="green">
          <Text style={[type.eyebrow, { color: colors.greenDark }]}>{t('receptionCode')}</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>2 9 1 6</Text>
            <Pill label={t('toClient')} tone="ok" />
          </View>
        </Card>
        <Button title={t('trustInvoice')} variant="outline" size="sm" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="WhatsApp" variant="outline" size="sm" style={{ flex: 1 }} />
          <Button title="SMS" variant="outline" size="sm" style={{ flex: 1 }} />
          <Button title={t('link')} variant="outline" size="sm" style={{ flex: 1 }} />
        </View>
        <Button title={t('trackDelivery')} onPress={() => navigation.navigate('DeliveryDetail')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  code: { fontSize: 26, fontWeight: '600', letterSpacing: 4, color: colors.ink, fontVariant: ['tabular-nums'] },
});
