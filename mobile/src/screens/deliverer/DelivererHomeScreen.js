import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KenteStripe from '../../components/KenteStripe';
import KGCard from '../../components/KGCard';
import KGStatusPill from '../../components/KGStatusPill';
import KGCourierBadge from '../../components/KGCourierBadge';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';

export default function DelivererHomeScreen({ navigation }) {
  const { online, setOnline, user, api, token } = useApp();
  const [deliveries, setDeliveries] = useState([]);
  const [available, setAvailable]   = useState([]);
  const [wallet, setWallet]         = useState(null);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [myDeliveries, avail, walletData] = await Promise.allSettled([
        api('/deliveries'),
        api('/deliveries/available'),
        api('/wallet'),
      ]);
      if (myDeliveries.status === 'fulfilled' && Array.isArray(myDeliveries.value)) {
        setDeliveries(myDeliveries.value);
      }
      if (avail.status === 'fulfilled' && Array.isArray(avail.value)) {
        setAvailable(avail.value);
      }
      if (walletData.status === 'fulfilled' && walletData.value) {
        setWallet(walletData.value);
      }
    } catch {}
  }, [api, token]);

  useEffect(() => {
    loadData().finally(() => setLoadingDeliveries(false));
    const interval = setInterval(loadData, 10000);
    const unsub = navigation.addListener('focus', loadData);
    return () => { clearInterval(interval); unsub(); };
  }, [loadData, navigation]);

  const displayName = user?.name?.split(' ')[0] || 'Livreur';
  const balance     = wallet?.balanceXAF ?? 0;

  const activeMission = deliveries.find(d => ['ACCEPTE', 'EN_ROUTE'].includes(d.status)) ?? null;
  const todayEarnings = deliveries
    .filter(d => d.status === 'LIVRE' && new Date(d.updatedAt ?? d.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, d) => s + (d.delivererEarning ?? d.priceXAF ?? 0), 0);
  const trips = deliveries.filter(d => d.status === 'LIVRE').length;

  const handleActiveMissionPress = () => {
    if (!activeMission) return;
    if (activeMission.status === 'ACCEPTE') {
      navigation.navigate('ConfirmCode', { deliveryId: activeMission.id });
    } else {
      navigation.navigate('Waiting', { deliveryId: activeMission.id });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KenteStripe height={4} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>Bonjour,</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink, letterSpacing: -0.5, marginTop: 2 }}>
              {displayName} 👋
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Online toggle */}
        <View style={{ marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', marginBottom: 16 }}>
          <View style={{ backgroundColor: online ? '#0E2116' : '#F5F0E8', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: online ? 'rgba(212,153,26,0.18)' : colors.ink12, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bolt" size={22} color={online ? '#D4991A' : colors.ink55} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: online ? '#fff' : colors.ink }}>
                {online ? 'En ligne · Tu reçois des courses' : 'Hors ligne'}
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: online ? 'rgba(255,255,255,0.6)' : colors.ink55, marginTop: 1 }}>
                {online ? 'Désactive pour te reposer' : 'Active pour recevoir des courses'}
              </Text>
            </View>
            <Switch
              value={online}
              onValueChange={setOnline}
              trackColor={{ false: colors.ink12, true: '#D4991A' }}
              thumbColor={online ? '#fff' : '#fff'}
            />
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 }}>
          {[
            { label: 'Solde', value: `${balance.toLocaleString('fr-FR')} XAF`, icon: 'wallet', bg: '#EFF8F1', color: colors.green },
            { label: "Aujourd'hui", value: `+${todayEarnings.toLocaleString('fr-FR')} XAF`, icon: 'bolt', bg: '#FFF8E3', color: '#C4611A' },
            { label: 'Courses', value: String(trips), icon: 'history', bg: '#F0F0EA', color: colors.ink55 },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 14, padding: 12, gap: 4 }}>
              <Icon name={s.icon} size={16} color={s.color} />
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>{s.value}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: colors.ink55 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Active mission */}
        {activeMission ? (
          <View style={{ marginHorizontal: 16, marginBottom: 16, gap: 8 }}>
            <TouchableOpacity onPress={handleActiveMissionPress} activeOpacity={0.92}>
              <View style={{ backgroundColor: '#0E2116', borderRadius: 18, padding: 16, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(212,153,26,0.12)' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <KGStatusPill status={activeMission.status} />
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Course en cours</Text>
                </View>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: '#fff', letterSpacing: -0.5 }}>
                  {activeMission.pickupAddress ?? '?'} → {activeMission.dropoffAddress ?? '?'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#D4991A' }}>
                    {(activeMission.delivererEarning ?? activeMission.priceXAF ?? 0).toLocaleString('fr-FR')} XAF
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Icon name="arrow" size={14} color="#fff" />
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: '#fff' }}>
                      {activeMission.status === 'ACCEPTE' ? 'Saisir code' : 'Voir détails'}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            {/* Chat buttons — vendor always, recipient after EN_ROUTE */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('DeliveryChat', { deliveryId: activeMission.id, title: 'Chat vendeur' })}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EFF8F1', borderWidth: 1, borderColor: '#C8E6D0' }}
              >
                <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: colors.greenDark }}>💬 Vendeur</Text>
              </TouchableOpacity>
              {activeMission.status === 'EN_ROUTE' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('DeliveryChat', { deliveryId: activeMission.id, title: 'Chat destinataire' })}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' }}
                >
                  <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: '#4338CA' }}>💬 Destinataire</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : null}

        {/* Available offers */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 15, color: colors.ink }}>Courses disponibles</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Available')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.green }}>Voir tout</Text>
              <Icon name="arrow" size={12} color={colors.green} />
            </TouchableOpacity>
          </View>

          {loadingDeliveries ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : available.length === 0 ? (
            <View style={{ backgroundColor: colors.cream, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 }}>
              <Icon name="moto" size={24} color={colors.ink35} />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink55, textAlign: 'center' }}>
                {online ? 'Aucune course disponible pour l\'instant' : 'Passe en ligne pour voir les courses'}
              </Text>
            </View>
          ) : (
            available.slice(0, 3).map(d => (
              <KGCard
                key={d.id}
                onPress={() => navigation.navigate('OfferDetail', { offer: d })}
                style={{ marginBottom: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <KGCourierBadge type={(d.delivererType ?? 'TEMPORAIRE').toLowerCase()} />
                      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>
                        {d.distanceKm ?? '?'} km · {d.weightKg ?? '?'} kg
                      </Text>
                    </View>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink }}>
                      {d.pickupAddress ?? '?'} → {d.dropoffAddress ?? '?'}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.green, letterSpacing: -0.5 }}>
                    {(d.delivererEarning ?? d.priceXAF ?? 0).toLocaleString('fr-FR')} XAF
                  </Text>
                </View>
              </KGCard>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
