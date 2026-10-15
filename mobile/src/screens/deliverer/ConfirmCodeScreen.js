import { tr } from '../../i18n/tr';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { capturePhoto } from '../../utils/camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { apiFetch, BASE_URL } from '../../services/api';
import { errMsg } from '../../utils/apiError';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

// Prise en charge : le colis est conforme, le livreur le confirme (plus de code de collecte : le seul code
// de la course est celui que l'acheteur donnera au livreur à la livraison).
function PickupStep({ navigation, route }) {
  const { api } = useApp();
  const deliveryId = route?.params?.deliveryId;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    if (!deliveryId) { navigation.navigate('Waiting'); return; }
    setLoading(true);
    setError(null);
    try {
      await api(`/deliveries/${deliveryId}/pickup`, { method: 'POST' });
      navigation.navigate('Waiting', { deliveryId });
    } catch (e) {
      setError(errMsg(e, tr('Impossible de confirmer la prise en charge.')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title={tr('Prise en charge')} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1, padding: 24, gap: 18, justifyContent: 'center' }}>
        <Icon name="check" size={40} color={colors.green} />
        <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', letterSpacing: -0.5 }}>{tr('Colis conforme')}</Text>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, lineHeight: 21 }}>
          {tr("En confirmant, tu prends le colis en charge et le vendeur est prévenu tout de suite. À la livraison, l'acheteur te donnera son code de réception et son numéro Mobile Money.")}
        </Text>
        {!!error && <Text style={{ color: '#C00', fontSize: 13.5 }}>{error}</Text>}
        <KGButton kind="primary" size="lg" icon="check" disabled={loading} onPress={confirm}>{loading ? tr('Envoi…') : tr('Confirmer la prise en charge')}</KGButton>
      </View>
    </SafeAreaView>
  );
}

