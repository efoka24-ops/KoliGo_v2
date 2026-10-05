import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { apiFetch } from '../../services/api';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';

// Facture d'une livraison : vente / paiement (vendeur), livraison (livreur) ou
// paiement du destinataire (public, sans compte). Les montants viennent du serveur.

const xaf = (n) => `${n < 0 ? '- ' : ''}${Math.abs(Number(n || 0)).toLocaleString('fr-FR')} XAF`;
const dateFr = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export function invoiceText(inv) {
  const L = [];
  L.push(`${inv.title.toUpperCase()} — KoliGo`, '--------------------------------');
  L.push(`N° : ${inv.number}`, `Date : ${dateFr(inv.issuedAt)}`, `Référence colis : ${inv.delivery.ref}`);
  L.push(`Trajet : ${inv.delivery.pickupAddress} -> ${inv.delivery.dropoffAddress}`, '');
  const party = (label, p) => p && L.push(`${label} : ${[p.shopName || p.name, p.phone].filter(Boolean).join(' · ')}`);
  party('Vendeur', inv.vendor);
  party('Destinataire', inv.recipient);
  party('Livreur', inv.deliverer);
  L.push('');
  inv.lines.forEach(l => L.push(`${l.label} : ${xaf(l.amountXAF)}`));
  L.push(`TOTAL : ${xaf(inv.total)}`);
  if (inv.payment) {
    L.push('', `Paiement : ${inv.payment.method} — ${inv.payment.status}`);
    if (inv.payment.reference) L.push(`Référence : ${inv.payment.reference}`);
    if (inv.payment.payerPhone) L.push(`Numéro payeur : ${inv.payment.payerPhone}`);
    if (inv.payment.paidAt) L.push(`Payé le : ${dateFr(inv.payment.paidAt)}`);
  }
  (inv.notes || []).forEach(n => L.push('', n));
  L.push('', inv.disclaimer);
  return L.join('\n');
}

function Row({ label, value, bold }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: 'right', fontFamily: `${fonts.ui}-${bold ? 'Bold' : 'SemiBold'}`, fontSize: 13, color: colors.ink }}>{value}</Text>
    </View>
  );
}

function Block({ title, children }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E8DCC8', padding: 14, gap: 2 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 10.5, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{title}</Text>
      {children}
    </View>
  );
}

export default function InvoiceScreen({ navigation, route }) {
  const { deliveryId, type, publicMode } = route?.params || {};
  const { api } = useApp();
  const [inv, setInv] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = publicMode
          ? await apiFetch(`/deliveries/${deliveryId}/public-invoice`)
          : await api(`/api/deliveries/${deliveryId}/invoice/${type}`);
        if (!alive) return;
        if (!data) throw new Error('Facture introuvable.');
        setInv(data);
      } catch (e) {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Impossible de charger la facture.');
      }
    })();
    return () => { alive = false; };
  }, [deliveryId, type, publicMode, api]);

  const share = () => inv && Share.share({ message: invoiceText(inv), title: inv.number }).catch(() => {});

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title={inv?.title || 'Facture'} onBack={() => navigation.goBack()} />
      {!inv && !error && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.green} /></View>}
      {error && (
        <View style={{ padding: 24 }}>
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16 }}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: '#D8472A', lineHeight: 20 }}>{error}</Text>
          </View>
        </View>
      )}
      {inv && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* En-tete */}
          <View style={{ backgroundColor: colors.green, borderRadius: 18, padding: 18, gap: 4 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#fff' }}>Koli<Text style={{ color: '#ffcb72' }}>Go</Text></Text>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 16, color: '#fff', marginTop: 4 }}>{inv.title}</Text>
            <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>N° {inv.number}</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{dateFr(inv.issuedAt)}</Text>
          </View>

          <Block title="Colis">
            <Row label="Référence" value={inv.delivery.ref} bold />
            <Row label="De" value={inv.delivery.pickupAddress} />
            <Row label="À" value={inv.delivery.dropoffAddress} />
            <Row label="Description" value={inv.delivery.description} />
            <Row label="Poids" value={inv.delivery.weightKg ? `${inv.delivery.weightKg} kg` : null} />
          </Block>

          <Block title="Parties">
            <Row label="Vendeur" value={[inv.vendor?.shopName || inv.vendor?.name, inv.vendor?.phone].filter(Boolean).join(' · ')} />
            <Row label="Destinataire" value={[inv.recipient?.name, inv.recipient?.phone].filter(Boolean).join(' · ')} />
            <Row label="Livreur" value={[inv.deliverer?.name, inv.deliverer?.phone].filter(Boolean).join(' · ')} />
          </Block>

          <Block title="Détail">
            {inv.lines.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F5F0E8' }}>
                <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink, lineHeight: 18 }}>{l.label}</Text>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: l.amountXAF < 0 ? '#D8472A' : colors.ink }}>{xaf(l.amountXAF)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: colors.ink }}>TOTAL</Text>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.greenDark }}>{xaf(inv.total)}</Text>
            </View>
          </Block>

          {inv.payment && (
            <Block title="Paiement">
              <Row label="Mode" value={inv.payment.method} />
              <Row label="Statut" value={inv.payment.status} bold />
              <Row label="Référence" value={inv.payment.reference} />
              <Row label="Transaction" value={inv.payment.transactionId} />
              <Row label="Numéro payeur" value={inv.payment.payerPhone} />
              <Row label="Payé le" value={inv.payment.paidAt ? dateFr(inv.payment.paidAt) : null} />
            </Block>
          )}

          {(inv.notes || []).map((n, i) => (
            <Text key={i} style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink70, lineHeight: 18 }}>{n}</Text>
          ))}
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35, lineHeight: 16 }}>{inv.disclaimer}</Text>

          <KGButton kind="primary" size="lg" icon="send" onPress={share}>Partager la facture</KGButton>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
