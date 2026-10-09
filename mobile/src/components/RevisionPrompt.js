import { tr } from '../i18n/tr';
import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { colors, fonts } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { BASE_URL } from '../services/api';
import { errMsg } from '../utils/apiError';
import KGButton from './KGButton';

const Money = (n) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`;

/**
 * Le livreur propose un autre gabarit à la collecte : le vendeur voit le nouveau prix et la photo du livreur,
 * puis accepte ou refuse. Refuser annule la course et verse les frais d'annulation au livreur (CGU, article 9).
 */
export default function RevisionPrompt({ deliveryId, revision, onDone }) {
  const { api, token, pricing, showToast } = useApp();
  const [busy, setBusy] = useState(null);
  const [now, setNow] = useState(Date.now());
  const fee = pricing?.cancelFeeXAF ?? 500;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!revision || revision.status !== 'PENDING') return null;

  const left = Math.max(0, Math.floor((new Date(`${revision.expiresAt.replace(' ', 'T')}Z`).getTime() - now) / 1000));
  const respond = async (accept) => {
    setBusy(accept ? 'yes' : 'no');
    try {
      await api(`/deliveries/${deliveryId}/revision`, { method: 'PATCH', body: JSON.stringify({ accept }) });
      showToast(accept ? 'Nouveau prix accepté' : `Course annulée · ${Money(fee)} versés au livreur`);
      onDone?.();
    } catch (e) {
      showToast(errMsg(e), 'error');
      onDone?.();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ margin: 16, backgroundColor: '#FFF8E3', borderRadius: 18, borderWidth: 1.5, borderColor: '#D4991A', padding: 16, gap: 10 }}>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 18, color: '#0E2116' }}>{tr("Le livreur corrige le gabarit")}</Text>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink, lineHeight: 21 }}>
        Gabarit {revision.declaredSize} → {revision.proposedSize}{'\n'}
        Prix : {Money(revision.oldPriceXAF)} → {Money(revision.newPriceXAF)}
      </Text>
      <Image
        source={{ uri: `${BASE_URL}/deliveries/${deliveryId}/photo?kind=revision`, headers: { Authorization: `Bearer ${token}` } }}
        style={{ width: '100%', height: 170, borderRadius: 12, backgroundColor: colors.cream }}
        resizeMode="cover"
      />
      <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 13, color: left < 60 ? '#D8472A' : colors.ink55 }}>
        Répondez avant {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')} — sans réponse, la course est annulée sans frais.
      </Text>
      <KGButton kind="primary" size="lg" icon="check" disabled={!!busy} onPress={() => respond(true)}>
        {busy === 'yes' ? '…' : `Accepter le nouveau prix (${Money(revision.newPriceXAF)})`}
      </KGButton>
      <KGButton kind="soft" size="lg" disabled={!!busy} onPress={() => respond(false)}>
        {busy === 'no' ? '…' : `Refuser et annuler (${Money(fee)} de frais)`}
      </KGButton>
    </View>
  );
}
