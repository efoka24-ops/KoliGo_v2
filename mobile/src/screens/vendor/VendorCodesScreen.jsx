import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Share, Linking, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors'; // Assuming colors and fonts are constants
import { useApp } from '../../context/AppContext';
import { getInitials } from '../../utils/helpers';
import { API_BASE } from '../../config';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGStatusPill from '../../components/KGStatusPill';
import Icon from '../../components/Icon';

const POLL_INTERVAL = 5000;

// Tracking page served by the same Express server as the API
function getTrackingBase() {
  return API_BASE;
}

function CodeBox({ digit, color, bg }) {
  return (
    <View style={{ width: 54, height: 66, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 30, color }}>{digit}</Text>
    </View>
  );
}

function TrustRow({ label, value, highlight }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.ink06 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>{label}</Text>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: highlight ? colors.green : colors.ink, flex: 1, textAlign: 'right', marginLeft: 12 }}>{value}</Text>
    </View>
  );
}

function SectionLabel({ children }) {
  return (
    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: colors.ink35, textTransform: 'uppercase', letterSpacing: 0.06, marginTop: 12, marginBottom: 2 }}>
      {children}
    </Text>
  );
}

export default function VendorCodesScreen({ navigation, route }) {
  const { api, token, showToast, startConversation, lang } = useApp();
  const isEn = lang === 'en';
  const params = route?.params || {};
  const orderId  = params.orderId || 'KG-2026-0512';
  const shopName = params.shopName || '';
  const clientWa = params.clientWhatsApp || '';

  const [codeCollect,   setCodeCollect]   = useState(params.codeCollect   || '');
  const [codeReception, setCodeReception] = useState(params.codeReception || '');
  const [fromQ,         setFromQ]         = useState(params.from          || '');
  const [toQ,           setToQ]           = useState(params.to            || '');
  const [recipientName, setRecipientName] = useState(params.recipientName || '');
  const [recipientAddress, setRecipientAddress] = useState(params.recipientAddress || '');
  const [trackingCode, setTrackingCode] = useState(params.trackingCode || '');

  const [status, setStatus]         = useState('en_attente');
  const [trustDoc, setTrustDoc]     = useState(null);
  const [loadingTrust, setLoadingTrust] = useState(false);
  const prevStatusRef = useRef(null);
  const pollRef       = useRef(null);
  const isDemo        = !token;
  const isRealId      = orderId && !String(orderId).startsWith('KG-');

  // Si le vendeur arrive via DeliveryDetail (sans params codes), on les fetch depuis l'API
  useEffect(() => {
    if (!isRealId || !api) return;
    api(`/api/deliveries/${orderId}`).then(d => {
      if (d.collectCode)  setCodeCollect(d.collectCode);
      if (d.deliverCode)  setCodeReception(d.deliverCode);
      if (d.trackingCode) setTrackingCode(d.trackingCode);
      if (d.fromQuartier) setFromQ(d.fromQuartier);
      if (d.toQuartier)   setToQ(d.toQuartier);
      if (d.recipientName) setRecipientName(d.recipientName);
      if (d.recipientAddress) setRecipientAddress(d.recipientAddress);
    }).catch(() => {});
  }, [isRealId, orderId, api]);

  const trackingUrl = trackingCode
    ? `${getTrackingBase()}/c/${trackingCode}`
    : `${getTrackingBase()}/track/${orderId}`;

  const fetchTrustDoc = useCallback(async () => {
    if (!isRealId || !api) return;
    setLoadingTrust(true);
    try {
      const doc = await api(`/api/deliveries/${orderId}/trust-doc`);
      setTrustDoc(doc);
    } catch {
      // not yet available
    } finally {
      setLoadingTrust(false);
    }
  }, [api, isRealId, orderId]);

  const fetchStatus = useCallback(async () => {
    if (isDemo || !isRealId) return;
    try {
      const data = await api(`/api/deliveries/${orderId}`);
      const newStatus = (data.status || '').toLowerCase();
      if (data.trackingCode) setTrackingCode(data.trackingCode);

      // Notify vendor when deliverer accepts
      const prev = prevStatusRef.current;
      if (prev && prev !== newStatus && newStatus === 'accepte') {
        showToast(isEn ? 'ðŸš´ A deliverer accepted your order!' : 'ðŸš´ Un livreur a acceptÃ© ta commande !');
      }
      if (prev && prev !== newStatus && newStatus === 'en_route') {
        showToast(isEn ? 'ðŸ“¦ Pickup code validated â€” trust invoice generated!' : 'ðŸ“¦ Le livreur a validÃ© le code collecte â€” facture gÃ©nÃ©rÃ©e !');
      }
      prevStatusRef.current = newStatus;
      setStatus(newStatus);

      if ((newStatus === 'en_route' || newStatus === 'livre') && !trustDoc) {
        fetchTrustDoc();
      }
    } catch {
      // keep polling
    }
  }, [api, isDemo, isRealId, orderId, trustDoc, fetchTrustDoc, showToast]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  // Build rich trust document text (WhatsApp-formatted)
  const buildTrustMessage = () => {
    const d = trustDoc?.deliverer;
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    return (
      `ðŸ“„ *${isEn ? 'TRUST INVOICE' : 'FACTURE DE CONFIANCE'} â€” KoliGo*\n` +
      `â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n` +
      `Commande : ${orderId}\n` +
      `Trajet : ${fromQ} â†’ ${toQ}\n` +
      `Date : ${today}\n\n` +
      `ðŸ‘¤ *LIVREUR*\n` +
      `Nom : ${d?.name || 'â€”'}\n` +
      `TÃ©lÃ©phone : +237 ${d?.phone || 'â€”'}\n` +
      `NÂ° CNI : ${d?.cniNumber || 'Non renseignÃ©'}\n` +
      `Statut KYC : ${d?.kycStatus === 'VERIFIED' ? 'VÃ©rifiÃ© âœ“' : d?.kycStatus === 'REJECTED' ? 'RejetÃ©' : 'En attente'}\n\n` +
      `ðŸ“¦ *CLIENT / DESTINATAIRE*\n` +
      `Nom : ${trustDoc?.recipientName || recipientName || 'â€”'}\n` +
      (trustDoc?.recipientPhone ? `TÃ©lÃ©phone : +237 ${trustDoc.recipientPhone}\n` : '') +
      `Adresse : ${trustDoc?.recipientAddress || recipientAddress || toQ || 'â€”'}\n\n` +
      `ðŸ”— *SUIVI DU COLIS*\n` +
      `${trackingUrl}\n` +
      `Code rÃ©ception : _${codeReception}_ (confidentiel)\n\n` +
      `Ce livreur est vÃ©rifiÃ© par KoliGo.\n` +
      `Conservez ce document en cas de litige.\n` +
      `â€” KoliGo`
    );
  };

  // Message to send to the client (WhatsApp/SMS)
  const buildClientMessage = () =>
    `${isEn ? 'Hello' : 'Salut'} ${trustDoc?.recipientName || recipientName || ''} ! ${isEn ? 'Your parcel from' : 'Ton colis de'} *${shopName || 'KoliGo'}* ${isEn ? 'is on the way' : 'est en route'} ðŸ“¦\n\n` +
    (fromQ && toQ ? `${isEn ? 'Route' : 'Trajet'} : ${fromQ} â†’ ${toQ}\n` : '') +
    `${isEn ? 'Order' : 'Commande'} : ${orderId}\n\n` +
    `ðŸ”— ${isEn ? 'Track your parcel live' : 'Suis ton colis en direct'} :\n${trackingUrl}\n\n` +
    `ðŸ”‘ ${isEn ? 'Delivery code' : 'Code de rÃ©ception'} : *${codeReception}*\n` +
    `${isEn ? 'Enter this code when the deliverer arrives to confirm delivery.' : 'Saisis ce code quand le livreur arrive pour confirmer la livraison.'}\n\n` +
    `â€” KoliGo`;

  const shareViaWhatsApp = async (msg, phone = '') => {
    const url = phone
      ? `https://wa.me/237${phone.replace(/\s/g, '')}?text=${encodeURIComponent(msg)}`
      : `whatsapp://send?text=${encodeURIComponent(msg)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
      else await Share.share({ message: msg, title: 'KoliGo' });
    } catch {
      showToast('Erreur lors du partage', 'error');
    }
  };

  const shareViaSMS = async (msg) => {
    try {
      await Linking.openURL(`sms:?body=${encodeURIComponent(msg)}`);
    } catch {
      await Share.share({ message: msg, title: 'KoliGo' });
    }
  };

  const downloadTrustDoc = async () => {
    await Share.share({ message: buildTrustMessage(), title: 'Facture de confiance KoliGo' });
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(trackingUrl);
    showToast('Lien copiÃ© âœ“');
  };

  const isAccepte  = status === 'accepte';
  const isEnRoute  = status === 'en_route';
  const isLivre    = status === 'livre';
  const showTrust  = isEnRoute || isLivre;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title={isEn ? 'Listing codes' : "Codes de l'annonce"} onBack={() => navigation.navigate('VendorHome')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Order ID + status */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 11, color: colors.ink55 }}>{orderId}</Text>
          <KGStatusPill status={status} />
          {!isDemo && isRealId && (
            <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green }} />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: colors.ink35 }}>en direct</Text>
            </View>
          )}
        </View>

        {/* Step 10 â€” Deliverer accepted banner */}
        {isAccepte && !showTrust && (
          <View style={{ backgroundColor: '#EFF6FF', borderRadius: 18, padding: 16, borderLeftWidth: 4, borderLeftColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>ðŸš´</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: '#1D4ED8' }}>Livreur en route !</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: '#3B82F6', marginTop: 3, lineHeight: 18 }}>
                Il arrive Ã  ta boutique. PrÃ©pare le code collecte Ã  lui montrer.
              </Text>
            </View>
          </View>
        )}

        {/* Step 12 â€” Delivery confirmed banner */}
        {isLivre && (
          <View style={{ backgroundColor: colors.greenLight, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={26} color="#fff" />
            </View>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 18, color: colors.greenDark, textAlign: 'center' }}>
              Livraison confirmÃ©e !
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.greenDark, textAlign: 'center', lineHeight: 20, opacity: 0.85 }}>
              Le client a confirmÃ© la rÃ©ception. Le livreur a Ã©tÃ© payÃ© automatiquement par KoliGo.
            </Text>
          </View>
        )}

        {/* Step 11 â€” Facture de confiance */}
        {showTrust && (
          <View style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink06 }}>
            {/* Document header */}
            <View style={{ backgroundColor: colors.ink, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="shield" size={20} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.06 }}>
                  KoliGo Â· Document officiel
                </Text>
                <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: '#fff' }}>
                  Facture de confiance
                </Text>
              </View>
              <View style={{ backgroundColor: colors.green, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: '#fff' }}>VÃ©rifiÃ© âœ“</Text>
              </View>
            </View>

            <View style={{ padding: 16 }}>
              {loadingTrust && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator color={colors.green} />
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 8 }}>
                    GÃ©nÃ©ration de la factureâ€¦
                  </Text>
                </View>
              )}

              {trustDoc && (
                <>
                  <SectionLabel>Commande</SectionLabel>
                  <TrustRow label="RÃ©fÃ©rence" value={orderId} />
                  <TrustRow label="Trajet" value={fromQ && toQ ? `${fromQ} â†’ ${toQ}` : null} />

                  <SectionLabel>Livreur identifiÃ©</SectionLabel>
                  <TrustRow label="Nom complet" value={trustDoc.deliverer?.name} />
                  <TrustRow label="TÃ©lÃ©phone" value={trustDoc.deliverer?.phone ? `+237 ${trustDoc.deliverer.phone}` : null} />
                  <TrustRow label="NÂ° CNI" value={trustDoc.deliverer?.cniNumber || 'Non renseignÃ©'} />
                  <TrustRow label="Statut KYC" value={trustDoc.deliverer?.kycStatus === 'VERIFIED' ? 'VÃ©rifiÃ© âœ“' : 'En attente'} highlight={trustDoc.deliverer?.kycStatus === 'VERIFIED'} />

                  <SectionLabel>{isEn ? 'Recipient (client)' : 'Destinataire (client)'}</SectionLabel>
                  <TrustRow label="Nom" value={trustDoc.recipientName || recipientName || 'â€”'} />
                  <TrustRow label="TÃ©lÃ©phone" value={trustDoc.recipientPhone ? `+237 ${trustDoc.recipientPhone}` : null} />
                  <TrustRow label="Adresse" value={trustDoc.recipientAddress || recipientAddress || toQ} />

                  {/* Download / share trust doc */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    <KGButton kind="primary" size="sm" icon="send" full={false} style={{ flex: 1 }}
                      onPress={downloadTrustDoc}>
                      {isEn ? 'Download' : 'TÃ©lÃ©charger'}
                    </KGButton>
                    {trustDoc.deliverer?.id && (
                      <KGButton kind="soft" size="sm" icon="chat" full={false} style={{ flex: 1 }}
                        onPress={() => {
                          const convId = startConversation({
                            id: trustDoc.deliverer.id,
                            name: trustDoc.deliverer.name || 'Livreur',
                            initials: getInitials(trustDoc.deliverer.name || 'L'),
                            role: 'deliverer',
                          });
                          navigation.navigate('Chat', { convId });
                        }}>
                        {isEn ? 'Contact' : 'Contacter'}
                      </KGButton>
                    )}
                  </View>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35, textAlign: 'center', marginTop: 8 }}>
                    {isEn ? 'ðŸ’¡ To save as an image, take a screenshot.' : 'ðŸ’¡ Pour sauvegarder en image, fais une capture d\'Ã©cran'}
                  </Text>
                </>
              )}

              {!loadingTrust && !trustDoc && (
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55, lineHeight: 18 }}>
                  {isEn ? 'The invoice will appear here once the pickup code is validated.' : 'La facture apparaÃ®tra ici dÃ¨s que le code de collecte est validÃ©.'}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Code A â€” Collecte */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, borderLeftWidth: 4, borderLeftColor: colors.orange }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.orange, letterSpacing: 0.06, textTransform: 'uppercase' }}>
            {isEn ? 'â‘  Pickup code â€” show it to the deliverer' : 'â‘  Code de collecte â€” Ã  montrer au livreur'}
          </Text>
          <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13.5, color: colors.ink, marginTop: 4 }}>
            Le livreur saisit ce code en arrivant chez toi
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {codeCollect.split('').map((d, i) => (
              <CodeBox key={i} digit={d} color={colors.orange} bg={colors.orangeLight} />
            ))}
          </View>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 12, lineHeight: 18 }}>
            KoliGo libÃ¨re le paiement de la marchandise vers ton compte MoMo et gÃ©nÃ¨re la facture de confiance.
          </Text>
        </View>

        {/* Code B + Client share section */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, borderLeftWidth: 4, borderLeftColor: colors.green }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.green, letterSpacing: 0.06, textTransform: 'uppercase' }}>
            {isEn ? 'â‘¡ Link + delivery code â€” share with the client' : 'â‘¡ Lien + code de rÃ©ception â€” Ã  partager avec le client'}
          </Text>
          <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13.5, color: colors.ink, marginTop: 4 }}>
            Le client confirme la rÃ©ception avec ce code
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {codeReception.split('').map((d, i) => (
              <CodeBox key={i} digit={d} color={colors.green} bg={colors.greenLight} />
            ))}
          </View>

          {/* PWA tracking link */}
          <View style={{ marginTop: 14, backgroundColor: colors.cream, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.06, marginBottom: 4 }}>
              {isEn ? 'Client tracking link' : 'Lien de suivi client'}
            </Text>
            <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 11, color: colors.ink70 }} numberOfLines={1}>
              {trackingUrl}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {/* Direct WhatsApp to client if phone known */}
            <KGButton kind="primary" size="sm" icon="chat" full={false} style={{ flex: 1 }}
              onPress={() => clientWa
                ? shareViaWhatsApp(buildClientMessage(), clientWa)
                : shareViaWhatsApp(buildClientMessage())
              }>
              WhatsApp
            </KGButton>
            <KGButton kind="soft" size="sm" icon="send" full={false} style={{ flex: 1 }}
              onPress={() => shareViaSMS(buildClientMessage())}>
              SMS
            </KGButton>
          </View>

          <TouchableOpacity
            onPress={copyLink}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cream }}
          >
            <Icon name="copy" size={14} color={colors.ink55} />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12.5, color: colors.ink55 }}>{isEn ? 'Copy link' : 'Copier le lien'}</Text>
          </TouchableOpacity>
        </View>

        {/* Security notice */}
        <KGCard kind="cream" padding={14}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Icon name="shield" size={18} color={colors.ink70} />
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink70, lineHeight: 18 }}>
              {isEn
                ? <>Never share <Text style={{ fontFamily: `${fonts.ui}-SemiBold` }}>the pickup code</Text> with the client. Share only the delivery code and the tracking link.</>
                : <>Ne partage <Text style={{ fontFamily: `${fonts.ui}-SemiBold` }}>jamais</Text> le code de collecte avec le client. Partage uniquement le code de rÃ©ception et le lien de suivi.</>}
            </Text>
          </View>
        </KGCard>
        <KGButton kind="primary" size="lg" icon="home" onPress={() => navigation.navigate('VendorHome')}>
          {isEn ? 'Back to dashboard' : 'Retour au tableau de bord'}
        </KGButton>

        {/* Preview for vendor */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.ink06, paddingTop: 16, gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink35, textTransform: 'uppercase', letterSpacing: 0.04, textAlign: 'center' }}>
            {isEn ? 'Client preview' : 'AperÃ§u cÃ´tÃ© client'}
          </Text>
          <KGButton
            kind="dark"
            size="md"
            icon="user"
            onPress={() => navigation.navigate('ClientLanding', {
              orderId,
              clientName: trustDoc?.recipientName || recipientName || 'Client',
              vendorName: shopName || 'Ma boutique',
              parcelDesc: params.parcelDesc || 'Colis Â· ' + orderId,
            })}
          >
            {isEn ? 'Open client view' : 'Voir la vue client (app)'}
          </KGButton>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
