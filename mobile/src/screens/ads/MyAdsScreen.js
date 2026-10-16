import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
import { errMsg } from '../../utils/apiError';
import { tr } from '../../i18n/tr';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGToast from '../../components/KGToast';
import KenteStripe from '../../components/KenteStripe';
import { DurationPicker, AdPaymentWait, PhoneModal, adPhoto, timeLeft, money } from '../../components/AdsShared';

const STATUS = {
  BROUILLON: { label: 'Paiement en attente', color: '#667085' },
  ACTIVE: { label: 'En ligne', color: '#0A7A3E' },
  EXPIREE: { label: 'Expirée', color: '#667085' },
  SUSPENDUE: { label: 'En vérification', color: '#C4611A' },
  SUPPRIMEE: { label: 'Retirée', color: '#B42318' },
};

/** Mes annonces : en ligne, expirées, en vérification ; retirer, republier (Flash gratuit) ou booster. */
export default function MyAdsScreen({ navigation }) {
  const { api, token, toast, showToast } = useApp();
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState(null); // annonce à republier
  const [duration, setDuration] = useState({ type: 'FLASH' });
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [pay, setPay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checkingId, setCheckingId] = useState(null);

  const load = useCallback(async () => {
    try { const r = await api('/ads/mine'); setItems(r?.items || []); } catch (e) { showToast(errMsg(e), 'error'); }
  }, [api, showToast]);

  useEffect(() => { load(); apiFetch('/public/ads/config').then(setConfig).catch(() => {}); }, [load]);
  useEffect(() => { const u = navigation.addListener('focus', load); return u; }, [navigation, load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const withdraw = (ad) => Alert.alert(tr('Retirer cette annonce ?'), tr("Elle ne sera plus visible. Un Boost payé n'est pas remboursé."), [
    { text: tr('Annuler'), style: 'cancel' },
    { text: tr('Retirer'), style: 'destructive', onPress: async () => { try { await api(`/ads/${ad.id}/withdraw`, { method: 'POST' }); load(); } catch (e) { showToast(errMsg(e), 'error'); } } },
  ]);

  const tariff = duration.type === 'BOOST' ? (config?.tariffs || []).find((t) => t.days === duration.days) : null;

  const republish = async (phone) => {
    setBusy(true);
    try {
      const r = await api(`/ads/${target.id}/republish`, { method: 'POST', timeout: 90000, body: JSON.stringify({ type: duration.type, days: duration.days, phone }) });
      setTarget(null);
      if (r?.ad?.status === 'BROUILLON') setPay({ adId: r.ad.id, amount: tariff?.priceXAF || 0 });
      else { showToast(r?.moderated ? tr('Annonce reçue : elle sera mise en ligne après vérification.') : tr('Annonce republiée ✓'), 'success'); load(); }
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmRepublish = () => {
    if (duration.type === 'BOOST' && tariff?.priceXAF > 0) setPhoneOpen(true);
    else republish(undefined);
  };

  const onPaymentDone = async (result) => {
    const adId = pay?.adId;
    setPay(null);
    if (result === 'success') showToast(tr('Paiement confirmé : annonce en ligne ✓'), 'success');
    else if (result === 'failed') {
      if (adId) { try { await api(`/ads/${adId}/withdraw`, { method: 'POST' }); } catch { /* sans importance */ } }
      showToast(tr("Le paiement n'a pas abouti."), 'error');
    }
    load();
  };

  const resumePendingPayment = async (ad) => {
    setCheckingId(ad.id);
    try {
      const r = await api(`/ads/${ad.id}/payment-status`);
      if (r?.status === 'success') {
        showToast(tr('Paiement confirmé : annonce en ligne ✓'), 'success');
        await load();
        return;
      }
      if (r?.status === 'failed') {
        showToast(tr("Le paiement n'a pas abouti."), 'error');
        await load();
        return;
      }
      setPay({ adId: ad.id, amount: r?.amountXAF || 0 });
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}
      <KenteStripe height={4} />
      <KGTopBar title={tr('Mes annonces')} onBack={() => navigation.goBack()}
        action={<TouchableOpacity onPress={() => navigation.navigate('PostAd')}><Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: colors.green }}>+ {tr('Publier')}</Text></TouchableOpacity>} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {items.length === 0 && (
          <Text style={{ textAlign: 'center', color: colors.ink55, paddingVertical: 50, fontFamily: `${fonts.ui}-Regular`, fontSize: 14 }}>{tr("Tu n'as pas encore d'annonce.")}</Text>
        )}
        {items.map((a) => {
          const s = STATUS[a.status] || STATUS.EXPIREE;
          return (
            <View key={a.id} style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E8DCC8', padding: 12, flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => navigation.navigate('AdDetail', { adId: a.id })}>
                <Image source={adPhoto(a.id, 0, token)} style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: colors.cream }} />
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14.5, color: colors.ink }}>{a.title}</Text>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: s.color }}>{tr(s.label)}{a.type === 'BOOST' ? ' · Boost' : ' · Flash'}</Text>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{money(a.priceXAF)} · {a.views} {tr('vues')} · {a.contacts} {tr('contacts')}</Text>
                {a.live ? <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>⏱ {timeLeft(a.secondsLeft)}</Text> : null}
                {a.suspendReason ? <Text style={{ fontSize: 12, color: '#C4611A' }}>⚠ {a.suspendReason}</Text> : null}
                {a.removeReason && a.status === 'SUPPRIMEE' ? <Text style={{ fontSize: 12, color: colors.ink55 }}>{a.removeReason}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
                  {a.status === 'BROUILLON' ? (
                    <TouchableOpacity onPress={() => resumePendingPayment(a)} disabled={checkingId === a.id}>
                      <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: colors.green }}>{checkingId === a.id ? tr('Vérification…') : tr('Vérifier le paiement')}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {['EXPIREE', 'SUPPRIMEE'].includes(a.status) && !a.live ? (
                    <TouchableOpacity onPress={() => { setTarget(a); setDuration({ type: 'FLASH' }); }}><Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: colors.green }}>{tr('Republier')}</Text></TouchableOpacity>
                  ) : null}
                  {['ACTIVE', 'BROUILLON'].includes(a.status) ? (
                    <TouchableOpacity onPress={() => withdraw(a)}><Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: '#B42318' }}>{tr('Retirer')}</Text></TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(14,33,22,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink }}>{tr('Republier')}</Text>
            <Text numberOfLines={1} style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55 }}>{target?.title}</Text>
            <DurationPicker config={config} value={duration} onChange={setDuration} />
            <KGButton kind="primary" size="lg" disabled={busy} onPress={confirmRepublish}>{busy ? tr('Envoi…') : duration.type === 'BOOST' && tariff ? `${tr('Payer et republier')} · ${money(tariff.priceXAF)}` : tr('Republier gratuitement')}</KGButton>
            <KGButton kind="ghost" size="md" onPress={() => setTarget(null)}>{tr('Annuler')}</KGButton>
          </View>
        </View>
      </Modal>
      <PhoneModal visible={phoneOpen} amount={tariff?.priceXAF || 0} onCancel={() => setPhoneOpen(false)} onConfirm={(phone) => { setPhoneOpen(false); republish(phone); }} />
      <AdPaymentWait visible={!!pay} adId={pay?.adId} amount={pay?.amount} onDone={onPaymentDone} />
    </SafeAreaView>
  );
}
