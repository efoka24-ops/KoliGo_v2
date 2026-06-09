import React from 'react';
import { View, Text, ScrollView, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import { kgSplitPayment } from '../constants/data';
import { useApp } from '../context/AppContext';
import KGTopBar from '../components/KGTopBar';
import KGButton from '../components/KGButton';
import KGReceipt from '../components/KGReceipt';
import Icon from '../components/Icon';

export default function ClientReceptionSuccessScreen({ navigation, route }) {
  const params = route?.params || {};
  const { showToast } = useApp();

  const merchandise = params.merchandise || 0;
  const delivery = params.delivery || 0;
  const split = kgSplitPayment({ merchandise, delivery });
  const parcelDesc = params.parcelDesc || 'Colis';
  const vendorName = params.vendorName || '—';
  const delivererName = params.delivererName || '—';
  const paymentNumber = params.paymentNumber || '—';

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' · ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const shareReceipt = async () => {
    const text = [
      `🧾 Reçu KoliGo · ${params.orderId || ''}`,
      `Date : ${dateStr}`,
      ``,
      `Vendeur : ${params.vendorName || '—'}`,
      `Livreur : ${params.delivererName || '—'}`,
      ``,
      `Marchandise : ${split.merchandise.toLocaleString('fr-FR')} XAF`,
      `Livraison   : ${split.delivery.toLocaleString('fr-FR')} XAF`,
      `Frais       : ${split.serviceFee.toLocaleString('fr-FR')} XAF`,
      `────────────────────`,
      `Total payé  : ${split.total.toLocaleString('fr-FR')} XAF`,
      ``,
      `KoliGo SARL · support@koligo.cm`,
    ].join('\n');

    try {
      if (Platform.OS === 'web' && navigator?.share) {
        await navigator.share({ title: `Reçu ${params.orderId || 'KoliGo'}`, text });
      } else {
        await Share.share({ message: text, title: `Reçu ${params.orderId || 'KoliGo'}` });
      }
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title="Réception confirmée" onBack={() => navigation.navigate('ClientLanding')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Success header */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center', gap: 10 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={38} color={colors.green} strokeWidth={2.6} />
          </View>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, letterSpacing: -0.02 * 24, color: colors.ink }}>
            Paiement traité ✓
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 }}>
            La répartition est automatique : vendeur, livreur et plateforme reçoivent leur part instantanément.
          </Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 12 }}>
            Reçu détaillé
          </Text>
          {[
            { label: 'Nom du vendeur ou boutique', value: vendorName },
            { label: 'Type colis', value: parcelDesc },
            { label: 'Prix de la marchandise', value: `${merchandise.toLocaleString('fr-FR')} XAF` },
            { label: 'Nom du livreur', value: delivererName },
            { label: 'Prix de livraison', value: `${delivery.toLocaleString('fr-FR')} XAF` },
            { label: 'KoliGo', value: `${split.platformTotal.toLocaleString('fr-FR')} XAF` },
            { label: 'Numéro de paiement', value: paymentNumber },
          ].map(row => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.ink06 }}>
              <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70 }}>{row.label}</Text>
              <Text style={{ flex: 1, textAlign: 'right', fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink }}>{row.value}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.ink }}>Total</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.ink }}>{split.total.toLocaleString('fr-FR')} XAF</Text>
          </View>
        </View>

        {/* Répartition rapide */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 12 }}>
            Répartition automatique
          </Text>
          {[
            { label: 'Vendeur reçoit', value: split.vendorNet, color: colors.green },
            { label: 'Livreur reçoit', value: split.delivererNet, color: colors.orange },
            { label: 'Plateforme KoliGo', value: split.platformTotal, color: colors.ink55 },
          ].map(r => (
            <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.ink06 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70 }}>{r.label}</Text>
              <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 13, color: r.color }}>{r.value.toLocaleString('fr-FR')} XAF</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.ink }}>Total payé</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.ink }}>{split.total.toLocaleString('fr-FR')} XAF</Text>
          </View>
        </View>

        {/* Receipt */}
        <KGReceipt
          kind="payment"
          orderId={params.orderId || 'KG-2026-0001'}
          date={dateStr}
          vendor={vendorName}
          client={params.clientName || '—'}
          deliverer={delivererName}
          paymentMethod="MTN MoMo"
          split={split}
        />

        {/* Download buttons */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <KGButton
            kind="dark"
            size="sm"
            icon="upload"
            full={false}
            style={{ flex: 1 }}
            onPress={shareReceipt}
          >
            Reçu paiement
          </KGButton>
          <KGButton
            kind="ghost"
            size="sm"
            icon="upload"
            full={false}
            style={{ flex: 1 }}
            onPress={() => showToast('Reçu livraison téléchargé 📦')}
          >
            Reçu livraison
          </KGButton>
        </View>

        <KGButton
          kind="ghost"
          size="md"
          icon="flag"
          onPress={() => navigation.navigate('ReportIssue', { deliveryId: params.deliveryId })}
        >
          Signaler un problème
        </KGButton>

        <KGButton
          kind="primary"
          size="lg"
          icon="star"
          onPress={() => navigation.navigate('Rating', {
            partner: 'deliverer',
            ratedId: params.delivererId || null,
            deliveryId: params.deliveryId || null,
            partnerName: params.delivererName || null,
          })}
        >
          Noter mon livreur
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
