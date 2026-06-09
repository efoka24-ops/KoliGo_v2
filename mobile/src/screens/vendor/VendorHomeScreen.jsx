import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp, t } from '../../context/AppContext';
import { useDeliveries } from '../../hooks/useDeliveries';
import KGCard from '../../components/KGCard';
import KGTabBar from '../../components/KGTabBar';
import KGStatusPill from '../../components/KGStatusPill';
import KGCourierBadge from '../../components/KGCourierBadge';
import KGSectionTitle from '../../components/KGSectionTitle';
import KGToast from '../../components/KGToast';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';
import DemoDrawer from '../../components/DemoDrawer';
import { useI18n } from '../../i18n';
function StatCard({ label, value, kind, sub, accent }) {
  return (
    <KGCard kind={kind} padding={16} style={styles.statCard}>
      {kind === 'dark' && <View style={styles.statCardBgDecoration} />}
      <Text style={[styles.statLabel, kind === 'dark' && styles.statLabelDark]}>{label}</Text>
      <Text style={[styles.statValue, kind === 'dark' && styles.statValueDark]}>{value}</Text>
      {sub && <Text style={[styles.statSub, kind === 'dark' && styles.statSubDark]}>{sub}</Text>}
    </KGCard>
  );
}

export default function VendorHomeScreen({ navigation, route }) {
  const { toast, user, lang } = useApp();`n  const { t } = useI18n();
  const displayName = user?.name || 'Mon compte';
  const avatar = user?.avatar || '??';
  const isDemo = user?.isTest === true;
  const isEn = lang === 'en';
  
  const { deliveries: active, fetchDeliveries } = useDeliveries();

  useEffect(() => {
    const load = () => fetchDeliveries({ activeOnly: true });
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [fetchDeliveries, navigation]);

  const handleTab = (tab) => {
    if (tab === 'history') navigation.navigate('History');
    else if (tab === 'chat') navigation.navigate('ChatInbox');
    else if (tab === 'profile') navigation.navigate('Profile');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: '#fff' }}>{avatar}</Text>
          </View>
          <View>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{t('Bonjour ðŸ‘‹')}</Text>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 17, color: colors.ink, letterSpacing: -0.01 }}>{displayName}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ChatInbox')}
          style={{ width: 40, height: 40, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 }}
        >
          <Icon name="bell" size={20} color={colors.ink} />
          <View style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, borderWidth: 2, borderColor: '#fff' }} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 16 }} showsVerticalScrollIndicator={false}>

        {/* Gains du jour */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Wallet')}
          activeOpacity={0.9}
          style={{
            backgroundColor: colors.ink, borderRadius: 20, padding: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          <View style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(13,122,62,0.22)' }} />
          <View>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.05 }}>{t('Gains du jour')}</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: '#fff', letterSpacing: -0.03 * 32, lineHeight: 36, marginTop: 4 }}>
              {isDemo ? '12 450' : '0'} <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>XAF</Text>
            </Text>
            {isDemo && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Part vendeur 97%</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Commission KoliGo 3%</Text>
                </View>
              </View>
            )}
          </View>
          <Icon name="wallet" size={22} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        {/* Stat cards */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.4 }}>
            <KGCard kind="dark" padding={16} style={{ overflow: 'hidden', position: 'relative' }}>
              <View style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(245,97,26,0.16)' }} />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{t('Livraisons actives')}</Text>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 44, color: '#fff', letterSpacing: -0.04, lineHeight: 50, marginTop: 6 }}>
                {active.length}
              </Text>
              {isDemo && active.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
                  {active.map(d => <View key={d.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: d.status === 'en_route' ? colors.orange : 'rgba(255,255,255,0.3)' }} />)}
                </View>
              )}
            </KGCard>
          </View>
          <View style={{ flex: 1 }}>
            <KGCard kind="green" padding={16} style={{ justifyContent: 'space-between', minHeight: 100 }}>
              <View>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.greenDark, opacity: 0.7 }}>{t('Ce mois')}</Text>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.greenDark, letterSpacing: -0.02, marginTop: 4 }}>{isDemo ? '42 colis' : '0 colis'}</Text>
              </View>
              {isDemo && <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.greenDark }}>+18% â†—</Text>}
            </KGCard>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={() => navigation.navigate('PostDelivery')}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.orange, borderRadius: 18, padding: 16,
            flexDirection: 'row', alignItems: 'center', gap: 14,
            shadowColor: colors.orange, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 24, elevation: 8,
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={24} color="#fff" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 17, color: '#fff', letterSpacing: -0.01 }}>{t('CrÃ©er une livraison')}</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{t('Prix calculÃ© en 3 secondes')}</Text>
          </View>
          <Icon name="arrow" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Active deliveries */}
        <KGSectionTitle action={{ label: t('Tout voir'), onPress: () => navigation.navigate('History') }}>{t('En cours')}</KGSectionTitle>

        <View style={{ gap: 10 }}>
          {active.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink12, borderStyle: 'dashed' }}>
                <Icon name="package" size={24} color={colors.ink35} />
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink55 }}>{t('Pas encore de livraisons actives')}</Text>
            </View>
          ) : (
            active.map(d => (
              <KGCard key={d.id} onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: d.id })}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <KGStatusPill status={d.status} />
                      <KGCourierBadge type={d.type} />
                    </View>
                    <RouteLine from={d.from} to={d.to} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{d.distance} km</Text>
                      <Text style={{ color: colors.ink55 }}>Â·</Text>
                      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{d.weight} kg</Text>
                      <Text style={{ color: colors.ink55 }}>Â·</Text>
                      <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 12, color: colors.ink }}>{d.price.toLocaleString('fr-FR')} XAF</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 11, color: colors.ink55 }}>#{d.id?.slice(-8).toUpperCase()}</Text>
                    <Icon name="arrow" size={18} color={colors.ink35} />
                  </View>
                </View>
                {d.status === 'en_route' && (
                  <View style={{ marginTop: 12, padding: 10, backgroundColor: colors.greenLight, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="moto" size={18} color={colors.greenDark} />
                    <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.greenDark }}>{d.deliverer || 'Livreur'} est en route</Text>
                  </View>
                )}
              </KGCard>
            ))
          )}
        </View>

        {/* Tip card */}
        <KGCard kind="cream" padding={14}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkle" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.ink }}>{isEn ? 'Go-go tip' : 'Astuce go-go'}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink70, marginTop: 4, lineHeight: 18 }}>
                {isEn ? 'Choose "Express" between 7am and 9am â€” your parcels arrive before shops open.' : 'Choisis "Express" entre 7h et 9h â€” tes colis arrivent avant l\'ouverture des boutiques.'}
              </Text>
            </View>
          </View>
        </KGCard>

      </ScrollView>

      <KGTabBar active="home" onTab={handleTab} role="vendor" />
      {isDemo && <DemoDrawer navigation={navigation} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  statCard: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  statCardBgDecoration: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(245,97,26,0.16)',
  },
  statLabel: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 12,
    color: colors.greenDark,
    opacity: 0.7,
  },
  statLabelDark: {
    color: 'rgba(255,255,255,0.6)',
    opacity: 1,
  },
  statValue: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 22,
    color: colors.greenDark,
    letterSpacing: -0.04,
    lineHeight: 26,
    marginTop: 6,
  },
  statValueDark: {
    fontSize: 44,
    color: '#fff',
    lineHeight: 48,
  },
  statSub: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 12,
    color: colors.greenDark,
    marginTop: 4,
  },
  statSubDark: {
    color: 'rgba(255,255,255,0.6)',
  },
});
