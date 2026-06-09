import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useDeliveries } from '../../hooks/useDeliveries';
import { KG_AVAILABLE_FOR_DELIVERER } from '../../constants/data';
import KGCard from '../../components/KGCard';
import KGTabBar from '../../components/KGTabBar';
import KGCourierBadge from '../../components/KGCourierBadge';
import KGSectionTitle from '../../components/KGSectionTitle';
import KGToast from '../../components/KGToast';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';
import DemoDrawer from '../../components/DemoDrawer';
import { useI18n } from '../../i18n';

function StatCard({ label, value }) {
  return (
    <KGCard padding={12} style={{ flex: 1, gap: 2 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </KGCard>
  );
}

function AvailableCard({ d, onPress }) {
  return (
    <KGCard onPress={onPress}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <KGCourierBadge type={d.type} />
            {d.posted && <Text style={styles.cardPosted}>{d.posted}</Text>}
          </View>
          <RouteLine from={d.from} to={d.to} />
          <View style={styles.cardMeta}>
            <Icon name="package" size={13} color={colors.ink55} />
            <Text style={styles.cardMetaText}>{d.weight} kg</Text>
            <Text style={styles.cardMetaDot}>&middot;</Text>
            <Text style={styles.cardMetaText}>{d.distance} km</Text>
            {d.vendorRating && (
              <>
                <Text style={styles.cardMetaDot}>&middot;</Text>
                <Icon name="star" size={13} color={colors.ink55} />
                <Text style={styles.cardMetaText}>{d.vendorRating}</Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.cardPrice}>
          <Text style={styles.cardPriceAmount}>{(d.price || 0).toLocaleString('fr-FR')}</Text>
          <Text style={styles.cardPriceCurrency}>XAF</Text>
        </View>
      </View>
    </KGCard>
  );
}

export default function DelivererHomeScreen({ navigation }) {
  const { toast, user, token, api } = useApp();
  const { t } = useI18n();
  const isDemo = user?.isTest === true;
  const [online, setOnline] = useState(true);
  const [stats, setStats] = useState(null);

  const { deliveries: availableDeliveries, loading: loadingDeliveries, fetchDeliveries } = useDeliveries();

  const fetchStats = useCallback(async () => {
    if (isDemo || !token) return;
    try {
      const data = await api('/api/users/me/stats');
      setStats(data);
    } catch {}
  }, [api, isDemo, token]);

  useEffect(() => {
    const loadData = () => { fetchDeliveries({ mode: 'available' }); fetchStats(); };
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [fetchDeliveries, fetchStats, navigation]);

  const handleTab = (tab) => {
    if (tab === 'courses') navigation.navigate('Available');
    else if (tab === 'wallet') navigation.navigate('Wallet');
    else if (tab === 'profile') navigation.navigate('Profile');
  };

  const demoStats = { balance: 128500, gainsToday: 12000, courses: 7, note: 4.9, acceptation: 92 };
  const s = isDemo ? demoStats : stats;

  const list = isDemo ? KG_AVAILABLE_FOR_DELIVERER : (availableDeliveries || []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}

      {/* Online/Offline banner */}
      <View style={[styles.banner, { backgroundColor: online ? colors.green : colors.ink35 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{online ? t('En ligne') : t('Hors ligne')}</Text>
          <Text style={styles.bannerSubtitle}>
            {online ? t('Vous recevez des courses') : t('Vous ne recevez plus de courses')}
          </Text>
        </View>
        <Switch
          value={online}
          onValueChange={setOnline}
          trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.3)' }}
          thumbColor="#fff"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Wallet card */}
        <View style={styles.walletCard}>
          <View style={styles.walletRow}>
            <View>
              <Text style={styles.walletLabel}>WALLET</Text>
              <Text style={styles.walletBalance}>
                {(s?.balance ?? 0).toLocaleString('fr-FR')}{' '}
                <Text style={styles.walletCurrency}>XAF</Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.walletLabel}>AUJOURD&apos;HUI</Text>
              <Text style={styles.walletGain}>+{(s?.gainsToday ?? 0).toLocaleString('fr-FR')}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard label="COURSES" value={String(s?.courses ?? 0)} />
          <StatCard label="NOTE" value={s?.note ? `${s.note}★` : '—'} />
          <StatCard label="ACCEPT." value={s?.acceptation != null ? `${s.acceptation}%` : '—'} />
        </View>

        {/* Bonus banner */}
        {isDemo && (
          <KGCard kind="orange" padding={14} style={styles.bonusCard}>
            <View style={styles.bonusRow}>
              <Text style={{ fontSize: 20 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.bonusTitle}>{t('+2 000 XAF en bonus')}</Text>
                <Text style={styles.bonusBody}>{t('Atteins 10 courses aujourd\'hui — encore 7 restantes.')}</Text>
              </View>
            </View>
          </KGCard>
        )}

        {/* Best deliveries */}
        <KGSectionTitle
          action={list.length > 0 ? { label: t('Voir tout'), onPress: () => navigation.navigate('Available') } : undefined}
        >
          {list.length > 0
            ? t('Courses dispo · {{count}}', { count: list.length })
            : t('Courses disponibles')}
        </KGSectionTitle>

        {list.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Icon name="moto" size={24} color={colors.ink35} />
            </View>
            <Text style={styles.emptyText}>{t('Aucune course disponible pour le moment')}</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {list.slice(0, 3).map(d => (
              <AvailableCard
                key={d.id}
                d={d}
                onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: d.id, mode: 'available' })}
              />
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <KGTabBar active="home" onTab={handleTab} role="deliverer" />
      {isDemo && <DemoDrawer navigation={navigation} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  bannerTitle: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 20,
    color: '#fff',
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  scrollContent: { paddingBottom: 16 },
  walletCard: {
    margin: 16,
    backgroundColor: colors.ink,
    borderRadius: 18,
    padding: 18,
  },
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  walletLabel: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  walletBalance: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 28,
    color: '#fff',
    letterSpacing: -0.5,
  },
  walletCurrency: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  walletGain: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 18,
    color: '#4ade80',
    letterSpacing: -0.3,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  statValue: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: -0.01,
  },
  statLabel: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 10,
    color: colors.ink55,
    letterSpacing: 0.6,
  },
  bonusCard: { marginHorizontal: 16, marginBottom: 4 },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bonusTitle: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 2,
  },
  bonusBody: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 12,
    color: colors.ink70,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
    marginHorizontal: 16,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink12,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 13,
    color: colors.ink55,
    textAlign: 'center',
  },
  listContainer: { gap: 8, marginHorizontal: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardPosted: { fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink55 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  cardMetaText: { fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 },
  cardMetaDot: { color: colors.ink35, fontSize: 12 },
  cardPrice: { alignItems: 'flex-end', gap: 2 },
  cardPriceAmount: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 18,
    color: colors.green,
    letterSpacing: -0.4,
  },
  cardPriceCurrency: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 10,
    color: colors.ink55,
  },
});
