import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Button, Pill, StatCard, Avatar } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../store';

export default function VendorHomeScreen({ navigation }) {
  const { t } = useI18n();
  const { setRole } = useApp();

  return (
    <Screen padded={false}>
      <ScreenHeader
        tone="green"
        title={`${t('hi')}, Awa`}
        subtitle={`${t('vendor')} · ${t('switchRole')}`}
        right={
          <Pressable onPress={() => { setRole('deliverer'); navigation.reset({ index: 0, routes: [{ name: 'DelivererApp' }] }); }} style={styles.roleBtn}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>↺ {t('switchRole')}</Text>
          </Pressable>
        }
      />
      <View style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatCard value="42 k" label={t('earningsXaf')} />
          <StatCard value="3" label={t('activeParcels')} />
          <StatCard value="2" label={t('enRoute')} />
        </View>
        <Button title={t('newDelivery')} variant="accent" onPress={() => navigation.navigate('PostDelivery')} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={type.eyebrow}>{t('activeDeliveries')}</Text>
          <Text style={type.eyebrow}>3</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('DeliveryDetail')}>
          <Card style={{ gap: 8 }}>
            <View style={styles.cardRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: colors.green }]} />
                <Text style={type.h3}>KG-2841 · Bonapriso</Text>
              </View>
              <Pill label={t('inTransit')} tone="ok" />
            </View>
            <Text style={type.lead}>3 kg · 2.4 km · Express</Text>
          </Card>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('VendorCodes')}>
          <Card style={{ gap: 8 }}>
            <View style={styles.cardRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: colors.orange }]} />
                <Text style={type.h3}>KG-2840 · Akwa</Text>
              </View>
              <Pill label={t('pickup')} tone="orange" />
            </View>
            <Text style={type.lead}>1 kg · 1.1 km · Standard</Text>
          </Card>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
