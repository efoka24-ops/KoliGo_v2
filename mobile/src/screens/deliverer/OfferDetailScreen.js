import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGCourierBadge from '../../components/KGCourierBadge';
import KGStatusPill from '../../components/KGStatusPill';
import RouteLine from '../../components/RouteLine';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';
import { deliveryService } from '../../services/delivery';

export default function OfferDetailScreen({ navigation, route }) {
  const { online, showToast, user } = useApp();
  const [accepting, setAccepting] = useState(false);

  const o = route?.params?.offer ?? {
    id: null,
    delivererType: 'TEMPORAIRE',
    priceXAF: 3200,
    pickupAddress: 'Akwa',
    dropoffAddress: 'Bonapriso',
    distanceKm: '2.4',
    weightKg: 3,
    vendorRating: '4.8',
  };

  const from     = o.pickupAddress ?? o.from ?? 'Akwa';
  const to       = o.dropoffAddress ?? o.to ?? 'Bonapriso';
  const price    = (o.priceXAF ?? o.price ?? 0);
  const type     = (o.delivererType ?? 'TEMPORAIRE').toUpperCase();
  const rating   = o.vendorRating ?? o.rating ?? '?';
  const km       = o.distanceKm ?? o.km ?? '?';
  const kg       = o.weightKg ?? o.weight ?? '?';
  const weight   = parseFloat(kg) || 0;

  const handleAccept = async () => {
    if (!online) {
      // Alert.alert freezes the web tab — use toast instead
      showToast('Passe en ligne depuis l\'accueil pour accepter des courses', 'error');
      return;
    }

    // KYC null / NOT_SUBMITTED → redirect to KYC flow
    if (!user?.kycStatus) {
      showToast('Soumettez votre CNI pour accepter des courses', 'error');
      navigation.navigate('Kyc');
      return;
    }

    // KYC PENDING or VERIFIED → allow accept (backend has no KYC gate on this route)
    if (!o.id) {
      showToast('Course acceptée !');
      navigation.navigate('DelivererHome');
      return;
    }
    setAccepting(true);
    try {
      await deliveryService.accept(o.id);
      showToast('Course acceptée !');
      navigation.navigate('DelivererHome');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Erreur acceptation';
      showToast(msg, 'error');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title={`${from} → ${to}`} onBack={() => navigation.goBack()} />

      <View style={{ flex: 1, padding: 16, gap: 14 }}>

        {/* Offline banner */}
        {!online && (
          <View style={{ backgroundColor: '#FEF0E3', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#F5D0B8' }}>
            <Icon name="bolt" size={18} color="#C4611A" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: '#C4611A' }}>Tu es hors ligne</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: '#C4611A', lineHeight: 17, marginTop: 2 }}>
                Retourne à l'accueil et active le switch "En ligne" pour accepter.
              </Text>
            </View>
          </View>
        )}

        {/* KYC not submitted banner */}
        {online && !user?.kycStatus && (
          <View style={{ backgroundColor: '#FEF0E3', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#F5D0B8' }}>
            <Icon name="shield" size={18} color="#C4611A" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: '#C4611A' }}>CNI requise</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: '#C4611A', lineHeight: 17, marginTop: 2 }}>
                Soumets ta pièce d'identité pour accepter des courses.
              </Text>
            </View>
          </View>
        )}

        {/* Price card */}
        <View style={{ backgroundColor: '#0E2116', borderRadius: 20, padding: 18, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(212,153,26,0.1)' }} />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.08 }}>Gain de la course</Text>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 36, color: '#fff', marginTop: 4 }}>
            {price.toLocaleString('fr-FR')} <Text style={{ fontSize: 16, color: '#D4991A' }}>XAF</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <KGCourierBadge type={type.toLowerCase()} />
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Vendeur ★{rating}</Text>
          </View>
        </View>

        {/* Route details */}
        <KGCard padding={14}>
          <RouteLine from={from} to={to} />
          <View style={{ height: 1, backgroundColor: colors.ink06, marginVertical: 12 }} />
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <View style={{ gap: 3 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink35, textTransform: 'uppercase', letterSpacing: 0.06 }}>Distance</Text>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>{km} km</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.ink06 }} />
            <View style={{ gap: 3 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink35, textTransform: 'uppercase', letterSpacing: 0.06 }}>Poids</Text>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>{kg} kg</Text>
            </View>
            {weight > 5 && (
              <>
                <View style={{ width: 1, backgroundColor: colors.ink06 }} />
                <View style={{ gap: 3 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#C4611A', textTransform: 'uppercase', letterSpacing: 0.06 }}>Lourd</Text>
                  <Icon name="bolt" size={16} color="#C4611A" />
                </View>
              </>
            )}
          </View>
        </KGCard>

        {/* Escort info */}
        <KGCard kind="green" padding={14}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Icon name="shield" size={20} color={colors.greenDark} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.greenDark }}>Codes sécurisés</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.greenDark, lineHeight: 18, marginTop: 3, opacity: 0.85 }}>
                Code A → demande-le au vendeur à la collecte.{'\n'}Code B → remis au destinataire à la livraison.
              </Text>
            </View>
          </View>
        </KGCard>

        <View style={{ flex: 1 }} />

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <KGButton kind="ghost" style={{ flex: 1 }} onPress={() => navigation.goBack()}>
            Refuser
          </KGButton>
          <KGButton
            kind={online ? 'primary' : 'ghost'}
            style={{ flex: 2 }}
            icon={accepting ? undefined : 'check'}
            disabled={accepting}
            onPress={handleAccept}
          >
            {accepting ? 'Acceptation...' : (online ? 'Accepter la course' : 'Hors ligne')}
          </KGButton>
        </View>
      </View>
    </SafeAreaView>
  );
}
