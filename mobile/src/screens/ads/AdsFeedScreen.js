import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
import { tr } from '../../i18n/tr';
import KGTopBar from '../../components/KGTopBar';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';
import { CATEGORY_LABELS, adPhoto, timeLeft, money } from '../../components/AdsShared';

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: active ? colors.green : '#fff', borderWidth: 1, borderColor: active ? colors.green : '#E8DCC8', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12.5, color: active ? '#fff' : colors.ink70 }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Marché KoliGo : annonces Flash (24 h) et Boost de la ville. Visible sans compte côté serveur. */
export default function AdsFeedScreen({ navigation }) {
  const { token, user, role } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [cities, setCities] = useState([]);
  const [error, setError] = useState(null);
  const isVendor = String(role || user?.activeRole || '').toUpperCase() === 'VENDOR';

  useEffect(() => {
    apiFetch('/public/cities').then((d) => { if (Array.isArray(d)) setCities(d.map((c) => c.name).filter(Boolean)); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (city) qs.set('city', city);
      if (category) qs.set('category', category);
      const r = await apiFetch(`/public/ads?${qs.toString()}`, {}, token);
      setItems(Array.isArray(r?.items) ? r.items : []);
      setError(null);
    } catch (e) {
      setError(tr("Impossible de charger les annonces. Vérifie ta connexion."));
    }
  }, [q, city, category, token]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [city, category]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const u = navigation.addListener('focus', load); return u; }, [navigation, load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const flash = useMemo(() => items.filter((i) => i.type === 'FLASH'), [items]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title={tr('Marché KoliGo')} onBack={() => navigation.goBack()}
        action={isVendor ? (
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <TouchableOpacity onPress={() => navigation.navigate('MyAds')}><Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink70 }}>{tr('Mes annonces')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('PostAd')}><Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: colors.green }}>+ {tr('Publier')}</Text></TouchableOpacity>
          </View>
        ) : null} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 16, paddingTop: 6, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E8DCC8', paddingHorizontal: 12 }}>
            <Icon name="search" size={16} color={colors.ink55} />
            <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => { setLoading(true); load().finally(() => setLoading(false)); }} returnKeyType="search"
              placeholder={tr('Rechercher un produit…')} placeholderTextColor={colors.ink35} style={{ flex: 1, height: 44, marginLeft: 8, fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip label={tr('Toutes les villes')} active={!city} onPress={() => setCity('')} />
            {cities.map((c) => <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip label={tr('Toutes catégories')} active={!category} onPress={() => setCategory('')} />
            {Object.keys(CATEGORY_LABELS).map((c) => <Chip key={c} label={tr(CATEGORY_LABELS[c])} active={category === c} onPress={() => setCategory(c)} />)}
          </ScrollView>
        </View>

        {flash.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 12, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, marginBottom: 8 }}>⚡ {tr('Flash · 24 h')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {flash.map((a) => (
                <TouchableOpacity key={a.id} onPress={() => navigation.navigate('AdDetail', { adId: a.id })} activeOpacity={0.85} style={{ alignItems: 'center', width: 74 }}>
                  <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: colors.orange, padding: 2 }}>
                    <Image source={adPhoto(a.id, 0, token)} style={{ flex: 1, borderRadius: 30, backgroundColor: colors.cream }} />
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink, marginTop: 4 }}>{a.title}</Text>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: colors.orange }}>{timeLeft(a.secondsLeft)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 16 }}>
          {loading ? <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
            : error ? <Text style={{ textAlign: 'center', color: '#C00', paddingVertical: 30 }}>{error}</Text>
            : items.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 50, gap: 8 }}>
                <Icon name="package" size={32} color={colors.ink35} />
                <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>{tr('Aucune annonce')}</Text>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, textAlign: 'center', maxWidth: 260 }}>{tr('Change de ville ou de catégorie, ou publie la première annonce.')}</Text>
              </View>
            ) : items.map((a) => (
              <TouchableOpacity key={a.id} onPress={() => navigation.navigate('AdDetail', { adId: a.id })} activeOpacity={0.9}
                style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E8DCC8', overflow: 'hidden' }}>
                <Image source={adPhoto(a.id, 0, token)} style={{ width: '100%', height: 170, backgroundColor: colors.cream }} resizeMode="cover" />
                {a.type === 'BOOST' && (
                  <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: colors.orange, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontFamily: `${fonts.ui}-Bold` }}>{tr('À la une')}</Text>
                  </View>
                )}
                <View style={{ padding: 12, gap: 3 }}>
                  <Text numberOfLines={1} style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 15, color: colors.ink }}>{a.title}</Text>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 18, color: colors.greenDark }}>{money(a.priceXAF)}</Text>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>{a.city}{a.quartier ? `, ${a.quartier}` : ''} · {a.seller}</Text>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: a.secondsLeft < 7200 ? '#D8472A' : colors.ink55 }}>⏱ {tr('Expire dans')} {timeLeft(a.secondsLeft)}</Text>
                </View>
              </TouchableOpacity>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
