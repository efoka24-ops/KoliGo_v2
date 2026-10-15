import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, ActivityIndicator, TouchableOpacity } from 'react-native';
import { BASE_URL } from '../services/api';
import { colors, fonts } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n/tr';
import KGButton from './KGButton';
import KGInput from './KGInput';

export const CATEGORY_LABELS = {
  ELECTRONICS: 'Électronique', CLOTHING: 'Vêtements', FOOD: 'Alimentation', HOME: 'Maison', BEAUTY: 'Beauté',
  BOOKS: 'Livres', AUTO: 'Auto & moto', OTHER: 'Autre',
};

/** Source d'image d'une annonce (route publique : aucune authentification requise). */
export function adPhoto(id, n = 0, token) {
  return { uri: `${BASE_URL}/public/ads/${id}/photo/${n}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}

export function timeLeft(seconds) {
  if (!seconds || seconds <= 0) return tr('Expirée');
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

export const money = (n) => `${Number(n || 0).toLocaleString('fr-FR')} F`;

/**
 * Choix de la visibilité : Flash gratuit (24 h) ou Boost (durée au choix, payant).
 * value = { type: 'FLASH' } ou { type: 'BOOST', days }.
 */
export function DurationPicker({ config, value, onChange }) {
  const tariffs = config?.tariffs || [];
  const row = (active, title, sub, price, onPress, key) => (
    <TouchableOpacity key={key} onPress={onPress} activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: active ? colors.green : colors.ink12, backgroundColor: active ? '#EFF8F1' : '#fff' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? colors.green : colors.ink12, alignItems: 'center', justifyContent: 'center' }}>
        {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{sub}</Text>
      </View>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 15, color: price === 0 ? colors.green : colors.ink }}>{price === 0 ? tr('Gratuit') : money(price)}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ gap: 8 }}>
      {row(value?.type === 'FLASH', `⚡ ${tr('Flash · 24 heures')}`, tr('Disparaît tout seul, comme un statut'), 0, () => onChange({ type: 'FLASH' }), 'flash')}
      {tariffs.map((t) => row(value?.type === 'BOOST' && value.days === t.days, `${tr('Boost')} · ${t.days} ${tr('jours')}`, tr('Mis en avant en haut du fil'), t.priceXAF, () => onChange({ type: 'BOOST', days: t.days }), `b${t.days}`))}
    </View>
  );
}

/**
 * Attente du paiement Mobile Money d'un Boost : l'annonce n'est en ligne qu'à la confirmation du fournisseur.
 * onDone('success' | 'failed') est appelé une seule fois.
 */
export function AdPaymentWait({ visible, adId, amount, onDone }) {
  const { api } = useApp();
  const alive = useRef(true);
  const finished = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const finish = useCallback((r) => { if (!finished.current) { finished.current = true; onDone?.(r); } }, [onDone]);

  useEffect(() => {
    if (!visible || !adId) return undefined;
    finished.current = false;
    setTimedOut(false);
    let stop = false;
    (async () => {
      for (let i = 0; i < 45 && alive.current && !stop; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        if (!alive.current || stop) return;
        try {
          const r = await api(`/ads/${adId}/payment-status`);
          if (r?.status === 'success') { finish('success'); return; }
          if (r?.status === 'failed') { finish('failed'); return; }
        } catch { /* réseau : on réessaie */ }
      }
      if (alive.current && !stop) setTimedOut(true);
    })();
    return () => { stop = true; };
  }, [visible, adId, api, finish]);

  return (
    <Modal visible={!!visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(14,33,22,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 14, alignItems: 'center', width: '100%' }}>
          {!timedOut ? <ActivityIndicator color={colors.green} size="large" /> : null}
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink, textAlign: 'center' }}>{timedOut ? tr('Paiement non confirmé') : tr('En attente du paiement')}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, textAlign: 'center', lineHeight: 20 }}>
            {timedOut
              ? tr("Nous n'avons pas reçu la confirmation. Si tu as été débité, ton annonce se mettra en ligne dès sa réception ; sinon, réessaie.")
              : `${tr('Valide le paiement de')} ${money(amount)} ${tr('sur ton téléphone avec ton code Mobile Money. Ton annonce se met en ligne dès la confirmation.')}`}
          </Text>
          {timedOut ? <KGButton kind="primary" size="md" onPress={() => finish('timeout')}>{tr('Fermer')}</KGButton> : null}
        </View>
      </View>
    </Modal>
  );
}

/** Demande du numéro Mobile Money pour payer un Boost. */
export function PhoneModal({ visible, amount, onCancel, onConfirm }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => { if (visible) { setPhone(''); setError(null); } }, [visible]);
  const ok = () => {
    const d = phone.replace(/\D/g, '').replace(/^237(?=\d{9}$)/, '');
    if (!/^6\d{8}$/.test(d)) { setError(tr('Numéro invalide (format : 6XXXXXXXX)')); return; }
    onConfirm(d);
  };
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(14,33,22,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink }}>{tr('Payer le Boost')}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55 }}>{`${tr('Montant')} : ${money(amount)}. ${tr('Une demande de paiement arrive sur ce numéro Mobile Money.')}`}</Text>
          <KGInput label={tr('Numéro Mobile Money')} value={phone} suffix="+237" onChangeText={(v) => setPhone(v.replace(/[^\d ]/g, ''))} keyboardType="phone-pad" placeholder="6 XX XX XX XX" />
          {!!error && <Text style={{ color: '#C00', fontSize: 13 }}>{error}</Text>}
          <KGButton kind="primary" size="lg" onPress={ok}>{tr('Payer')}</KGButton>
          <KGButton kind="ghost" size="md" onPress={onCancel}>{tr('Annuler')}</KGButton>
        </View>
      </View>
    </Modal>
  );
}
