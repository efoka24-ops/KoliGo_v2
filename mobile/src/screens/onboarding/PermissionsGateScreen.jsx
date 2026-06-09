import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors, fonts } from '../../constants/colors';
import KGButton from '../../components/KGButton';
import Icon from '../../components/Icon';

const STEPS = {
  fr: [
    {
      icon: 'pin',
      color: colors.green,
      bg: colors.greenLight,
      title: 'Position GPS',
      subtitle: 'Requis pour le suivi en temps rÃ©el des livraisons',
      benefits: [
        'Suivi de votre livreur en temps rÃ©el',
        'Confirmation de prÃ©sence Ã  la collecte',
        'Calcul automatique de la distance',
      ],
      kind: 'foreground',
    },
    {
      icon: 'moto',
      color: colors.orange,
      bg: '#FFF3EC',
      title: 'GPS en arriÃ¨re-plan',
      subtitle: 'Permet de continuer le suivi quand l\'app est minimisÃ©e',
      benefits: [],
      kind: 'background',
    },
  ],
  en: [
    {
      icon: 'pin',
      color: colors.green,
      bg: colors.greenLight,
      title: 'GPS Location',
      subtitle: 'Required for real-time delivery tracking',
      benefits: [
        'Real-time deliverer tracking',
        'Pickup location confirmation',
        'Automatic distance calculation',
      ],
      kind: 'foreground',
    },
    {
      icon: 'moto',
      color: colors.orange,
      bg: '#FFF3EC',
      title: 'Background GPS',
      subtitle: 'Continue tracking when app is minimized',
      benefits: [],
      kind: 'background',
    },
  ],
};

export default function PermissionsGateScreen({ lang = 'fr', onGranted }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  const steps = STEPS[lang] || STEPS.fr;
  const current = steps[step];

  const requestPermission = async () => {
    setLoading(true);
    setDenied(false);
    try {
      if (current.kind === 'foreground') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setStep(1);
        } else {
          setDenied(true);
        }
      } else {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status === 'granted' || status === 'denied') {
          // Even if background is denied, we allow app usage (it's optional for clients/vendors)
          onGranted();
        } else {
          setDenied(true);
        }
      }
    } catch {
      // Background permissions not available (web/simulator) â€” proceed anyway
      if (step === 1) onGranted();
      else setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const skip = () => {
    if (step === 1) onGranted();
    else setStep(step + 1);
  };

  const buttonLabels = lang === 'en'
    ? { permit: 'Allow access', skip: 'Continue without GPS' }
    : { permit: 'Autoriser l\'accÃ¨s GPS', skip: 'Continuer sans GPS' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 28 }} edges={['top', 'bottom']}>
      {/* Progress dots */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 48 }}>
        {steps.map((_, i) => (
          <View key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === step ? colors.green : colors.ink12 }} />
        ))}
      </View>

      <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: current.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        <Icon name={current.icon} size={44} color={current.color} />
      </View>

      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: colors.ink, textAlign: 'center', letterSpacing: -0.5, marginBottom: 10 }}>
        {current.title}
      </Text>
      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 15, color: colors.ink55, textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
        {current.subtitle}
      </Text>

      {step === 0 && (
        <View style={{ backgroundColor: colors.cream, borderRadius: 14, padding: 16, marginBottom: 32, gap: 10, width: '100%' }}>
          {current.benefits.map(t => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={11} color={colors.green} />
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, flex: 1 }}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {step === 1 && (
        <View style={{ backgroundColor: '#FFF3EC', borderRadius: 14, padding: 16, marginBottom: 32, width: '100%' }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.orange, marginBottom: 6 }}>
            {lang === 'en' ? 'For deliverers only' : 'Pour les livreurs uniquement'}
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, lineHeight: 19 }}>
            {lang === 'en'
              ? 'This permission allows you to continue sharing your location during a delivery, even if you leave the app. It can be disabled from your phone\'s settings at any time.'
              : 'Cette permission permet de continuer Ã  partager votre position pendant une livraison, mÃªme si vous quittez l\'application. Elle peut Ãªtre dÃ©sactivÃ©e depuis les paramÃ¨tres de votre tÃ©lÃ©phone Ã  tout moment.'}
          </Text>
        </View>
      )}

      {denied && (
        <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 20, width: '100%' }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#D8472A', textAlign: 'center' }}>
            {lang === 'en'
              ? 'Permission denied. Enable GPS in Settings â†’ Apps â†’ KoliGo â†’ Location.'
              : 'Permission refusÃ©e. Activez le GPS dans ParamÃ¨tres â†’ Applications â†’ KoliGo â†’ Localisation.'}
          </Text>
        </View>
      )}

      <KGButton kind="primary" size="lg" onPress={requestPermission} style={{ width: '100%' }}>
        {loading ? <ActivityIndicator color="#fff" /> : buttonLabels.permit}
      </KGButton>

      <Text
        onPress={skip}
        style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink35, marginTop: 18, textDecorationLine: 'underline' }}
      >
        {step === 1 ? (lang === 'en' ? 'Skip (I\'m a vendor / customer)' : 'Ignorer (je suis vendeur / client)') : buttonLabels.skip}
      </Text>
    </SafeAreaView>
  );
}
