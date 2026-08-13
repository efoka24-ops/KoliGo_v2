import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { KG_QUARTIERS, kgEstimateDistance } from '../../constants/data';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGInput from '../../components/KGInput';
import KGSectionTitle from '../../components/KGSectionTitle';
import KGCourierBadge from '../../components/KGCourierBadge';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { apiFetch } from '../../services/api';

// ── Generic list picker modal ──────────────────────────────────────────────
function ListPicker({ label, value, items, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55 }}>{label}</Text>
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        style={{
          height: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1,
          borderColor: disabled ? colors.ink06 : colors.ink12,
          backgroundColor: disabled ? colors.cream : '#fff',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: disabled ? colors.ink35 : colors.ink }}>
          {value || '—'}
        </Text>
        <Icon name="arrow" size={14} color={disabled ? colors.ink35 : colors.ink55} style={{ transform: [{ rotate: '90deg' }] }} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingVertical: 12 }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.ink12, borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />
            <ScrollView style={{ maxHeight: 360 }}>
              {items.map(item => (
                <TouchableOpacity
                  key={item}
                  onPress={() => { onChange(item); setOpen(false); }}
                  style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: item === value ? colors.greenLight : '#fff' }}
                >
                  <Text style={{ fontFamily: `${fonts.ui}-${item === value ? 'Bold' : 'Regular'}`, fontSize: 15, color: item === value ? colors.greenDark : colors.ink }}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Cascading Region → City → Neighborhood picker ─────────────────────────
function LocationPicker({ label, value, onChange, cities }) {
  const [region, setRegion] = useState('');
  const [city, setCity]     = useState('');

  const regions        = useMemo(() => [...new Set(cities.map(c => c.region))].sort(), [cities]);
  const citiesInRegion = useMemo(() => cities.filter(c => c.region === region), [cities, region]);
  const neighborhoods  = useMemo(() => {
    const found = citiesInRegion.find(c => c.name === city);
    return found ? found.neighborhoods.map(n => n.name) : [];
  }, [citiesInRegion, city]);

  const handleRegion = (r) => { setRegion(r); setCity(''); onChange(''); };
  const handleCity   = (c) => { setCity(c);   onChange(''); };

  // Fall back to flat list when backend has no data
  if (cities.length === 0) {
    return <ListPicker label={label} value={value} items={KG_QUARTIERS} onChange={onChange} />;
  }

  return (
    <View style={{ gap: 8 }}>
      <ListPicker label={`${label} — Région`} value={region}  items={regions}                    onChange={handleRegion} />
      <ListPicker label={`${label} — Ville`}  value={city}    items={citiesInRegion.map(c => c.name)} onChange={handleCity} disabled={!region} />
      <ListPicker label={`${label} — Quartier`} value={value} items={neighborhoods}              onChange={onChange}    disabled={!city} />
    </View>
  );
}

function Detail({ label, value, last }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.ink06 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>{label}</Text>
      <View>{typeof value === 'string'
        ? <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13.5, color: colors.ink }}>{value}</Text>
        : value}
      </View>
    </View>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: '#DC2626', marginTop: 4 }}>{msg}</Text>;
}

