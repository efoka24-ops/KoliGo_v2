import React from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../constants/colors';
import KGButton from './KGButton';

// Boutons d'acces aux factures d'une livraison, selon le role et l'etat :
//   vendeur  : facture de vente (des qu'un livreur est trouve) + facture de paiement (livre)
//   livreur  : facture de livraison (livre)
// `status` accepte les deux graphies (EN_ROUTE / en_route).
export default function InvoiceButtons({ navigation, deliveryId, status, role }) {
  const s = String(status || '').toLowerCase();
  const delivered = s === 'livre';
  const started = ['accepte', 'en_route', 'livre'].includes(s);
  const open = (type) => navigation.navigate('Invoice', { deliveryId, type });

  const buttons = [];
  if (role === 'vendor') {
    if (started) buttons.push(['sale', 'Facture de vente']);
    if (delivered) buttons.push(['payment', 'Facture de paiement']);
  } else if (role === 'deliverer') {
    if (delivered) buttons.push(['delivery', 'Facture de livraison']);
  }
  if (!buttons.length) return null;

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.6 }}>Factures</Text>
      {buttons.map(([type, label]) => (
        <KGButton key={type} kind="soft" size="md" icon="send" onPress={() => open(type)}>{label}</KGButton>
      ))}
    </View>
  );
}
