import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { KG_DEMO_DELIVERIES } from '../../constants/data';
import { normalizeDelivery } from '../../services/api';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGCard from '../../components/KGCard';
import KGChip from '../../components/KGChip';
import KGStatusPill from '../../components/KGStatusPill';
import KGTabBar from '../../components/KGTabBar';
import Icon from '../../components/Icon';

const FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'livre', label: 'LivrÃ©' },
  { id: 'en_route', label: 'En route' },
  { id: 'accepte', label: 'AcceptÃ©' },
  { id: 'annule', label: 'AnnulÃ©' },
];

const STATUS_ICON_COLOR = {
  livre:    { bg: colors.greenLight, color: colors.greenDark },
  en_route: { bg: colors.orangeLight, color: colors.orange },
  default:  { bg: colors.cream, color: colors.ink70 },
};

export default function HistoryScreen({ navigation }) {
  const { role, user, token, api } = useApp();
  const [filter, setFilter] = useState('all');
  const isDemo = user?.isTest === true;
  const [realDeliveries, setRealDeliveries] = useState(null); // null = loading

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else if (role === 'deliverer') navigation.navigate('DelivererHome');
    else navigation.navigate('VendorHome');
  };

  const fetchDeliveries = useCallback(() => {
    if (isDemo || !token) return;
    api('/api/deliveries').then(data => setRealDeliveries(data.map(normalizeDelivery))).catch(() => setRealDeliveries([]));
  }, [api, isDemo, token]);

  useEffect(() => {
    if (isDemo) { setRealDeliveries(null); return; }
    if (!token) { setRealDeliveries([]); return; }
    fetchDeliveries();
    const unsub = navigation.addListener('focus', fetchDeliveries);
    return unsub;
  }, [fetchDeliveries, navigation, isDemo, token]);

  const allDeliveries = isDemo ? KG_DEMO_DELIVERIES : (realDeliveries || []);
  const list = allDeliveries.filter(d => filter === 'all' || d.status === filter);
  const loading = !isDemo && realDeliveries === null;

  const handleTab = (tab) => {
    if (role === 'vendor') {
      if (tab === 'home') navigation.navigate('VendorHome');
      else if (tab === 'chat') navigation.navigate('ChatInbox');
      else if (tab === 'profile') navigation.navigate('Profile');
    } else {
      if (tab === 'home') navigation.navigate('DelivererHome');
      else if (tab === 'wallet') navigation.navigate('Wallet');
      else if (tab === 'chat') navigation.navigate('ChatInbox');
      else if (tab === 'profile') navigation.navigate('Profile');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title="Historique" onBack={goBack} action={<Icon name="search" size={20} color={colors.ink} />} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        {FILTERS.map(f => (
          <KGChip key={f.id} active={filter === f.id} onPress={() => setFilter(f.id)}>{f.label}</KGChip>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
          {isDemo && (
            <KGCard kind="dark" padding={14} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Ce mois</Text>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: '#fff', letterSpacing: -0.02 }}>42 colis</Text>
                </View>
                <View style={{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                <View>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.04 }}>DÃ©pensÃ©</Text>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: '#fff', letterSpacing: -0.02 }}>82 350 <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>XAF</Text></Text>
                </View>
              </View>
            </KGCard>
          )}

          {!isDemo && list.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink12, borderStyle: 'dashed' }}>
                <Icon name="package" size={28} color={colors.ink35} />
              </View>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>Aucune livraison pour le moment</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, textAlign: 'center', maxWidth: 240, lineHeight: 18 }}>
                Tes livraisons apparaÃ®tront ici dÃ¨s que tu en auras crÃ©Ã© une.
              </Text>
            </View>
          )}

          {isDemo && <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, paddingHorizontal: 4, paddingTop: 8, textTransform: 'uppercase', letterSpacing: 0.05 }}>Mai 2026</Text>}

          {list.map(d => {
            const sc = STATUS_ICON_COLOR[d.status] || STATUS_ICON_COLOR.default;
            return (
              <KGCard key={d.id} onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: d.id })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: sc.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="package" size={20} color={sc.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }} numberOfLines={1}>{d.from} â†’ {d.to}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <KGStatusPill status={d.status} />
                      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11.5, color: colors.ink55 }}>{d.posted || d.time}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14.5, color: colors.ink }}>{d.price.toLocaleString('fr-FR')}</Text>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: colors.ink55 }}>XAF</Text>
                  </View>
                </View>
              </KGCard>
            );
          })}
        </ScrollView>
      )}

      <KGTabBar active="history" onTab={handleTab} role={role} />
    </SafeAreaView>
  );
}
