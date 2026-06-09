import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import KGTopBar from '../components/KGTopBar';
import KGButton from '../components/KGButton';

const SECTIONS = [
  {
    title: '1. Objet et champ d\'application',
    body: `KoliGo est une plateforme de mise en relation entre vendeurs, livreurs et clients au Cameroun, exploitée par KoliGo SARL (ci-après « KoliGo »), enregistrée au Registre du Commerce de Douala.\n\nEn créant un compte ou en utilisant les services KoliGo, vous acceptez sans réserve les présentes Conditions Générales d'Utilisation (CGU). Ces CGU s'appliquent à toute personne physique ou morale utilisant la plateforme, qu'elle soit vendeur, livreur ou client.`,
  },
  {
    title: '2. Inscription et compte utilisateur',
    body: `Pour utiliser KoliGo, vous devez :\n• Être âgé(e) d'au moins 18 ans\n• Fournir un numéro de téléphone camerounais valide (format 6XXXXXXXX)\n• Fournir des informations exactes, complètes et à jour\n• Créer un code PIN confidentiel à 4 chiffres\n\nVous êtes responsable de la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte est réputée effectuée par vous. En cas de perte ou de compromission, contactez immédiatement le support KoliGo.\n\nUn même numéro de téléphone peut être associé aux profils Vendeur et Livreur, permettant de passer d'un mode à l'autre depuis votre profil.`,
  },
  {
    title: '3. Services proposés',
    body: `KoliGo propose les services suivants :\n\n• Vendeurs : Publication d'annonces de livraison, génération de codes de collecte et de livraison, suivi en temps réel des colis, historique des commandes.\n\n• Livreurs : Accès aux courses disponibles dans leur zone, acceptation de livraisons, navigation GPS, portefeuille électronique avec retrait Mobile Money.\n\n• Clients : Suivi en temps réel de la livraison, confirmation de réception par code sécurisé.\n\nKoliGo agit en tant qu'intermédiaire technique et ne peut être tenu responsable des actes des vendeurs ou livreurs indépendants inscrits sur la plateforme.`,
  },
  {
    title: '4. Tarification et commissions',
    body: `Les tarifs de livraison sont calculés automatiquement en fonction de la distance, du poids du colis et du type de course (Temporaire, Permanent, Express, VVIP).\n\nKoliGo prélève une commission de 15% sur chaque transaction complétée. Cette commission est déduite automatiquement lors du paiement au livreur.\n\nLes prix affichés sur la plateforme sont libellés en Francs CFA (XAF) et sont TTC. KoliGo se réserve le droit de modifier ses tarifs avec un préavis de 15 jours.`,
  },
  {
    title: '5. Obligations des livreurs',
    body: `En tant que livreur inscrit sur KoliGo, vous vous engagez à :\n• Détenir un permis de conduire valide et un véhicule en règle\n• Traiter les colis avec soin et les livrer dans les délais convenus\n• Activer le GPS pendant la livraison pour le suivi en temps réel\n• Respecter le code de conduite et traiter tous les utilisateurs avec respect\n• Ne pas ouvrir, endommager ou retenir un colis\n• Soumettre vos documents KYC pour vérification d'identité\n\nTout manquement grave peut entraîner la suspension ou la suppression du compte sans préavis.`,
  },
  {
    title: '6. Obligations des vendeurs',
    body: `En tant que vendeur inscrit sur KoliGo, vous vous engagez à :\n• Décrire les colis avec exactitude (poids, nature, valeur)\n• Ne pas expédier de marchandises illicites, dangereuses ou prohibées par la législation camerounaise\n• Être disponible à l'adresse de collecte aux horaires indiqués\n• Communiquer le code de collecte uniquement au livreur désigné\n• Régler les frais de livraison dans les délais convenus\n\nKoliGo se réserve le droit de refuser ou annuler toute livraison suspecte.`,
  },
  {
    title: '7. Sécurité et codes de livraison',
    body: `KoliGo utilise un système à double code pour sécuriser les livraisons :\n\n• Code de collecte (remis au livreur par le vendeur) : valide la prise en charge du colis\n• Code de livraison (remis au destinataire par le vendeur) : valide la remise du colis\n\nCes codes sont à usage unique et confidentiels. KoliGo ne vous demandera jamais vos codes par téléphone ou email. Ne communiquez vos codes qu'aux parties concernées en face à face.`,
  },
  {
    title: '8. Limitation de responsabilité',
    body: `KoliGo met tout en œuvre pour assurer la continuité et la qualité de ses services, mais ne peut garantir :\n• L'absence d'interruptions ou de bugs\n• La disponibilité permanente de livreurs dans toutes les zones\n• La ponctualité absolue des livraisons\n\nEn cas de perte, vol ou dommage d'un colis, la responsabilité de KoliGo est limitée à la valeur déclarée du colis, dans la limite de 50 000 XAF par incident. Pour les colis de valeur supérieure, une assurance complémentaire est recommandée.\n\nKoliGo n'est pas responsable des dommages indirects, perte de revenus ou préjudice commercial.`,
  },
  {
    title: '9. Propriété intellectuelle',
    body: `L'application KoliGo, son logo, ses algorithmes, ses codes sources, son design et l'ensemble de ses contenus sont la propriété exclusive de KoliGo SARL et sont protégés par les lois camerounaises et internationales relatives à la propriété intellectuelle.\n\nToute reproduction, modification, distribution ou exploitation sans autorisation écrite préalable de KoliGo est strictement interdite.`,
  },
  {
    title: '10. Résiliation et suspension',
    body: `Vous pouvez supprimer votre compte à tout moment depuis les paramètres de l'application. Les données personnelles seront supprimées dans un délai de 30 jours, sous réserve des obligations légales de conservation.\n\nKoliGo se réserve le droit de suspendre ou supprimer tout compte en cas de :\n• Violation des présentes CGU\n• Fraude ou comportement malveillant\n• Inactivité prolongée de plus de 12 mois\n• Décision d'une autorité judiciaire`,
  },
  {
    title: '11. Droit applicable et litiges',
    body: `Les présentes CGU sont régies par le droit camerounais. En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire.\n\nÀ défaut d'accord amiable dans un délai de 30 jours, le litige sera soumis aux tribunaux compétents de Douala, Cameroun.\n\nPour toute réclamation : support@koligo.cm\nKoliGo SARL — Akwa, Douala, Cameroun\n\nDernière mise à jour : Janvier 2026`,
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
            Lisez attentivement ces conditions avant d'utiliser KoliGo. Faites défiler jusqu'en bas pour accepter.
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
          © 2026 KoliGo SARL — Douala, Cameroun
        </Text>
      </ScrollView>

      {fromSignup && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 28, borderTopWidth: 1, borderTopColor: colors.ink06 }}>
          {!scrolledToEnd && (
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, textAlign: 'center', marginBottom: 10 }}>
              Faites défiler jusqu'en bas pour activer le bouton
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
