import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import KGTopBar from '../../components/KGTopBar';
import Icon from '../../components/Icon';

const SECTIONS = [
  {
    icon: 'shield',
    title: 'Données collectées',
    body: `KoliGo collecte les informations suivantes pour vous fournir ses services :\n\nâ€¢ Identité : nom complet, numéro de téléphone\nâ€¢ Données de connexion : code PIN (hashé et non lisible), date/heure de connexion\nâ€¢ Position GPS : collectée uniquement lors d'une livraison active (livreur) ou du suivi de colis (client), jamais en dehors\nâ€¢ Appareil : identifiant unique de l'appareil, modèle, version du système, adresse IP locale\nâ€¢ Documents KYC : CNI recto/verso, selfie (pour les livreurs)\nâ€¢ Transactions : historique des paiements et des livraisons`,
  },
  {
    icon: 'pin',
    title: 'Pourquoi nous collectons ces données',
    body: `Vos données sont utilisées exclusivement pour :\n\nâ€¢ Créer et gérer votre compte\nâ€¢ Permettre le suivi GPS en temps réel des livraisons\nâ€¢ Sécuriser les transactions via les codes de collecte/livraison\nâ€¢ Prévenir la fraude et sécuriser la plateforme\nâ€¢ Calculer les commissions et gérer les paiements\nâ€¢ Améliorer nos services et l'expérience utilisateur\nâ€¢ Respecter nos obligations légales\n\nNous ne vendons, ne louons et ne partageons vos données personnelles avec aucun tiers à des fins commerciales.`,
  },
  {
    icon: 'package',
    title: 'GPS et localisation',
    body: `La localisation est au cÅ"ur de notre service de livraison. Voici comment nous la gérons :\n\nâ€¢ Livreurs : La position GPS est collectée toutes les 10 secondes pendant une livraison active. Cette collecte s'arrête automatiquement à la confirmation de livraison.\n\nâ€¢ Clients : La position est utilisée uniquement pour afficher votre position sur la carte de suivi. Elle n'est pas stockée.\n\nâ€¢ Fonctionnement en arrière-plan : Avec votre autorisation explicite, l'app peut accéder à votre position en arrière-plan pour maintenir le suivi pendant une livraison. Cette permission peut être révoquée à tout moment dans les paramètres de votre téléphone.\n\nâ€¢ Historique GPS : Les traces GPS sont conservées 30 jours après la livraison à des fins de résolution de litiges, puis supprimées.`,
  },
  {
    icon: 'bell',
    title: 'Partage des données',
    body: `Vos données peuvent être partagées dans les cas suivants :\n\nâ€¢ Entre utilisateurs de la plateforme : Le vendeur voit le nom du livreur et sa position pendant la livraison. Le livreur voit le nom, l'adresse et le téléphone du vendeur et du destinataire.\n\nâ€¢ Sous-traitants techniques : Hébergement, envoi de SMS, traitement des paiements Mobile Money. Ces partenaires sont soumis à des obligations de confidentialité strictes.\n\nâ€¢ Autorités légales : Sur réquisition judiciaire uniquement, conformément à la loi camerounaise.\n\nNous ne transférons pas vos données en dehors du Cameroun sauf obligation légale.`,
  },
  {
    icon: 'shield',
    title: 'Sécurité des données',
    body: `KoliGo met en Å"uvre des mesures techniques et organisationnelles pour protéger vos données :\n\nâ€¢ Chiffrement HTTPS (TLS 1.3) pour tous les échanges\nâ€¢ Codes PIN hashés (bcrypt) â€" même KoliGo ne peut pas lire votre PIN\nâ€¢ Tokens JWT à durée de vie limitée (7 jours)\nâ€¢ Journalisation des accès suspects\nâ€¢ Serveurs hébergés au Cameroun\nâ€¢ Accès aux données limité au personnel autorisé\n\nEn cas de violation de données, vous serez notifié dans les 72 heures.`,
  },
  {
    icon: 'user',
    title: 'Vos droits',
    body: `Conformément à la loi camerounaise sur la protection des données personnelles, vous disposez des droits suivants :\n\nâ€¢ Droit d'accès : Obtenir une copie de vos données personnelles\nâ€¢ Droit de rectification : Corriger des données inexactes\nâ€¢ Droit à l'effacement : Demander la suppression de votre compte et de vos données\nâ€¢ Droit d'opposition : Vous opposer à certains traitements\nâ€¢ Droit à la portabilité : Recevoir vos données dans un format lisible\n\nPour exercer ces droits, contactez-nous à : privacy@koligo.cm\n\nNous répondrons à votre demande dans un délai de 30 jours.`,
  },
  {
    icon: 'package',
    title: 'Conservation des données',
    body: `Vos données sont conservées selon les durées suivantes :\n\nâ€¢ Données de compte : Pendant toute la durée de votre abonnement + 1 an\nâ€¢ Historique des livraisons : 5 ans (obligations comptables)\nâ€¢ Logs GPS : 30 jours après livraison\nâ€¢ Sessions d'appareils : 90 jours\nâ€¢ Logs d'activité : 12 mois\n\nAprès suppression de votre compte, les données sont anonymisées sous 30 jours.`,
  },
  {
    icon: 'bell',
    title: 'Cookies et identifiants',
    body: `L'application KoliGo utilise un identifiant unique d'appareil (Android ID) pour :\nâ€¢ Sécuriser votre compte contre les connexions non autorisées\nâ€¢ Détecter les comportements frauduleux\nâ€¢ Améliorer votre expérience en mémorisant vos préférences\n\nCet identifiant est lié à votre appareil et non à votre identité. Il peut être réinitialisé en désinstallant l'application.`,
  },
  {
    icon: 'shield',
    title: 'Contact et réclamations',
    body: `Pour toute question relative à la protection de vos données personnelles :\n\nDélégué à la Protection des Données (DPO)\nKoliGo SARL\nAkwa, Douala, Cameroun\n\nEmail : privacy@koligo.cm\nTéléphone : +237 6XX XX XX XX\n\nVous pouvez également saisir l'autorité de protection des données compétente au Cameroun.\n\nDernière mise à jour : Janvier 2026`,
  },
];

export default function PrivacyScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="Politique de confidentialité" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.ink, borderRadius: 16, padding: 16, gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: '#fff' }}>
            Vos données nous appartiennent... à vous.
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19 }}>
            KoliGo collecte uniquement ce qui est nécessaire pour faire fonctionner le service. Voici tout ce que vous devez savoir.
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
          Â© 2026 KoliGo SARL â€" privacy@koligo.cm
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
