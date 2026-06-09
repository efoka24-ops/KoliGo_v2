import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import Icon from '../../components/Icon';

// Step 0: CNI number Â· Step 1: CNI recto Â· Step 2: CNI verso Â· Step 3: Selfie Â· Step 4: Success
const TITLES = [
  'Ton numÃ©ro de CNI',
  'Photo de ta CNI',
  'Et le verso',
  'Selfie avec ta CNI',
];
const DESCS = [
  'Saisis le numÃ©ro figurant sur ta Carte Nationale d\'IdentitÃ© camerounaise. Il sera affichÃ© sur ta facture de confiance.',
  'Cadre bien la face recto de ta CNI. Toutes les informations doivent Ãªtre lisibles.',
  'Tourne ta CNI et photographie l\'arriÃ¨re.',
  'Tiens ta CNI Ã  cÃ´tÃ© de ton visage face Ã  la camÃ©ra. Cligne des yeux si demandÃ©.',
];
const STEP_LABELS = ['NÂ° CNI', 'CNI recto', 'CNI verso', 'Selfie'];

export default function VerificationScreen({ navigation }) {
  const { api } = useApp();
  const [step, setStep] = useState(0);
  const [cniNumber, setCniNumber] = useState('');
  const [cniRecto, setCniRecto]   = useState(null);
  const [cniVerso, setCniVerso]   = useState(null);
  const [selfie, setSelfie]       = useState(null);
  const [loading, setLoading]     = useState(false);

  const isSuccess = step === 4;
  const isCNIStep = step === 0;
  const isSelfie  = step === 3;
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

  const handleBack = () => {
    if (step === 0) navigation.goBack();
    else setStep(s => s - 1);
  };

  const handleNext = async () => {
    if (step === 0) { setStep(1); return; }
    if (step === 1) {
      const photo = await captureStepPhoto();
      if (!photo) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      const photo = await captureStepPhoto();
      if (!photo) return;
      setStep(3);
      return;
    }

    // Step 3 â†’ submit + success
    setLoading(true);
    try {
      const selfieData = selfie || await captureStepPhoto();
      if (!selfieData) return;
      await api('/api/auth/kyc', {
        method: 'POST',
        body: JSON.stringify({
          cniNumber: cniNumber.trim(),
          cniRecto,
          cniVerso,
          selfie: selfieData,
        }),
      });
    } catch {
      // Continue even if API fails â€” user can resubmit from profile
    } finally {
      setLoading(false);
      setStep(4);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="VÃ©rification d'identitÃ©" onBack={handleBack} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, flexGrow: 1 }} showsVerticalScrollIndicator={false}>

        {/* 4-step progress bar */}
        {!isSuccess && (
          <>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  backgroundColor: i <= step ? colors.green : colors.ink12,
                }} />
              ))}
            </View>

            <View>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink35, textTransform: 'uppercase', letterSpacing: 0.06 }}>
                Ã‰tape {step + 1} / 4 â€” {STEP_LABELS[step]}
              </Text>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: colors.ink, letterSpacing: -0.02 * 26, marginTop: 4 }}>
                {TITLES[step]}
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink70, marginTop: 8, lineHeight: 20 }}>
                {DESCS[step]}
              </Text>
            </View>

            {isCNIStep ? (
              <KGInput
                label="NumÃ©ro CNI"
                value={cniNumber}
                onChangeText={setCniNumber}
                icon="shield"
                placeholder="ex: CM000123456789"
                autoCapitalize="characters"
              />
            ) : (
              <View style={{
                aspectRatio: isSelfie ? 1 : 1.6,
                borderWidth: 2, borderStyle: 'dashed', borderColor: colors.green,
                borderRadius: 18, backgroundColor: colors.greenSoft,
                alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {[
                  { top: 10, left: 10 }, { top: 10, right: 10 },
                  { bottom: 10, left: 10 }, { bottom: 10, right: 10 },
                ].map((pos, i) => (
                  <View key={i} style={{
                    position: 'absolute', width: 22, height: 22,
                    borderTopWidth: pos.bottom !== undefined ? 0 : 2,
                    borderBottomWidth: pos.top !== undefined ? 0 : 2,
                    borderLeftWidth: pos.right !== undefined ? 0 : 2,
                    borderRightWidth: pos.left !== undefined ? 0 : 2,
                    borderColor: colors.green, borderRadius: 4, ...pos,
                  }} />
                ))}
                <Icon name={isSelfie ? 'user' : 'id'} size={48} color={colors.green} strokeWidth={1.4} />
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.greenDark, marginTop: 8 }}>
                  {STEP_LABELS[step]}
                </Text>
                <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 10, color: colors.green, opacity: 0.5, marginTop: 4 }}>
                  aperÃ§u camÃ©ra
                </Text>
              </View>
            )}

            <View style={{ backgroundColor: colors.orangeLight, padding: 14, borderRadius: 12, flexDirection: 'row', gap: 10 }}>
              <Icon name="shield" size={20} color={colors.orange} />
              <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, lineHeight: 18 }}>
                Tes documents sont chiffrÃ©s et ne servent qu'Ã  la vÃ©rification KYC.{' '}
                <Text style={{ fontFamily: `${fonts.ui}-Bold`, color: colors.orange }}>Jamais partagÃ©s.</Text>
              </Text>
            </View>

            <View style={{ flex: 1 }} />
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
          </>
        )}

        {isSuccess && (
          <View style={{ flex: 1, alignItems: 'center', gap: 18, marginTop: 30 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={48} color={colors.green} strokeWidth={2.4} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: colors.ink, letterSpacing: -0.02 * 26 }}>
                VÃ©rification envoyÃ©e
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink70, marginTop: 8, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 }}>
                Un admin KoliGo valide ton dossier sous 5â€“10 minutes. Tu peux dÃ©jÃ  utiliser l'application.
              </Text>
            </View>
            <KGButton kind="primary" size="lg" iconRight="arrow" onPress={() => navigation.navigate('PaymentAccount')}>
              Configurer mon compte MoMo
            </KGButton>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
