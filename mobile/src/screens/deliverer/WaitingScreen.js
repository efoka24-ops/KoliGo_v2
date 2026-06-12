import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
// ActivityIndicator used for loading state
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { apiFetch, normalizeDelivery } from '../../services/api';
// apiFetch used for polling delivery status
import { getInitials } from '../../utils/helpers';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGStatusPill from '../../components/KGStatusPill';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';
import LiveMap from '../../components/LiveMap';
import { KG_QUARTIER_COORDS } from '../../constants/data';

const POLL_MS = 6000;

export default function WaitingScreen({ navigation, route }) {
  const { token, showToast, startConversation } = useApp();
  const deliveryId = route?.params?.deliveryId;
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchDelivery = async (silent = false) => {
    if (!deliveryId || !token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch(`/deliveries/${deliveryId}`, {}, token);
      setDelivery(normalizeDelivery(data));
      if (data.status === 'livre' && !silent) {
        showToast('Livraison confirmee par le client !');
        navigation.navigate('DelivererApp');
      }
    } catch {
      if (!silent) showToast('Erreur chargement', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDelivery(false);
    pollRef.current = setInterval(() => fetchDelivery(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [deliveryId, token]);

  const handleCall = () => {
    const phone = delivery?.recipientPhone || delivery?.recipientPhone;
    if (!phone) { showToast('Numero du destinataire indisponible', 'error'); return; }
    Linking.openURL(`tel:+237${phone.replace(/\s/g, '')}`).catch(() =>
      showToast('Impossible d\'ouvrir le telephone', 'error')
    );
  };

  const handleChat = () => {
    if (!delivery?.recipientId) {
      showToast('Chat indisponible', 'error');
      return;
    }
    const name = delivery.recipient || 'Client';
    const convId = startConversation({
      id: delivery.recipientId,
      name,
      initials: getInitials(name),
      role: 'client',
    });
    navigation.navigate('ChatDetail', { convId });
  };

  const handleConfirmDelivery = () => {
    navigation.navigate('DelivererWaiting', { deliveryId });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color={colors.green} />
      </SafeAreaView>
    );
  }

  // Demo / no delivery fallback
  const d = delivery || {
    from: 'Akwa',
    to: 'Bonapriso',
    recipient: 'Marie Fotso',
    recipientPhone: '655000000',
    price: 2500,
    status: 'en_route',
  };

  const fromCoords = KG_QUARTIER_COORDS?.[d.from] || null;
  const toCoords   = KG_QUARTIER_COORDS?.[d.to]   || null;
  const initials   = d.recipient ? getInitials(d.recipient) : '?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      {/* Map header */}
      <View style={{ height: 220, position: 'relative' }}>
        <LiveMap delivererPos={fromCoords} clientPos={toCoords} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <KGTopBar title=" " onBack={() => navigation.goBack()} transparent />
        </View>
        <View style={{ position: 'absolute', bottom: 12, left: 16, right: 16 }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: '#fff' }}>EN ROUTE vers le destinataire</Text>
            {d.status && <KGStatusPill status={d.status} style={{ marginLeft: 'auto' }} />}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Route */}
        <KGCard padding={14}>
          <RouteLine from={d.from} to={d.to} />
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 14 }}>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70 }}>
              {(d.price || 0).toLocaleString('fr-FR')} XAF
            </Text>
            {d.distance && (
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70 }}>
                {d.distance} km
              </Text>
            )}
          </View>
        </KGCard>

        {/* Recipient card */}
        <KGCard padding={14}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 12 }}>
            Destinataire
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.greenDark }}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 15, color: colors.ink }}>{d.recipient || 'Client'}</Text>
              {d.recipientPhone && (
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55, marginTop: 2 }}>
                  +237 {d.recipientPhone}
                </Text>
              )}
            </View>
            {/* Call button */}
            <TouchableOpacity
              onPress={handleCall}
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="phone" size={20} color={colors.green} />
            </TouchableOpacity>
            {/* Chat button */}
            <TouchableOpacity
              onPress={handleChat}
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.ink12 }}
            >
              <Icon name="chat" size={20} color={colors.ink } />
            </TouchableOpacity>
          </View>
          {d.to && (
            <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="pin" size={14} color={colors.ink55} />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>{d.to}</Text>
            </View>
          )}
        </KGCard>

        {/* Delivery code reminder */}
        {d.code && (
          <KGCard kind="green" padding={14}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Icon name="shield" size={22} color={colors.greenDark} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 12, color: colors.greenDark, textTransform: 'uppercase', letterSpacing: 0.05 }}>
                  Code de livraison (Code B)
                </Text>
                <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 28, color: colors.ink, letterSpacing: 8, marginTop: 4 }}>
                  {d.code.split('').join(' ')}
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.greenDark, marginTop: 8, lineHeight: 17, opacity: 0.85 }}>
              Le destinataire te donnera ce code pour confirmer la remise du colis.
            </Text>
          </KGCard>
        )}

        {/* Info reminder */}
        <View style={{ backgroundColor: '#FFF8EC', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#F5D0B8' }}>
          <Icon name="bolt" size={16} color="#C4611A" />
          <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: '#C4611A', lineHeight: 18 }}>
            Une fois chez le destinataire, appuie sur le bouton ci-dessous pour valider l'arrive.
          </Text>
        </View>

        {/* CTA: arrived at client */}
        <KGButton
          kind="primary"
          size="lg"
          icon="check"
          onPress={handleConfirmDelivery}
        >
          Je suis arrive chez le client
        </KGButton>

        <KGButton kind="ghost" size="md" onPress={() => navigation.goBack()}>
          Retour
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
