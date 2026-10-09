import { tr } from '../../i18n/tr';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
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

function FilterPicker({ label, value, items, onChange, allLabel, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        style={{ flex: 1, height: 38, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: value ? colors.green : colors.ink12, backgroundColor: value ? colors.greenLight : '#fff', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
      >
        <Text numberOfLines={1} style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12.5, color: value ? colors.greenDark : colors.ink55 }}>
          {value || label}
        </Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingVertical: 12 }}>
            <ScrollView style={{ maxHeight: 380 }}>
              {[{ id: '', name: allLabel }, ...items.map((n) => ({ id: n, name: n }))].map((it) => (
                <TouchableOpacity key={it.id || 'all'} onPress={() => { onChange(it.id); setOpen(false); }}
                  style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: it.id === value ? colors.greenLight : '#fff' }}>
                  <Text style={{ fontFamily: `${fonts.ui}-${it.id === value ? 'Bold' : 'Regular'}`, fontSize: 15, color: it.id === value ? colors.greenDark : colors.ink }}>{it.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function OfferCard({ delivery, onPress }) {
  const km  = delivery.distanceKm ?? delivery.distance ?? '?';
  const size = delivery.size || null;
  const kg  = delivery.weightKg   ?? delivery.weight   ?? '?';
  const type = (delivery.delivererType ?? 'TEMPORAIRE').toUpperCase();

  return (
    <KGCard onPress={onPress} style={{ marginBottom: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <KGCourierBadge type={type.toLowerCase()} />
            <KGStatusPill status={delivery.status ?? 'EN_ATTENTE'} />
            {delivery.vehicleOk === false && (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 10.5, color: '#D8472A' }}>{tr("Véhicule inadapté")}</Text>
              </View>
            )}
          </View>
          <RouteLine from={delivery.pickupAddress ?? '?'} to={delivery.dropoffAddress ?? '?'} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="package" size={13} color={colors.ink55} />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>
                {size ? `Gabarit ${size}` : `${kg} kg`}
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
  // Filtres facultatifs : par défaut le livreur voit toutes les offres, sans barrière de ville ni de quartier.
  const [city, setCity]             = useState('');
  const [quartier, setQuartier]     = useState('');
  const [cities, setCities]         = useState([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    apiFetch('/public/cities').then((d) => { if (Array.isArray(d)) setCities(d); }).catch(() => {});
  }, []);
  const cityItems = cities.map((c) => c.name);
  const quartierItems = (cities.find((c) => c.name === city)?.neighborhoods || []).map((n) => n.name);

  const query = useCallback((p) => {
    const qs = [`page=${p}`];
    if (city) qs.push(`city=${encodeURIComponent(city)}`);
    if (quartier) qs.push(`quartier=${encodeURIComponent(quartier)}`);
    return `/deliveries/available?${qs.join('&')}`;
  }, [city, quartier]);

  // Première page : relue régulièrement pour voir les nouvelles offres.
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api(query(1));
      const list = Array.isArray(data) ? data : [];
      setDeliveries(list);
      setPage(1);
      setHasMore(list.length === 20);
    } catch {}
  }, [api, token, query]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await api(query(page + 1));
      const list = Array.isArray(data) ? data : [];
      setDeliveries((prev) => [...prev, ...list.filter((d) => !prev.some((p) => p.id === d.id))]);
      setPage(page + 1);
      setHasMore(list.length === 20);
    } catch {} finally { setLoadingMore(false); }
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    const interval = setInterval(() => { if (page === 1) load(); }, 8000);
    const unsub = navigation.addListener('focus', load);
    return () => { clearInterval(interval); unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        title={tr("Courses disponibles")}
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

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <FilterPicker label={tr("Toutes les villes")} allLabel="Toutes les villes" value={city} items={cityItems}
          onChange={(c) => { setCity(c); setQuartier(''); }} />
        <FilterPicker label={tr("Tous les quartiers")} allLabel="Tous les quartiers" value={quartier} items={quartierItems}
          onChange={setQuartier} disabled={!city} />
      </View>

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
                {tr("Aucune course disponible")}
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink35, textAlign: 'center' }}>
                {tr("Reviens dans quelques minutes ou change le filtre.")}
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
          {hasMore && (
            <TouchableOpacity onPress={loadMore} disabled={loadingMore} style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1.5, borderColor: colors.green }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.green }}>{loadingMore ? 'Chargement…' : 'Voir plus de courses'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
