import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Logo, Card, Button, Pill } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function ClientLandingScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen footer={<Button title={t('trackDelivery')} onPress={() => navigation.navigate('ClientTracking')} />}>
      <Logo size={34} showText />
      <Card tone="green">
        <Text style={[type.eyebrow, { color: colors.greenDark }]}>{t('parcelComing')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <View style={styles.box}><Text style={{ fontSize: 20 }}>📦</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>KG-2841</Text>
            <Text style={type.lead}>De Awa N. · 3 kg</Text>
          </View>
        </View>
      </Card>
      <Card tone="orange" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.eyebrow, { color: colors.orangeDark }]}>{t('yourReceptionCode')}</Text>
        <Text style={styles.code}>2916</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.green100, alignItems: 'center', justifyContent: 'center' },
  code: { fontSize: 22, fontWeight: '600', letterSpacing: 3, color: colors.ink, fontVariant: ['tabular-nums'] },
});
