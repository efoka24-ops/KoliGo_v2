import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { KG_DEMO_DELIVERIES, KG_AVAILABLE_FOR_DELIVERER, KG_QUARTIER_COORDS } from '../../constants/data';
import LiveMap from '../../components/LiveMap';
import { normalizeDelivery } from '../../services/api';
import { useApp, t } from '../../context/AppContext';
import { getInitials } from '../../utils/helpers';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGStatusPill from '../../components/KGStatusPill';
import KGCourierBadge from '../../components/KGCourierBadge';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';

function formatDelivererReceipt(d) {
  const line = '─'.repeat(38);
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const ref = (d.id || '').slice(-8).toUpperCase();
  const totalPrice = d.priceXAF || d.price || 0;
  const earning = d.delivererEarning || d.earning || 0;
  const commission = d.commissionXAF || (totalPrice - earning);
  const pct = totalPrice > 0 ? Math.round((commission / totalPrice) * 100) : 0;
  return [
    '╔════════════════════════════════════════╗',
    '║         REÇU DE COURSE · LIVREUR       ║',
    '║                KoliGo                  ║',
    '╚════════════════════════════════════════╝',
    '',
    'Ref.    : ' + ref,
    'Date    : ' + date,
    'Statut  : LIVRÉ ✓',
    line,
    'De      : ' + (d.from || d.pickupAddress || '—'),
    'Vers    : ' + (d.to || d.dropoffAddress || '—'),
    d.distanceKm ? 'Distance: ' + d.distanceKm + ' km' : null,
    d.weightKg ? 'Poids   : ' + d.weightKg + ' kg' : null,
    line,
    d.shopName ? 'Boutique: ' + d.shopName : null,
    d.description ? 'Colis   : ' + d.description : null,
    d.recipientName ? 'Client  : ' + d.recipientName : null,
    line,
    'Transport total  : ' + totalPrice.toLocaleString('fr-FR') + ' XAF',
    'Commission KoliGo: ' + commission.toLocaleString('fr-FR') + ' XAF (' + pct + '%)',
    'Vos gains nets   : ' + earning.toLocaleString('fr-FR') + ' XAF',
    '',
    'Merci de votre confiance · koligo.cm',
    '════════════════════════════════════════',
  ].filter(Boolean).join('\n');
}

