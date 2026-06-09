import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGChip from '../../components/KGChip';
import KGTabBar from '../../components/KGTabBar';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
const VEHICLE_TYPES = [
  { id: 'moto',     label: 'Moto',      icon: 'moto' },
  { id: 'tricycle', label: 'Tricycle',  icon: 'package' },
  { id: 'voiture',  label: 'Voiture',   icon: 'bolt' },
];

export default function ProfileScreen({ navigation }) {
  const { role, setRole, user, logout, token, api, loginAs, showToast, lang } = useApp();
  const { t } = useI18n();
  const isEn = lang === 'en';
  const isVendor = role === 'vendor';
  const isDemo = user?.isTest === true;
  const [apiStats, setApiStats] = useState(null);
  const [vehicle, setVehicle] = useState(user?.vehicle || '');
  const [plate, setPlate] = useState(user?.plate || '');
  const [savingVehicle, setSavingVehicle] = useState(false);

  useEffect(() => {
    if (isDemo || !token) return;
    api('/api/users/me/stats').then(setApiStats).catch(() => {});
    api('/api/users/me').then(u => {
      if (u.vehicle) setVehicle(u.vehicle);
      if (u.plate) setPlate(u.plate);
    }).catch(() => {});
  }, [token, isDemo]);

  const saveVehicle = async () => {
    if (!vehicle) return;
    setSavingVehicle(true);
    try {
      await api('/api/users/me', { method: 'PATCH', body: JSON.stringify({ vehicle, plate: plate.trim() || null }) });
      showToast('VÃ©hicule mis Ã  jour âœ“');
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
    } finally {
      setSavingVehicle(false);
    }
  };
  const kycLabel = { PENDING: t('En attente'), VERIFIED: t('VÃ©rifiÃ©e âœ“'), REJECTED: t('RefusÃ©e â€” rÃ©essaie') }[user?.kycStatus] || t('Non soumise');
  const MENU_ITEMS = [
    { icon: 'history',  label: t('Historique'),         sub: isDemo ? t('127 livraisons') : t('Consulter mes livraisons'), screen: 'History' },
    { icon: 'wallet',   label: t('Moyens de paiement'), sub: 'MTN MoMo Â· Orange Money',  screen: 'PaymentAccount' },
    ...(!isVendor ? [{ icon: 'shield',   label: t('VÃ©rification KYC'),   sub: kycLabel, screen: 'KYC' }] : []),
    { icon: 'bell',     label: t('Notifications'),       sub: t('GÃ©rer les alertes'),        screen: 'Notifications' },
    { icon: 'settings', label: t('ParamÃ¨tres'),          sub: t('Langue, sÃ©curitÃ©, compte'), screen: 'Settings' },
  ];
  const displayName = user?.name || (isVendor ? t('Vendeur') : t('Livreur'));
  const avatar = user?.avatar || '??';

  const stats = isVendor
    ? [
        { k: isDemo ? '127' : String(apiStats?.colisEnvoyes ?? 0), l: t('Colis envoyÃ©s') },
        { k: isDemo ? '4.8' : (apiStats?.note ?? 'â€”'), l: t('Note moyenne') },
        { k: isDemo ? '98%' : (apiStats?.livres != null ? `${apiStats.livres}%` : 'â€”'), l: t('LivrÃ©s') },
      ]
    : [
        { k: isDemo ? '342' : String(apiStats?.courses ?? 0), l: t('Courses') },
        { k: isDemo ? '4.9' : (apiStats?.note ?? 'â€”'), l: t('Note') },
        { k: isDemo ? '92%' : (apiStats?.acceptation != null ? `${apiStats.acceptation}%` : 'â€”'), l: t('Acceptation') },
      ];

  const switchRole = async () => {
    const newRole = isVendor ? 'deliverer' : 'vendor';
    const newRoleUpper = isVendor ? 'DELIVERER' : 'VENDOR';
    if (token) {
      try {
        const result = await api('/api/auth/switch-role', {
          method: 'POST',
          body: JSON.stringify({ role: newRoleUpper }),
        });
        loginAs({ ...result.user, role: newRole }, result.token);
      } catch {
        setRole(newRole);
      }
    } else {
      setRole(newRole);
    }
    navigation.replace(newRole === 'vendor' ? 'VendorHome' : 'DelivererHome');
  };

  const handleTab = (tab) => {
    if (role === 'vendor') {
      if (tab === 'home') navigation.navigate('VendorHome');
      else if (tab === 'history') navigation.navigate('History');
      else if (tab === 'chat') navigation.navigate('ChatInbox');
    } else {
      if (tab === 'home') navigation.navigate('DelivererHome');
      else if (tab === 'wallet') navigation.navigate('Wallet');
      else if (tab === 'chat') navigation.navigate('ChatInbox');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KGTopBar title={t('Profil')} onBack={() => navigation.goBack()} action={<Icon name="settings" size={20} color={colors.ink} />} />
      <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>

        {/* Profile header card */}
        <KGCard padding={20} style={styles.profileHeaderCard}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: isVendor ? colors.green : colors.ink }]}>
              <Text style={styles.avatarText}>{avatar}</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Icon name="check" size={14} color="#fff" strokeWidth={2.4} />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.roleText}>
              {isVendor ? t('Vendeur Â· KoliGo') : t('Livreur Â· KoliGo')}
            </Text>
          </View>
          <View style={styles.chipsContainer}>
            <KGChip color="green" icon="shield">{t('CNI vÃ©rifiÃ©e')}</KGChip>
            <KGChip color="orange" icon="star">{apiStats?.note ? `${apiStats.note} â˜…` : (isDemo ? (isVendor ? '4.8 â˜…' : '4.9 â˜…') : 'â€” â˜…')}</KGChip>
            {!isVendor && <KGChip color="ink" icon="bolt">{t('Lvl Argent')}</KGChip>}
          </View>
        </KGCard>

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((s, index) => (
            <KGCard key={index} padding={12} style={styles.statCard}>
              <Text style={styles.statValue}>{s.k}</Text>
              <Text style={styles.statLabel}>{s.l}</Text>
            </KGCard>
          ))}
        </View>

        {/* Section vÃ©hicule â€” livreur uniquement */}
        {!isVendor && (
          <KGCard padding={14} style={styles.vehicleSection}>
            <Text style={styles.vehicleSectionTitle}>{t('Mon vÃ©hicule')}</Text>
            <View style={styles.vehicleTypesContainer}>
              {VEHICLE_TYPES.map(v => {
                const on = vehicle === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setVehicle(v.id)}
                    style={[styles.vehicleTypeButton, on && styles.vehicleTypeButtonActive]}
                  >
                    <Icon name={v.icon} size={16} color={on ? colors.greenDark : colors.ink55} /> {/* Assuming Icon component handles color */}
                    <Text style={[styles.vehicleTypeLabel, on && styles.vehicleTypeLabelActive]}>{v.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              value={plate}
              onChangeText={setPlate}
              placeholder={t('NumÃ©ro de plaque (ex: LT-892-DA)')}
              placeholderTextColor={colors.ink35} // Assuming colors.ink35 is defined
              autoCapitalize="characters"
              style={styles.plateInput}
            />
            <TouchableOpacity
              onPress={saveVehicle}
              disabled={savingVehicle || !vehicle}
              style={[styles.saveVehicleButton, vehicle && styles.saveVehicleButtonActive]}
            >
              <Text style={[styles.saveVehicleButtonText, vehicle && styles.saveVehicleButtonTextActive]}>
                {savingVehicle ? t('Enregistrementâ€¦') : t('Enregistrer le vÃ©hicule')}
              </Text>
            </TouchableOpacity>
          </KGCard>
        )}

        {/* Switch role */}
        <KGCard onPress={switchRole} kind="green" padding={14} style={styles.switchRoleCard}>
          <View style={styles.switchRoleContent}>
            <Icon name={isVendor ? 'moto' : 'package'} size={22} color={colors.greenDark} />
            <View style={styles.switchRoleTextContainer}>
              <Text style={styles.switchRoleTitle}>
                {isVendor ? t('Passer en mode livreur') : t('Passer en mode vendeur')}
              </Text>
              <Text style={styles.switchRoleDescription}>
                {isVendor ? t('Tu gagnes en livrant les autres') : t('Tu vends et tu fais livrer')}
              </Text>
            </View>
            <Icon name="arrow" size={18} color={colors.greenDark} />
          </View>
        </KGCard>

        {/* Menu */}
        <KGCard padding={0} style={styles.menuCard}>
          {MENU_ITEMS.map((m, i) => (
            <TouchableOpacity
              key={m.label}
              onPress={() => m.screen && navigation.navigate(m.screen)}
              style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
            >
              <View style={styles.menuItemIconContainer}>
                <Icon name={m.icon} size={18} color={colors.ink70} />
              </View>
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemLabel}>{m.label}</Text>
                <Text style={styles.menuItemSub}>{m.sub}</Text>
              </View>
              <Icon name="arrow" size={16} color={colors.ink35} />
            </TouchableOpacity>
          ))}
        </KGCard>

        <KGButton kind="ghost" icon="logout" onPress={() => { logout(); navigation.replace('Welcome'); }}>{t('Se dÃ©connecter')}</KGButton>

        <Text style={styles.versionText}>
          KoliGo v1.1
        </Text>
      </ScrollView>

      <KGTabBar active="profile" onTab={handleTab} role={role} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scrollViewContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 16,
  },
  profileHeaderCard: {
    alignItems: 'center',
    gap: 10,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 26,
    color: '#fff',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.green,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    alignItems: 'center',
  },
  displayName: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: -0.02 * 22,
  },
  roleText: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 13,
    color: colors.ink55,
    marginTop: 2,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 20,
    color: colors.ink,
    letterSpacing: -0.02,
  },
  statLabel: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 11,
    color: colors.ink55,
    textAlign: 'center',
  },
  vehicleSection: {
    gap: 12,
  },
  vehicleSectionTitle: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 11,
    color: colors.ink55,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
  },
  vehicleTypesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleTypeButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.ink12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  vehicleTypeButtonActive: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  vehicleTypeLabel: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 11,
    color: colors.ink55,
  },
  vehicleTypeLabelActive: {
    color: colors.greenDark,
  },
  plateInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink12,
    paddingHorizontal: 14,
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  saveVehicleButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.ink12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveVehicleButtonActive: {
    backgroundColor: colors.green,
  },
  saveVehicleButtonText: {
    fontFamily: `${fonts.ui}-Bold`,
    fontSize: 13,
    color: colors.ink35,
  },
  saveVehicleButtonTextActive: {
    color: '#fff',
  },
  switchRoleCard: {
    // Styles for KGCard are already handled by the component itself
  },
  switchRoleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchRoleTextContainer: {
    flex: 1,
  },
  switchRoleTitle: {
    fontFamily: `${fonts.ui}-Bold`,
    fontSize: 14,
    color: colors.greenDark,
  },
  switchRoleDescription: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 12,
    color: colors.greenDark,
    opacity: 0.75,
  },
  menuCard: {
    // Styles for KGCard are already handled by the component itself
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.ink06,
  },
  menuItemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemLabel: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 14.5,
    color: colors.ink,
  },
  menuItemSub: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 12,
    color: colors.ink55,
  },
  versionText: {
    textAlign: 'center',
    fontFamily: `${fonts.mono}-Regular`,
    fontSize: 11,
    color: colors.ink35,
    paddingVertical: 10,
  },
});
