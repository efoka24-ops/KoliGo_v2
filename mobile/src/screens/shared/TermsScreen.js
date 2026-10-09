import { tr } from '../../i18n/tr';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
import { errMsg, errCode } from '../../utils/apiError';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

// Les CGU ne sont plus écrites dans l'application : elles viennent du serveur (modifiables depuis le
// back-office) et chaque version acceptée est enregistrée avec sa date.
export default function TermsScreen({ navigation, route }) {
  const { lang, api, setUser, showToast } = useApp();
  const acceptMode = route?.params?.mode === 'accept';
  const fr = lang !== 'en';
  const [cgu, setCgu] = useState(null);
  const [error, setError] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch(`/public/cgu?lang=${lang === 'en' ? 'en' : 'fr'}`);
      if (!data?.articles) throw new Error('empty');
      setCgu(data);
    } catch {
      setError(lang === 'en'
        ? 'Could not load the terms. Check your connection.'
        : 'Impossible de charger les conditions. Vérifiez votre connexion.');
    }
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async () => {
    if (!cgu) return;
    if (!acceptMode) {
      // Pendant l'inscription le compte n'existe pas encore : l'acceptation est enregistrée à la première connexion.
      navigation.navigate('Signup', { termsAccepted: true });
      return;
    }
    setSaving(true);
    try {
      await api('/auth/accept-cgu', { method: 'POST', body: JSON.stringify({ version: cgu.version }) });
      setUser((prev) => (prev ? { ...prev, needsCgu: false, cguVersion: cgu.version } : prev));
      navigation.goBack();
    } catch (e) {
      showToast(errMsg(e), 'error');
      if (errCode(e) === 'CGU_OUTDATED') load();
    } finally {
      setSaving(false);
    }
  };

  const date = cgu?.publishedAt
    ? new Date(`${cgu.publishedAt.replace(' ', 'T')}Z`).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title={fr ? "Conditions d'utilisation" : 'Terms of use'} onBack={acceptMode ? undefined : () => navigation.goBack()} />

      {!cgu && !error && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.green} size="large" />
        </View>
      )}

      {error && (
        <View style={{ padding: 24, gap: 14 }}>
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16 }}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: '#D8472A', lineHeight: 20 }}>{error}</Text>
          </View>
          <KGButton kind="primary" size="lg" onPress={load}>{fr ? 'Réessayer' : 'Retry'}</KGButton>
        </View>
      )}

      {cgu && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 4, marginBottom: 4 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', letterSpacing: -0.5 }}>{tr("CGU KoliGo")}</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>
              Version {cgu.version}{date ? ` · ${fr ? 'publiée le' : 'published'} ${date}` : ''}
            </Text>
            {acceptMode && (
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#C4611A', marginTop: 6, lineHeight: 19 }}>
                {fr ? 'Vous devez accepter les conditions pour continuer.' : 'You must accept the terms to continue.'}
              </Text>
            )}
          </View>

          {cgu.articles.map((a) => (
            <View key={`${a.num}-${a.title}`} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8DCC8' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={{ minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 8, backgroundColor: '#0E2116', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13, color: '#D4991A' }}>{a.num}</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: '#0E2116' }}>{a.title}</Text>
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink70, lineHeight: 21 }}>{a.body}</Text>
            </View>
          ))}

          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: accepted ? colors.green : '#E8DCC8', gap: 14, marginTop: 4 }}>
            <TouchableOpacity onPress={() => setAccepted((a) => !a)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: accepted ? colors.green : '#C8BEA8', backgroundColor: accepted ? colors.green : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 }}>
                {accepted && <Icon name="check" size={13} color="#fff" />}
              </View>
              <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink, lineHeight: 21 }}>
                {fr ? "J'ai lu l'intégralité des conditions d'utilisation et je les accepte." : 'I have read the full terms of use and accept them.'}
              </Text>
            </TouchableOpacity>
            <KGButton kind={accepted ? 'primary' : 'ghost'} size="lg" icon="check" disabled={!accepted || saving} onPress={handleAccept}>
              {saving ? '…' : (fr ? "J'accepte & continuer" : 'Accept & continue')}
            </KGButton>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Icon name="shield" size={13} color={colors.green} />
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.green }}>
              {fr ? 'Données protégées · KoliGo · Cameroun' : 'Data protected · KoliGo · Cameroon'}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
