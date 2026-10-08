import React from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

/** Bandeau affiché tant que le KYC du rôle actif n'est pas validé par le back-office. */
export default function KycBanner({ status, role }) {
  if (!status || status === 'VERIFIED') return null;
  const action = role === 'DELIVERER' ? 'livrer un colis' : 'publier une livraison';
  const text = status === 'PENDING'
    ? `Ton dossier est en cours de vérification. Tu pourras ${action} dès qu'il sera validé.`
    : status === 'REJECTED'
      ? `Ton dossier a été refusé. Renvoie-le pour pouvoir ${action}.`
      : `Envoie ton dossier KYC pour pouvoir ${action}.`;
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FEF0E3', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#F5D0B8' }}>
      <Icon name="shield" size={18} color="#C4611A" />
      <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#C4611A', lineHeight: 19 }}>{text}</Text>
    </View>
  );
}
