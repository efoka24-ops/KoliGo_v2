import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import KGButton from './KGButton';
import Icon from './Icon';

/**
 * Écran affiché à la place de l'application quand le mode maintenance est activé dans le back-office.
 * L'état vient du serveur (/public/config) ; « Réessayer » le relit.
 */
export default function MaintenanceGate({ onRetry, lang }) {
  const [busy, setBusy] = useState(false);
  const fr = lang !== 'en';
  const retry = async () => {
    setBusy(true);
    try { await onRetry(); } finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: '#FEF0E3', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Icon name="bolt" size={34} color="#C4611A" />
      </View>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: '#0E2116', textAlign: 'center' }}>
        {fr ? 'KoliGo est en maintenance' : 'KoliGo is under maintenance'}
      </Text>
      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21, marginTop: 10, maxWidth: 320 }}>
        {fr
          ? "Nous améliorons le service. Vos livraisons en cours ne sont pas perdues. Réessayez dans quelques instants."
          : 'We are improving the service. Your ongoing deliveries are safe. Please try again in a few moments.'}
      </Text>
      <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
        <KGButton kind="primary" size="lg" disabled={busy} onPress={retry}>
          {busy ? <ActivityIndicator color="#fff" /> : (fr ? 'Réessayer' : 'Retry')}
        </KGButton>
      </View>
    </SafeAreaView>
  );
}
