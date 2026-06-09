import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Pill, StatCard, Toggle } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../store';

export default function DelivererHomeScreen({ navigation }) {
  const { t } = useI18n();
  const { online, setOnline } = useApp();

  return (
    <Screen padded={false}>
      <ScreenHeader
        tone="green"
        title={t('online')}
        subtitle={t('youReceiveOffers')}
        right={<Toggle value={online} onValueChange={setOnline} />}
      />
      <View style={{ padding: 18, gap: 14 }}>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={type.eyebrow}>{t('wallet')}</Text>
            <Text style={styles.balance}>128 500 <Text style={{ fontSize: 13, color: colors.muted }}>XAF</Text></Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={type.eyebrow}>{t('today')}</Text>
            <Text style={[styles.balance, { fontSize: 16, color: colors.greenDark }]}>+12 000</Text>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatCard value="7" label={t('trips')} />
          <StatCard value="4.9★" label={t('rating')} />
          <StatCard value="92%" label="Accept." />
        </View>
        <Card tone="orange" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 20 }}>🎁</Text>
          <Text style={[type.body, { flex: 1 }]}>Bonus : +1 000 XAF après 3 courses aujourd'hui</Text>
        </Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={type.eyebrow}>{t('topOffers')}</Text>
          <Text style={type.eyebrow}>3</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('OfferDetail')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.dot, { backgroundColor: colors.orange }]} />
              <Text style={type.h3}>Akwa → Bonapriso</Text>
            </View>
            <Text style={styles.amt}>2 500</Text>
          </Card>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { fontSize: 24, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  amt: { fontSize: 16, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
