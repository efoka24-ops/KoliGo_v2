import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import Icon from '../../components/Icon';

export default function ProfileChoiceScreen({ navigation }) {
  const { token, api, user, loginAs, pendingUser, setPendingUser, showToast } = useApp();
  const [loading, setLoading] = useState(null);

  // Roles this user already has
  const existingRoles = user?.roles || [];
  const hasVendor = existingRoles.includes('VENDOR');
  const hasDeliverer = existingRoles.includes('DELIVERER');
  const isMulti = hasVendor && hasDeliverer;

  const pick = async (role) => {
    if (!token) {
      showToast('Session expirÃ©e â€” reconnecte-toi.', 'error');
      navigation.replace('Auth');
      return;
    }
    setLoading(role);
    try {
      const roleUpper = role === 'vendor' ? 'VENDOR' : 'DELIVERER';
      const result = await api('/api/auth/switch-role', {
        method: 'POST',
        body: JSON.stringify({ role: roleUpper }),
      });
      loginAs({ ...result.user, role: (result.user.role || role).toLowerCase() }, result.token);
      setPendingUser(null);
      navigation.replace(role === 'vendor' ? 'VendorHome' : 'DelivererHome');
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const RoleBadge = ({ label }) => (
    <View style={{ backgroundColor: colors.greenLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name="check" size={11} color={colors.green} />
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.greenDark }}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="Tu es ?" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>

        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: colors.ink, letterSpacing: -0.5 }}>
            Choisis ton mode
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink70, marginTop: 6 }}>
            {isMulti
              ? 'Tu as les deux profils actifs. Choisis lequel utiliser maintenant.'
              : 'Tu pourras passer de l\'un Ã  l\'autre depuis ton profil.'}
          </Text>
        </View>

        {isMulti && (
          <View style={{ backgroundColor: colors.greenLight, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="shield" size={16} color={colors.greenDark} />
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.greenDark }}>
              Double profil actif â€” tes activitÃ©s sont suivies sÃ©parÃ©ment pour chaque rÃ´le.
            </Text>
          </View>
        )}

        {/* Vendor card */}
        <TouchableOpacity
          onPress={() => pick('vendor')}
          activeOpacity={0.9}
          disabled={!!loading}
          style={{
            backgroundColor: colors.green, borderRadius: 22, padding: 20, gap: 12,
            overflow: 'hidden',
            shadowColor: colors.green, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 8,
            opacity: loading && loading !== 'vendor' ? 0.5 : 1,
          }}
        >
          <View style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="package" size={26} color="#fff" />
              </View>
              {hasVendor && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#fff' }}>Profil existant</Text>
                </View>
              )}
            </View>
            {loading === 'vendor' ? <ActivityIndicator color="#fff" /> : <Icon name="arrow" size={22} color="#fff" />}
          </View>
          <View>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: '#fff', letterSpacing: -0.5 }}>Je suis vendeur</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 19 }}>
              {hasVendor
                ? `Connexion Ã  ton profil vendeur existant â€” ${user?.name || 'tes infos sont conservÃ©es'}.`
                : 'Je vends en ligne et je dois faire livrer mes commandes vite.'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {['CrÃ©e une annonce', 'Calcul auto du prix', 'Codes sÃ©curisÃ©s'].map(t => (
              <View key={t} style={{ backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#fff' }}>{t}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* Deliverer card */}
        <TouchableOpacity
          onPress={() => pick('deliverer')}
          activeOpacity={0.9}
          disabled={!!loading}
          style={{
            backgroundColor: colors.ink, borderRadius: 22, padding: 20, gap: 12,
            overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 8,
            opacity: loading && loading !== 'deliverer' ? 0.5 : 1,
          }}
        >
          <View style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(245,97,26,0.18)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="moto" size={26} color="#fff" />
              </View>
              {hasDeliverer && (
                <View style={{ backgroundColor: 'rgba(245,97,26,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.orange }}>Profil existant</Text>
                </View>
              )}
            </View>
            {loading === 'deliverer' ? <ActivityIndicator color="#fff" /> : <Icon name="arrow" size={22} color="#fff" />}
          </View>
          <View>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: '#fff', letterSpacing: -0.5 }}>Je suis livreur</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 19 }}>
              {hasDeliverer
                ? `Connexion Ã  ton profil livreur existant â€” ${user?.name || 'tes infos sont conservÃ©es'}.`
                : 'Je veux gagner ma vie en livrant des colis dans ma zone.'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {['Choisis tes courses', 'Wallet Mobile Money', 'Retraits 0 frais'].map(t => (
              <View key={t} style={{ backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#fff' }}>{t}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* Info about dual profile */}
        {!isMulti && (hasVendor || hasDeliverer) && (
          <View style={{ backgroundColor: colors.cream, borderRadius: 14, padding: 14, gap: 6 }}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink }}>
              Ajouter le deuxiÃ¨me profil ?
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, lineHeight: 18 }}>
              En choisissant l'autre mode, tes informations actuelles seront rÃ©utilisÃ©es et les deux profils seront sauvegardÃ©s sur le mÃªme compte.
            </Text>
          </View>
        )}

        <Text style={{ textAlign: 'center', fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>
          ðŸ‡¨ðŸ‡² Fier produit camerounais
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
