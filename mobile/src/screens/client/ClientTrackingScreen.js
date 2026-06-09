import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Card, Button, Pill, Placeholder, Avatar } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function ClientTrackingScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen padded={false} footer={<Button title={t('reception')} onPress={() => navigation.navigate('ClientReception')} />}>
      <Placeholder map height={230} />
      <View style={{ padding: 18, gap: 12, marginTop: -20, backgroundColor: colors.app, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pill label="En route · ETA 8 min" tone="ok" />
          <Text style={type.eyebrow}>poll 10s</Text>
        </View>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Avatar label="J" tone="orange" size={42} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={type.h3}>Jean K.</Text>
              <Pill label="★ 4.9" tone="ok" dot={false} />
            </View>
            <Text style={type.lead}>Moto · CE 482 AB</Text>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title={t('call')} variant="outline" size="sm" style={{ flex: 1 }} />
          <Button title="WhatsApp" size="sm" style={{ flex: 1 }} />
        </View>
        <Card tone="orange" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[type.eyebrow, { color: colors.orangeDark }]}>{t('receptionCode')}</Text>
          <Text style={styles.code}>2916</Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 20, fontWeight: '600', letterSpacing: 3, color: colors.ink, fontVariant: ['tabular-nums'] },
});
