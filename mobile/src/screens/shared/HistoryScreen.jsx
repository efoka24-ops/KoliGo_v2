import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

const FILTERS = [
  { id: 'all',     label: 'Toutes'  },
  { id: 'livre',   label: 'Livré'   },
  { id: 'en_route',label: 'En route'},
  { id: 'accepte', label: 'Accepté' },
  { id: 'annule',  label: 'Annulé'  },
];

const STATUS_STYLE = {
  livre:    { bg: '#EFF8F1', color: colors.greenDark, dot: '#0D7A3E' },
  en_route: { bg: '#FEF0E3', color: '#C4611A',        dot: '#C4611A' },
  default:  { bg: '#F5F0E8', color: colors.ink55,     dot: '#D4991A' },
};

export default function HistoryScreen({ navigation }) {
  const { role, user, token, api } = useApp();
  const [filter, setFilter] = useState('all');
  const isDemo = user?.isTest === true;
  const [realDeliveries, setRealDeliveries] = useState(null);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Historique" onBack={goBack} action={<Icon name="search" size={20} color={colors.ink} />} />

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {FILTERS.map(f => (
          <KGChip key={f.id} active={filter === f.id} onPress={() => setFilter(f.id)}>{f.label}</KGChip>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }} showsVerticalScrollIndicator={false}>

          {/* Stats card */}
          {isDemo && (
            <View style={{
              backgroundColor: '#0E2116', borderRadius: 20, padding: 18, marginBottom: 4,
              flexDirection: 'row', alignItems: 'center', gap: 0, overflow: 'hidden',
            }}>
              <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(212,153,26,0.1)' }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.08 }}>Ce mois</Text>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#fff', letterSpacing: -0.02 }}>42 colis</Text>
              </View>
              <View style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 18 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.08 }}>Dépensé</Text>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#D4991A', letterSpacing: -0.02 }}>82 350 <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>XAF</Text></Text>
              </View>
            </View>
          )}

          {isDemo && (
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 10, color: '#B8A48A', paddingHorizontal: 2, textTransform: 'uppercase', letterSpacing: 0.1 }}>
              ◈ Mai 2026
            </Text>
          )}

          {!isDemo && list.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E8DCC8', borderStyle: 'dashed' }}>
                <Icon name="package" size={30} color={colors.ink35} />
              </View>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 17, color: colors.ink }}>Aucune livraison</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, textAlign: 'center', maxWidth: 240, lineHeight: 19 }}>
                Tes livraisons apparaîtront ici dès que tu en auras créé une.
              </Text>
            </View>
          )}

          {list.map(d => {
            const sc = STATUS_STYLE[d.status] || STATUS_STYLE.default;
            return (
              <TouchableOpacity
                key={d.id}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: d.id })}
                style={{ backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#E8DCC8', gap: 0 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: sc.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="package" size={22} color={sc.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }} numberOfLines={1}>
                      {d.from} → {d.to}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sc.dot }} />
                      <KGStatusPill status={d.status} />
                      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35 }}>{d.posted || d.time}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: colors.ink }}>{d.price.toLocaleString('fr-FR')}</Text>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: '#B8A48A' }}>XAF</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <KGTabBar active="history" onTab={handleTab} role={role} />
    </SafeAreaView>
  );
}
