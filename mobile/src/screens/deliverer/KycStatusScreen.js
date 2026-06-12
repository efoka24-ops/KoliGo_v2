import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

export default function KycStatusScreen({ navigation }) {
  const { user } = useApp();
  const kycStatus = user?.kycStatus || 'NONE';

  if (kycStatus === 'VERIFIED') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
        <KenteStripe height={4} />
        <KGTopBar title="Vérification KYC" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <View style={{ width: 100, height: 100, borderRadius: 28, backgroundColor: '#EFF8F1', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.green }}>
            <Icon name="shield" size={48} color={colors.green} />
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#0E2116', textAlign: 'center', letterSpacing: -0.5 }}>
              Identité vérifiée ✓
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21, maxWidth: 280 }}>
              Ta CNI a été validée. Tu peux accepter et effectuer des livraisons.
            </Text>
          </View>
          <View style={{ backgroundColor: '#EFF8F1', borderRadius: 16, padding: 16, width: '100%', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="check" size={16} color={colors.green} />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13.5, color: colors.greenDark }}>CNI vérifiée</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="check" size={16} color={colors.green} />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13.5, color: colors.greenDark }}>Profil de confiance</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="check" size={16} color={colors.green} />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13.5, color: colors.greenDark }}>Accès complet à la plateforme</Text>
            </View>
          </View>
          <KGButton kind="primary" size="lg" icon="arrow" onPress={() => navigation.goBack()}>
            Retour
          </KGButton>
        </View>
      </SafeAreaView>
    );
  }

  if (kycStatus === 'REJECTED') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
        <KenteStripe height={4} />
        <KGTopBar title="Vérification KYC" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <View style={{ width: 100, height: 100, borderRadius: 28, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D8472A' }}>
            <Icon name="flag" size={48} color="#D8472A" />
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', textAlign: 'center', letterSpacing: -0.5 }}>
              Dossier refusé
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21, maxWidth: 280 }}>
              {user?.kycRejectionReason || 'Tes documents ne sont pas lisibles. Merci de resoumettre des photos claires.'}
            </Text>
          </View>
          <KGButton kind="primary" size="lg" icon="arrow" onPress={() => navigation.navigate('Kyc')}>
            Resoumettre mon dossier
          </KGButton>
          <KGButton kind="ghost" size="md" onPress={() => navigation.goBack()}>
            Retour
          </KGButton>
        </View>
      </SafeAreaView>
    );
  }

  if (kycStatus === 'PENDING') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
        <KenteStripe height={4} />
        <KGTopBar title="Vérification KYC" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <View style={{ width: 100, height: 100, borderRadius: 28, backgroundColor: '#FFF8E3', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#C4611A' }}>
            <Icon name="shield" size={48} color="#C4611A" />
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', textAlign: 'center', letterSpacing: -0.5 }}>
              En cours de vérification
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21, maxWidth: 280 }}>
              Ton dossier est en cours d'examen par notre équipe. Délai : 24h.
            </Text>
          </View>
          <KGButton kind="ghost" size="lg" onPress={() => navigation.goBack()}>
            Retour
          </KGButton>
        </View>
      </SafeAreaView>
    );
  }

  // NONE — navigate directly to KYC submission
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Vérification KYC" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6, marginBottom: 8 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', letterSpacing: -0.5 }}>
            Vérifier mon identité
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, lineHeight: 21 }}>
            Pour accepter des livraisons, tu dois soumettre ta CNI. C'est rapide et sécurisé.
          </Text>
        </View>

        {[
          { icon: 'shield', label: 'Numéro CNI', desc: 'Le numéro sur ta carte nationale' },
          { icon: 'id',     label: 'Photo recto', desc: 'Photo nette de la face avant' },
          { icon: 'id',     label: 'Photo verso', desc: "Photo de l'arrière de la carte" },
          { icon: 'user',   label: 'Selfie + CNI', desc: 'Toi avec ta carte en main' },
        ].map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E8DCC8' }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#FEF0E3', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={step.icon} size={20} color="#C4611A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{step.label}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 2 }}>{step.desc}</Text>
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#E8DCC8', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.ink55 }}>{i + 1}</Text>
            </View>
          </View>
        ))}

        <View style={{ flex: 1, minHeight: 16 }} />

        <KGButton kind="primary" size="lg" icon="arrow" onPress={() => navigation.navigate('Kyc')}>
          Commencer la vérification
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
