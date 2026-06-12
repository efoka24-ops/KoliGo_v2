import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';

export default function RoleSelectScreen({ navigation }) {
  const { token, api, user, loginAs, showToast } = useApp();
  const { t } = useI18n();
  const [loading, setLoading] = useState(null);

  const existingRoles = user?.roles || [];
  const hasVendor    = existingRoles.includes('VENDOR');
  const hasDeliverer = existingRoles.includes('DELIVERER');
  const isMulti      = hasVendor && hasDeliverer;

  const pick = async (role) => {
    setLoading(role);
    try {
      if (token && api) {
        const roleUpper = role === 'vendor' ? 'VENDOR' : 'DELIVERER';
        const result = await api('/api/auth/switch-role', { method: 'POST', body: JSON.stringify({ role: roleUpper }) });
        loginAs({ ...result.user, role: (result.user.role || role).toLowerCase() }, result.token);
        navigation.navigate(role === 'vendor' ? 'VendorApp' : 'DelivererApp');
      } else {
        // Cas hors-ligne ou session manquante
        navigation.navigate(role === 'vendor' ? 'VendorApp' : 'DelivererApp');
      }
    } catch (err) {
      showToast(t("Erreur de connexion au serveur"), 'error');
      console.error("[RoleSelect] Switch role failed:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title={t('Tu es ?')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            {t('Choisis ton mode')}
          </Text>
          <Text style={styles.subtitle}>
            {isMulti
              ? t('Tu as les deux profils actifs. Choisis lequel utiliser maintenant.')
              : t("Tu pourras passer de l'un à l'autre depuis ton profil.")}
          </Text>
        </View>

        {/* Vendor card */}
        <TouchableOpacity
          onPress={() => pick('vendor')}
          activeOpacity={0.88}
          disabled={!!loading}
          style={[styles.card, styles.vendorCardShadow, loading && loading !== 'vendor' && styles.loadingOpacity]}
        >
          <View style={[styles.cardContent, { backgroundColor: colors.green }]}>
            <View style={styles.decoCircle} />

            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <Icon name="package" size={28} color="#fff" />
              </View>
              {loading === 'vendor' ? <ActivityIndicator color="#fff" /> : <Icon name="arrow" size={22} color="#fff" />}
            </View>

            <View>
              <Text style={styles.cardTitle}>{t('Je suis vendeur')}</Text>
              <Text style={styles.cardDesc}>
                {t('Je vends en ligne et je dois faire livrer mes commandes vite.')}
              </Text>
            </View>

            <View style={styles.tagContainer}>
              {[t('Créer une annonce'), t('Calcul auto du prix'), t('Codes sécurisés')].map(tag => (
                <View key={tag} style={styles.vendorTag}>
                  <Text style={styles.tagText}>{tag}</Text>
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
          style={[styles.card, styles.delivererCardShadow, loading && loading !== 'deliverer' && styles.loadingOpacity]}
        >
          <View style={[styles.cardContent, { backgroundColor: '#0E2116' }]}>
            <View style={[styles.decoCircle, { backgroundColor: 'rgba(196,97,26,0.15)' }]} />

            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: '#C4611A' }]}>
                <Icon name="moto" size={28} color="#fff" />
              </View>
              {loading === 'deliverer' ? <ActivityIndicator color="#fff" /> : <Icon name="arrow" size={22} color="#fff" />}
            </View>

            <View>
              <Text style={styles.cardTitle}>{t('Je suis livreur')}</Text>
              <Text style={[styles.cardDesc, { color: 'rgba(255,255,255,0.68)' }]}>
                {t('Je veux gagner ma vie en livrant des colis dans ma zone.')}
              </Text>
            </View>

            <View style={styles.tagContainer}>
              {[t('Choisis tes courses'), t('Wallet Mobile Money'), t('Retraits 0 frais')].map(tag => (
                <View key={tag} style={styles.delivererTag}>
                  <Text style={[styles.tagText, { color: 'rgba(255,255,255,0.85)' }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          ◈ Fier produit camerounais 🇨🇲
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF5E6' },
  scrollContent: { padding: 20, gap: 16 },
  headerContainer: { marginBottom: 4 },
  title: { fontFamily: `${fonts.display}-ExtraBold`, fontSize: 30, color: '#0E2116', letterSpacing: -0.5 },
  subtitle: { fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, marginTop: 6, lineHeight: 20 },
  card: { borderRadius: 24, overflow: 'hidden', elevation: 8 },
  vendorCardShadow: { shadowColor: '#0D7A3E', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20 },
  delivererCardShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 20 },
  loadingOpacity: { opacity: 0.45 },
  cardContent: { padding: 22, gap: 14 },
  decoCircle: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#fff', letterSpacing: -0.5 },
  cardDesc: { fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: 'rgba(255,255,255,0.82)', marginTop: 5, lineHeight: 20 },
  tagContainer: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  vendorTag: { backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  delivererTag: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagText: { fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#fff' },
  footerText: { textAlign: 'center', fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: '#B8A48A' },
});
