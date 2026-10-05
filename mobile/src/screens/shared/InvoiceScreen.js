import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { apiFetch } from '../../services/api';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';

// Facture d'une livraison. Trois documents differents, rendus de facon generique :
// emetteur / facture a, blocs de details propres au type (vente, recu de paiement,
// releve de course du livreur), lignes et total. Tout vient du serveur.

const xaf = (n) => `${n < 0 ? '- ' : ''}${Math.abs(Number(n || 0)).toLocaleString('fr-FR')} XAF`;
const dateFr = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const rowValue = (r) => (r.date ? dateFr(r.value) : r.value);
const partyLine = (p) => [p?.name, p?.subname, p?.phone].filter(Boolean).join(' · ');

export function invoiceText(inv) {
  const L = [`${inv.title.toUpperCase()} — KoliGo`, '--------------------------------'];
  L.push(`N° : ${inv.number}`, `Date : ${dateFr(inv.issuedAt)}`, `Référence colis : ${inv.delivery.ref}`, '');
  L.push(`${inv.issuer.label} : ${partyLine(inv.issuer)}`, `${inv.billedTo.label} : ${partyLine(inv.billedTo)}`, '');
  (inv.details || []).forEach((b) => {
    L.push(b.title.toUpperCase());
    b.rows.forEach((r) => L.push(`${r.label} : ${rowValue(r)}`));
    L.push('');
  });
  inv.lines.forEach((l) => L.push(`${l.label} : ${xaf(l.amountXAF)}`));
  L.push(`${inv.totalLabel || 'TOTAL'} : ${xaf(inv.total)}`, '', inv.disclaimer);
  return L.join('\n');
}

function Row({ label, value, bold }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
      <Text style={{ flexShrink: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: 'right', fontFamily: `${fonts.ui}-${bold ? 'Bold' : 'SemiBold'}`, fontSize: 13, color: colors.ink }}>{value}</Text>
    </View>
  );
}

function Block({ title, accent, children }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E8DCC8', borderLeftWidth: 4, borderLeftColor: accent, padding: 14, gap: 2 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 10.5, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{title}</Text>
      {children}
    </View>
  );
}

function Party({ party, accent }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E8DCC8', padding: 12 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 10, color: accent, textTransform: 'uppercase', letterSpacing: 0.6 }}>{party.label}</Text>
      <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14.5, color: colors.ink, marginTop: 4 }}>{party.name || '—'}</Text>
      {!!party.subname && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>{party.subname}</Text>}
      {!!party.phone && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>{party.phone}</Text>}
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
  const accent = inv?.accent || colors.green;

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
          {/* En-tete : couleur propre a chaque type de facture */}
          <View style={{ backgroundColor: accent, borderRadius: 18, padding: 18, gap: 4 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#fff' }}>Koli<Text style={{ color: '#ffcb72' }}>Go</Text></Text>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 17, color: '#fff', marginTop: 4 }}>{inv.title}</Text>
            <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>N° {inv.number}</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{dateFr(inv.issuedAt)} · Colis {inv.delivery.ref}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Party party={inv.issuer} accent={accent} />
            <Party party={inv.billedTo} accent={accent} />
          </View>

          {(inv.details || []).map((b) => (
            <Block key={b.title} title={b.title} accent={accent}>
              {b.rows.map((r, i) => <Row key={i} label={r.label} value={rowValue(r)} bold={r.bold} />)}
            </Block>
          ))}

          <Block title="Montants" accent={accent}>
            {inv.lines.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F5F0E8' }}>
                <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink, lineHeight: 18 }}>{l.label}</Text>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: l.amountXAF < 0 ? '#D8472A' : colors.ink }}>{xaf(l.amountXAF)}</Text>
              </View>
            ))}
            <View style={{ paddingTop: 10, gap: 2 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.ink55 }}>{inv.totalLabel || 'TOTAL'}</Text>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: accent === '#0E2A1C' ? colors.greenDark : accent }}>{xaf(inv.total)}</Text>
            </View>
          </Block>

          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35, lineHeight: 16 }}>{inv.disclaimer}</Text>
          <KGButton kind="primary" size="lg" icon="send" onPress={share}>Partager la facture</KGButton>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
