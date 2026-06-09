import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGInput from '../../components/KGInput';
import Icon from '../../components/Icon';

const STATUS_CONFIG = {
  PENDING:  { label: 'En attente de vÃ©rification', color: colors.orange, bg: colors.orangeLight, icon: 'clock' },
  VERIFIED: { label: 'IdentitÃ© vÃ©rifiÃ©e',           color: colors.green,  bg: colors.greenLight,  icon: 'shield' },
  REJECTED: { label: 'VÃ©rification refusÃ©e',        color: '#DC2626',     bg: '#FEF2F2',          icon: 'close' },
};

function getVerifiedLabel(gender) {
  if (gender === 'HOMME') return 'Homme vÃ©rifiÃ© âœ“';
  if (gender === 'FEMME') return 'Femme vÃ©rifiÃ©e âœ“';
  return 'IdentitÃ© vÃ©rifiÃ©e âœ“';
}

async function pickImage(setter, showToast, { selfie = false } = {}) {
  // Demander permission camÃ©ra
  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (camPerm.status !== 'granted') {
    Alert.alert(
      'Permission refusÃ©e',
      'KoliGo a besoin de la camÃ©ra pour capturer tes documents. Active-la dans les paramÃ¨tres.',
      [{ text: 'OK' }]
    );
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images',
    quality: 0.75,
    base64: true,
    allowsEditing: true,
    aspect: selfie ? [1, 1] : [4, 3],
  });

  if (!result.canceled && result.assets?.[0]?.base64) {
    setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
    showToast('Photo capturÃ©e âœ“');
  }
}

function DocSlot({ label, sublabel, uri, onPress, onRetake }) {
  const done = !!uri;
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: done ? colors.green : colors.ink12, borderStyle: done ? 'solid' : 'dashed' }}>
      <TouchableOpacity onPress={done ? undefined : onPress} activeOpacity={done ? 1 : 0.75}>
        {done && uri.startsWith('data:') ? (
          <View>
            <Image source={{ uri }} style={{ width: '100%', height: 140, resizeMode: 'cover' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: colors.greenLight }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="check" size={16} color={colors.green} />
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.greenDark }}>{label} â€” capturÃ©</Text>
              </View>
              <TouchableOpacity onPress={onRetake} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff', borderRadius: 8 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55 }}>Reprendre</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: done ? colors.greenLight : '#fff' }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: done ? colors.green : colors.cream, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={done ? 'check' : 'camera'} size={20} color={done ? '#fff' : colors.ink55} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: done ? colors.greenDark : colors.ink }}>{label}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: done ? colors.green : colors.ink55, marginTop: 1 }}>{sublabel}</Text>
            </View>
            <Icon name="camera" size={18} color={colors.ink35} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function KYCScreen({ navigation }) {
  const { user, api, showToast } = useApp();
  const kycStatus = user?.kycStatus || 'PENDING';
  const gender = user?.gender;
  const statusCfg = STATUS_CONFIG[kycStatus] || STATUS_CONFIG.PENDING;
  const verifiedLabel = kycStatus === 'VERIFIED' ? getVerifiedLabel(gender) : statusCfg.label;

  const [cniNumber,  setCniNumber]  = useState(user?.cniNumber || '');
  const [cniRecto,   setCniRecto]   = useState(null);
  const [cniVerso,   setCniVerso]   = useState(null);
  const [selfie,     setSelfie]     = useState(null);
  const [loading,    setLoading]    = useState(false);

  const allDone = cniNumber.trim().length >= 6 && cniRecto && cniVerso && selfie;

  const handleSubmit = async () => {
    if (!allDone) return;
    setLoading(true);
    try {
      await api('/api/auth/kyc', {
        method: 'POST',
        body: JSON.stringify({ cniNumber: cniNumber.trim(), cniRecto, cniVerso, selfie }),
      });
      showToast('Documents soumis â€” vÃ©rification sous 24h');
      navigation.goBack();
    } catch {
      showToast('Erreur lors de la soumission', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title="VÃ©rification d'identitÃ©" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Status badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: statusCfg.bg, borderRadius: 16, padding: 14 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: statusCfg.color, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={statusCfg.icon} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: statusCfg.color }}>{verifiedLabel}</Text>
            {kycStatus === 'PENDING' && (
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 2 }}>
                Soumets tes documents pour accÃ©der Ã  toutes les fonctionnalitÃ©s.
              </Text>
            )}
            {kycStatus === 'VERIFIED' && (
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.greenDark, marginTop: 2 }}>
                {getVerifiedLabel(gender)} â€” accÃ¨s complet activÃ©.
              </Text>
            )}
            {kycStatus === 'REJECTED' && (
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: '#DC2626', marginTop: 2 }}>
                Tes documents n'ont pas pu Ãªtre vÃ©rifiÃ©s. RÃ©essaie avec des photos claires.
              </Text>
            )}
          </View>
        </View>

        {kycStatus !== 'VERIFIED' && (
          <>
            <KGCard padding={14}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 12 }}>
                NumÃ©ro CNI
              </Text>
              <KGInput
                label="NumÃ©ro de ta Carte Nationale d'IdentitÃ©"
                value={cniNumber}
                onChangeText={setCniNumber}
                icon="shield"
                placeholder="ex: CM000123456789"
                autoCapitalize="characters"
              />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35, marginTop: 6, lineHeight: 16 }}>
                Ce numÃ©ro sera affichÃ© sur la facture de confiance remise au vendeur.
              </Text>
            </KGCard>

            <KGCard padding={14}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 12 }}>
                Documents requis
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginBottom: 10, lineHeight: 18 }}>
                Prends chaque document en photo. Les images sont chiffrÃ©es et envoyÃ©es de faÃ§on sÃ©curisÃ©e Ã  l'Ã©quipe KoliGo.
              </Text>
              <View style={{ gap: 10 }}>
                <DocSlot
                  label="CNI â€” Recto"
                  sublabel="Appuie pour prendre la photo face avant"
                  uri={cniRecto}
                  onPress={() => pickImage(setCniRecto, showToast)}
                  onRetake={() => pickImage(setCniRecto, showToast)}
                />
                <DocSlot
                  label="CNI â€” Verso"
                  sublabel="Appuie pour prendre la photo face arriÃ¨re"
                  uri={cniVerso}
                  onPress={() => pickImage(setCniVerso, showToast)}
                  onRetake={() => pickImage(setCniVerso, showToast)}
                />
                <DocSlot
                  label="Selfie avec CNI"
                  sublabel="Tiens ta CNI face Ã  la camÃ©ra frontale"
                  uri={selfie}
                  onPress={() => pickImage(setSelfie, showToast, { selfie: true })}
                  onRetake={() => pickImage(setSelfie, showToast, { selfie: true })}
                />
              </View>
            </KGCard>

            <KGCard kind="cream" padding={14}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Icon name="shield" size={18} color={colors.ink55} />
                <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink70, lineHeight: 18 }}>
                  Tes documents sont chiffrÃ©s et utilisÃ©s uniquement pour la vÃ©rification d'identitÃ©. Ils ne seront jamais partagÃ©s.
                </Text>
              </View>
            </KGCard>

            <KGButton kind="primary" size="lg" icon={loading ? undefined : 'check'} onPress={handleSubmit} disabled={!allDone || loading}>
              {loading ? <ActivityIndicator color="#fff" /> : allDone ? 'Soumettre les documents' : 'Ajoute tous les documents'}
            </KGButton>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
