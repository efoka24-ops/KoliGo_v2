import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGInput from '../../components/KGInput';
import Icon from '../../components/Icon';
import { useApp } from '../../context/AppContext';

const PROVIDERS = [
  { id: 'mtn',    label: 'MTN MoMo',      sub: 'Numéros 65x-67x, 68x', bg: '#FFCC00', textColor: '#1A1A1A' },
  { id: 'orange', label: 'Orange Money',   sub: 'Numéros 69x, 65x',     bg: colors.orange, textColor: '#fff' },
];

export default function PaymentAccountScreen({ navigation }) {
  const { api, showToast, setUser } = useApp();
  const [provider, setProvider] = useState('mtn');
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/user/profile')
      .then(u => {
        if (u.paymentProvider) setProvider(u.paymentProvider);
        if (u.paymentNumber)   setNumber(u.paymentNumber);
        if (u.paymentName)     setName(u.paymentName);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!number.trim() || !name.trim()) {
      showToast('Remplis le numéro et le nom du titulaire.', 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = await api('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ paymentProvider: provider, paymentNumber: number.trim(), paymentName: name.trim() }),
      });
      setUser(prev => ({ ...prev, ...updated }));
      showToast('Compte de paiement enregistré âœ"', 'success');
      navigation.navigate('ProfileChoice');
    } catch (err) {
      showToast(err.message || 'Erreur lors de la sauvegarde.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="Compte de paiement" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.green} size="large" />
        </View>
      ) : (
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, letterSpacing: -0.02 * 26, color: colors.ink }}>
            Où on t'envoie l'argent ?
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink70, lineHeight: 21 }}>
            Choisis ton compte Mobile Money. C'est là que KoliGo verse automatiquement tes paiements après chaque livraison.
          </Text>
        </View>

        {/* Provider selection */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {PROVIDERS.map(p => {
            const on = provider === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setProvider(p.id)}
                style={{
                  flex: 1, borderWidth: 2,
                  borderColor: on ? colors.green : colors.ink12,
                  borderRadius: 16, padding: 14, gap: 8, backgroundColor: '#fff',
                }}
              >
                <View style={{ height: 32, borderRadius: 8, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 12, color: p.textColor }}>{p.label}</Text>
                </View>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11.5, color: colors.ink55 }}>{p.sub}</Text>
                {on && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={12} color={colors.green} />
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.green }}>Sélectionné</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Account details */}
        <KGCard padding={14} style={{ gap: 14 }}>
          <KGInput
            label="Numéro du compte"
            value={number}
            onChangeText={setNumber}
            icon="bell"
            suffix="ðŸ‡¨ðŸ‡² +237"
            keyboardType="phone-pad"
          />
          <KGInput
            label="Nom du titulaire"
            value={name}
            onChangeText={setName}
            icon="user"
            hint="Doit correspondre exactement au compte MoMo/OM"
          />
        </KGCard>

        {/* Security notice */}
        <KGCard kind="green" padding={14}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Icon name="shield" size={20} color={colors.greenDark} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13.5, color: colors.greenDark }}>Paiement automatique</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.greenDark, marginTop: 4, lineHeight: 18, opacity: 0.85 }}>
                Chaque transaction est répartie en direct : marchandise + livraison + frais. Tu reçois ta part sans cliquer.
              </Text>
            </View>
          </View>
        </KGCard>

        <KGButton
          kind="primary"
          size="lg"
          iconRight="arrow"
          loading={saving}
          onPress={handleSave}
        >
          Enregistrer et continuer
        </KGButton>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}
