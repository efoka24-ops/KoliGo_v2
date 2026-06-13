import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGCard from '../../components/KGCard';
import KGCourierBadge from '../../components/KGCourierBadge';
import KGStatusPill from '../../components/KGStatusPill';
import RouteLine from '../../components/RouteLine';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

const FILTERS = [
  { id: 'all',        label: 'Toutes' },
  { id: 'TEMPORAIRE', label: 'Temporaire' },
  { id: 'PERMANENT',  label: 'Permanent' },
  { id: 'EXPRESS',    label: 'Express' },
  { id: 'VVIP',       label: 'VVIP' },
];

function OfferCard({ delivery, onPress }) {
  const km  = delivery.distanceKm ?? delivery.distance ?? '?';
  const kg  = delivery.weightKg   ?? delivery.weight   ?? '?';
  const type = (delivery.delivererType ?? 'TEMPORAIRE').toUpperCase();

  return (
    <KGCard onPress={onPress} style={{ marginBottom: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <KGCourierBadge type={type.toLowerCase()} />
            <KGStatusPill status={delivery.status ?? 'EN_ATTENTE'} />
          </View>
          <RouteLine from={delivery.pickupAddress ?? '?'} to={delivery.dropoffAddress ?? '?'} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="package" size={13} color={colors.ink55} />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>
                {kg} kg
              </Text>
            </View>
            <Text style={{ color: colors.ink35, fontSize: 11 }}>·</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="bolt" size={13} color={colors.ink55} />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>
                {km} km
              </Text>
            </View>
            {delivery.shopName ? (
              <>
                <Text style={{ color: colors.ink35, fontSize: 11 }}>·</Text>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }} numberOfLines={1}>
                  {delivery.shopName}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 70 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 18, color: colors.green, letterSpacing: -0.5 }}>
            {(delivery.delivererEarning ?? delivery.priceXAF ?? 0).toLocaleString('fr-FR')}
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: colors.ink55 }}>XAF</Text>
        </View>
      </View>
    </KGCard>
  );
}

export default function AvailableScreen({ navigation }) {
  const { api, token, user } = useApp();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState('all');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api('/deliveries/available');
      setDeliveries(Array.isArray(data) ? data : []);
    } catch {}
  }, [api, token]);

  useEffect(() => {
    load().finally(() => setLoading(false));
    const interval = setInterval(load, 8000);
    const unsub = navigation.addListener('focus', load);
    return () => { clearInterval(interval); unsub(); };
  }, [load, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = deliveries.filter(d => filter === 'all' || (d.delivererType ?? '').toUpperCase() === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar
        title="Courses disponibles"
        onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('DelivererHome')}
        action={
          <TouchableOpacity onPress={onRefresh}>
            <Icon name="history" size={20} color={colors.ink} />
          </TouchableOpacity>
        }
      />

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map(f => {
          const on = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={{
                borderWidth: 1.5,
                borderColor: on ? colors.green : colors.ink12,
                backgroundColor: on ? colors.green : '#fff',
                borderRadius: 99,
                paddingVertical: 7,
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12.5, color: on ? '#fff' : colors.ink55 }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.green} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        >
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginBottom: 4 }}>
            {filtered.length} course{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
          </Text>

          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E8DCC8', borderStyle: 'dashed' }}>
                <Icon name="moto" size={28} color={colors.ink35} />
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink55 }}>
                Aucune course disponible
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink35, textAlign: 'center' }}>
                Reviens dans quelques minutes ou change le filtre.
              </Text>
            </View>
          ) : (
            filtered.map(d => (
              <OfferCard
                key={d.id}
                delivery={d}
                onPress={() => navigation.navigate('OfferDetail', { offer: d })}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
