import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import KGTopBar from '../../components/KGTopBar';
import Icon from '../../components/Icon';

const SECTIONS = [
  {
    icon: 'shield',
    title: 'DonnÃ©es collectÃ©es',
    body: `KoliGo collecte les informations suivantes pour vous fournir ses services :\n\nâ€¢ IdentitÃ© : nom complet, numÃ©ro de tÃ©lÃ©phone\nâ€¢ DonnÃ©es de connexion : code PIN (hashÃ© et non lisible), date/heure de connexion\nâ€¢ Position GPS : collectÃ©e uniquement lors d'une livraison active (livreur) ou du suivi de colis (client), jamais en dehors\nâ€¢ Appareil : identifiant unique de l'appareil, modÃ¨le, version du systÃ¨me, adresse IP locale\nâ€¢ Documents KYC : CNI recto/verso, selfie (pour les livreurs)\nâ€¢ Transactions : historique des paiements et des livraisons`,
  },
  {
    icon: 'pin',
    title: 'Pourquoi nous collectons ces donnÃ©es',
    body: `Vos donnÃ©es sont utilisÃ©es exclusivement pour :\n\nâ€¢ CrÃ©er et gÃ©rer votre compte\nâ€¢ Permettre le suivi GPS en temps rÃ©el des livraisons\nâ€¢ SÃ©curiser les transactions via les codes de collecte/livraison\nâ€¢ PrÃ©venir la fraude et sÃ©curiser la plateforme\nâ€¢ Calculer les commissions et gÃ©rer les paiements\nâ€¢ AmÃ©liorer nos services et l'expÃ©rience utilisateur\nâ€¢ Respecter nos obligations lÃ©gales\n\nNous ne vendons, ne louons et ne partageons vos donnÃ©es personnelles avec aucun tiers Ã  des fins commerciales.`,
  },
  {
    icon: 'package',
    title: 'GPS et localisation',
    body: `La localisation est au cÅ“ur de notre service de livraison. Voici comment nous la gÃ©rons :\n\nâ€¢ Livreurs : La position GPS est collectÃ©e toutes les 10 secondes pendant une livraison active. Cette collecte s'arrÃªte automatiquement Ã  la confirmation de livraison.\n\nâ€¢ Clients : La position est utilisÃ©e uniquement pour afficher votre position sur la carte de suivi. Elle n'est pas stockÃ©e.\n\nâ€¢ Fonctionnement en arriÃ¨re-plan : Avec votre autorisation explicite, l'app peut accÃ©der Ã  votre position en arriÃ¨re-plan pour maintenir le suivi pendant une livraison. Cette permission peut Ãªtre rÃ©voquÃ©e Ã  tout moment dans les paramÃ¨tres de votre tÃ©lÃ©phone.\n\nâ€¢ Historique GPS : Les traces GPS sont conservÃ©es 30 jours aprÃ¨s la livraison Ã  des fins de rÃ©solution de litiges, puis supprimÃ©es.`,
  },
  {
    icon: 'bell',
    title: 'Partage des donnÃ©es',
    body: `Vos donnÃ©es peuvent Ãªtre partagÃ©es dans les cas suivants :\n\nâ€¢ Entre utilisateurs de la plateforme : Le vendeur voit le nom du livreur et sa position pendant la livraison. Le livreur voit le nom, l'adresse et le tÃ©lÃ©phone du vendeur et du destinataire.\n\nâ€¢ Sous-traitants techniques : HÃ©bergement, envoi de SMS, traitement des paiements Mobile Money. Ces partenaires sont soumis Ã  des obligations de confidentialitÃ© strictes.\n\nâ€¢ AutoritÃ©s lÃ©gales : Sur rÃ©quisition judiciaire uniquement, conformÃ©ment Ã  la loi camerounaise.\n\nNous ne transfÃ©rons pas vos donnÃ©es en dehors du Cameroun sauf obligation lÃ©gale.`,
  },
  {
    icon: 'shield',
    title: 'SÃ©curitÃ© des donnÃ©es',
    body: `KoliGo met en Å“uvre des mesures techniques et organisationnelles pour protÃ©ger vos donnÃ©es :\n\nâ€¢ Chiffrement HTTPS (TLS 1.3) pour tous les Ã©changes\nâ€¢ Codes PIN hashÃ©s (bcrypt) â€” mÃªme KoliGo ne peut pas lire votre PIN\nâ€¢ Tokens JWT Ã  durÃ©e de vie limitÃ©e (7 jours)\nâ€¢ Journalisation des accÃ¨s suspects\nâ€¢ Serveurs hÃ©bergÃ©s au Cameroun\nâ€¢ AccÃ¨s aux donnÃ©es limitÃ© au personnel autorisÃ©\n\nEn cas de violation de donnÃ©es, vous serez notifiÃ© dans les 72 heures.`,
  },
  {
    icon: 'user',
    title: 'Vos droits',
    body: `ConformÃ©ment Ã  la loi camerounaise sur la protection des donnÃ©es personnelles, vous disposez des droits suivants :\n\nâ€¢ Droit d'accÃ¨s : Obtenir une copie de vos donnÃ©es personnelles\nâ€¢ Droit de rectification : Corriger des donnÃ©es inexactes\nâ€¢ Droit Ã  l'effacement : Demander la suppression de votre compte et de vos donnÃ©es\nâ€¢ Droit d'opposition : Vous opposer Ã  certains traitements\nâ€¢ Droit Ã  la portabilitÃ© : Recevoir vos donnÃ©es dans un format lisible\n\nPour exercer ces droits, contactez-nous Ã  : privacy@koligo.cm\n\nNous rÃ©pondrons Ã  votre demande dans un dÃ©lai de 30 jours.`,
  },
  {
    icon: 'package',
    title: 'Conservation des donnÃ©es',
    body: `Vos donnÃ©es sont conservÃ©es selon les durÃ©es suivantes :\n\nâ€¢ DonnÃ©es de compte : Pendant toute la durÃ©e de votre abonnement + 1 an\nâ€¢ Historique des livraisons : 5 ans (obligations comptables)\nâ€¢ Logs GPS : 30 jours aprÃ¨s livraison\nâ€¢ Sessions d'appareils : 90 jours\nâ€¢ Logs d'activitÃ© : 12 mois\n\nAprÃ¨s suppression de votre compte, les donnÃ©es sont anonymisÃ©es sous 30 jours.`,
  },
  {
    icon: 'bell',
    title: 'Cookies et identifiants',
    body: `L'application KoliGo utilise un identifiant unique d'appareil (Android ID) pour :\nâ€¢ SÃ©curiser votre compte contre les connexions non autorisÃ©es\nâ€¢ DÃ©tecter les comportements frauduleux\nâ€¢ AmÃ©liorer votre expÃ©rience en mÃ©morisant vos prÃ©fÃ©rences\n\nCet identifiant est liÃ© Ã  votre appareil et non Ã  votre identitÃ©. Il peut Ãªtre rÃ©initialisÃ© en dÃ©sinstallant l'application.`,
  },
  {
    icon: 'shield',
    title: 'Contact et rÃ©clamations',
    body: `Pour toute question relative Ã  la protection de vos donnÃ©es personnelles :\n\nDÃ©lÃ©guÃ© Ã  la Protection des DonnÃ©es (DPO)\nKoliGo SARL\nAkwa, Douala, Cameroun\n\nEmail : privacy@koligo.cm\nTÃ©lÃ©phone : +237 6XX XX XX XX\n\nVous pouvez Ã©galement saisir l'autoritÃ© de protection des donnÃ©es compÃ©tente au Cameroun.\n\nDerniÃ¨re mise Ã  jour : Janvier 2026`,
  },
];

export default function PrivacyScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="Politique de confidentialitÃ©" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.ink, borderRadius: 16, padding: 16, gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: '#fff' }}>
            Vos donnÃ©es nous appartiennent... Ã  vous.
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19 }}>
            KoliGo collecte uniquement ce qui est nÃ©cessaire pour faire fonctionner le service. Voici tout ce que vous devez savoir.
          </Text>
        </View>

        {SECTIONS.map((s, i) => (
          <View key={i} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={15} color={colors.greenDark} />
              </View>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.ink, flex: 1 }}>
                {s.title}
              </Text>
            </View>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, lineHeight: 20, paddingLeft: 38 }}>
              {s.body}
            </Text>
          </View>
        ))}

        <View style={{ height: 1, backgroundColor: colors.ink06 }} />
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35, textAlign: 'center' }}>
          Â© 2026 KoliGo SARL â€” privacy@koligo.cm
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
