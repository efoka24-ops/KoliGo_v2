import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KenteStripe from '../../components/KenteStripe';
import KGCard from '../../components/KGCard';
import KGStatusPill from '../../components/KGStatusPill';
import KGCourierBadge from '../../components/KGCourierBadge';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';

export default function VendorHomeScreen({ navigation }) {
  const { user, api, token } = useApp();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const displayName = user?.name?.split(' ')[0] || 'Vendeur';
  const avatar = (user?.name || 'V').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api('/deliveries');
      setDeliveries(Array.isArray(data) ? data : []);
    } catch {}
  }, [api, token]);

  useEffect(() => {
    load().finally(() => setLoading(false));
    const interval = setInterval(load, 10000);
    const unsub = navigation.addListener('focus', load);
    return () => { clearInterval(interval); unsub(); };
  }, [load, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const active = deliveries.filter(d => ['EN_ATTENTE', 'ACCEPTE', 'EN_ROUTE'].includes(d.status));
  const todayDelivered = deliveries.filter(d => {
    if (d.status !== 'LIVRE') return false;
    return new Date(d.updatedAt ?? d.createdAt).toDateString() === new Date().toDateString();
  }).length;

  const statusColor = { EN_ATTENTE: colors.ink55, ACCEPTE: '#C4611A', EN_ROUTE: colors.green, LIVRE: colors.green, ANNULE: '#D8472A' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KenteStripe height={4} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: '#fff' }}>{avatar}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>Bonjour,</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink, letterSpacing: -0.5, marginTop: 1 }}>{displayName}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 }}>
          {[
            { label: 'Actives', value: String(active.length),         icon: 'bolt',    bg: '#EFF8F1', color: colors.greenDark },
            { label: "Livrées aujourd'hui", value: String(todayDelivered), icon: 'check',   bg: '#FFF8E3', color: '#C4611A' },
            { label: 'Total', value: String(deliveries.length),       icon: 'history', bg: '#F0F0EA', color: colors.ink55 },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 14, padding: 12, gap: 4 }}>
              <Icon name={s.icon} size={15} color={s.color} />
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>{s.value}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: colors.ink55 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={() => navigation.navigate('PostDelivery')}
          activeOpacity={0.88}
          style={{
            marginHorizontal: 16, marginBottom: 16,
            backgroundColor: '#C4611A', borderRadius: 18, padding: 16,
            flexDirection: 'row', alignItems: 'center', gap: 14,
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={24} color="#fff" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 17, color: '#fff', letterSpacing: -0.01 }}>Créer une livraison</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Prix calculé en 3 secondes</Text>
          </View>
          <Icon name="arrow" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Active deliveries list */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 15, color: colors.ink }}>Mes livraisons</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.green }}>Tout voir</Text>
              <Icon name="arrow" size={12} color={colors.green} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : active.length === 0 ? (
            <View style={{ backgroundColor: colors.cream, borderRadius: 16, padding: 24, alignItems: 'center', gap: 10 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E8DCC8', borderStyle: 'dashed' }}>
                <Icon name="package" size={24} color={colors.ink35} />
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink55 }}>
                Aucune livraison en cours
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink35, textAlign: 'center' }}>
                Crée ta première livraison ci-dessus.
              </Text>
            </View>
          ) : (
            active.map(d => (
              <KGCard
                key={d.id}
                onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: d.id })}
                style={{ marginBottom: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <KGStatusPill status={d.status} />
                      <KGCourierBadge type={(d.delivererType ?? 'TEMPORAIRE').toLowerCase()} />
                    </View>
                    <RouteLine from={d.pickupAddress ?? '?'} to={d.dropoffAddress ?? '?'} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>
                        {d.distanceKm ?? '?'} km · {d.weightKg ?? '?'} kg
                      </Text>
                      <Text style={{ color: colors.ink35 }}>·</Text>
                      <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 12, color: colors.ink }}>
                        {(d.priceXAF ?? 0).toLocaleString('fr-FR')} XAF
                      </Text>
                    </View>
                  </View>
                  <Icon name="arrow" size={16} color={colors.ink35} />
                </View>
              </KGCard>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
