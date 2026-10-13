import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, fonts } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { errMsg } from '../utils/apiError';
import { tr } from '../i18n/tr';
import KGButton from './KGButton';
import KGInput from './KGInput';
import Icon from './Icon';

const POLL_MS = 4000;
const MAX_POLLS = 45; // ~3 minutes : le temps laissé à l'acheteur pour valider avec son code Mobile Money

/** Position du livreur à l'arrivée : facultative, jamais bloquante. */
export async function currentPosition() {
  try {
    const Location = require('expo-location');
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const p = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    return p ? { latitude: p.coords.latitude, longitude: p.coords.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * Flux à un seul code. À l'arrivée, le livreur saisit le code que lui donne l'acheteur et le numéro Mobile Money
 * de l'acheteur. Le serveur vérifie le code, lance le prélèvement, confirme la livraison à la réception du paiement
 * et crédite le livreur.
 */
export default function CollectPaymentModal({ visible, deliveryId, amount, onClose, onDone }) {
  const { api, showToast } = useApp();
  const [step, setStep] = useState('form'); // form | pending | failed
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (visible) { setStep('form'); setCode(''); setPhone(''); setError(null); } }, [visible]);

  const poll = useCallback(async () => {
    for (let i = 0; i < MAX_POLLS && alive.current; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (!alive.current) return;
      try {
        const r = await api(`/deliveries/${deliveryId}/charge-status`);
        if (r?.status === 'success') { onDone?.(); return; }
        if (r?.status === 'failed') { setStep('failed'); return; }
      } catch { /* réseau : on réessaie */ }
    }
    if (alive.current) { setStep('failed'); setError(tr("Pas de confirmation du paiement. Vérifie avec l'acheteur, puis réessaie.")); }
  }, [api, deliveryId, onDone]);

  const submit = async () => {
    setError(null);
    if (code.length !== 4) { setError(tr('Le code de réception a 4 chiffres.')); return; }
    if (phone.replace(/\D/g, '').length < 9) { setError(tr('Saisis le numéro Mobile Money de l\'acheteur (9 chiffres).')); return; }
    setBusy(true);
    try {
      await api(`/deliveries/${deliveryId}/charge`, { method: 'POST', body: JSON.stringify({ code, phone }) });
      setStep('pending');
      poll();
    } catch (e) {
      setError(errMsg(e, tr('Impossible de lancer le paiement.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => step !== 'pending' && onClose?.()}>
      <View style={{ flex: 1, backgroundColor: 'rgba(14,33,22,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 }}>
          {step === 'form' && (
            <>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink }}>{tr('Livraison chez l\'acheteur')}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, lineHeight: 20 }}>
                {tr('Demande à l\'acheteur son code de réception et son numéro Mobile Money. Le colis est conforme, le paiement est prélevé sur son numéro.')}
              </Text>
              <View style={{ backgroundColor: colors.greenLight, borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.greenDark }}>{tr('Montant à payer')}</Text>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.greenDark }}>{Number(amount || 0).toLocaleString('fr-FR')} XAF</Text>
              </View>
              <KGInput label={tr('Code de réception de l\'acheteur')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="••••" />
              <KGInput label={tr('Numéro Mobile Money de l\'acheteur')} value={phone} suffix="+237" onChangeText={(v) => setPhone(v.replace(/[^\d ]/g, ''))} keyboardType="phone-pad" placeholder="6 XX XX XX XX" />
              {!!error && <Text style={{ color: '#C00', fontSize: 13 }}>{error}</Text>}
              <KGButton kind="primary" size="lg" icon="check" disabled={busy} onPress={submit}>{busy ? tr('Vérification…') : tr('Confirmer et lancer le paiement')}</KGButton>
              <KGButton kind="ghost" size="md" onPress={onClose}>{tr('Annuler')}</KGButton>
            </>
          )}

          {step === 'pending' && (
            <View style={{ alignItems: 'center', gap: 14, paddingVertical: 18 }}>
              <ActivityIndicator color={colors.green} size="large" />
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink, textAlign: 'center' }}>{tr('En attente du paiement')}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, textAlign: 'center', lineHeight: 20 }}>
                {tr('L\'acheteur reçoit une demande sur son téléphone : il doit saisir son code Mobile Money pour valider. Ne remets pas le colis avant la confirmation.')}
              </Text>
            </View>
          )}

          {step === 'failed' && (
            <View style={{ alignItems: 'center', gap: 14, paddingVertical: 10 }}>
              <Icon name="flag" size={36} color="#D8472A" />
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink, textAlign: 'center' }}>{tr('Paiement non confirmé')}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, textAlign: 'center', lineHeight: 20 }}>
                {error || tr('Le paiement a été refusé ou n\'a pas abouti. Tu peux réessayer, avec le même numéro ou un autre.')}
              </Text>
              <KGButton kind="primary" size="lg" onPress={() => { setStep('form'); setError(null); }}>{tr('Réessayer')}</KGButton>
              <TouchableOpacity onPress={onClose}><Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink55 }}>{tr('Fermer')}</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
