import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Linking, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
import { errMsg } from '../../utils/apiError';
import { tr } from '../../i18n/tr';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import KGToast from '../../components/KGToast';
import KenteStripe from '../../components/KenteStripe';
import { CATEGORY_LABELS, adPhoto, timeLeft, money } from '../../components/AdsShared';

const W = Dimensions.get('window').width;

export default function AdDetailScreen({ navigation, route }) {
  const { token, api, toast, showToast } = useApp();
  const adId = route?.params?.adId;
  const [ad, setAd] = useState(null);
  const [error, setError] = useState(null);
  const [contact, setContact] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loadedAt] = useState(Date.now());
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch(`/public/ads/${adId}`, {}, token)
      .then((d) => { if (d) setAd(d); else setError(tr("Cette annonce n'est plus disponible.")); })
      .catch((e) => setError(errMsg(e, tr("Cette annonce n'est plus disponible."))));
  }, [adId, token]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const left = ad ? Math.max(0, ad.secondsLeft - Math.round((now - loadedAt) / 1000)) : 0;

  const doContact = useCallback(async () => {
    if (!token) { showToast(tr('Connecte-toi pour contacter le vendeur.'), 'error'); return; }
    setBusy(true);
    try { setContact(await api(`/ads/${adId}/contact`, { method: 'POST' })); } catch (e) { showToast(errMsg(e), 'error'); } finally { setBusy(false); }
  }, [api, adId, token, showToast]);

  const call = () => contact?.phone && Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`).catch(() => showToast(tr("Impossible d'ouvrir le téléphone"), 'error'));
  const whatsapp = () => {
    const n = String(contact?.phone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(`${tr('Bonjour, je suis intéressé(e) par votre annonce KoliGo')} « ${ad.title} » (${money(ad.priceXAF)}).`);
    Linking.openURL(`https://wa.me/${n.startsWith('237') ? n : `237${n}`}?text=${msg}`).catch(() => showToast(tr("Impossible d'ouvrir WhatsApp"), 'error'));
  };

  const order = () => navigation.navigate('PostDelivery', { prefill: { fromCity: ad.city, from: ad.quartier || '', parcelDesc: ad.title, productPrice: String(ad.priceXAF) } });

  const sendReport = async () => {
    if (reason.trim().length < 3) { showToast(tr('Indique le motif du signalement.'), 'error'); return; }
    setBusy(true);
    try { await api(`/ads/${adId}/report`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }); showToast(tr('Signalement envoyé. Merci.'), 'success'); setReporting(false); setReason(''); }
    catch (e) { showToast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  const withdraw = () => Alert.alert(tr('Retirer cette annonce ?'), tr("Elle ne sera plus visible. Un Boost payé n'est pas remboursé."), [
    { text: tr('Annuler'), style: 'cancel' },
    { text: tr('Retirer'), style: 'destructive', onPress: async () => { try { await api(`/ads/${adId}/withdraw`, { method: 'POST' }); showToast(tr('Annonce retirée.')); navigation.goBack(); } catch (e) { showToast(errMsg(e), 'error'); } } },
  ]);

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
        <KGTopBar title={tr('Annonce')} onBack={() => navigation.goBack()} />
        <Text style={{ textAlign: 'center', color: colors.ink55, padding: 40, fontFamily: `${fonts.ui}-Regular`, fontSize: 14 }}>{error}</Text>
      </SafeAreaView>
    );
  }
  if (!ad) return <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.green} /></SafeAreaView>;

  const mine = !!ad.status;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}
      <KenteStripe height={4} />
      <KGTopBar title={tr('Annonce')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {Array.from({ length: Math.max(1, ad.photoCount) }).map((_, i) => (
            <Image key={i} source={adPhoto(ad.id, i, token)} style={{ width: W, height: 280, backgroundColor: colors.cream }} resizeMode="cover" />
          ))}
        </ScrollView>
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink }}>{ad.title}</Text>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: colors.greenDark }}>{money(ad.priceXAF)}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: left < 7200 ? '#D8472A' : colors.ink55 }}>⏱ {tr('Expire dans')} {timeLeft(left)}{ad.type === 'BOOST' ? ` · ${tr('À la une')}` : ''}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink70 }}>{ad.city}{ad.quartier ? `, ${ad.quartier}` : ''} · {tr(CATEGORY_LABELS[ad.category] || ad.category)}{ad.stock != null ? ` · ${tr('Stock')} : ${ad.stock}` : ''}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14.5, color: colors.ink, lineHeight: 22, marginTop: 6 }}>{ad.description}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink55, marginTop: 6 }}>{tr('Vendeur')} : {ad.seller}</Text>

          {mine ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>{ad.views} {tr('vues')} · {ad.contacts} {tr('contacts')} · {tr('Statut')} : {ad.status}</Text>
              {ad.suspendReason ? <Text style={{ color: '#C4611A', fontSize: 13 }}>⚠ {ad.suspendReason}</Text> : null}
              {['ACTIVE', 'BROUILLON'].includes(ad.status) ? <KGButton kind="soft" size="md" onPress={withdraw}>{tr('Retirer cette annonce')}</KGButton> : null}
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 14 }}>
              {!contact ? (
                <KGButton kind="primary" size="lg" icon="phone" disabled={busy} onPress={doContact}>{tr('Contacter le vendeur')}</KGButton>
              ) : (
                <View style={{ backgroundColor: '#EFF8F1', borderRadius: 14, padding: 14, gap: 8 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: colors.greenDark }}>{contact.name} · {contact.phone}</Text>
                  <KGButton kind="primary" size="md" icon="phone" onPress={call}>{tr('Appeler')}</KGButton>
                  <KGButton kind="soft" size="md" onPress={whatsapp}>WhatsApp</KGButton>
                </View>
              )}
              <KGButton kind="soft" size="lg" icon="package" onPress={order}>{tr('Commander une livraison')}</KGButton>
              {!reporting ? (
                <KGButton kind="ghost" size="md" onPress={() => setReporting(true)}>{tr('Signaler cette annonce')}</KGButton>
              ) : (
                <View style={{ gap: 8 }}>
                  <KGInput label={tr('Motif du signalement')} value={reason} onChangeText={setReason} placeholder={tr('Produit interdit, arnaque…')} />
                  <KGButton kind="primary" size="md" disabled={busy} onPress={sendReport}>{tr('Envoyer le signalement')}</KGButton>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