function formatReceipt(d) {
  return formatDelivererReceipt(d);
}
export default function DeliveryDetailScreen({ navigation, route }) {
  const { role, user, token, api, showToast, conversations, startConversation, lang } = useApp();
  const { t } = useI18n();
  const isEn = lang === 'en';
  const { deliveryId, mode } = route?.params || {};
  const isAvailable = mode === 'available';
  const isGoingVendor = mode === 'going_vendor';
  const isVendor = role === 'vendor';
  const isDemo = user?.isTest === true;

  const [delivery, setDelivery] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [sharingReceipt, setSharingReceipt] = useState(false);

  const handleShareReceipt = async () => {
    if (!delivery) return;
    setSharingReceipt(true);
    try {
      const text = formatDelivererReceipt(delivery);
      const ref = (delivery.id || '').slice(-8).toUpperCase();
      if (Platform.OS === 'web') {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recu-course-koligo-' + ref + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Recu telecharge');
      } else {
        await Share.share({ message: text, title: 'Recu de course KoliGo' });
      }
    } catch {} finally {
      setSharingReceipt(false);
    }
  };

  useEffect(() => {
    if (isDemo) {
      const allList = [...KG_DEMO_DELIVERIES, ...KG_AVAILABLE_FOR_DELIVERER];
      const found = allList.find(x => x.id === deliveryId) || allList[0];
      setDelivery(found);
      return;
    }
    if (!token || !deliveryId) return;
    api(`/api/deliveries/${deliveryId}`)
      .then(data => setDelivery(normalizeDelivery(data)))
      .catch(() => showToast('Erreur chargement', 'error'));
  }, [deliveryId, token, isDemo]);

  const handleAccept = async () => {
    if (isDemo) {
      navigation.navigate('DeliveryDetail', { deliveryId: delivery.id, mode: 'going_vendor' });
      return;
    }
    if (user?.kycStatus !== 'VERIFIED') {
      if (user?.kycStatus === 'PENDING') {
        showToast(t('Vérification KYC en cours — résultat sous 24h'), 'error');
      } else {
        showToast(t('Soumettez votre CNI pour accepter des courses'), 'error');
        navigation.navigate('Kyc');
      }
      return;
    }
    setAccepting(true);
    try {
      await api(`/api/deliveries/${deliveryId}/accept`, { method: 'PATCH' });
      showToast(t('Course acceptée !'));
      navigation.navigate('DeliveryDetail', { deliveryId, mode: 'going_vendor' });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAccepting(false);
    }
  };

  const handleCancel = async () => {
    if (isDemo) { navigation.goBack(); return; }
    setCancelling(true);
    try {
      await api(`/api/deliveries/${deliveryId}/cancel`, { method: 'POST' });
      showToast('Livraison annulée');
      navigation.goBack();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenChat = (type) => {
    const isDeliverer = type === 'deliverer';
    const partnerId = isDeliverer ? d.delivererId : d.recipientId;
    const partnerName = isDeliverer ? (d.delivererName || 'Livreur') : (d.recipient || 'Client');

    if (isDemo) {
      const convId = isDeliverer ? d.convIdDeliverer : d.convIdClient;
      if (convId) navigation.navigate('Chat', { convId });
    } else if (partnerId) {
      const convId = startConversation({ id: partnerId, name: partnerName, initials: getInitials(partnerName), role: type });
      navigation.navigate('Chat', { convId });
    }
  };

  if (!delivery) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color={colors.green} />
      </SafeAreaView>
    );
  }

  const d = delivery;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      {/* Map header */}
      <View style={{ height: 220, position: 'relative' }}>
        <LiveMap
          delivererPos={KG_QUARTIER_COORDS[d.from] || null}
          clientPos={KG_QUARTIER_COORDS[d.to] || null}
        />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <KGTopBar title=" " onBack={() => navigation.goBack()} transparent />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 12, color: colors.ink55 }}>{d.id}</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: colors.ink, letterSpacing: -0.02 * 24, marginTop: 2 }}>
              {d.price.toLocaleString('fr-FR')} <Text style={{ fontSize: 14, color: colors.ink55 }}>XAF</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {d.status && <KGStatusPill status={d.status} />}
            <KGCourierBadge type={d.type} size="lg" />
          </View>
        </View>

        {/* Route */}
        <KGCard padding={14}>
          <RouteLine from={d.from} to={d.to} />
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70 }}>ðŸ" {d.distance} km</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70 }}>ðŸ"¦ {d.weight} kg</Text>
            {d.vendor && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70 }}>ðŸª {d.vendor}</Text>}
          </View>
          {(d.shopName || d.parcelDesc) && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.ink06, gap: 6 }}>
              {d.shopName ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Icon name="package" size={14} color={colors.ink55} />
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink }}>{d.shopName}</Text>
                </View>
              ) : null}
              {d.parcelDesc ? (
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink70, lineHeight: 18 }}>{d.parcelDesc}</Text>
              ) : null}
            </View>
          )}
        </KGCard>

        {/* Collect code (vendor sees it, or deliverer going to vendor) */}
        {(isVendor || isGoingVendor) && d.collectCode && (
          <KGCard kind="orange" padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="shield" size={24} color={colors.orange} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.orange, textTransform: 'uppercase', letterSpacing: 0.05 }}>{t('Code de collecte')}</Text>
                <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 30, color: colors.ink, letterSpacing: 0.2 * 30, marginTop: 4 }}>
                  {d.collectCode.split('').join(' ')}
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink70, marginTop: 10, lineHeight: 17 }}>
              {isVendor
                ? t('Donne ce code au livreur quand il vient récupérer le colis.')
                : t('Demande ce code au vendeur pour valider la collecte.')}
            </Text>
          </KGCard>
        )}

        {/* Delivery code (vendor sees when en_route) */}
        {isVendor && d.code && d.status === 'en_route' && (
          <KGCard kind="green" padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="check" size={24} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.greenDark, textTransform: 'uppercase', letterSpacing: 0.05 }}>{t('Code livraison (destinataire)')}</Text>
                <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 30, color: colors.ink, letterSpacing: 0.2 * 30, marginTop: 4 }}>
                  {d.code.split('').join(' ')}
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.greenDark, marginTop: 10, lineHeight: 17, opacity: 0.8 }}>
              {t('doit donner ce code au livreur à la remise.', { name: d.recipient })}
            </Text>
          </KGCard>
        )}

        {/* Recipient */}
        {d.recipient && (
          <KGCard padding={14}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 10 }}>{t('Destinataire')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 14, color: colors.greenDark }}>
                  {d.recipient.split(' ').map(p => p[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{d.recipient}</Text>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>+237 {d.recipientPhone || 'â€"'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleOpenChat('client')}
                style={{ width: 40, height: 40, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.ink12 }}
              >
                <Icon name="chat" size={18} color={colors.green} />
              </TouchableOpacity>
            </View>
          </KGCard>
        )}

        {/* Receipt download for completed deliveries */}
        {d.status === 'livre' && (
          <TouchableOpacity
            onPress={handleShareReceipt}
            disabled={sharingReceipt}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8DCC8', backgroundColor: '#F5F0E8' }}
          >
            {sharingReceipt ? <ActivityIndicator color={colors.green} size="small" /> : <Icon name="upload" size={18} color={colors.green} />}
            <Text style={{ fontFamily: fonts.ui + '-Bold', fontSize: 14, color: colors.green }}>
              Télécharger le reçu
            </Text>
          </TouchableOpacity>
        )}

        {/* Vendor can cancel EN_ATTENTE delivery */}
        {isVendor && d.status === 'en_attente' && (
          <KGButton kind="ghost" size="lg" onPress={handleCancel} disabled={cancelling}>
            {cancelling ? <ActivityIndicator color={colors.ink} /> : t('Annuler la livraison')}
          </KGButton>
        )}

        {/* Actions */}
        {isAvailable && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <KGButton kind="ghost" style={{ flex: 1 }} onPress={() => navigation.goBack()}>Refuser</KGButton>
            <KGButton kind="primary" style={{ flex: 2 }} icon={accepting ? undefined : 'check'} onPress={handleAccept} disabled={accepting}>
              {accepting ? <ActivityIndicator color="#fff" /> : t('Accepter la course')}
            </KGButton>
          </View>
        )}
        {isGoingVendor && role === 'deliverer' && (
          <KGButton kind="primary" size="lg" icon="pin" onPress={() => navigation.navigate('Confirm', { deliveryId: d.id, phase: 'collect' })}>
            {t('Je suis arrivé chez le vendeur')}
          </KGButton>
        )}
        {!isAvailable && !isGoingVendor && role === 'deliverer' && (
          <KGButton kind="orange" size="lg" icon="check" onPress={() => navigation.navigate('DelivererWaiting', { deliveryId: d.id })}>
            {t('Je suis arrivé chez le client')}
          </KGButton>
        )}
        {!isAvailable && isVendor && !['en_attente', 'annule', 'livre'].includes(d.status) && (
          <View style={{ gap: 10 }}>
            <KGButton kind="primary" size="lg" icon="shield"
              onPress={() => navigation.navigate('VendorCodes', { orderId: d.id })}>
              {t('Codes & Facture de confiance')}
            </KGButton>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KGButton kind="ghost" style={{ flex: 1 }} icon="chat" onPress={() => handleOpenChat('deliverer')}>Chat</KGButton>
              <KGButton kind="soft" style={{ flex: 1 }} icon="pin" onPress={() => navigation.navigate('ClientTracking', { orderId: d.id, vendorName: user?.name })}>Suivre</KGButton>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
