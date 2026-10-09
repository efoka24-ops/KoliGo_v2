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
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

function DigitBox({ digit, active }) {
  const filled = digit !== '';
  return (
    <View style={{
      width: 60, height: 72, borderRadius: 16,
      borderWidth: 2,
      borderColor: active ? colors.green : filled ? '#C4611A' : colors.ink12,
      backgroundColor: filled ? '#FEF0E3' : colors.cream,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: '#C4611A' }}>{digit}</Text>
    </View>
  );
}

function NumPad({ onPress, onBack }) {
  return (
    <View style={{ gap: 10 }}>
      {[[1,2,3],[4,5,6],[7,8,9]].map(row => (
        <View key={row[0]} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => onPress(String(n))}
              style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 24, color: colors.ink }}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => onPress('0')}
          style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 24, color: colors.ink }}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onBack}
          style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="back" size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CodeStep({ navigation, route }) {
  const { token } = useApp();
  const deliveryId = route?.params?.deliveryId;
  const [code, setCode]       = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const pressDigit = (digit) => {
    if (loading) return;
    setError(null);
    setCode(prev => {
      const i = prev.findIndex(x => x === '');
      if (i === -1) return prev;
      const next = [...prev];
      next[i] = digit;
      if (i === 3) {
        const finalCode = [...next].join('');
        setTimeout(() => confirmCollect(finalCode), 80);
      }
      return next;
    });
  };

  const backspace = () => {
    if (loading) return;
    setCode(prev => {
      const next = [...prev];
      for (let i = 3; i >= 0; i--) {
        if (next[i] !== '') { next[i] = ''; break; }
      }
      return next;
    });
  };

  const confirmCollect = async (finalCode) => {
    if (!deliveryId) {
      navigation.navigate('Waiting');
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/deliveries/${deliveryId}/confirm-collect`, {
        method: 'PATCH',
        body: JSON.stringify({ collectCode: finalCode }),
      }, token);
      navigation.navigate('Waiting', { deliveryId });
    } catch (e) {
      setCode(['', '', '', '']);
      setError(errMsg(e, 'Code invalide, réessaie.'));
    } finally {
      setLoading(false);
    }
  };

  const filled = code.filter(d => d !== '').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title={tr("Code de collecte")} onBack={() => navigation.goBack()} />

      <View style={{ flex: 1, padding: 24, gap: 0 }}>
        <View style={{ marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={{ backgroundColor: '#FEF0E3', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 12, color: '#C4611A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {tr("Chez le vendeur")}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', letterSpacing: -0.5 }}>
            {tr("Code de collecte")}
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, marginTop: 6, lineHeight: 20 }}>
            {tr("Demande le code 4 chiffres au vendeur pour confirmer la prise en charge du colis.")}
          </Text>
        </View>

        {/* Code display */}
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
          {code.map((d, i) => (
            <DigitBox key={i} digit={d} active={i === filled && filled < 4} />
          ))}
        </View>

        {error && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <Icon name="flag" size={16} color="#D8472A" />
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#D8472A' }}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={colors.green} size="large" />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, marginTop: 8 }}>
              {tr("Vérification…")}
            </Text>
          </View>
        ) : (
          <NumPad onPress={pressDigit} onBack={backspace} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Contrôle de conformité du colis, avant la saisie du code de collecte ────────────────────────
// Le livreur confirme que le colis correspond au gabarit déclaré, ou propose un autre gabarit avec une
// photo. Le vendeur répond dans l'application ; sans réponse dans le délai, la course est annulée sans frais.
const Money = (n) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`;

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
      const rev = await api(`/deliveries/${deliveryId}/revision`, { method: 'POST', body: JSON.stringify({ size: newSize, photo: photo.data }) });
      setRevision(rev);
      setPhase('wait');
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

  if (phase === 'code') return <CodeStep navigation={navigation} route={route} />;

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
          <KGButton kind="primary" size="lg" icon="check" onPress={() => setPhase('code')}>{tr("Oui, conforme : saisir le code")}</KGButton>
          <KGButton kind="soft" size="lg" icon="flag" onPress={() => setPhase('correct')}>{tr("Non, corriger le gabarit")}</KGButton>
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
          {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 160, borderRadius: 14, backgroundColor: colors.cream }} resizeMode="cover" />}
          <KGButton kind={photo ? 'soft' : 'primary'} size="md" icon="camera" onPress={takePhoto}>{photo ? 'Reprendre la photo' : 'Photographier le colis (obligatoire)'}</KGButton>
          <KGButton kind="primary" size="lg" icon="send" disabled={!newSize || !photo || busy} onPress={submitCorrection}>
            {busy ? 'Envoi…' : 'Envoyer la correction au vendeur'}
          </KGButton>
          <KGButton kind="ghost" size="md" onPress={() => setPhase('check')}>{tr("Retour")}</KGButton>
        </ScrollView>
      )}

      {phase === 'wait' && revision && (
        <View style={{ flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#0E2116', textAlign: 'center' }}>{tr("En attente du vendeur")}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21 }}>
            Gabarit {revision.declaredSize} → {revision.proposedSize}{'\n'}
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
