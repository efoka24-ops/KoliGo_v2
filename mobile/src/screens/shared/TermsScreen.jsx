import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';

const SECTIONS = [
  {
    title: '1. Objet et champ d\'application',
    body: `KoliGo est une plateforme de mise en relation entre vendeurs, livreurs et clients au Cameroun, exploitÃ©e par KoliGo SARL (ci-aprÃ¨s Â« KoliGo Â»), enregistrÃ©e au Registre du Commerce de Douala.\n\nEn crÃ©ant un compte ou en utilisant les services KoliGo, vous acceptez sans rÃ©serve les prÃ©sentes Conditions GÃ©nÃ©rales d'Utilisation (CGU). Ces CGU s'appliquent Ã  toute personne physique ou morale utilisant la plateforme, qu'elle soit vendeur, livreur ou client.`,
  },
  {
    title: '2. Inscription et compte utilisateur',
    body: `Pour utiliser KoliGo, vous devez :\nâ€¢ ÃŠtre Ã¢gÃ©(e) d'au moins 18 ans\nâ€¢ Fournir un numÃ©ro de tÃ©lÃ©phone camerounais valide (format 6XXXXXXXX)\nâ€¢ Fournir des informations exactes, complÃ¨tes et Ã  jour\nâ€¢ CrÃ©er un code PIN confidentiel Ã  4 chiffres\n\nVous Ãªtes responsable de la confidentialitÃ© de vos identifiants. Toute activitÃ© rÃ©alisÃ©e depuis votre compte est rÃ©putÃ©e effectuÃ©e par vous. En cas de perte ou de compromission, contactez immÃ©diatement le support KoliGo.\n\nUn mÃªme numÃ©ro de tÃ©lÃ©phone peut Ãªtre associÃ© aux profils Vendeur et Livreur, permettant de passer d'un mode Ã  l'autre depuis votre profil.`,
  },
  {
    title: '3. Services proposÃ©s',
    body: `KoliGo propose les services suivants :\n\nâ€¢ Vendeurs : Publication d'annonces de livraison, gÃ©nÃ©ration de codes de collecte et de livraison, suivi en temps rÃ©el des colis, historique des commandes.\n\nâ€¢ Livreurs : AccÃ¨s aux courses disponibles dans leur zone, acceptation de livraisons, navigation GPS, portefeuille Ã©lectronique avec retrait Mobile Money.\n\nâ€¢ Clients : Suivi en temps rÃ©el de la livraison, confirmation de rÃ©ception par code sÃ©curisÃ©.\n\nKoliGo agit en tant qu'intermÃ©diaire technique et ne peut Ãªtre tenu responsable des actes des vendeurs ou livreurs indÃ©pendants inscrits sur la plateforme.`,
  },
  {
    title: '4. Tarification et commissions',
    body: `Les tarifs de livraison sont calculÃ©s automatiquement en fonction de la distance, du poids du colis et du type de course (Temporaire, Permanent, Express, VVIP).\n\nKoliGo prÃ©lÃ¨ve une commission de 15% sur chaque transaction complÃ©tÃ©e. Cette commission est dÃ©duite automatiquement lors du paiement au livreur.\n\nLes prix affichÃ©s sur la plateforme sont libellÃ©s en Francs CFA (XAF) et sont TTC. KoliGo se rÃ©serve le droit de modifier ses tarifs avec un prÃ©avis de 15 jours.`,
  },
  {
    title: '5. Obligations des livreurs',
    body: `En tant que livreur inscrit sur KoliGo, vous vous engagez Ã  :\nâ€¢ DÃ©tenir un permis de conduire valide et un vÃ©hicule en rÃ¨gle\nâ€¢ Traiter les colis avec soin et les livrer dans les dÃ©lais convenus\nâ€¢ Activer le GPS pendant la livraison pour le suivi en temps rÃ©el\nâ€¢ Respecter le code de conduite et traiter tous les utilisateurs avec respect\nâ€¢ Ne pas ouvrir, endommager ou retenir un colis\nâ€¢ Soumettre vos documents KYC pour vÃ©rification d'identitÃ©\n\nTout manquement grave peut entraÃ®ner la suspension ou la suppression du compte sans prÃ©avis.`,
  },
  {
    title: '6. Obligations des vendeurs',
    body: `En tant que vendeur inscrit sur KoliGo, vous vous engagez Ã  :\nâ€¢ DÃ©crire les colis avec exactitude (poids, nature, valeur)\nâ€¢ Ne pas expÃ©dier de marchandises illicites, dangereuses ou prohibÃ©es par la lÃ©gislation camerounaise\nâ€¢ ÃŠtre disponible Ã  l'adresse de collecte aux horaires indiquÃ©s\nâ€¢ Communiquer le code de collecte uniquement au livreur dÃ©signÃ©\nâ€¢ RÃ©gler les frais de livraison dans les dÃ©lais convenus\n\nKoliGo se rÃ©serve le droit de refuser ou annuler toute livraison suspecte.`,
  },
  {
    title: '7. SÃ©curitÃ© et codes de livraison',
    body: `KoliGo utilise un systÃ¨me Ã  double code pour sÃ©curiser les livraisons :\n\nâ€¢ Code de collecte (remis au livreur par le vendeur) : valide la prise en charge du colis\nâ€¢ Code de livraison (remis au destinataire par le vendeur) : valide la remise du colis\n\nCes codes sont Ã  usage unique et confidentiels. KoliGo ne vous demandera jamais vos codes par tÃ©lÃ©phone ou email. Ne communiquez vos codes qu'aux parties concernÃ©es en face Ã  face.`,
  },
  {
    title: '8. Limitation de responsabilitÃ©',
    body: `KoliGo met tout en Å“uvre pour assurer la continuitÃ© et la qualitÃ© de ses services, mais ne peut garantir :\nâ€¢ L'absence d'interruptions ou de bugs\nâ€¢ La disponibilitÃ© permanente de livreurs dans toutes les zones\nâ€¢ La ponctualitÃ© absolue des livraisons\n\nEn cas de perte, vol ou dommage d'un colis, la responsabilitÃ© de KoliGo est limitÃ©e Ã  la valeur dÃ©clarÃ©e du colis, dans la limite de 50 000 XAF par incident. Pour les colis de valeur supÃ©rieure, une assurance complÃ©mentaire est recommandÃ©e.\n\nKoliGo n'est pas responsable des dommages indirects, perte de revenus ou prÃ©judice commercial.`,
  },
  {
    title: '9. PropriÃ©tÃ© intellectuelle',
    body: `L'application KoliGo, son logo, ses algorithmes, ses codes sources, son design et l'ensemble de ses contenus sont la propriÃ©tÃ© exclusive de KoliGo SARL et sont protÃ©gÃ©s par les lois camerounaises et internationales relatives Ã  la propriÃ©tÃ© intellectuelle.\n\nToute reproduction, modification, distribution ou exploitation sans autorisation Ã©crite prÃ©alable de KoliGo est strictement interdite.`,
  },
  {
    title: '10. RÃ©siliation et suspension',
    body: `Vous pouvez supprimer votre compte Ã  tout moment depuis les paramÃ¨tres de l'application. Les donnÃ©es personnelles seront supprimÃ©es dans un dÃ©lai de 30 jours, sous rÃ©serve des obligations lÃ©gales de conservation.\n\nKoliGo se rÃ©serve le droit de suspendre ou supprimer tout compte en cas de :\nâ€¢ Violation des prÃ©sentes CGU\nâ€¢ Fraude ou comportement malveillant\nâ€¢ InactivitÃ© prolongÃ©e de plus de 12 mois\nâ€¢ DÃ©cision d'une autoritÃ© judiciaire`,
  },
  {
    title: '11. Droit applicable et litiges',
    body: `Les prÃ©sentes CGU sont rÃ©gies par le droit camerounais. En cas de litige, les parties s'engagent Ã  rechercher une solution amiable avant tout recours judiciaire.\n\nÃ€ dÃ©faut d'accord amiable dans un dÃ©lai de 30 jours, le litige sera soumis aux tribunaux compÃ©tents de Douala, Cameroun.\n\nPour toute rÃ©clamation : support@koligo.cm\nKoliGo SARL â€” Akwa, Douala, Cameroun\n\nDerniÃ¨re mise Ã  jour : Janvier 2026`,
  },
];

