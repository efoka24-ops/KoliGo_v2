import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

export default function ProfileChoiceScreen({ navigation }) {
  const { token, api, user, loginAs, pendingUser, setPendingUser, showToast } = useApp();
  const [loading, setLoading] = useState(null);

  const existingRoles = user?.roles || [];
  const hasVendor    = existingRoles.includes('VENDOR');
  const hasDeliverer = existingRoles.includes('DELIVERER');
  const isMulti      = hasVendor && hasDeliverer;

  const pick = async (role) => {
    if (!token) { showToast('Session expirée — reconnecte-toi.', 'error'); navigation.replace('Auth'); return; }
    setLoading(role);
    try {
      const roleUpper = role === 'vendor' ? 'VENDOR' : 'DELIVERER';
      const result = await api('/api/auth/switch-role', { method: 'POST', body: JSON.stringify({ role: roleUpper }) });
      loginAs({ ...result.user, role: (result.user.role || role).toLowerCase() }, result.accessToken);
      setPendingUser(null);
      navigation.replace(role === 'vendor' ? 'VendorHome' : 'DelivererHome');
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Tu es ?" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>

        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 30, color: '#0E2116', letterSpacing: -0.5 }}>
            Choisis ton mode
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, marginTop: 6, lineHeight: 20 }}>
            {isMulti
              ? 'Tu as les deux profils actifs. Choisis lequel utiliser maintenant.'
              : "Tu pourras passer de l'un à l'autre depuis ton profil."}
          </Text>
        </View>

        {isMulti && (
          <View style={{ backgroundColor: '#EFF8F1', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#C8E8D0' }}>
            <Icon name="shield" size={16} color={colors.greenDark} />
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.greenDark }}>
              Double profil actif — activités suivies séparément.
            </Text>
          </View>
        )}

        {/* Vendor card */}
        <TouchableOpacity
          onPress={() => pick('vendor')}
          activeOpacity={0.88}
          disabled={!!loading}
          style={{
            borderRadius: 24, overflow: 'hidden',
            opacity: loading && loading !== 'vendor' ? 0.45 : 1,
            shadowColor: '#0D7A3E', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 8,
          }}
        >
          <View style={{ backgroundColor: colors.green, padding: 22, gap: 14 }}>
            {/* Losange déco top-right */}
            <View style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <View style={{ position: 'absolute', top: 10, right: 10, width: 60, height: 60, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', transform: [{ rotate: '20deg' }] }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="package" size={28} color="#fff" />
                </View>
                {hasVendor && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: '#fff' }}>Profil existant</Text>
                  </View>
                )}
              </View>
              {loading === 'vendor' ? <ActivityIndicator color="#fff" /> : <Icon name="arrow" size={22} color="#fff" />}
            </View>

            <View>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>Je suis vendeur</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: 'rgba(255,255,255,0.82)', marginTop: 5, lineHeight: 20 }}>
                {hasVendor
                  ? `Connexion à ton profil vendeur — ${user?.name || 'tes infos sont conservées'}.`
                  : 'Je vends en ligne et je dois faire livrer mes commandes vite.'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {['Créer une annonce', 'Calcul auto du prix', 'Codes sécurisés'].map(tag => (
                <View key={tag} style={{ backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#fff' }}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>

        {/* Deliverer card */}
        <TouchableOpacity
          onPress={() => pick('deliverer')}
          activeOpacity={0.88}
          disabled={!!loading}
          style={{
            borderRadius: 24, overflow: 'hidden',
            opacity: loading && loading !== 'deliverer' ? 0.45 : 1,
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 8,
          }}
        >
          <View style={{ backgroundColor: '#0E2116', padding: 22, gap: 14 }}>
            <View style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(196,97,26,0.15)' }} />
            <View style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(212,153,26,0.08)' }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#C4611A', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="moto" size={28} color="#fff" />
                </View>
                {hasDeliverer && (
                  <View style={{ backgroundColor: 'rgba(196,97,26,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: '#C4611A' }}>Profil existant</Text>
                  </View>
                )}
              </View>
              {loading === 'deliverer' ? <ActivityIndicator color="#fff" /> : <Icon name="arrow" size={22} color="#fff" />}
            </View>

            <View>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>Je suis livreur</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: 'rgba(255,255,255,0.68)', marginTop: 5, lineHeight: 20 }}>
                {hasDeliverer
                  ? `Connexion à ton profil livreur — ${user?.name || 'tes infos sont conservées'}.`
                  : 'Je veux gagner ma vie en livrant des colis dans ma zone.'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {['Choisis tes courses', 'Wallet Mobile Money', 'Retraits 0 frais'].map(tag => (
                <View key={tag} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>

        {!isMulti && (hasVendor || hasDeliverer) && (
          <View style={{ backgroundColor: '#F5F0E8', borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: '#E8DCC8' }}>
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: colors.ink }}>Ajouter le deuxième profil ?</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, lineHeight: 18 }}>
              En choisissant l'autre mode, tes informations actuelles seront réutilisées et les deux profils seront sauvegardés.
            </Text>
          </View>
        )}

        <Text style={{ textAlign: 'center', fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: '#B8A48A' }}>
          ◈ Fier produit camerounais 🇨🇲
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
