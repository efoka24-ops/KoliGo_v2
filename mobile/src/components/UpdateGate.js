import React, { useState } from 'react';
import { View, Text, ActivityIndicator, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import { API_BASE } from '../config';
import KGButton from './KGButton';
import Icon from './Icon';

/**
 * Écran bloquant : la version installée n'est plus celle que le back-office impose.
 * Le lien ouvre le téléchargement de l'APK ; « J'ai installé » relit l'état auprès du serveur.
 */
export default function UpdateGate({ update, onRetry, lang }) {
  const [busy, setBusy] = useState(false);
  const fr = lang !== 'en';
  const url = /^https?:/.test(update.downloadUrl) ? update.downloadUrl : `${API_BASE}${update.downloadUrl}`;
  const retry = async () => {
    setBusy(true);
    try { await onRetry(); } finally { setBusy(false); }
  };
  const title = update.downgrade
    ? (fr ? 'Retour à une version précédente' : 'Rollback to a previous version')
    : (fr ? 'Mise à jour obligatoire' : 'Update required');
  const text = update.downgrade
    ? (fr
      ? `KoliGo vous demande d'installer la version ${update.version}. Désinstallez l'application actuelle puis installez cette version. Vos données sont conservées sur votre compte.`
      : `KoliGo asks you to install version ${update.version}. Uninstall the current app, then install this version. Your data stays on your account.`)
    : (fr
      ? `Une nouvelle version de KoliGo (${update.version}) est disponible. Pour continuer à utiliser l'application, installez-la maintenant. Vos données sont conservées.`
      : `A new version of KoliGo (${update.version}) is available. To keep using the app, please install it now. Your data is kept.`);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F7F2' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: '#E3F2E8', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon name="bolt" size={34} color="#0A5C2F" />
        </View>
        <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: '#0E2116', textAlign: 'center' }}>{title}</Text>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21, marginTop: 10, maxWidth: 330 }}>{text}</Text>
        {!!update.notes && (
          <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#fff', maxWidth: 330, alignSelf: 'stretch' }}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: '#0E2116', marginBottom: 4 }}>{fr ? 'Nouveautés' : 'What\'s new'}</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, lineHeight: 19 }}>{update.notes}</Text>
          </View>
        )}
        <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
          <KGButton kind="primary" size="lg" onPress={() => Linking.openURL(url).catch(() => {})}>
            {fr ? `Télécharger la version ${update.version}` : `Download version ${update.version}`}
          </KGButton>
          <View style={{ height: 10 }} />
          <KGButton kind="ghost" size="lg" disabled={busy} onPress={retry}>
            {busy ? <ActivityIndicator color="#0A5C2F" /> : (fr ? 'J\'ai installé la mise à jour' : 'I installed the update')}
          </KGButton>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
