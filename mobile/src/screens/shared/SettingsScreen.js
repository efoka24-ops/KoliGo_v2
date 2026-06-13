import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useTheme, THEME_OPTIONS } from '../../context/ThemeContext';
import { useI18n } from '../../i18n';
import KGTopBar from '../../components/KGTopBar';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

function Section({ title, children }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink35, textTransform: 'uppercase', letterSpacing: 0.08, paddingHorizontal: 2 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E8DCC8' }}>
        {children}
      </View>
    </View>
  );
}

function SettingRow({ icon, iconBg, label, sub, right, onPress, last }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.ink06 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: iconBg || '#F0F0EA', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} color={colors.ink70} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { biometricEnabled, enableBiometric, logout } = useApp();
  const [biometric, setBiometric] = useState(biometricEnabled);

  const handleBiometricToggle = async (enabled) => {
    if (enabled) {
      const compat = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compat || !enrolled) {
        Alert.alert(
          'Biométrie non disponible',
          'Ce téléphone ne supporte pas la biométrie ou aucun visage/empreinte n\'est enregistré.',
          [{ text: 'OK' }]
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme ton identité pour activer',
        cancelLabel: 'Annuler',
        fallbackLabel: 'Utiliser le PIN',
      });
      if (!result.success) return;
    }
    setBiometric(enabled);
    enableBiometric(enabled);
  };

  const handleLogout = () => {
    Alert.alert('Se déconnecter', 'Es-tu sûr(e) de vouloir te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter', style: 'destructive', onPress: () => {
          logout();
          navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        }
      },
    ]);
  };

  const THEME_ICONS = { light: 'sparkle', dark: 'bolt', sepia: 'id' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Paramètres" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Langue */}
        <Section title="Langue">
          {[['fr', '🇫🇷  Français'], ['en', '🇬🇧  English']].map(([k, label], i) => (
            <SettingRow
              key={k}
              icon={k === 'fr' ? 'bell' : 'bolt'}
              iconBg={lang === k ? '#EFF8F1' : '#F0F0EA'}
              label={label}
              onPress={() => setLang(k)}
              last={i === 1}
              right={
                lang === k ? (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={12} color="#fff" />
                  </View>
                ) : <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#E8DCC8' }} />
              }
            />
          ))}
        </Section>

        {/* Thème */}
        <Section title="Thème d'affichage">
          {THEME_OPTIONS.map((opt, i) => (
            <SettingRow
              key={opt.key}
              icon={THEME_ICONS[opt.key] || 'sparkle'}
              iconBg={theme === opt.key ? '#EFF8F1' : '#F0F0EA'}
              label={opt.labelFr}
              onPress={() => setTheme(opt.key)}
              last={i === THEME_OPTIONS.length - 1}
              right={
                theme === opt.key ? (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={12} color="#fff" />
                  </View>
                ) : <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#E8DCC8' }} />
              }
            />
          ))}
        </Section>

        {/* Sécurité */}
        <Section title="Sécurité">
          <SettingRow
            icon="user"
            iconBg="#EFF8F1"
            label="Face ID / Empreinte digitale"
            sub={biometric ? 'Activé — connexion rapide' : 'Désactivé'}
            right={
              <Switch
                value={biometric}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: '#E8DCC8', true: colors.green }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="shield"
            iconBg="#FEF0E3"
            label="Changer le PIN"
            sub="Réinitialisation par email"
            onPress={() => navigation.navigate('ForgotPin')}
          />
          <SettingRow
            icon="id"
            iconBg="#F0F0EA"
            label="Conditions d'utilisation"
            onPress={() => navigation.navigate('Terms')}
            last
          />
        </Section>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#F5D0B8', backgroundColor: '#FEF8F5' }}
        >
          <Icon name="logout" size={18} color="#C4611A" />
          <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: '#C4611A' }}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', fontFamily: `${fonts.mono}-Regular`, fontSize: 11, color: colors.ink35 }}>
          KoliGo v1.1 · Douala, Cameroun
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
