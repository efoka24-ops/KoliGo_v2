import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

const TITLES = [
  'Ton numéro de CNI',
  'Photo de ta CNI',
  'Et le verso',
  'Selfie avec ta CNI',
];
const DESCS = [
  "Saisis le numéro figurant sur ta Carte Nationale d'Identité camerounaise.",
  'Cadre bien la face recto de ta CNI. Toutes les informations doivent être lisibles.',
  "Tourne ta CNI et photographie l'arrière.",
  'Tiens ta CNI à côté de ton visage face à la caméra.',
];
const STEP_LABELS = ['N° CNI', 'CNI recto', 'CNI verso', 'Selfie'];

const STEP_ICONS = ['shield', 'id', 'id', 'user'];

export default function VerificationScreen({ navigation }) {
  const { api } = useApp();
  const [step, setStep]         = useState(0);
  const [cniNumber, setCniNumber] = useState('');
  const [cniRecto, setCniRecto] = useState(null);
  const [cniVerso, setCniVerso] = useState(null);
  const [selfie, setSelfie]     = useState(null);
  const [loading, setLoading]   = useState(false);

  const isSuccess  = step === 4;
  const isCNIStep  = step === 0;
  const isSelfie   = step === 3;
  const canProceed = isCNIStep ? cniNumber.trim().length >= 6 : true;

  const captureStepPhoto = async () => {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (camPerm.status !== 'granted') return null;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.75,
      base64: true,
      allowsEditing: true,
      aspect: isSelfie ? [1, 1] : [4, 3],
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;
    const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
    if (step === 1) setCniRecto(dataUrl);
    if (step === 2) setCniVerso(dataUrl);
    if (step === 3) setSelfie(dataUrl);
    return dataUrl;
  };

  const handleBack = () => { if (step === 0) navigation.goBack(); else setStep(s => s - 1); };

  const handleNext = async () => {
    if (step === 0) { setStep(1); return; }
    if (step === 1 || step === 2) { const p = await captureStepPhoto(); if (!p) return; setStep(s => s + 1); return; }
    setLoading(true);
    try {
      const selfieData = selfie || await captureStepPhoto();
      if (!selfieData) return;
      await api('/api/auth/kyc', { method: 'POST', body: JSON.stringify({ cniNumber: cniNumber.trim(), cniRecto, cniVerso, selfie: selfieData }) });
    } catch { /* continue even on API error */ } finally {
      setLoading(false);
      setStep(4);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
        <KenteStripe height={4} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <View style={{ width: 100, height: 100, borderRadius: 28, backgroundColor: '#EFF8F1', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.green }}>
            <Icon name="shield" size={48} color={colors.green} />
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#0E2116', textAlign: 'center', letterSpacing: -0.5 }}>
              Dossier envoyé !
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21, maxWidth: 280 }}>
              Notre équipe examine tes documents. Tu seras notifié sous 24h. En attendant, tu peux déjà utiliser l'application.
            </Text>
          </View>
          <View style={{ backgroundColor: '#F5F0E8', borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: '#E8DCC8', width: '100%' }}>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 12, color: '#B8A48A', textTransform: 'uppercase', letterSpacing: 0.08 }}>◈ Prochaines étapes</Text>
            {['Vérification du document CNI', 'Validation de ton selfie', 'Badge KYC activé sur ton profil'].map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: '#fff' }}>{i + 1}</Text>
                </View>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink }}>{s}</Text>
              </View>
            ))}
          </View>
          <KGButton kind="primary" size="lg" icon="check" onPress={() => navigation.goBack()}>
            Retour au profil
          </KGButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Vérification d'identité" onBack={handleBack} />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, flexGrow: 1 }} showsVerticalScrollIndicator={false}>

        {/* Progress steps */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.green : '#E8DCC8' }} />
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#0E2116', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={STEP_ICONS[step]} size={18} color="#D4991A" />
          </View>
          <View>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#B8A48A', textTransform: 'uppercase', letterSpacing: 0.08 }}>
              Étape {step + 1} / 4 — {STEP_LABELS[step]}
            </Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: '#0E2116', letterSpacing: -0.5, marginTop: 2 }}>
              {TITLES[step]}
            </Text>
          </View>
        </View>

        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, lineHeight: 20 }}>
          {DESCS[step]}
        </Text>

        {isCNIStep ? (
          <KGInput
            label="Numéro CNI"
            value={cniNumber}
            onChangeText={setCniNumber}
            icon="shield"
            placeholder="ex: CM000123456789"
            autoCapitalize="characters"
          />
        ) : (
          /* Photo frame — African terracotta corners instead of dashed green */
          <View style={{
            aspectRatio: isSelfie ? 1 : 1.6,
            backgroundColor: '#F5F0E8',
            borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Terracotta L-corners */}
            {[
              { top: 0, left: 0 },
              { top: 0, right: 0 },
              { bottom: 0, left: 0 },
              { bottom: 0, right: 0 },
            ].map((pos, i) => {
              const isTop    = pos.top    !== undefined;
              const isLeft   = pos.left   !== undefined;
              return (
                <View key={i} style={{
                  position: 'absolute', width: 28, height: 28,
                  borderTopWidth:    isTop    ? 3 : 0,
                  borderBottomWidth: !isTop   ? 3 : 0,
                  borderLeftWidth:   isLeft   ? 3 : 0,
                  borderRightWidth:  !isLeft  ? 3 : 0,
                  borderColor: '#C4611A',
                  borderTopLeftRadius:     ( isTop &&  isLeft) ? 10 : 0,
                  borderTopRightRadius:    ( isTop && !isLeft) ? 10 : 0,
                  borderBottomLeftRadius:  (!isTop &&  isLeft) ? 10 : 0,
                  borderBottomRightRadius: (!isTop && !isLeft) ? 10 : 0,
                  ...pos,
                }} />
              );
            })}

            {/* Warm decorative circle bg */}
            <View style={{ position: 'absolute', width: '70%', height: '70%', borderRadius: 999, backgroundColor: 'rgba(196,97,26,0.06)' }} />
            <Icon name={isSelfie ? 'user' : 'id'} size={52} color="#C4611A" strokeWidth={1.2} />
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#C4611A', marginTop: 10 }}>
              {STEP_LABELS[step]}
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: '#B8A48A', marginTop: 4 }}>
              aperçu caméra
            </Text>
          </View>
        )}

        {/* Security notice — warm terracotta */}
        <View style={{ backgroundColor: '#FEF0E3', padding: 14, borderRadius: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#F5D0B8' }}>
          <Icon name="shield" size={20} color="#C4611A" />
          <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, lineHeight: 18 }}>
            Tes documents sont chiffrés et ne servent qu'à la vérification KYC.{' '}
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, color: '#C4611A' }}>Jamais partagés.</Text>
          </Text>
        </View>

        <View style={{ flex: 1, minHeight: 16 }} />

        <KGButton
          kind={canProceed ? 'primary' : 'ghost'}
          disabled={!canProceed || loading}
          size="lg"
          icon={isCNIStep ? 'arrow' : loading ? undefined : 'camera'}
          onPress={handleNext}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : isCNIStep
              ? 'Continuer'
              : isSelfie
                ? 'Prendre le selfie'
                : 'Prendre la photo'}
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
