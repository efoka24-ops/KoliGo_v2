import React from 'react';
import { View, Text, TouchableOpacity, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function ReceptionSuccessScreen({ navigation, route }) {
  const { priceXAF = 0, delivery, transactionId, clientToken } = route?.params ?? {};

  const fmt = (n) => (n ?? 0).toLocaleString('fr-FR');
  const delivererName = delivery?.deliverer?.name ?? 'Le livreur';
  const from   = delivery?.pickupAddress ?? '';
  const to     = delivery?.dropoffAddress ?? '';
  const commXAF     = delivery?.commissionXAF ?? 0;
  const deliverEarn = delivery?.delivererEarning ?? 0;

  const downloadReceipt = async () => {
    const msg =
      `🧾 *Reçu KoliGo*\n\n` +
      `Livraison : ${from} → ${to}\n` +
      `Montant payé : ${fmt(priceXAF)} XAF\n` +
      (transactionId ? `Réf. transaction : ${transactionId}\n` : '') +
      `Livreur : ${delivererName}\n\n` +
      `Merci d\'avoir utilisé KoliGo ! 🚀`;
    try { await Share.share({ message: msg, title: 'Reçu KoliGo' }); } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F5F1' }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: 24, gap: 18 }}>

        {/* Success icon */}
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
          <View style={s.checkCircle}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>
          <Text style={s.title}>Livraison confirmée !</Text>
          <Text style={s.sub}>Votre colis a bien été réceptionné et payé.</Text>
        </View>

        {/* Amount card */}
        <View style={s.amountCard}>
          <Text style={s.amountLabel}>Montant payé</Text>
          <Text style={s.amountValue}>{fmt(priceXAF)} <Text style={s.amountCur}>XAF</Text></Text>
          {from || to ? <Text style={s.amountRoute}>{from} → {to}</Text> : null}
        </View>

        {/* Répartition */}
        {(commXAF > 0 || deliverEarn > 0) && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>Répartition</Text>
            <View style={s.splitRow}>
              <View style={[s.pill, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[s.pillTxt, { color: '#166534' }]}>Livreur</Text>
              </View>
              <Text style={s.splitAmt}>{fmt(deliverEarn)} XAF</Text>
            </View>
            <View style={s.splitRow}>
              <View style={[s.pill, { backgroundColor: '#FFF3E0' }]}>
                <Text style={[s.pillTxt, { color: '#92400E' }]}>KoliGo · plateforme</Text>
              </View>
              <Text style={s.splitAmt}>{fmt(commXAF)} XAF</Text>
            </View>
          </View>
        )}

        {/* Ref */}
        {transactionId && (
          <View style={{ backgroundColor: '#F8F8F8', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="receipt-outline" size={14} color="#888" />
            <Text style={{ fontSize: 11, color: '#888', flex: 1 }} numberOfLines={1}>Réf : {transactionId}</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Actions */}
        <TouchableOpacity onPress={downloadReceipt} style={s.btnOutline}>
          <Ionicons name="download-outline" size={18} color="#178A3C" />
          <Text style={s.btnOutlineTxt}>Télécharger le reçu</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[s.btnAction, { backgroundColor: '#178A3C' }]}
            onPress={() => navigation.navigate('ClientRating', { clientToken, delivererName })}
          >
            <Ionicons name="star" size={16} color="#fff" />
            <Text style={s.btnActionTxt}>Noter le livreur</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btnAction, { backgroundColor: '#DC2626' }]}
            onPress={() => navigation.navigate('ClientReportIssue', { clientToken })}
          >
            <Ionicons name="alert-circle" size={16} color="#fff" />
            <Text style={s.btnActionTxt}>Signaler</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.popToTop()} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ fontSize: 14, color: '#888' }}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  checkCircle:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#178A3C', alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 24, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  sub:          { fontSize: 14, color: '#666', textAlign: 'center' },
  amountCard:   { backgroundColor: '#F0FFF4', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#BBF7D0' },
  amountLabel:  { fontSize: 12, fontWeight: '600', color: '#166534' },
  amountValue:  { fontSize: 42, fontWeight: '800', color: '#166534', marginTop: 4, lineHeight: 48 },
  amountCur:    { fontSize: 18, fontWeight: '400' },
  amountRoute:  { fontSize: 12, color: '#166534', opacity: 0.7, marginTop: 4 },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  splitRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill:         { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  pillTxt:      { fontSize: 12, fontWeight: '600' },
  splitAmt:     { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  btnOutline:   { borderRadius: 14, borderWidth: 2, borderColor: '#178A3C', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff' },
  btnOutlineTxt:{ fontSize: 15, fontWeight: '700', color: '#178A3C' },
  btnAction:    { flex: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnActionTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
