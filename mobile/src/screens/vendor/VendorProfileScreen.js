import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';

const VEHICLE_TYPES = [
  { id: 'moto',     label: 'Moto',     icon: 'moto' },
  { id: 'tricycle', label: 'Tricycle', icon: 'package' },
  { id: 'voiture',  label: 'Voiture',  icon: 'bolt' },
];

function MenuRow({ icon, iconBg, label, sub, onPress, last }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.ink06 }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: iconBg || '#F0F0EA', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={colors.ink70} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14.5, color: colors.ink }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <Icon name="arrow" size={15} color={colors.ink35} />
    </TouchableOpacity>
  );
}

export default function VendorProfileScreen({ navigation }) {
  const { role, setRole, user, logout, token, api, loginAs, showToast } = useApp();
  const { t } = useI18n();
  const isDemo = user?.isTest === true;

  const [apiStats, setApiStats] = useState(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (isDemo || !token) return;
    api('/user/profile')
      .then(setApiStats)
      .catch((err) => console.warn("[VendorProfile] Stats fetch failed:", err));
  }, [token, isDemo]);

  const displayName = user?.name || 'Vendeur';
  const initials    = displayName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const shopLine    = user?.boutique || user?.shopName || null;
  const roleLabel   = user?.gender === 'FEMME' ? 'Vendeuse' : 'Vendeur';

  const kycStatus = user?.kycStatus || 'NONE';
  const kycLabel  = { NONE: 'Non soumise', PENDING: 'En cours de vérification', VERIFIED: 'CNI vérifiée ✓', REJECTED: 'Refusée — réessaie' }[kycStatus] || 'Non soumise';

  const stats = [
    { k: isDemo ? '127' : String(apiStats?.colisEnvoyes ?? 0), l: t('Colis envoyés') },
    { k: isDemo ? '4.8' : String(apiStats?.note ?? '—'),       l: t('Note moyenne') },
    { k: isDemo ? '98%' : (apiStats?.livres != null ? `${apiStats.livres}%` : '—'), l: t('Livrés') },
  ];

  const switchRole = async () => {
    setLoading(true);
    try {
      if (token) {
        const result = await api('/auth/switch-role', { method: 'POST', body: JSON.stringify({ role: 'DELIVERER' }) });
        loginAs(Object.assign({}, result.user, { role: 'deliverer' }), result.token);
      }
      setRole('deliverer');
      navigation.getParent()?.reset({ index: 0, routes: [{ name: 'DelivererApp' }] });
    } catch (err) {
      showToast(t("Impossible de changer de mode"), 'error');
      console.error("[VendorProfile] switchRole error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const MENU = [
    { icon: 'history',  iconBg: '#EFF8F1', label: 'Historique',          sub: isDemo ? '127 livraisons' : 'Consulter mes livraisons', screen: 'History' },
    { icon: 'wallet',   iconBg: '#FFF8E3', label: 'Moyens de paiement',  sub: 'MTN MoMo · Orange Money', screen: 'PaymentAccount' },
    { icon: 'shield',   iconBg: '#FEF0E3', label: 'Vérifications',        sub: kycLabel, screen: 'Kyc' },
    { icon: 'bell',     iconBg: '#F0F0EA', label: 'Notifications',         sub: 'Tout actif', screen: 'Notifications' },
    { icon: 'settings', iconBg: '#F0F0EA', label: 'Paramètres',            sub: 'Langue, sécurité, compte', screen: 'Settings' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KenteStripe height={4} />

      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>{t('Profil')}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
          <Icon name="settings" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.avatarSection}>
          <View style={{ position: 'relative' }}>
            <View style={[styles.avatar, { backgroundColor: colors.green }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.checkBadge}>
              <Icon name="check" size={12} color="#fff" strokeWidth={2.5} />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: 3 }}>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.roleSubtext}>{roleLabel}{shopLine ? ` · ${shopLine}` : ' · KoliGo'}</Text>
          </View>

          {/* Badges */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF8F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
              <Icon name="shield" size={13} color={colors.greenDark} />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.greenDark }}>CNI vérifiée</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF8E3', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
              <Text style={{ fontSize: 12 }}>★</Text>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: '#C4611A' }}>
                {isDemo ? '4.8' : (apiStats?.note ?? '—')}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {stats.map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: '#F5F0E8', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 }}>
              <Text style={styles.statValue}>{s.k}</Text>
              <Text style={styles.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={switchRole}
          disabled={loading}
          activeOpacity={0.85}
          style={styles.switchCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.switchIconBox, { backgroundColor: colors.green }]}>
              <Icon name="moto" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: colors.greenDark }}>Passer en mode livreur</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.greenDark, opacity: 0.75, marginTop: 1 }}>Tu gagnes en livrant les autres</Text>
            </View>
            {loading ? <ActivityIndicator color={colors.green} size="small" /> : <Icon name="arrow" size={18} color={colors.greenDark} />}
          </View>
        </TouchableOpacity>

        {/* Menu */}
        <View style={{ backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#E8DCC8' }}>
          {MENU.map((m, i) => (
            <MenuRow
              key={m.label}
              icon={m.icon}
              iconBg={m.iconBg}
              label={m.label}
              sub={m.sub}
              onPress={() => m.screen && navigation.navigate(m.screen)}
              last={i === MENU.length - 1}
            />
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#F5D0B8', backgroundColor: '#FEF8F5' }}
        >
          <Icon name="logout" size={18} color="#C4611A" />
          <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: '#C4611A' }}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', fontFamily: `${fonts.mono}-Regular`, fontSize: 11, color: colors.ink35 }}>
          KoliGo v1.1 · 🇨🇲
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  topBarTitle: { fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink },
  settingsBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, gap: 14, paddingBottom: 28 },
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: `${fonts.display}-ExtraBold`, fontSize: 30, color: '#fff' },
  checkBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  displayName: { fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink, letterSpacing: -0.5 },
  roleSubtext: { fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 },
  statValue: { fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink },
  statLabel: { fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink55, textAlign: 'center' },
  switchCard: { backgroundColor: '#EFF8F1', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.green },
  switchIconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