export default function PostDeliveryScreen({ navigation }) {
  const { api, token, showToast, pricing, lang, user } = useApp();
  const { t } = useI18n();
  const isEn = lang === 'en';

  const PARCEL_TYPES = useMemo(() => [
    { id: t('Vêtements'),    icon: 'package' },
    { id: t('Documents'),    icon: 'id'      },
    { id: t('Électronique'), icon: 'bolt'    },
    { id: t('Alimentaire'),  icon: 'sparkle' },
    { id: t('Autre'),        icon: 'package' },
  ], [t]);

  const WEIGHT_PRESETS = useMemo(() => [
    { label: t('Documents'), w: 0.3 },
    { label: t('Petit'),     w: 1.5 },
    { label: t('Moyen'),     w: 3.5 },
    { label: t('Gros'),      w: 7   },
  ], [t]);

  const COURIER_TYPES = useMemo(() => [
    { id: 'TEMPORAIRE', title: t('Standard'), sub: t('Tarif de base'),    mul: 'x1.0',  icon: 'user'  },
    { id: 'EXPRESS',    title: t('Express'),  sub: t('Livraison rapide'), mul: 'x1.25', icon: 'bolt'  },
    { id: 'VVIP',       title: t('VVIP'),     sub: t('Certifié premium'), mul: 'x1.40', icon: 'crown' },
  ], [t]);

  // Captured once at signup; the vendor never retypes it per delivery.
  const [shopName, setShopName]     = useState(user?.shopName ?? '');
  const [from, setFrom]             = useState('Akwa');
  const [parcelDesc, setParcelDesc] = useState('');
  const [parcelType, setParcelType] = useState('Vêtements');
  const [to, setTo]                 = useState('Bonapriso');
  const [weight, setWeight]         = useState(1.2);
  const [type, setType]             = useState('TEMPORAIRE');
  const [productPrice, setProductPrice] = useState('');

  const [recipient, setRecipient]           = useState('');
  const [clientPhone, setClientPhone]       = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [cities, setCities]   = useState([]);
  const [fetchedDistance, setFetchedDistance] = useState(null);
  const [distanceFetching, setDistanceFetching] = useState(false);

  // Load cities for cascade picker.
  useEffect(() => {
    apiFetch('/api/public/cities').then(data => { if (Array.isArray(data)) setCities(data); }).catch(() => {});
  }, []);

  // The profile can land after first render (cold start restores the session
  // asynchronously), so adopt its shop name once it arrives.
  useEffect(() => {
    if (user?.shopName) setShopName(user.shopName);
  }, [user?.shopName]);

  // Fetch real road distance from backend when from/to changes
  useEffect(() => {
    if (!from || !to) return;
    if (kgEstimateDistance(from, to) > 0 && from !== to) {
      setDistanceFetching(true);
      apiFetch(`/api/public/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .then(data => { if (typeof data?.km === 'number' && data.km > 0) setFetchedDistance(data.km); })
        .catch(() => {})
        .finally(() => setDistanceFetching(false));
    }
  }, [from, to]);

  const distance = fetchedDistance ?? kgEstimateDistance(from, to);
  const price    = useMemo(() => {
    const { baseRate = 300, perKmRate = 150, minPrice = 1000, weightSurcharge = 100 } = pricing || {};
    const mult = { TEMPORAIRE: 1, EXPRESS: 1.25, VVIP: 1.4 }[type] || 1;
    return Math.max(minPrice, Math.round((baseRate + distance * perKmRate + weight * weightSurcharge) * mult));
  }, [distance, weight, type, pricing]);

  const productVal  = parseInt(productPrice, 10) || 0;
  const totalClient = price + productVal;
  const phoneNorm   = clientPhone.replace(/\s/g, '');

  const validateStep1 = () => {
    const errs = {};
    // Only legacy accounts still type this; new ones inherit it from the profile.
    if (!shopName.trim() && !user?.shopName) errs.shopName = t('Indique le nom de ta boutique');
    if (!parcelDesc.trim()) errs.parcelDesc = t('Décris le colis');
    if (!recipient.trim())  errs.recipient  = t('Indique le nom du destinataire');
    if (!phoneNorm)         errs.clientPhone = t('Numéro requis');
    else if (!/^6\d{8}$/.test(phoneNorm))   errs.clientPhone = t('Format invalide');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => { if (validateStep1()) setStep(2); };

  const handlePublish = async () => {
    setLoading(true);
    try {
      if (token) {
        const result = await api('/api/deliveries', {
          method: 'POST',
          body: JSON.stringify({
            shopName:       shopName.trim(),
            fromQuartier:   from,
            toQuartier:     to,
            parcelDesc:     parcelDesc.trim(),
            parcelType,
            distance,
            weight,
            courierType:    type,
            recipientName:  recipient.trim(),
            recipientPhone: phoneNorm,
            recipientEmail: recipientEmail.trim() || undefined,
            clientWhatsApp: phoneNorm,
            productPrice:   productVal,
          }),
        });
        navigation.navigate('VendorCodes', {
          deliveryId:    result.id,
          clientToken:   result.clientToken,
          price:         result.priceXAF ?? price,
          from, to,
          collectCode:   result.collectCode,
          deliverCode:   result.deliverCode,
          shopName:      shopName.trim(),
          parcelDesc:    parcelDesc.trim(),
          recipientName: recipient.trim(),
          recipientPhone: phoneNorm,
          productPrice:  productVal,
        });
      } else {
        const deliveryId  = `KG-${Date.now().toString().slice(-6)}`;
        const collectCode = String(Math.floor(1000 + Math.random() * 9000));
        const deliverCode = String(Math.floor(1000 + Math.random() * 9000));
        navigation.navigate('VendorCodes', {
          deliveryId, collectCode, deliverCode, from, to, price,
          shopName: shopName.trim(), parcelDesc: parcelDesc.trim(),
          recipientName: recipient.trim(), recipientPhone: phoneNorm, productPrice: productVal,
        });
      }
    } catch (err) {
      showToast(err.message || 'Impossible de créer la livraison', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar
        title={step === 1 ? t('Nouvelle livraison') : t('Confirmer')}
        onBack={() => step === 1 ? navigation.goBack() : setStep(1)}
      />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {step === 1 && (
          <>
            <KGSectionTitle>{t('Ta boutique')}</KGSectionTitle>
            <KGCard padding={14} style={{ gap: 10 }}>
              {user?.shopName ? (
                // Set once at signup — shown for confirmation, not re-entry.
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                  <Icon name="package" size={16} color={colors.green} />
                  <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 15, color: colors.ink }}>
                    {user.shopName}
                  </Text>
                </View>
              ) : (
                // Accounts created before the shop name moved onto the profile.
                <View>
                  <KGInput
                    label={t('Nom de ta boutique')}
                    value={shopName}
                    onChangeText={v => { setShopName(v); setFieldErrors(e => ({ ...e, shopName: null })); }}
                    icon="package"
                    placeholder={t('Nom de ta boutique')}
                  />
                  <FieldError msg={fieldErrors.shopName} />
                </View>
              )}
              <LocationPicker
                label={isEn ? 'Pickup area' : 'Quartier de départ (retrait)'}
                value={from}
                onChange={setFrom}
                cities={cities}
              />
            </KGCard>

            <KGSectionTitle>{isEn ? 'The parcel' : 'Le colis'}</KGSectionTitle>
            <KGCard padding={14} style={{ gap: 12 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.05 }}>
                  {isEn ? 'Type' : 'Type de colis'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {PARCEL_TYPES.map(pt => {
                    const on = parcelType === pt.id;
                    return (
                      <TouchableOpacity key={pt.id} onPress={() => setParcelType(pt.id)}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: on ? colors.green : colors.ink12, backgroundColor: on ? colors.greenLight : '#fff', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name={pt.icon} size={14} color={on ? colors.greenDark : colors.ink55} />
                        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: on ? colors.greenDark : colors.ink70 }}>{pt.id}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View>
                <KGInput
                  label={isEn ? 'Parcel description' : 'Description du colis'}
                  value={parcelDesc}
                  onChangeText={v => { setParcelDesc(v); setFieldErrors(e => ({ ...e, parcelDesc: null })); }}
                  icon="package"
                  placeholder={isEn ? 'e.g. wax dress · 1 piece' : 'ex: Robe wax tissu · 1 pièce'}
                />
                <FieldError msg={fieldErrors.parcelDesc} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink70 }}>{isEn ? 'Weight' : 'Poids'}</Text>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 18, color: colors.ink }}>{weight} kg</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {WEIGHT_PRESETS.map(p => {
                  const on = Math.abs(weight - p.w) < 0.05;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      onPress={() => setWeight(p.w)}
                      style={{ flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: on ? colors.green : colors.ink12, backgroundColor: on ? colors.greenLight : '#fff', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: on ? colors.greenDark : colors.ink70 }}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setWeight(w => Math.max(0.1, parseFloat((w - 0.5).toFixed(1))))} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="minus" size={18} color={colors.ink} />
                </TouchableOpacity>
                <View style={{ flex: 1, height: 6, backgroundColor: colors.cream, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ width: `${((weight - 0.1) / 9.9) * 100}%`, height: '100%', backgroundColor: colors.green, borderRadius: 3 }} />
                </View>
                <TouchableOpacity onPress={() => setWeight(w => Math.min(10, parseFloat((w + 0.5).toFixed(1))))} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={18} color={colors.ink} />
                </TouchableOpacity>
              </View>
            </KGCard>

            <KGSectionTitle>{isEn ? 'Speed' : 'Urgence'}</KGSectionTitle>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {COURIER_TYPES.map(opt => {
                const on = type === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setType(opt.id)}
                    style={{ flex: 1, borderWidth: 1.5, borderColor: on ? colors.green : colors.ink12, borderRadius: 14, backgroundColor: on ? colors.greenLight : '#fff', padding: 12, gap: 4 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Icon name={opt.icon} size={20} color={on ? colors.green : colors.ink70} />
                      <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 10, color: on ? colors.greenDark : colors.ink55 }}>{opt.mul}</Text>
                    </View>
                    <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13, color: colors.ink, marginTop: 4 }}>{opt.title}</Text>
                    <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink55 }}>{opt.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <KGSectionTitle>Destination & client</KGSectionTitle>
            <KGCard padding={14} style={{ gap: 12 }}>
              <LocationPicker
                label={isEn ? 'Delivery area' : 'Quartier de livraison'}
                value={to}
                onChange={setTo}
                cities={cities}
              />
              <View style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.cream, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{isEn ? 'Estimated distance' : 'Distance estimée'}</Text>
                {distanceFetching
                  ? <ActivityIndicator size="small" color={colors.green} />
                  : <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13, color: colors.ink }}>{distance} km</Text>}
              </View>

              <View>
                <KGInput
                  label={isEn ? 'Recipient name' : 'Nom du destinataire'}
                  value={recipient}
                  onChangeText={v => { setRecipient(v); setFieldErrors(e => ({ ...e, recipient: null })); }}
                  icon="user"
                  placeholder={isEn ? 'e.g. Aïcha N.' : 'ex: Aïcha N.'}
                />
                <FieldError msg={fieldErrors.recipient} />
              </View>

              <View>
                <KGInput
                  label={isEn ? 'Client phone / WhatsApp' : 'Téléphone / WhatsApp du client'}
                  value={clientPhone}
                  onChangeText={v => { setClientPhone(v); setFieldErrors(e => ({ ...e, clientPhone: null })); }}
                  icon="chat"
                  suffix="+237"
                  keyboardType="phone-pad"
                  placeholder="6 XX XX XX XX"
                  hint={isEn ? 'Delivery code will be sent here' : 'Le code de réception lui sera envoyé ici'}
                />
                <FieldError msg={fieldErrors.clientPhone} />
              </View>

              <KGInput
                label={isEn ? 'Client email (optional)' : 'Email du destinataire (optionnel)'}
                value={recipientEmail}
                onChangeText={setRecipientEmail}
                icon="bell"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="ex: client@gmail.com"
                hint={isEn ? 'Tracking link will be sent to this email' : 'Le lien de suivi sera envoyé à cet email'}
              />
            </KGCard>

            <KGSectionTitle>{isEn ? 'Goods value' : 'Valeur de la marchandise'}</KGSectionTitle>
            <KGCard padding={14}>
              <KGInput
                label={isEn ? 'Client sale price (XAF)' : 'Prix de vente au client (XAF)'}
                value={productPrice}
                onChangeText={setProductPrice}
                icon="wallet"
                keyboardType="numeric"
                placeholder={isEn ? 'e.g. 15000' : 'ex: 15000'}
              />
            </KGCard>

            <View style={{ backgroundColor: colors.ink, borderRadius: 18, padding: 16, gap: 10, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(13,122,62,0.22)' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.04 }}>{isEn ? 'Delivery fee' : 'Frais de livraison'}</Text>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 30, color: '#fff', marginTop: 2 }}>
                    {price.toLocaleString('fr-FR')} <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)' }}>XAF</Text>
                  </Text>
                </View>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="sparkle" size={20} color="#fff" />
                </View>
              </View>
              {productVal > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{isEn ? 'Total billed to client' : 'Total facturé client'}</Text>
                  <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: '#fff' }}>{totalClient.toLocaleString('fr-FR')} XAF</Text>
                </View>
              )}
              <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {from} {'->'} {to} {'·'} {distanceFetching ? '…' : `${distance} km`} {'·'} {weight} kg
              </Text>
            </View>

            <KGButton kind="primary" size="lg" iconRight="arrow" onPress={handleContinue}>
              {isEn ? 'Continue' : 'Continuer'}
            </KGButton>
          </>
        )}

        {step === 2 && (
          <>
            <KGCard kind="cream" padding={18} style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.ink55, letterSpacing: 0.04, textTransform: 'uppercase' }}>{isEn ? 'Delivery fee' : 'Frais de livraison'}</Text>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 52, color: colors.ink, lineHeight: 56 }}>{price.toLocaleString('fr-FR')}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>XAF {'·'} {isEn ? 'paid on delivery' : 'payé à la livraison'}</Text>
            </KGCard>

            <KGCard padding={14}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 10 }}>{isEn ? 'Summary' : 'Récapitulatif'}</Text>
              <RouteLine from={from} to={to} />
              <View style={{ height: 1, backgroundColor: colors.ink06, marginVertical: 12 }} />
              <Detail label={isEn ? 'Shop' : 'Boutique'}         value={shopName || '—'} />
              <Detail label={isEn ? 'Parcel' : 'Colis'}          value={parcelDesc || '—'} />
              <Detail label="Distance"                            value={`${distance} km`} />
              <Detail label={isEn ? 'Weight' : 'Poids'}          value={`${weight} kg`} />
              <Detail label={isEn ? 'Speed' : 'Urgence'}         value={<KGCourierBadge type={type.toLowerCase()} />} />
              <Detail label={isEn ? 'Recipient' : 'Destinataire'} value={recipient || '—'} />
              <Detail label={isEn ? 'Phone / WhatsApp' : 'Téléphone / WhatsApp'} value={phoneNorm ? `+237 ${phoneNorm}` : '—'} />
              {productVal > 0 && <Detail label={isEn ? 'Goods value' : 'Valeur marchandise'} value={`${productVal.toLocaleString('fr-FR')} XAF`} />}
              <Detail label={isEn ? 'Total billed to client' : 'Total facturé client'} value={`${totalClient.toLocaleString('fr-FR')} XAF`} last />
            </KGCard>

            <KGCard kind="green" padding={14}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Icon name="shield" size={22} color={colors.greenDark} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.greenDark }}>{isEn ? '2 secure codes generated' : '2 codes sécurisés générés'}</Text>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.greenDark, marginTop: 4, lineHeight: 18, opacity: 0.85 }}>
                    {isEn
                      ? 'Code A (orange): give it to the deliverer at pickup.\nCode B (green): share it with your client to confirm delivery.'
                      : 'Code A (orange) : tu le donnes au livreur à la prise en charge.\nCode B (vert) : tu le partages avec ton client pour confirmer la réception.'}
                  </Text>
                </View>
              </View>
            </KGCard>

            <KGButton kind="primary" size="lg" icon={loading ? undefined : 'check'} disabled={loading} onPress={handlePublish}>
              {loading ? <ActivityIndicator color="#fff" /> : (isEn ? 'Publish delivery' : "Publier l'annonce")}
            </KGButton>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
