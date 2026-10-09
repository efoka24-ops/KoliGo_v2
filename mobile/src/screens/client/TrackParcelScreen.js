import { tr } from '../../i18n/tr';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { apiFetch } from '../../services/api';
import { KG_QUARTIER_COORDS } from '../../constants/data';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import LiveMap from '../../components/LiveMap';
import Icon from '../../components/Icon';

// Parcours du destinataire, sans compte : Ref -> colis -> progression -> carte ->
// livreur -> messages -> confirmation et paiement mobile money -> recu.

const STEPS = [
  { k: 'EN_ATTENTE', label: 'Colis publié', sub: 'En attente d’un livreur' },
  { k: 'ACCEPTE', label: 'Livreur trouvé', sub: 'Il récupère le colis chez le vendeur' },
  { k: 'EN_ROUTE', label: 'Colis en route', sub: 'Le livreur se dirige vers vous' },
  { k: 'LIVRE', label: 'Livré', sub: 'Réception confirmée et payée' },
];
const POLL_STATUS_MS = 8000;
const POLL_GPS_MS = 10000;
const PAY_TIMEOUT_MS = 180000;

// Distance (km) a vol d'oiseau : sert a ignorer un GPS destinataire aberrant (hors du Cameroun, emulateur...).
const kmBetween = (a, b) => {
  const r = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const errMsg = (e) => e?.response?.data?.error || e?.message || 'Erreur réseau, réessaie.';
const xaf = (n) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`;
const initials = (n) => String(n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

function Section({ title, children, accent }) {
  return (
    <KGCard padding={16} style={{ gap: 10, borderLeftWidth: accent ? 4 : 0, borderLeftColor: accent || 'transparent' }}>
      <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</Text>
      {children}
    </KGCard>
  );
}

function Row({ label, value, bold }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55 }}>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: 'right', fontFamily: `${fonts.ui}-${bold ? 'Bold' : 'SemiBold'}`, fontSize: 13.5, color: colors.ink }}>{value}</Text>
    </View>
  );
}

function Input({ label, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.ink55 }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.ink35}
        style={{ height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: colors.ink12, backgroundColor: '#fff', paddingHorizontal: 14, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 16, color: colors.ink }}
        {...props}
      />
    </View>
  );
}

export default function TrackParcelScreen({ navigation, route }) {
  const [refInput, setRefInput] = useState(route?.params?.ref || '');
  const [d, setD] = useState(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  const [delivererPos, setDelivererPos] = useState(null);
  const [clientPos, setClientPos] = useState(null);
  const [lastGps, setLastGps] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);

  const [code, setCode] = useState('');
  const [momo, setMomo] = useState('');
  const [paying, setPaying] = useState(false);
  const [payInfo, setPayInfo] = useState(null); // { kind: 'pending'|'error'|'timeout', text }
  const payStartedAt = useRef(null);

  const idRef = useRef(null);
  const scrollRef = useRef(null);

  // ── Etape 1 : retrouver le colis par sa Ref ────────────────────────────────
  const lookup = useCallback(async (silent = false, refOverride) => {
    const ref = String(refOverride ?? refInput).replace(/[^A-Za-z0-9]/g, '');
    if (ref.length < 6) { setLookupError('Entre la référence du colis (8 caractères).'); return; }
    if (!silent) { setLooking(true); setLookupError(null); }
    try {
      // Rafraichissement : par identifiant (non devinable, sans limite). Recherche par Ref : 1ere fois seulement.
      const data = silent && idRef.current
        ? await apiFetch(`/deliveries/${idRef.current}/public`)
        : await apiFetch(`/deliveries/by-ref/${encodeURIComponent(ref)}`);
      if (!data) throw new Error('Référence introuvable. Vérifie-la auprès du vendeur.');
      idRef.current = data.id;
      setD(data);
    } catch (e) {
      if (!silent) setLookupError(errMsg(e));
    } finally {
      if (!silent) setLooking(false);
    }
  }, [refInput]);

  useEffect(() => { if (route?.params?.ref) lookup(false, route.params.ref); }, []); // eslint-disable-line

  // Rafraichit statut / montant tant que le colis n'est pas termine.
  useEffect(() => {
    if (!d || d.status === 'LIVRE' || d.status === 'ANNULE') return undefined;
    const t = setInterval(() => lookup(true, d.ref), POLL_STATUS_MS);
    return () => clearInterval(t);
  }, [d?.id, d?.status, lookup]); // eslint-disable-line

  // ── Carte : position du livreur (publique) + position du destinataire ──────
  useEffect(() => {
    if (!d) return undefined;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setClientPos({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {}
    })();
  }, [d?.id]); // eslint-disable-line

  useEffect(() => {
    if (!d || !['ACCEPTE', 'EN_ROUTE'].includes(d.status)) { setDelivererPos(null); return undefined; }
    const poll = async () => {
      try {
        const p = await apiFetch(`/deliveries/${d.id}/public-location`);
        if (p && p.lat != null) { setDelivererPos({ lat: p.lat, lng: p.lng }); setLastGps(new Date()); }
      } catch {}
    };
    poll();
    const t = setInterval(poll, POLL_GPS_MS);
    return () => clearInterval(t);
  }, [d?.id, d?.status]); // eslint-disable-line

  // ── Messages ────────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!idRef.current) return;
    try {
      const m = await apiFetch(`/deliveries/${idRef.current}/messages-public`);
      if (Array.isArray(m)) setMessages(m);
    } catch {}
  }, []);

  useEffect(() => {
    if (!d) return undefined;
    loadMessages();
    const t = setInterval(loadMessages, POLL_STATUS_MS);
    return () => clearInterval(t);
  }, [d?.id, loadMessages]); // eslint-disable-line

  const sendMessage = async () => {
    const content = chatText.trim();
    if (!content || sending || !d) return;
    setSending(true);
    try {
      await apiFetch(`/deliveries/${d.id}/recipient-message`, {
        method: 'POST',
        body: JSON.stringify({ content, recipientName: d.recipientName || 'Destinataire' }),
      });
      setChatText('');
      loadMessages();
    } catch (e) {
      setPayInfo({ kind: 'error', text: errMsg(e) });
    } finally {
      setSending(false);
    }
  };

  // ── Paiement mobile money (Sungku) ──────────────────────────────────────────
  const pay = async () => {
    const phone = momo.replace(/\s/g, '');
    if (!/^\d{4}$/.test(code)) { setPayInfo({ kind: 'error', text: 'Entre le code de réception à 4 chiffres.' }); return; }
    if (!/^6\d{8}$/.test(phone)) { setPayInfo({ kind: 'error', text: 'Numéro MoMo invalide (format : 6XXXXXXXX).' }); return; }
    setPaying(true);
    setPayInfo(null);
    try {
      const res = await apiFetch(`/deliveries/${d.id}/client-confirm`, {
        method: 'POST',
        body: JSON.stringify({ code, momoPhone: phone }),
      });
      if (!res) throw new Error('Paiement impossible pour le moment.');
      payStartedAt.current = Date.now();
      if (res.pending) {
        setPayInfo({ kind: 'pending', text: res.message || 'Valide le paiement sur ton téléphone (code PIN mobile money).' });
      } else {
        lookup(true, d.ref);
      }
    } catch (e) {
      setPayInfo({ kind: 'error', text: errMsg(e) });
    } finally {
      setPaying(false);
    }
  };

  // Tant que le paiement est en attente : on guette le passage a LIVRE (webhook Sungku).
  useEffect(() => {
    if (payInfo?.kind !== 'pending') return undefined;
    const t = setInterval(() => {
      lookup(true, d.ref);
      if (payStartedAt.current && Date.now() - payStartedAt.current > PAY_TIMEOUT_MS) {
        setPayInfo({ kind: 'timeout', text: 'Paiement non détecté après 3 minutes. Vérifie ton téléphone ou réessaie.' });
      }
    }, 5000);
    return () => clearInterval(t);
  }, [payInfo?.kind, d?.ref]); // eslint-disable-line

  useEffect(() => { if (d?.status === 'LIVRE') setPayInfo(null); }, [d?.status]);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  const goBack = () => (d ? (setD(null), setMessages([]), setPayInfo(null)) : navigation.goBack());

  if (!d) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
        <KGTopBar title={tr("Suivre mon colis")} onBack={() => navigation.goBack()} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', gap: 10, paddingTop: 20 }}>
              <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="package" size={34} color={colors.green} />
              </View>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: colors.ink, letterSpacing: -0.5, textAlign: 'center' }}>{tr("Ton colis arrive")}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14.5, color: colors.ink55, textAlign: 'center', lineHeight: 21, maxWidth: 310 }}>
                Entre la référence que le vendeur t’a communiquée pour suivre ton colis en direct, discuter avec le livreur et payer à la réception.
              </Text>
            </View>
            <Input
              label={tr("Référence du colis")}
              value={refInput}
              onChangeText={(t) => { setRefInput(t.toUpperCase()); setLookupError(null); }}
              placeholder={tr("ex : A1B2C3D4")}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              returnKeyType="search"
              onSubmitEditing={() => lookup(false)}
            />
            {lookupError && (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#D8472A' }}>{lookupError}</Text>
              </View>
            )}
            <KGButton kind="primary" size="lg" icon="pin" onPress={() => lookup(false)} disabled={looking}>
              {looking ? 'Recherche…' : 'Voir mon colis'}
            </KGButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const cancelled = d.status === 'ANNULE';
  const stepIdx = Math.max(0, STEPS.findIndex(s => s.k === d.status));
  const dropoff = KG_QUARTIER_COORDS?.[d.dropoffAddress] || null;
  const anchor = delivererPos || dropoff;
  const mapClientPos = clientPos && (!anchor || kmBetween(clientPos, anchor) < 150) ? clientPos : dropoff;
  const total = (d.priceXAF || 0);
  const canPay = d.status === 'EN_ROUTE';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title={`Colis ${d.ref}`} onBack={goBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* 1. Colis */}
          <Section title={tr("1 · Ton colis")} accent={colors.green}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink }}>
              {d.description || 'Colis'}
            </Text>
            <Row label={tr("Boutique")} value={d.shopName} />
            <Row label={tr("Référence")} value={d.ref} bold />
            <Row label={tr("De")} value={d.pickupAddress} />
            <Row label="À" value={d.dropoffAddress} />
            <Row label={tr("Poids")} value={d.weightKg ? `${d.weightKg} kg` : null} />
            <Row label={tr("Distance")} value={d.distanceKm ? `${d.distanceKm} km` : null} />
          </Section>

          {/* 2. Progression */}
          <Section title={tr("2 · Progression")} accent={colors.orange}>
            {cancelled ? (
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 15, color: '#D8472A' }}>{tr("Cette livraison a été annulée.")}</Text>
            ) : STEPS.map((s, i) => {
              const done = i < stepIdx || d.status === 'LIVRE';
              const current = i === stepIdx && d.status !== 'LIVRE';
              return (
                <View key={s.k} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', opacity: done || current ? 1 : 0.4 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: done ? colors.green : current ? colors.orange : colors.ink12, alignItems: 'center', justifyContent: 'center' }}>
                      {done ? <Icon name="check" size={14} color="#fff" /> : <Text style={{ color: '#fff', fontFamily: `${fonts.ui}-Bold`, fontSize: 12 }}>{i + 1}</Text>}
                    </View>
                    {i < STEPS.length - 1 && <View style={{ width: 2, height: 22, backgroundColor: done ? colors.green : colors.ink12, marginTop: 2 }} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 6 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14.5, color: colors.ink }}>{s.label}</Text>
                    <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>{s.sub}</Text>
                  </View>
                </View>
              );
            })}
          </Section>

          {/* 3. Carte */}
          {!cancelled && (
            <Section title={tr("3 · Position du livreur")}>
              <LiveMap delivererPos={delivererPos} clientPos={mapClientPos} />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>
                {delivererPos
                  ? `Position mise à jour à ${lastGps ? lastGps.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}`
                  : d.status === 'LIVRE' ? 'Colis livré.' : 'La position apparaît dès que le livreur est en route.'}
              </Text>
            </Section>
          )}

          {/* 4. Livreur */}
          {d.deliverer && (
            <Section title={tr("4 · Ton livreur")}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.greenDark }}>{initials(d.deliverer.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>{d.deliverer.name}</Text>
                  {!!d.deliverer.quartier && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }}>{d.deliverer.quartier}</Text>}
                </View>
              </View>
            </Section>
          )}

          {/* 5. Messages */}
          {!cancelled && d.status !== 'LIVRE' && !['EN_ATTENTE'].includes(d.status) && (
            <Section title={tr("5 · Messages")}>
              <View style={{ gap: 8, maxHeight: 240 }}>
                {messages.length === 0 && (
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink35, textAlign: 'center', paddingVertical: 10 }}>{tr("Aucun message pour l’instant")}</Text>
                )}
                <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }}>
                  {messages.map(m => {
                    const mine = m.senderRole === 'recipient';
                    return (
                      <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: mine ? '#EEF2FF' : m.senderRole === 'deliverer' ? '#FEF0E3' : colors.greenLight, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 }}>
                        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink }}>{m.content}</Text>
                        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: colors.ink35, marginTop: 2 }}>
                          {m.senderName} · {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={chatText}
                  onChangeText={setChatText}
                  placeholder={tr("Écris au livreur / vendeur…")}
                  placeholderTextColor={colors.ink35}
                  maxLength={500}
                  onSubmitEditing={sendMessage}
                  style={{ flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: colors.ink12, backgroundColor: '#fff', paddingHorizontal: 16, fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink }}
                />
                <TouchableOpacity onPress={sendMessage} disabled={sending || !chatText.trim()} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', opacity: sending || !chatText.trim() ? 0.5 : 1 }}>
                  <Icon name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </Section>
          )}

          {/* 6. Confirmation et paiement */}
          {canPay && (
            <Section title={tr("6 · Confirmer la réception et payer")} accent={colors.green}>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink70, lineHeight: 20 }}>
                {tr("Quand le livreur est chez toi, entre ton")} <Text style={{ fontFamily: `${fonts.ui}-Bold` }}>code de réception</Text> (reçu du vendeur) et ton numéro mobile money. Tu valideras ensuite le paiement sur ton téléphone.
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12.5, color: '#C4611A', lineHeight: 18 }}>
                À savoir : sur la demande de paiement de ton opérateur, le nom affiché sera « Kerry Pay », notre prestataire de paiement sécurisé. C'est normal : tu peux valider.
              </Text>
              <Row label={tr("Transport à payer")} value={xaf(total)} bold />
              <Input label={tr("Code de réception (4 chiffres)")} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="0000" />
              <Input label={tr("Numéro mobile money (MTN / Orange)")} value={momo} onChangeText={(t) => setMomo(t.replace(/\D/g, '').slice(0, 9))} keyboardType="number-pad" maxLength={9} placeholder="6XXXXXXXX" />
              {payInfo && (
                <View style={{ borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: payInfo.kind === 'pending' ? colors.greenLight : '#FEF2F2' }}>
                  {payInfo.kind === 'pending' && <ActivityIndicator color={colors.green} />}
                  <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: payInfo.kind === 'pending' ? colors.greenDark : '#D8472A', lineHeight: 19 }}>{payInfo.text}</Text>
                </View>
              )}
              <KGButton kind="primary" size="lg" icon="check" onPress={pay} disabled={paying || payInfo?.kind === 'pending'}>
                {paying ? 'Envoi…' : payInfo?.kind === 'pending' ? 'En attente du paiement…' : `Payer ${xaf(total)}`}
              </KGButton>
            </Section>
          )}

          {/* 7. Reçu */}
          {d.status === 'LIVRE' && (
            <Section title={tr("7 · Reçu")} accent={colors.green}>
              <View style={{ alignItems: 'center', gap: 6, paddingVertical: 6 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={28} color="#fff" />
                </View>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.greenDark }}>{tr("Colis livré et payé")}</Text>
              </View>
              <Row label={tr("Référence")} value={d.ref} bold />
              <Row label={tr("Date")} value={new Date(d.createdAt).toLocaleDateString('fr-FR')} />
              <Row label={tr("De")} value={d.pickupAddress} />
              <Row label="À" value={d.dropoffAddress} />
              <Row label={tr("Boutique")} value={d.shopName} />
              <Row label={tr("Livreur")} value={d.deliverer?.name} />
              <Row label={tr("Transport payé")} value={xaf(total)} bold />
              <KGButton kind="soft" size="md" icon="send" onPress={() => navigation.navigate('Invoice', { deliveryId: d.id, type: 'payment', publicMode: true })}>
                {tr("Voir ma facture de paiement")}
              </KGButton>
            </Section>
          )}

          <KGButton kind="ghost" size="md" onPress={() => navigation.goBack()}>{tr("Retour à l’accueil")}</KGButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