export default function TermsScreen({ navigation, route }) {
  const scrollRef = useRef(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const fromSignup = route?.params?.fromSignup;

  const handleScroll = ({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60) {
      setScrolledToEnd(true);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="Conditions d'utilisation" onBack={() => navigation.goBack()} />

      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ backgroundColor: colors.greenLight, borderRadius: 14, padding: 14 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.greenDark, lineHeight: 19 }}>
            Lisez attentivement ces conditions avant d'utiliser KoliGo. Faites dÃ©filer jusqu'en bas pour accepter.
          </Text>
        </View>

        {SECTIONS.map((s, i) => (
          <View key={i}>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.ink, marginBottom: 6 }}>
              {s.title}
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, lineHeight: 20 }}>
              {s.body}
            </Text>
          </View>
        ))}

        <View style={{ height: 1, backgroundColor: colors.ink06 }} />
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35, textAlign: 'center' }}>
          Â© 2026 KoliGo SARL â€” Douala, Cameroun
        </Text>
      </ScrollView>

      {fromSignup && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 28, borderTopWidth: 1, borderTopColor: colors.ink06 }}>
          {!scrolledToEnd && (
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, textAlign: 'center', marginBottom: 10 }}>
              Faites dÃ©filer jusqu'en bas pour activer le bouton
            </Text>
          )}
          <KGButton
            kind={scrolledToEnd ? 'primary' : 'ghost'}
            size="lg"
            icon="check"
            disabled={!scrolledToEnd}
            onPress={() => navigation.navigate('Auth', { termsAccepted: true })}
          >
            J'accepte les conditions
          </KGButton>
        </View>
      )}
    </SafeAreaView>
  );
}
