import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

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

export default function DelivererProfileScreen({ navigation }) {
  const { role, setRole, user, logout, token, api, loginAs, showToast } = useApp();
  const isDemo = user?.isTest === true;

  const [apiStats, setApiStats]   = useState(null);
  const [vehicle, setVehicle]     = useState(user?.vehicle || '');
  const [plate, setPlate]         = useState(user?.plate || '');
  const [saving, setSaving]       = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (isDemo || !token) return;
    api('/user/profile').then(setApiStats).catch(() => {});
    api('/api/user/profile').then(u => {
      if (u.vehicle) setVehicle(u.vehicle);
      if (u.plate) setPlate(u.plate);
    }).catch(() => {});
  }, [token, isDemo]);

  const displayName = user?.name || 'Livreur';
  const initials    = displayName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const roleLabel   = user?.gender === 'FEMME' ? 'Livreuse' : 'Livreur';

  const kycStatus = user?.kycStatus || 'NONE';
  const kycLabel  = { NONE: 'Non soumise', PENDING: 'En cours de vérification', VERIFIED: 'CNI vérifiée ✓', REJECTED: 'Refusée — réessaie' }[kycStatus] || 'Non soumise';

  const stats = [
    { k: isDemo ? '342' : String(apiStats?.courses ?? 0),      l: 'Courses' },
    { k: isDemo ? '4.9' : String(apiStats?.note ?? '—'),       l: 'Note' },
    { k: isDemo ? '92%' : (apiStats?.acceptation != null ? `${apiStats.acceptation}%` : '—'), l: 'Acceptation' },
  ];

  const saveVehicle = async () => {
    if (!vehicle) return;
    setSaving(true);
    try {
      await api('/user/profile', { method: 'PATCH', body: JSON.stringify({ vehicle, plate: plate.trim() || null }) });
      showToast('Véhicule mis à jour ✓');
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const switchRole = async () => {
    setSwitching(true);
    try {
      if (token) {
        const result = await api('/auth/switch-role', { method: 'POST', body: JSON.stringify({ role: 'VENDOR' }) });
        loginAs({ ...result.user, role: 'vendor' }, result.token);
      } else {
        setRole('vendor');
      }
      navigation.getParent()?.reset({ index: 0, routes: [{ name: 'VendorApp' }] });
    } catch {
      setRole('vendor');
      navigation.getParent()?.reset({ index: 0, routes: [{ name: 'VendorApp' }] });
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const MENU = [
    { icon: 'history',  iconBg: '#EFF8F1', label: 'Historique',          sub: isDemo ? '342 courses' : 'Consulter mes courses', screen: 'DelivererHistory' },
    { icon: 'wallet',   iconBg: '#FFF8E3', label: 'Wallet & retraits',   sub: 'MTN MoMo · Orange Money', screen: 'Wallet' },
    { icon: 'shield',   iconBg: '#FEF0E3', label: 'Vérifications KYC',   sub: kycLabel, screen: kycStatus === 'NONE' ? 'Kyc' : 'KycStatus' },
    { icon: 'bell',     iconBg: '#F0F0EA', label: 'Notifications',        sub: 'Tout actif', screen: 'Notifications' },
    { icon: 'settings', iconBg: '#F0F0EA', label: 'Paramètres',           sub: 'Langue, sécurité, compte', screen: 'Settings' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KenteStripe height={4} />

      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink }}>Profil</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="settings" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>

        {/* Avatar + infos */}
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <View style={{ position: 'relative' }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#0E2116', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 30, color: '#D4991A' }}>{initials}</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={12} color="#fff" strokeWidth={2.5} />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: 3 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink, letterSpacing: -0.5 }}>{displayName}</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>{roleLabel} · KoliGo</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF8F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
              <Icon name="shield" size={13} color={colors.greenDark} />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.greenDark }}>
                {kycStatus === 'VERIFIED' ? 'CNI vérifiée' : 'KYC en attente'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF8E3', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
              <Text style={{ fontSize: 12 }}>★</Text>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: '#C4611A' }}>
                {isDemo ? '4.9' : (apiStats?.note ?? '—')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F0EA', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
              <Icon name="bolt" size={12} color={colors.ink55} />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.ink55 }}>Lvl Argent</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {stats.map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: '#F5F0E8', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: colors.ink }}>{s.k}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink55, textAlign: 'center' }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Véhicule */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E8DCC8', padding: 14, gap: 12 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.06 }}>Mon véhicule</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {VEHICLE_TYPES.map(v => {
              const on = vehicle === v.id;
              return (
                <TouchableOpacity key={v.id} onPress={() => setVehicle(v.id)}
                  style={{ flex: 1, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: on ? colors.green : colors.ink12, backgroundColor: on ? '#EFF8F1' : '#fff', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  <Icon name={v.icon} size={16} color={on ? colors.greenDark : colors.ink55} />
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: on ? colors.greenDark : colors.ink55 }}>{v.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={plate}
            onChangeText={setPlate}
            placeholder="Numéro de plaque (ex: LT-892-DA)"
            placeholderTextColor={colors.ink35}
            autoCapitalize="characters"
            underlineColorAndroid="transparent"
            style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.ink12, paddingHorizontal: 14, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink, backgroundColor: '#fff' }}
          />
          <TouchableOpacity onPress={saveVehicle} disabled={saving || !vehicle}
            style={{ height: 40, borderRadius: 10, backgroundColor: vehicle ? colors.green : colors.ink12, alignItems: 'center', justifyContent: 'center' }}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 13, color: vehicle ? '#fff' : colors.ink35 }}>
                Enregistrer le véhicule
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Switch role */}
        <TouchableOpacity onPress={switchRole} disabled={switching} activeOpacity={0.85}
          style={{ backgroundColor: '#F5F0E8', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8DCC8' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#0E2116', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="package" size={22} color="#D4991A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: colors.ink }}>Passer en mode vendeur</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>Tu vends et tu fais livrer</Text>
            </View>
            {switching ? <ActivityIndicator color={colors.ink} size="small" /> : <Icon name="arrow" size={18} color={colors.ink55} />}
          </View>
        </TouchableOpacity>

        {/* Menu */}
        <View style={{ backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#E8DCC8' }}>
          {MENU.map((m, i) => (
            <MenuRow key={m.label} icon={m.icon} iconBg={m.iconBg} label={m.label} sub={m.sub}
              onPress={() => m.screen && navigation.navigate(m.screen)}
              last={i === MENU.length - 1}
            />
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#F5D0B8', backgroundColor: '#FEF8F5' }}>
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
