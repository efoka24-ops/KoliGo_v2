import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
import { capturePhoto, pickFromGallery } from '../../utils/camera';
import { errMsg } from '../../utils/apiError';
import { tr } from '../../i18n/tr';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import KGTextarea from '../../components/KGTextarea';
import KGToast from '../../components/KGToast';
import KenteStripe from '../../components/KenteStripe';
import { CATEGORY_LABELS, DurationPicker, AdPaymentWait, PhoneModal, money } from '../../components/AdsShared';

const Section = ({ children }) => (
  <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 }}>{children}</Text>
);

function Pick({ items, value, onChange, label = (x) => x }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {items.map((it) => {
        const on = value === it;
        return (
          <TouchableOpacity key={it} onPress={() => onChange(it)} activeOpacity={0.8}
            style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: on ? colors.green : '#fff', borderWidth: 1, borderColor: on ? colors.green : '#E8DCC8', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12.5, color: on ? '#fff' : colors.ink70 }}>{label(it)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Publier une annonce : Flash gratuit (24 h) ou Boost payant, mis en ligne à la confirmation du paiement. */
export default function PostAdScreen({ navigation }) {
  const { api, toast, showToast } = useApp();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState(null);
  const [cities, setCities] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [quartier, setQuartier] = useState('');
  const [stock, setStock] = useState('');
  const [contactMode, setContactMode] = useState('CALL');
  const [duration, setDuration] = useState({ type: 'FLASH' });
  const [busy, setBusy] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [pay, setPay] = useState(null); // { adId, amount }

  useEffect(() => {
    apiFetch('/public/ads/config').then(setConfig).catch(() => {});
    apiFetch('/public/cities').then((d) => { if (Array.isArray(d)) setCities(d.map((c) => c.name).filter(Boolean)); }).catch(() => {});
  }, []);

  const maxPhotos = config?.maxPhotos || 4;
  const tariff = duration.type === 'BOOST' ? (config?.tariffs || []).find((t) => t.days === duration.days) : null;

  const addPhoto = async (fromGallery) => {
    if (photos.length >= maxPhotos) { showToast(tr(`${maxPhotos} photos maximum.`), 'error'); return; }
    const shot = fromGallery ? await pickFromGallery({ quality: 0.6 }) : await capturePhoto({ quality: 0.6 });
    if (shot.status === 'cancelled') return;
    if (shot.status !== 'ok') { showToast(shot.message, 'error'); return; }
    setPhotos((p) => [...p, { uri: shot.uri, data: shot.base64 }]);
  };

  const validate = () => {
    if (photos.length < 1) return tr('Ajoute au moins une photo.');
    if (title.trim().length < 3) return tr('Le titre doit faire au moins 3 caractères.');
    if (description.trim().length < 10) return tr('La description doit faire au moins 10 caractères.');
    if (!category) return tr('Choisis une catégorie.');
    if (price === '') return tr('Indique le prix.');
    if (!city) return tr('Choisis la ville.');
    return null;
  };

  const submit = async (phone) => {
    setBusy(true);
    try {
      const r = await api('/ads', {
        method: 'POST',
        timeout: 90000,
        body: JSON.stringify({
          title: title.trim(), description: description.trim(), category, priceXAF: parseInt(price, 10) || 0, city, quartier: quartier.trim() || undefined,
          stock: stock === '' ? undefined : parseInt(stock, 10), contactMode, photos: photos.map((p) => p.data),
          type: duration.type, days: duration.days, phone,
        }),
      });
      if (r?.moderated) { showToast(tr('Annonce reçue : elle sera mise en ligne après vérification par KoliGo.')); navigation.replace('MyAds'); return; }
      if (r?.ad?.status === 'BROUILLON') { setPay({ adId: r.ad.id, amount: tariff?.priceXAF || 0 }); return; }
      showToast(tr('Annonce publiée ✓'), 'success');
      navigation.replace('MyAds');
    } catch (e) {
      showToast(errMsg(e, tr("Impossible de publier l'annonce.")), 'error');
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    const err = validate();
    if (err) { showToast(err, 'error'); return; }
    if (duration.type === 'BOOST' && tariff?.priceXAF > 0) setPhoneOpen(true);
    else submit(undefined);
  };

  const onPaymentDone = async (result) => {
    const adId = pay?.adId;
    setPay(null);
    if (result === 'success') { showToast(tr('Paiement confirmé : annonce en ligne ✓'), 'success'); navigation.replace('MyAds'); return; }
    // Paiement refusé ou abandonné : le brouillon est retiré, le formulaire reste rempli pour réessayer.
    if (result === 'failed' && adId) { try { await api(`/ads/${adId}/withdraw`, { method: 'POST' }); } catch { /* sans importance */ } }
    if (result === 'failed') showToast(tr("Le paiement n'a pas abouti. Tu peux réessayer."), 'error');
    else navigation.replace('MyAds');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}
      <KenteStripe height={4} />
      <KGTopBar title={tr('Publier une annonce')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Section>{tr('Photos')} ({photos.length}/{maxPhotos})</Section>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {photos.map((p, i) => (
            <TouchableOpacity key={i} onPress={() => setPhotos((arr) => arr.filter((_, j) => j !== i))} style={{ marginRight: 10 }}>
              <Image source={{ uri: p.uri }} style={{ width: 92, height: 92, borderRadius: 12, backgroundColor: colors.cream }} />
              <Text style={{ position: 'absolute', top: 4, right: 6, color: '#fff', fontWeight: '700', textShadowColor: '#000', textShadowRadius: 3 }}>✕</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><KGButton kind="soft" size="md" icon="camera" onPress={() => addPhoto(false)}>{tr('Prendre une photo')}</KGButton></View>
          <View style={{ flex: 1 }}><KGButton kind="ghost" size="md" onPress={() => addPhoto(true)}>{tr('Galerie')}</KGButton></View>
        </View>

        <KGInput label={tr('Titre')} value={title} onChangeText={setTitle} placeholder={tr('Ex : Manga Naruto tome 1')} />
        <KGTextarea label={tr('Description')} value={description} onChangeText={setDescription} placeholder={tr('État, caractéristiques…')} rows={4} />

        <Section>{tr('Catégorie')}</Section>
        <Pick items={Object.keys(CATEGORY_LABELS)} value={category} onChange={setCategory} label={(c) => tr(CATEGORY_LABELS[c])} />

        <KGInput label={tr('Prix (F)')} value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ''))} keyboardType="numeric" placeholder="15000" />

        <Section>{tr('Ville')}</Section>
        <Pick items={cities} value={city} onChange={setCity} />
        <KGInput label={tr('Quartier (facultatif)')} value={quartier} onChangeText={setQuartier} placeholder={tr('Ex : Roumdé Adjia')} />
        <KGInput label={tr('Stock (facultatif)')} value={stock} onChangeText={(v) => setStock(v.replace(/\D/g, ''))} keyboardType="numeric" placeholder="3" />

        <Section>{tr('Contact')}</Section>
        <Pick items={['CALL', 'WHATSAPP']} value={contactMode} onChange={setContactMode} label={(m) => (m === 'CALL' ? tr('Appel') : 'WhatsApp')} />

        <Section>{tr('Durée de visibilité')}</Section>
        <DurationPicker config={config} value={duration} onChange={setDuration} />
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, lineHeight: 18 }}>
          {tr("Le Boost est payé avant la mise en ligne et n'est pas remboursable. L'annonce disparaît à l'expiration ; tu pourras la republier.")}
        </Text>

      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 16, backgroundColor: '#FBF5E6', borderTopWidth: 1, borderTopColor: 'rgba(14,33,22,0.08)' }}>
        <KGButton kind="primary" size="lg" icon="check" disabled={busy} onPress={publish}>
          {busy ? tr('Envoi…') : duration.type === 'BOOST' && tariff ? `${tr('Payer et publier')} · ${money(tariff.priceXAF)}` : tr('Publier gratuitement')}
        </KGButton>
      </View>

      <PhoneModal visible={phoneOpen} amount={tariff?.priceXAF || 0} onCancel={() => setPhoneOpen(false)} onConfirm={(phone) => { setPhoneOpen(false); submit(phone); }} />
      <AdPaymentWait visible={!!pay} adId={pay?.adId} amount={pay?.amount} onDone={onPaymentDone} />
    </SafeAreaView>
  );
}
