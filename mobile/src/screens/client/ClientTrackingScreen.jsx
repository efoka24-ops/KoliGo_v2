import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { apiFetch } from '../../services/api';
import { useApp } from '../../context/AppContext';
import LiveMap from '../../components/LiveMap';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGStatusPill from '../../components/KGStatusPill';
import Icon from '../../components/Icon';

export default function ClientTrackingScreen({ navigation, route }) {
  const params = route?.params || {};
  const { role, token } = useApp();
  const deliveryId = params.orderId;
  const isRealId = deliveryId && !String(deliveryId).startsWith('KG-');

  const [delivererPos, setDelivererPos] = useState(null);
  const [clientPos, setClientPos] = useState(null);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollRef = useRef(null);

  // Fetch public delivery info (deliverer name, status)
  useEffect(() => {
    if (!isRealId) return;
    apiFetch(`/deliveries/track/${deliveryId}`)
      .then(d => setTrackingInfo(d))
      .catch(() => {});
  }, [deliveryId, isRealId]);

  // Poll deliverer GPS every 10s
  const pollLocation = useCallback(async () => {
    if (!deliveryId) return;
    try {
      const data = await apiFetch(`/deliveries/${deliveryId}/location`, {}, token);
      if (data?.lat && data?.lng) {
        setDelivererPos({ lat: data.lat, lng: data.lng });
        setLastUpdated(new Date());
      }
    } catch {}
  }, [deliveryId]);

  useEffect(() => {
    pollLocation();
    pollRef.current = setInterval(pollLocation, 10000);
    return () => clearInterval(pollRef.current);
  }, [pollLocation]);

  // Request client's own GPS
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setClientPos({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {}
    })();
  }, []);

  const delivererName = trackingInfo?.delivererName || params.delivererName || null;
  const delivererVehicle = trackingInfo?.delivererVehicle || null;
  const delivererPlate = trackingInfo?.delivererPlate || null;
  const delivererPhone = trackingInfo?.delivererPhone || null;
  const delivererRating = trackingInfo?.delivererRating || null;
  const delivererAvatarUrl = trackingInfo?.delivererAvatarUrl || null;
  const initials = delivererName
    ? delivererName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const eta = useMemo(() => {
    if (!delivererPos || !clientPos) return null;
    const R = 6371;
    const dLat = (clientPos.lat - delivererPos.lat) * Math.PI / 180;
    const dLng = (clientPos.lng - delivererPos.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(delivererPos.lat * Math.PI / 180) * Math.cos(clientPos.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(1, Math.ceil(km / 25 * 60));
  }, [delivererPos, clientPos]);

  const goHome = () => {
    if (role === 'vendor') navigation.navigate('VendorHome');
    else if (role === 'deliverer') navigation.navigate('DelivererHome');
    else navigation.navigate('ClientLanding', params);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar
        title="Suivi de mon colis"
        onBack={goHome}
        action={<Icon name="bell" size={20} color={colors.ink} />}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        <LiveMap delivererPos={delivererPos} clientPos={clientPos} />

        <View style={{ backgroundColor: colors.green, borderRadius: 20, padding: 16, gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.05 }}>Parcours client</Text>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: '#fff', letterSpacing: -0.03 * 20 }}>
            {delivererPos ? 'Le livreur bouge en temps réel' : 'En attente de position GPS'}
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 19 }}>
            Tu peux appeler le livreur, lui parler, puis confirmer la réception avec le code B quand il arrive chez toi.
          </Text>
        </View>

        {/* Status card */}
        <View style={{ backgroundColor: colors.ink, borderRadius: 20, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.05 }}>Statut</Text>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 18, color: '#fff', marginTop: 4 }}>
                {delivererPos ? 'Livreur en route' : 'En attente de position GPS'}
              </Text>
              {eta !== null && (
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.orange, marginTop: 2, letterSpacing: -0.02 * 22 }}>
                  ~{eta} min
                </Text>
              )}
              {lastUpdated && (
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  Mis à jour à {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
            <KGStatusPill status="en_route" />
          </View>
        </View>

        {/* Deliverer card */}
        <KGCard padding={14}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 10 }}>Ton livreur</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {delivererAvatarUrl ? (
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.greenDark }}>{initials}</Text>
              ) : (
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.greenDark }}>{initials}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: colors.ink }}>
                  {delivererName || 'Livreur assigné'}
                </Text>
                {delivererRating && (
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.orange }}>
                    {delivererRating} â˜…
                  </Text>
                )}
              </View>
              {(delivererVehicle || delivererPlate) && (
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>
                  {[delivererVehicle, delivererPlate].filter(Boolean).join(' Â· ')}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name="pin" size={12} color={delivererPos ? colors.green : colors.ink35} />
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>
                  {delivererPos ? 'Position GPS active' : 'Position non disponible'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {delivererPhone && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${delivererPhone}`)}
                  style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="phone" size={18} color={colors.green} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://wa.me/${String(delivererPhone || '').replace(/\D/g, '').startsWith('237') ? String(delivererPhone || '').replace(/\D/g, '') : `237${String(delivererPhone || '').replace(/\D/g, '')}`}`)}
                style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="chat" size={18} color={colors.green} />
              </TouchableOpacity>
            </View>
          </View>
        </KGCard>

        {/* Package details */}
        <KGCard padding={14}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 10 }}>Détails commande</Text>
          {[
            { label: 'Vendeur', value: params.vendorName || 'Vendeur KoliGo' },
            { label: 'Colis', value: params.parcelDesc || 'Colis en cours de livraison' },
            trackingInfo && { label: 'Trajet', value: `${trackingInfo.fromQuartier} â†' ${trackingInfo.toQuartier}` },
            params.balance && { label: 'Montant', value: `${Number(params.balance).toLocaleString('fr-FR')} XAF` },
          ].filter(Boolean).map(r => (
            <View key={r.label} style={{ marginBottom: 10 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04 }}>{r.label}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13.5, color: colors.ink, marginTop: 2 }}>{r.value}</Text>
            </View>
          ))}
        </KGCard>

        {role !== 'vendor' && (
          <>
            <KGButton kind="primary" size="lg" icon="check" onPress={() => navigation.navigate('ClientReception', params)}>
              Confirmer la réception
            </KGButton>
            <KGButton kind="ghost" size="md" icon="flag" onPress={() => navigation.navigate('ReportIssue', { deliveryId: params.orderId })}>
              Signaler un problème
            </KGButton>
          </>
        )}
      </ScrollView>

      {/* Floating home button â€" always visible */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 28, backgroundColor: colors.cream, borderTopWidth: 1, borderTopColor: colors.ink06 }}>
        <KGButton kind="soft" size="md" icon="home" onPress={goHome}>
          Retour à l'accueil
        </KGButton>
      </View>
    </SafeAreaView>
  );
}
