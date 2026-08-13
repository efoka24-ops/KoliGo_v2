import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/auth';
import KGTopBar from '../../components/KGTopBar';
import KGInput from '../../components/KGInput';
import KGButton from '../../components/KGButton';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

export default function SignupScreen({ navigation, route }) {
  const { setPendingUser, showToast } = useApp();
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [email, setEmail]     = useState('');
  const [shopName, setShopName] = useState('');
  const [gender, setGender]   = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (route.params?.termsAccepted) {
      setAccepted(true);
    }
  }, [route.params?.termsAccepted]);

  const canProceed = name.trim().length >= 2 && shopName.trim().length >= 2 && phone.trim().length >= 8 && email.includes('@') && gender !== '' && accepted;

  const handleContinue = async () => {
    if (!canProceed) return;
    const normalized = phone.replace(/\s/g, '');
    setLoading(true);
    try {
      const fullPhone = '+237' + normalized;
      await authService.sendOtp(fullPhone, email.trim(), name.trim());
      setPendingUser({ name: name.trim(), shopName: shopName.trim(), phone: fullPhone, email: email.trim(), gender });
      navigation.navigate('Otp');
    } catch (e) {
      showToast(e?.response?.data?.error || 'Erreur réseau', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Créer un compte" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#B8A48A', textTransform: 'uppercase', letterSpacing: 0.08 }}>
            Étape 1 / 3
          </Text>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#0E2116', letterSpacing: -0.5, marginTop: 4 }}>
            Ton compte
          </Text>
        </View>

        <KGInput
          label="Nom complet"
          value={name}
          onChangeText={setName}
          icon="user"
          placeholder="Awa N."
          autoCapitalize="words"
        />
        <KGInput
          label="Nom de la boutique"
          value={shopName}
          onChangeText={setShopName}
          icon="package"
          placeholder="Chez Awa"
          autoCapitalize="words"
          hint="Demandé une seule fois — il apparaîtra sur toutes tes livraisons"
        />
        <KGInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          icon="mail"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="vous@exemple.cm"
          hint="On t'envoie le code OTP et les confirmations ici"
        />
        <KGInput
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          icon="phone"
          suffix="+237"
          keyboardType="phone-pad"
          placeholder="6 XX XX XX XX"
        />

        {/* Genre */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink70 }}>Genre</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[{ id: 'HOMME', label: 'Homme' }, { id: 'FEMME', label: 'Femme' }].map(g => {
              const on = gender === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setGender(g.id)}
                  activeOpacity={0.85}
                  style={{
                    flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5,
                    borderColor: on ? colors.green : '#E8DCC8',
                    backgroundColor: on ? '#EFF8F1' : '#F5F0E8',
                    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
                  }}
                >
                  <View style={{
                    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
                    borderColor: on ? colors.green : '#C8BEA8',
                    backgroundColor: on ? colors.green : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                  </View>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: on ? colors.greenDark : colors.ink70 }}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CGU */}
        <TouchableOpacity
          onPress={() => setAccepted(a => !a)}
          activeOpacity={0.88}
          style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 12,
            backgroundColor: accepted ? '#EFF8F1' : '#F5F0E8',
            padding: 14, borderRadius: 14,
            borderWidth: 1.5, borderColor: accepted ? colors.green : '#E8DCC8',
          }}
        >
          <View style={{
            width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
            borderColor: accepted ? colors.green : '#C8BEA8',
            backgroundColor: accepted ? colors.green : 'transparent',
            alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
          }}>
            {accepted && <Icon name="check" size={11} color="#fff" />}
          </View>
          <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink70, lineHeight: 21 }}>
            J'ai lu et j'accepte les{' '}
            <Text
              style={{ fontFamily: `${fonts.ui}-Bold`, color: colors.green, textDecorationLine: 'underline' }}
              onPress={(e) => { e.stopPropagation?.(); navigation.navigate('Terms'); }}
            >
              CGU & politique de confidentialité
            </Text>
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
          <Icon name="shield" size={12} color={colors.green} />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.green, letterSpacing: 0.3 }}>
            Données protégées · KoliGo
          </Text>
        </View>

        <KGButton
          kind="primary"
          size="lg"
          icon={loading ? undefined : 'arrow'}
          disabled={!canProceed || loading}
          onPress={handleContinue}
        >
          {loading ? <ActivityIndicator color="#fff" /> : 'Recevoir mon code'}
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
