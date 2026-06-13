import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { KoliGoLogo, KoliGoWordmark } from '../../components/KoliGoLogo';
import KGButton from '../../components/KGButton';
import KGStatusPill from '../../components/KGStatusPill';
import Icon from '../../components/Icon';

export default function WelcomeScreen({ navigation }) {
  const { lang, user, token, api } = useApp();
  const [activeMission, setActiveMission] = useState(null);
  const isEn = lang === 'en';

  useEffect(() => {
    if (!token) return;
    api('/deliveries')
      .then(list => {
        if (Array.isArray(list)) {
          const found = list.find(d => ['accepte', 'en_route'].includes((d.status ?? '').toLowerCase()));
          setActiveMission(found ?? null);
        }
      })
      .catch(() => {});
  }, [token, api]);

  const showReal = !!(user && activeMission);
  const firstName = user?.name?.split(' ')[0] ?? 'Herve';
  const typeLabel = showReal
    ? ((activeMission.delivererType ?? 'TEMPORAIRE') === 'PERMANENT' ? 'Permanent' : 'Temporaire')
    : 'Permanent';
  const cardName   = showReal ? (firstName + ' · ' + typeLabel) : 'Herve · Permanent';
  const cardRoute  = showReal
    ? ((activeMission.pickupAddress ?? '?') + ' → ' + (activeMission.dropoffAddress ?? '?'))
    : 'Bonamoussadi → Akwa';
  const cardStatus = showReal ? (activeMission.status ?? 'en_route') : 'en_route';
  const cardPrice  = showReal ? (activeMission.delivererEarning ?? activeMission.priceXAF ?? 0) : 1955;
  const cardSub    = showReal
    ? (isEn ? 'delivery in progress' : 'livraison en cours')
    : (isEn ? 'arrival 12 min' : 'arrivée 12 min');
  const cardPct    = cardStatus === 'accepte' ? 28 : 62;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream, overflow: 'hidden' }} edges={['top']}>
      <View style={{ position: 'absolute', top: -100, right: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.green, opacity: 0.12 }} />
      <View style={{ position: 'absolute', top: 90, left: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.orange, opacity: 0.18 }} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 0 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <KoliGoLogo size={42} />
          <KoliGoWordmark size={26} />
        </View>

        <View style={{ marginTop: 36 }}>
          <Text style={{ fontFamily: fonts.display + '-ExtraBold', fontSize: 38, lineHeight: 40, letterSpacing: -0.03 * 38, color: colors.ink }}>
            {isEn ? 'Your parcel,\n' : 'Ton colis,\n'}
            <Text style={{ color: colors.green }}>{isEn ? 'delivered go-go.' : 'livré go-go.'}</Text>
          </Text>
          <Text style={{ fontFamily: fonts.ui + '-Regular', fontSize: 15.5, lineHeight: 22, color: colors.ink70, marginTop: 14, maxWidth: 320 }}>
            {isEn
              ? 'Collaborative delivery in Cameroon. Every Cameroonian can become a courier - you can earn too.'
              : 'La livraison collaborative au Cameroun. Chaque camerounais est un livreur - toi aussi tu peux gagner.'}
          </Text>
        </View>

        <View style={{ marginTop: 26, position: 'relative' }}>
          <View style={{
            backgroundColor: colors.ink, borderRadius: 24, padding: 18, gap: 14,
            shadowColor: '#000', shadowOffset: { width: 0, height: 22 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12,
            overflow: 'hidden',
          }}>
            <View style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(245,97,26,0.16)' }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="moto" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1, maxWidth: 160 }}>
                  <Text style={{ fontFamily: fonts.ui + '-Bold', fontSize: 13, color: '#fff' }} numberOfLines={1}>{cardName}</Text>
                  <Text style={{ fontFamily: fonts.ui + '-Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)' }} numberOfLines={1}>{cardRoute}</Text>
                </View>
              </View>
              <KGStatusPill status={cardStatus} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontFamily: fonts.display + '-ExtraBold', fontSize: 34, color: '#fff', letterSpacing: -0.02 * 34 }}>{cardPrice.toLocaleString('fr-FR')}</Text>
              <Text style={{ fontFamily: fonts.ui + '-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{'XAF · ' + cardSub}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: cardPct + '%', height: '100%', backgroundColor: colors.orange, borderRadius: 3 }} />
              </View>
              <Text style={{ fontFamily: fonts.mono + '-Medium', fontSize: 11, color: colors.orange }}>{cardPct + '%'}</Text>
            </View>
          </View>

          <View style={{
            position: 'absolute', top: -14, right: 18,
            backgroundColor: colors.orange, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            shadowColor: colors.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
          }}>
            <Text style={{ fontFamily: fonts.ui + '-Bold', fontSize: 11, color: '#fff', letterSpacing: 0.04 * 11, textTransform: 'uppercase' }}>
              {isEn ? 'Fast delivery, cash pay' : 'Livré vite, payé cash'}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />

        <View style={{ backgroundColor: colors.ink, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontFamily: fonts.ui + '-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
            {isEn ? 'Fixed rate' : 'Taux fixe'}
          </Text>
          <Text style={{ fontFamily: fonts.mono + '-Medium', fontSize: 12, color: colors.orange }}>
            {'1 EUR = 655,957 XAF'}
          </Text>
          <Text style={{ fontFamily: fonts.ui + '-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
            {'BEAC · Zone CFA'}
          </Text>
        </View>

        <View style={{ paddingVertical: 20, gap: 10 }}>
          <KGButton kind="primary" size="lg" iconRight="arrow" onPress={() => navigation.navigate('Signup')}>
            {isEn ? 'Get started' : 'Démarrer'}
          </KGButton>
          <KGButton kind="ghost" size="md" onPress={() => navigation.navigate('Signin')}>
            {isEn ? 'I already have an account' : "J'ai déjà un compte"}
          </KGButton>
        </View>

        <View style={{ paddingBottom: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
