import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

const ARTICLES = [
  {
    num: '1',
    title: 'Service',
    body: "KoliGo met en relation vendeurs, livreurs et clients pour la livraison de colis à Douala. La plateforme prélève une commission de 3% sur chaque livraison confirmée par code de réception.",
  },
  {
    num: '2',
    title: 'Paiements',
    body: "Les paiements sont opérés via MTN MoMo et Orange Money. La répartition est automatique entre le vendeur, le livreur et la plateforme dès la confirmation de réception.",
  },
  {
    num: '3',
    title: 'Données & KYC',
    body: "Les vendeurs et livreurs fournissent une pièce d'identité (CNI) et un selfie pour vérification. Ces données sont conservées de façon sécurisée et utilisées uniquement pour la conformité réglementaire.",
  },
  {
    num: '4',
    title: 'Responsabilités',
    body: "KoliGo agit en tant que plateforme intermédiaire. Le vendeur est responsable du conditionnement des colis. Le livreur est responsable de la bonne prise en charge et de la livraison dans les délais annoncés.",
  },
  {
    num: '5',
    title: 'Résiliation',
    body: "Tout utilisateur peut supprimer son compte à tout moment depuis les paramètres. KoliGo se réserve le droit de suspendre un compte en cas de fraude, d'abus ou de non-respect des CGU.",
  },
  {
    num: '6',
    title: 'Droit applicable',
    body: "Les présentes conditions sont régies par le droit camerounais. Tout litige sera soumis aux juridictions compétentes de Douala, Cameroun.",
  },
];

export default function TermsScreen({ navigation }) {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    // Navigate back to Signup, merging the acceptance flag into its params
    navigation.navigate('Signup', { termsAccepted: true });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Conditions d'utilisation" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 4, marginBottom: 4 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', letterSpacing: -0.5 }}>
            CGU KoliGo
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>
            Dernière mise à jour : 1ᵉʳ juin 2026
          </Text>
        </View>

        {ARTICLES.map(a => (
          <View key={a.num} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8DCC8' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#0E2116', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13, color: '#D4991A' }}>{a.num}</Text>
              </View>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: '#0E2116' }}>{a.title}</Text>
            </View>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink70, lineHeight: 21 }}>
              {a.body}
            </Text>
          </View>
        ))}

        {/* Acceptance block at the end */}
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: accepted ? colors.green : '#E8DCC8', gap: 14, marginTop: 4 }}>
          <TouchableOpacity
            onPress={() => setAccepted(a => !a)}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
          >
            <View style={{
              width: 24, height: 24, borderRadius: 7, borderWidth: 1.5,
              borderColor: accepted ? colors.green : '#C8BEA8',
              backgroundColor: accepted ? colors.green : 'transparent',
              alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
            }}>
              {accepted && <Icon name="check" size={13} color="#fff" />}
            </View>
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink, lineHeight: 21 }}>
              J'ai lu l'intégralité des conditions d'utilisation et je les accepte.
            </Text>
          </TouchableOpacity>

          <KGButton
            kind={accepted ? 'primary' : 'ghost'}
            size="lg"
            icon="check"
            disabled={!accepted}
            onPress={handleAccept}
          >
            J'accepte & continuer
          </KGButton>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <Icon name="shield" size={13} color={colors.green} />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.green }}>
            Données protégées · KoliGo · Cameroun
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
