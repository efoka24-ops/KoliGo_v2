import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../constants/colors';
import { useApp } from '../context/AppContext';
import KGTopBar from '../components/KGTopBar';
import KGButton from '../components/KGButton';
import KGCard from '../components/KGCard';
import KGInput from '../components/KGInput';
import Icon from '../components/Icon';

const STATUS_CONFIG = {
  PENDING:  { label: 'En attente de vérification', color: colors.orange, bg: colors.orangeLight, icon: 'clock' },
  VERIFIED: { label: 'Identité vérifiée',           color: colors.green,  bg: colors.greenLight,  icon: 'shield' },
  REJECTED: { label: 'Vérification refusée',        color: '#DC2626',     bg: '#FEF2F2',          icon: 'close' },
};

function getVerifiedLabel(gender) {
  if (gender === 'HOMME') return 'Homme vérifié ✓';
  if (gender === 'FEMME') return 'Femme vérifiée ✓';
  return 'Identité vérifiée ✓';
}

async function pickImage(setter, showToast, { selfie = false } = {}) {
  // Demander permission caméra
  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (camPerm.status !== 'granted') {
    Alert.alert(
      'Permission refusée',
      'KoliGo a besoin de la caméra pour capturer tes documents. Active-la dans les paramètres.',
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
    showToast('Photo capturée ✓');
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
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.greenDark }}>{label} — capturé</Text>
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
      showToast('Documents soumis — vérification sous 24h');
      navigation.goBack();
    } catch {
      showToast('Erreur lors de la soumission', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title="Vérification d'identité" onBack={() => navigation.goBack()} />
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
                Soumets tes documents pour accéder à toutes les fonctionnalités.
              </Text>
            )}
            {kycStatus === 'VERIFIED' && (
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.greenDark, marginTop: 2 }}>
                {getVerifiedLabel(gender)} — accès complet activé.
              </Text>
            )}
            {kycStatus === 'REJECTED' && (
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: '#DC2626', marginTop: 2 }}>
                Tes documents n'ont pas pu être vérifiés. Réessaie avec des photos claires.
              </Text>
            )}
          </View>
        </View>

        {kycStatus !== 'VERIFIED' && (
          <>
            <KGCard padding={14}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 12 }}>
                Numéro CNI
              </Text>
              <KGInput
                label="Numéro de ta Carte Nationale d'Identité"
                value={cniNumber}
                onChangeText={setCniNumber}
                icon="shield"
                placeholder="ex: CM000123456789"
                autoCapitalize="characters"
              />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35, marginTop: 6, lineHeight: 16 }}>
                Ce numéro sera affiché sur la facture de confiance remise au vendeur.
              </Text>
            </KGCard>

            <KGCard padding={14}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 12 }}>
                Documents requis
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginBottom: 10, lineHeight: 18 }}>
                Prends chaque document en photo. Les images sont chiffrées et envoyées de façon sécurisée à l'équipe KoliGo.
              </Text>
              <View style={{ gap: 10 }}>
                <DocSlot
                  label="CNI — Recto"
                  sublabel="Appuie pour prendre la photo face avant"
                  uri={cniRecto}
                  onPress={() => pickImage(setCniRecto, showToast)}
                  onRetake={() => pickImage(setCniRecto, showToast)}
                />
                <DocSlot
                  label="CNI — Verso"
                  sublabel="Appuie pour prendre la photo face arrière"
                  uri={cniVerso}
                  onPress={() => pickImage(setCniVerso, showToast)}
                  onRetake={() => pickImage(setCniVerso, showToast)}
                />
                <DocSlot
                  label="Selfie avec CNI"
                  sublabel="Tiens ta CNI face à la caméra frontale"
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
                  Tes documents sont chiffrés et utilisés uniquement pour la vérification d'identité. Ils ne seront jamais partagés.
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
