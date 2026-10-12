import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { errMsg } from '../../utils/apiError';
import { tr } from '../../i18n/tr';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import KGToast from '../../components/KGToast';
import KenteStripe from '../../components/KenteStripe';

const STATUS = {
  OPEN: { label: 'En cours d\'examen', color: '#C4611A' },
  CONFIRMED: { label: 'Confirmé', color: '#B42318' },
  CLEARED: { label: 'Annulé', color: '#667085' },
  EXPIRED: { label: 'Sans suite', color: '#667085' },
};

function when(iso) {
  const t = new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z'));
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Mes incidents de déclaration : état du compteur, détail de chaque incident et recours. */
export default function IncidentsScreen({ navigation }) {
  const { api, token, toast, showToast } = useApp();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try { setData(await api('/incidents')); } catch (e) { showToast(errMsg(e), 'error'); }
  }, [api, token, showToast]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const sendAppeal = async (id) => {
    if (text.trim().length < 10) { showToast(tr('Explique ton recours en quelques phrases (10 caractères minimum).'), 'error'); return; }
    setBusy(true);
    try {
      await api(`/incidents/${id}/appeal`, { method: 'POST', body: JSON.stringify({ text: text.trim() }) });
      showToast(tr('Recours envoyé à KoliGo.'), 'success');
      setOpenId(null);
      setText('');
      await load();
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const st = data?.strikes;
  const items = data?.items || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}
      <KenteStripe height={4} />
      <KGTopBar title={tr('Mes incidents')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {st && (
          <View style={{ borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, backgroundColor: st.suspended ? '#FDECEC' : st.count > 0 ? '#FEF0E3' : '#EFF8F1', borderColor: st.suspended ? '#F0B4B4' : st.count > 0 ? '#E6B8A8' : '#BFE0CA' }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink }}>
              {st.suspended ? tr('Compte vendeur suspendu') : `${st.count} / ${st.threshold} ${tr('incident(s) confirmé(s)')}`}
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, lineHeight: 19 }}>
              {st.suspended
                ? tr("Tu ne peux plus publier de livraison. Tu peux contester un incident ci-dessous ou contacter KoliGo.")
                : tr("Déclare bien le poids, la taille et le contenu de tes colis. À 3 incidents confirmés, ton compte vendeur est suspendu.")}
            </Text>
          </View>
        )}

        {data && items.length === 0 && (
          <Text style={{ textAlign: 'center', color: colors.ink55, paddingVertical: 40, fontFamily: `${fonts.ui}-Regular`, fontSize: 14 }}>{tr('Aucun incident. Continue comme ça !')}</Text>
        )}

        {items.map((i) => {
          const s = STATUS[i.status] || STATUS.OPEN;
          const open = openId === i.id;
          return (
            <View key={i.id} style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E8DCC8', padding: 14, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Bold`, fontSize: 15, color: colors.ink, textTransform: 'capitalize' }}>{i.label}</Text>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: s.color }}>{tr(s.label)}</Text>
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{when(i.createdAt)} · {i.pickupAddress} → {i.dropoffAddress}</Text>
              {!!i.comment && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70 }}>{tr('Constat du livreur')} : {i.comment}{i.measuredWeightKg ? ` (${i.measuredWeightKg} kg)` : ''}</Text>}
              {!!i.decisionNote && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>{tr('Réponse de KoliGo')} : {i.decisionNote}</Text>}
              {!!i.appealText && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: '#8A6410', backgroundColor: '#FFF8E3', padding: 8, borderRadius: 8 }}>{tr('Ton recours')} : {i.appealText}</Text>}
              {i.canAppeal && !open && (
                <TouchableOpacity onPress={() => { setOpenId(i.id); setText(''); }}>
                  <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: colors.green, marginTop: 4 }}>{tr('Contester cet incident')}</Text>
                </TouchableOpacity>
              )}
              {open && (
                <View style={{ gap: 10, marginTop: 6 }}>
                  <KGInput label={tr('Ton recours')} value={text} onChangeText={setText} placeholder={tr('Explique ce qui s’est passé')} />
                  <KGButton kind="primary" size="md" disabled={busy} onPress={() => sendAppeal(i.id)}>{busy ? tr('Envoi…') : tr('Envoyer mon recours')}</KGButton>
                  <KGButton kind="ghost" size="md" onPress={() => setOpenId(null)}>{tr('Annuler')}</KGButton>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
