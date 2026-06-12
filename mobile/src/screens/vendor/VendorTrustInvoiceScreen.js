import React, { useState, useEffect } from 'react';
import { View, Text, Share, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, ScreenHeader, Card, Button } from '../../components';
import { colors, type } from '../../theme';
import { useApp } from '../../context/AppContext';

function Row({ label, value, icon }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        {icon && <Ionicons name={icon} size={14} color={colors.muted} style={{ marginRight: 6 }} />}
        <Text style={[type.eyebrow, { color: colors.muted }]}>{label}</Text>
      </View>
      <Text style={styles.rowVal}>{value ?? 'Non renseigné'}</Text>
    </View>
  );
}

export default function VendorTrustInvoiceScreen({ navigation, route }) {
  const { deliveryId } = route?.params ?? {};
  const { api } = useApp();
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deliveryId || !api) { setLoading(false); return; }
    api(`/api/deliveries/${deliveryId}/trust-invoice`)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message ?? 'Erreur'); setLoading(false); });
  }, [deliveryId, api]);

  const fmt = (n) => (n ?? 0).toLocaleString('fr-FR');

  const handleShare = async () => {
    if (!data) return;
    const msg =
      `📋 *KoliGo — Facture de confiance*\n\n` +
      `Livraison : ${data.pickupAddress} → ${data.dropoffAddress}\n` +
      `Montant : ${fmt(data.priceXAF)} XAF (payé à la réception)\n\n` +
      `*Votre livreur :*\n` +
      `• Nom : ${data.deliverer.name}\n` +
      `• Tél : +237 ${data.deliverer.phone}\n` +
      `• CNI : ${data.deliverer.cniNumber}\n` +
      `• Quartier : ${data.deliverer.quartier}\n\n` +
      `_Ce document vous est fourni par KoliGo pour votre sécurité._`;
    try { await Share.share({ message: msg, title: 'Facture de confiance KoliGo' }); } catch {}
  };

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Facture de confiance" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <ScreenHeader title="Facture de confiance" onBack={() => navigation.goBack()} />
        <View style={{ padding: 24, alignItems: 'center', gap: 12 }}>
          <Ionicons name="alert-circle" size={48} color={colors.error ?? '#DC2626'} />
          <Text style={[type.h3, { textAlign: 'center' }]}>{error ?? 'Données indisponibles'}</Text>
          <Text style={[type.lead, { textAlign: 'center', color: colors.muted }]}>
            La facture de confiance sera disponible dès qu'un livreur a accepté votre annonce.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Facture de confiance" onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 12 }}>

        {/* Header badge */}
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={22} color={colors.greenDark} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: colors.greenDark }}>Document de confiance KoliGo</Text>
            <Text style={{ fontSize: 12, color: colors.greenDark, opacity: 0.7 }}>Identité du livreur assigné à votre colis</Text>
          </View>
        </View>

        {/* Deliverer info */}
        <Card>
          <Text style={[type.eyebrow, { marginBottom: 12 }]}>Livreur</Text>
          <Row label="Nom"     value={data.deliverer.name}      icon="person" />
          <Row label="Téléphone" value={`+237 ${data.deliverer.phone}`} icon="call" />
          <Row label="N° CNI"  value={data.deliverer.cniNumber}  icon="card" />
          <Row label="Quartier" value={data.deliverer.quartier}  icon="location" />
        </Card>

        {/* Delivery summary */}
        <Card>
          <Text style={[type.eyebrow, { marginBottom: 12 }]}>Livraison</Text>
          <Row label="Départ"      value={data.pickupAddress} />
          <Row label="Destination" value={data.dropoffAddress} />
          <Row label="Montant"     value={`${fmt(data.priceXAF)} XAF (payé à la réception)`} />
        </Card>

        {/* Disclaimer */}
        <View style={{ backgroundColor: '#F0FFF4', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8 }}>
          <Ionicons name="information-circle" size={16} color={colors.greenDark} />
          <Text style={{ fontSize: 11.5, color: colors.greenDark, flex: 1, lineHeight: 17, opacity: 0.85 }}>
            Ce document a été généré par KoliGo. Envoyez-le au destinataire pour qu'il puisse vérifier l'identité du livreur avant de payer.
          </Text>
        </View>

        <Button title="Envoyer au destinataire" onPress={handleShare} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#E8F5E9', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.greenDark + '33',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.line2 ?? '#F0F0F0',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowVal:  { fontSize: 13.5, fontWeight: '600', color: colors.ink, maxWidth: '60%', textAlign: 'right' },
});
