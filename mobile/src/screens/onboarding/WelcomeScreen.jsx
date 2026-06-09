import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { KoliGoLogo, KoliGoWordmark } from '../../components/KoliGoLogo';
import KGButton from '../../components/KGButton';
import KGStatusPill from '../../components/KGStatusPill';
import Icon from '../../components/Icon';

export default function WelcomeScreen({ navigation }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream, overflow: 'hidden' }} edges={['top']}>
      {/* Decorative circles â€” clipped by overflow hidden */}
      <View style={{ position: 'absolute', top: -100, right: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.green, opacity: 0.12 }} />
      <View style={{ position: 'absolute', top: 90, left: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.orange, opacity: 0.18 }} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 0 }} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <KoliGoLogo size={42} />
          <KoliGoWordmark size={26} />
        </View>

        {/* Hero text */}
        <View style={{ marginTop: 36 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 38, lineHeight: 40, letterSpacing: -0.03 * 38, color: colors.ink }}>
            {isEn ? 'Your parcel,\n' : 'Ton colis,\n'}
            <Text style={{ color: colors.green }}>{isEn ? 'delivered go-go.' : 'livrÃ© go-go.'}</Text>
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 15.5, lineHeight: 22, color: colors.ink70, marginTop: 14, maxWidth: 320 }}>
            {isEn
              ? 'Collaborative delivery in Cameroon. Every Cameroonian can become a courier â€” you can earn too.'
              : 'La livraison collaborative au Cameroun. Chaque camerounais est un livreur â€” toi aussi tu peux gagner.'}
          </Text>
        </View>

        {/* Hero card */}
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
                <View>
                  <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: '#fff' }}>HervÃ© Â· Permanent</Text>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Bonamoussadi â†’ Akwa</Text>
                </View>
              </View>
              <KGStatusPill status="en_route" />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 34, color: '#fff', letterSpacing: -0.02 * 34 }}>1 955</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>XAF Â· arrivÃ©e 12 min</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: '62%', height: '100%', backgroundColor: colors.orange, borderRadius: 3 }} />
              </View>
              <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 11, color: colors.orange }}>62%</Text>
            </View>
          </View>

          {/* Floating pill */}
          <View style={{
            position: 'absolute', top: -14, right: 18,
            backgroundColor: colors.orange, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            shadowColor: colors.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
          }}>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: '#fff', letterSpacing: 0.04 * 11, textTransform: 'uppercase' }}>LivrÃ© vite, payÃ© cash</Text>
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />

        {/* CTAs */}
        <View style={{ paddingVertical: 20, gap: 10 }}>
          <KGButton kind="primary" size="lg" iconRight="arrow" onPress={() => navigation.navigate('Auth', { mode: 'signup' })}>
            {isEn ? 'Get started' : 'DÃ©marrer'}
          </KGButton>
          <KGButton kind="ghost" size="md" onPress={() => navigation.navigate('Auth', { mode: 'signin' })}>
            {isEn ? 'I already have an account' : "J'ai dÃ©jÃ  un compte"}
          </KGButton>
        </View>

        <View style={{ paddingBottom: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