// ─── Contrôle de conformité du colis, avant la saisie du code de collecte ────────────────────────
// Le livreur confirme que le colis correspond au gabarit déclaré, ou propose un autre gabarit avec une
// photo. Le vendeur répond dans l'application ; sans réponse dans le délai, la course est annulée sans frais.
const Money = (n) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`;

// Motifs de non-conformité. Poids et taille passent par une correction du gabarit (le vendeur répond) ;
// les autres sont signalés à KoliGo : un contenu interdit ou dangereux annule la course immédiatement.
const REASONS = [
  { id: 'POIDS', title: 'Poids différent', sub: 'Le colis est plus lourd que déclaré', next: 'correct' },
  { id: 'TAILLE', title: 'Taille différente', sub: 'Les dimensions dépassent le gabarit déclaré', next: 'correct' },
  { id: 'AUTRE', title: 'Autre raison', sub: 'Route difficile, détour, attente…', next: 'correct', offersOnly: true },
  { id: 'VALEUR', title: 'Valeur incohérente', sub: 'La valeur déclarée ne paraît pas crédible', next: 'flag' },
  { id: 'INTERDIT', title: 'Contenu interdit', sub: 'Drogue, armes, faux documents…', next: 'flag', danger: true },
  { id: 'DANGEREUX', title: 'Contenu dangereux', sub: 'Risque pour toi ou pour les autres', next: 'flag', danger: true },
];

export default function ConfirmCodeScreen({ navigation, route }) {
  const { token, api, pricing, showToast } = useApp();
  const deliveryId = route?.params?.deliveryId;
  const [phase, setPhase] = useState(deliveryId ? 'loading' : 'code'); // loading | check | correct | wait | ended | code
  const [delivery, setDelivery] = useState(null);
  const [revision, setRevision] = useState(null);
  const [newSize, setNewSize] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [endedText, setEndedText] = useState('');
  const [reason, setReason] = useState('TAILLE');
  const [kg, setKg] = useState('');
  const [comment, setComment] = useState('');
  const [flagKind, setFlagKind] = useState(null);
  const [minPrice, setMinPrice] = useState('');

  const gabarits = pricing?.gabarits || {};
  const fee = pricing?.cancelFeeXAF ?? 500;

  const applyState = useCallback((d, rev) => {
    setDelivery(d);
    setRevision(rev);
    if (d.status === 'ANNULE') {
      setEndedText(rev?.status === 'REFUSED'
        ? `Le vendeur a refusé le nouveau prix. La course est annulée et ${Money(rev.feeXAF || fee)} de dédommagement sont crédités sur ton portefeuille.`
        : rev?.status === 'EXPIRED'
          ? "Le vendeur n'a pas répondu à temps : la course est annulée."
          : 'La course a été annulée.');
      setPhase('ended');
    } else if (rev?.status === 'PENDING') {
      setPhase('wait');
    } else if (rev?.status === 'ACCEPTED' || d.status !== 'ACCEPTE') {
      setPhase('code');
    } else {
      setPhase((p) => (p === 'loading' ? 'check' : p));
    }
  }, [fee]);

  const refresh = useCallback(async () => {
    const d = await api(`/deliveries/${deliveryId}`);
    if (d) applyState(d, d.revision || null);
    return d;
  }, [api, deliveryId, applyState]);

  useEffect(() => {
    if (!deliveryId) return;
    refresh().catch((e) => { showToast(errMsg(e), 'error'); setPhase('code'); });
  }, [deliveryId, refresh, showToast]);

  // Attente de la réponse du vendeur : lecture régulière + compte à rebours.
  useEffect(() => {
    if (phase !== 'wait') return undefined;
    const poll = setInterval(() => { refresh().catch(() => {}); }, 4000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [phase, refresh]);

  const takePhoto = async () => {
    const shot = await capturePhoto({ quality: 0.6 });
    if (shot.status === 'cancelled') return;
    if (shot.status !== 'ok') { showToast(shot.message, 'error'); return; }
    setPhoto({ uri: shot.uri, data: shot.base64 });
  };

  const submitCorrection = async () => {
    if (!newSize || !photo) return;
    setBusy(true);
    try {
      const rev = await api(`/deliveries/${deliveryId}/revision`, { method: 'POST', body: JSON.stringify({ size: newSize, photo: photo.data, reason, comment: comment.trim() || undefined, measuredWeightKg: parseFloat(String(kg).replace(',', '.')) || undefined }) });
      setRevision(rev);
      setPhase('wait');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Course à prix proposés : le livreur indique le prix minimum qu'il demande ; le serveur choisit le niveau suivant qui le couvre.
  const isOffers = delivery?.priceBreakdown?.mode === 'OFFERS';
  const submitPriceRequest = async () => {
    const asked = parseInt(minPrice, 10);
    if (!asked || asked <= (delivery?.priceXAF || 0)) { showToast(tr('Indique un montant supérieur au prix actuel.'), 'error'); return; }
    if (reason === 'AUTRE' && comment.trim().length < 5) { showToast(tr('Explique pourquoi (5 caractères minimum).'), 'error'); return; }
    if (reason !== 'AUTRE' && !photo) { showToast(tr('La photo du colis est obligatoire.'), 'error'); return; }
    setBusy(true);
    try {
      const rev = await api(`/deliveries/${deliveryId}/revision`, { method: 'POST', body: JSON.stringify({ reason, comment: comment.trim() || undefined, minPriceXAF: asked, photo: photo?.data }) });
      setRevision(rev);
      setPhase('wait');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitFlag = async () => {
    if (comment.trim().length < 5) { showToast(tr('Décris ce que tu as constaté (5 caractères minimum).'), 'error'); return; }
    setBusy(true);
    try {
      const r = await api(`/deliveries/${deliveryId}/reject`, { method: 'POST', body: JSON.stringify({ reason: flagKind, comment: comment.trim(), photo: photo?.data }) });
      if (r?.cancelled) {
        setEndedText(tr("Le colis est refusé et la course est annulée. KoliGo examine le dossier avec le vendeur."));
        setPhase('ended');
      } else {
        showToast(tr('Signalement envoyé à KoliGo. Tu peux continuer la course.'));
        setComment('');
        setPhoto(null);
        setPhase('check');
      }
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const declared = delivery?.size || null;
  const declaredInfo = declared ? gabarits[declared] : null;
  const photoSource = delivery?.hasPhoto
    ? { uri: `${BASE_URL}/deliveries/${deliveryId}/photo`, headers: { Authorization: `Bearer ${token}` } }
    : null;
  const secondsLeft = revision?.expiresAt ? Math.max(0, Math.floor((new Date(`${revision.expiresAt.replace(' ', 'T')}Z`).getTime() - now) / 1000)) : 0;

  if (phase === 'code') return <PickupStep navigation={navigation} route={route} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title={tr("Contrôle du colis")} onBack={() => navigation.goBack()} />

      {phase === 'loading' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.green} size="large" /></View>
      )}

      {phase === 'check' && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: '#0E2116', letterSpacing: -0.5 }}>{tr("Le colis est-il conforme ?")}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, lineHeight: 20 }}>
            Compare le colis avec ce que le vendeur a déclaré. Une fois le code de collecte saisi, le gabarit déclaré devient définitif : tu ne pourras plus demander de supplément.
          </Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8DCC8', gap: 8 }}>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.6 }}>{tr("Gabarit déclaré")}</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 30, color: '#0E2116' }}>{declared || '—'}</Text>
            {!!declaredInfo?.dims && <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink }}>{declaredInfo.dims} cm · jusqu'à {declaredInfo.maxKg} kg</Text>}
            {!!declaredInfo?.examples?.fr && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>{declaredInfo.examples.fr}</Text>}
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.green }}>Prix : {Money(delivery?.priceXAF)}</Text>
            {photoSource && <Image source={photoSource} style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.cream, marginTop: 4 }} resizeMode="cover" />}
          </View>
          <KGButton kind="primary" size="lg" icon="check" onPress={() => setPhase('code')}>{tr("Oui, conforme : prendre en charge")}</KGButton>
          <KGButton kind="soft" size="lg" icon="flag" onPress={() => setPhase('reason')}>{tr("Non conforme")}</KGButton>
        </ScrollView>
      )}

      {phase === 'reason' && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#0E2116' }}>{tr("Qu'est-ce qui ne va pas ?")}</Text>
          {REASONS.filter((r) => !r.offersOnly || isOffers).map((r) => (
            <TouchableOpacity key={r.id} activeOpacity={0.85}
              onPress={() => { setComment(''); setKg(''); setPhoto(null); if (r.next === 'correct') { setReason(r.id); setNewSize(null); setMinPrice(''); setPhase(isOffers ? 'price' : 'correct'); } else { setFlagKind(r.id); setPhase('flag'); } }}
              style={{ padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: r.danger ? '#E6B8A8' : colors.ink12, backgroundColor: r.danger ? '#FEF0E3' : '#fff' }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 15, color: r.danger ? '#B42318' : colors.ink }}>{tr(r.title)}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55, marginTop: 2 }}>{tr(r.sub)}</Text>
            </TouchableOpacity>
          ))}
          <KGButton kind="ghost" size="md" onPress={() => setPhase('check')}>{tr("Retour")}</KGButton>
        </ScrollView>
      )}

      {phase === 'price' && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#0E2116' }}>{tr('Demander un nouveau prix')}</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E8DCC8' }}>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>{tr('Prix actuel')}</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: colors.ink }}>{Money(delivery?.priceXAF)}</Text>
          </View>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, lineHeight: 20 }}>
            {tr("Indique le prix minimum que tu demandes pour prendre ce colis. KoliGo propose au vendeur le prochain prix qui le couvre ; il accepte ou annule la course.")}
          </Text>
          <KGInput label={tr('Prix minimum demandé (F)')} value={minPrice} onChangeText={(v) => setMinPrice(v.replace(/\D/g, ''))} keyboardType="numeric" placeholder="ex : 1500" />
          {reason === 'POIDS' && <KGInput label={tr("Poids constaté en kg (facultatif)")} value={kg} onChangeText={setKg} keyboardType="numeric" placeholder="ex : 12" />}
          <KGInput label={reason === 'AUTRE' ? tr('Explique pourquoi (obligatoire)') : tr('Commentaire (facultatif)')} value={comment} onChangeText={setComment} placeholder={tr('Ce que tu as constaté')} />
          {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 160, borderRadius: 14, backgroundColor: colors.cream }} resizeMode="cover" />}
          <KGButton kind={photo ? 'soft' : 'primary'} size="md" icon="camera" onPress={takePhoto}>{photo ? tr('Reprendre la photo') : (reason === 'AUTRE' ? tr('Ajouter une photo (facultatif)') : tr('Photographier le colis (obligatoire)'))}</KGButton>
          <KGButton kind="primary" size="lg" icon="send" disabled={busy || !minPrice} onPress={submitPriceRequest}>{busy ? tr('Envoi…') : tr('Envoyer la demande au vendeur')}</KGButton>
          <KGButton kind="ghost" size="md" onPress={() => setPhase('reason')}>{tr("Retour")}</KGButton>
        </ScrollView>
      )}

      {phase === 'flag' && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#0E2116' }}>{tr(REASONS.find((r) => r.id === flagKind)?.title || 'Signalement')}</Text>
          {(flagKind === 'INTERDIT' || flagKind === 'DANGEREUX') ? (
            <View style={{ backgroundColor: '#FEF0E3', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E6B8A8' }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13.5, color: '#B42318', lineHeight: 20 }}>
                {tr("Le colis sera refusé et la course annulée tout de suite. KoliGo examine le dossier. Ne prends pas ce colis.")}
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, lineHeight: 20 }}>
              {tr("La course continue. KoliGo est prévenu et vérifiera la valeur déclarée.")}
            </Text>
          )}
          <KGInput label={tr("Ce que tu as constaté (obligatoire)")} value={comment} onChangeText={setComment} placeholder={tr("Décris le contenu ou le problème")} />
          {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 160, borderRadius: 14, backgroundColor: colors.cream }} resizeMode="cover" />}
          <KGButton kind="soft" size="md" icon="camera" onPress={takePhoto}>{photo ? tr('Reprendre la photo') : tr('Ajouter une photo (recommandé)')}</KGButton>
          <KGButton kind="primary" size="lg" icon="send" disabled={busy || comment.trim().length < 5} onPress={submitFlag}>
            {busy ? tr('Envoi…') : (flagKind === 'VALEUR' ? tr('Signaler à KoliGo') : tr('Refuser le colis'))}
          </KGButton>
          <KGButton kind="ghost" size="md" onPress={() => setPhase('reason')}>{tr("Retour")}</KGButton>
        </ScrollView>
      )}

      {phase === 'correct' && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#0E2116' }}>{tr("Quel est le bon gabarit ?")}</Text>
          {Object.keys(gabarits).filter((c) => c !== declared && gabarits[c].bookable !== false).map((code) => {
            const g = gabarits[code];
            const on = newSize === code;
            return (
              <TouchableOpacity key={code} onPress={() => setNewSize(code)} activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: on ? colors.green : colors.ink12, backgroundColor: on ? '#EFF8F1' : '#fff' }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: on ? colors.green : colors.cream, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: on ? '#fff' : colors.ink }}>{code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink }}>{g.dims} cm · jusqu'à {g.maxKg} kg</Text>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{g.examples?.fr}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55, lineHeight: 18 }}>
            Pour un colis XXL (plus grand que XL), contacte le support KoliGo : ce gabarit se fait sur devis.
          </Text>
          {reason === 'POIDS' && <KGInput label={tr("Poids constaté en kg (facultatif)")} value={kg} onChangeText={setKg} keyboardType="numeric" placeholder="ex : 12" />}
          <KGInput label={tr("Commentaire (facultatif)")} value={comment} onChangeText={setComment} placeholder={tr("Ce que tu as constaté")} />
          {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 160, borderRadius: 14, backgroundColor: colors.cream }} resizeMode="cover" />}
          <KGButton kind={photo ? 'soft' : 'primary'} size="md" icon="camera" onPress={takePhoto}>{photo ? 'Reprendre la photo' : 'Photographier le colis (obligatoire)'}</KGButton>
          <KGButton kind="primary" size="lg" icon="send" disabled={!newSize || !photo || busy} onPress={submitCorrection}>
            {busy ? 'Envoi…' : 'Envoyer la correction au vendeur'}
          </KGButton>
          <KGButton kind="ghost" size="md" onPress={() => setPhase('reason')}>{tr("Retour")}</KGButton>
        </ScrollView>
      )}

      {phase === 'wait' && revision && (
        <View style={{ flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#0E2116', textAlign: 'center' }}>{tr("En attente du vendeur")}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21 }}>
            {revision.declaredSize ? `Gabarit ${revision.declaredSize} → ${revision.proposedSize}\n` : ''}
            Prix : {Money(revision.oldPriceXAF)} → {Money(revision.newPriceXAF)}
          </Text>
          <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 28, color: secondsLeft < 60 ? '#D8472A' : colors.ink }}>
            {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55, textAlign: 'center' }}>
            {tr("Sans réponse du vendeur, la course est annulée sans frais pour lui.")}
          </Text>
        </View>
      )}

      {phase === 'ended' && (
        <View style={{ flex: 1, padding: 24, gap: 18, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="flag" size={40} color="#D8472A" />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 15, color: colors.ink, textAlign: 'center', lineHeight: 22 }}>{endedText}</Text>
          <KGButton kind="primary" size="lg" onPress={() => navigation.navigate('DelivererApp')}>{tr("Retour aux courses")}</KGButton>
        </View>
      )}
    </SafeAreaView>
  );
}
