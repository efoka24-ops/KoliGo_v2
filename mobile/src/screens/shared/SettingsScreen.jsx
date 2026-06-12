import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useTheme, THEME_OPTIONS } from '../../context/ThemeContext';
import KGTopBar from '../../components/KGTopBar';
import KGCard from '../../components/KGCard';
import KGButton from '../../components/KGButton';
import Icon from '../../components/Icon';

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: 'ðŸ‡«ðŸ‡·' },
  { code: 'en', label: 'English',  flag: 'ðŸ‡¬ðŸ‡§' },
];

function Section({ title, children }) {
  return (
    <View>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 8, paddingHorizontal: 2 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ icon, label, sub, onPress, rightLabel, rightNode }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: colors.ink06 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={colors.ink70} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{label}</Text>
        {sub && <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>{sub}</Text>}
      </View>
      {rightNode ?? (rightLabel
        ? <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.ink35 }}>{rightLabel}</Text>
        : <Icon name="arrow" size={16} color={colors.ink35} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { user, api, logout, showToast, lang, setLang, biometricEnabled, enableBiometric } = useApp();
  const { theme, setTheme } = useTheme();
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [bioHardware, setBioHardware] = useState(false);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(has => {
      LocalAuthentication.isEnrolledAsync().then(enrolled => {
        setBioHardware(has && enrolled);
      });
    }).catch(() => {});
  }, []);

  const handlePinChange = async () => {
    if (newPin.length < 4) { showToast('Le PIN doit faire au moins 4 chiffres', 'error'); return; }
    if (newPin !== confirmPin) { showToast('Les PINs ne correspondent pas', 'error'); return; }
    setPinLoading(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: oldPin, newPassword: newPin }),
      });
      showToast('Code PIN modifié avec succès âœ"');
      setShowPinChange(false);
      setOldPin(''); setNewPin(''); setConfirmPin('');
    } catch {
      showToast('Ancien PIN incorrect', 'error');
    } finally {
      setPinLoading(false);
    }
  };

  const handleToggleBiometric = async () => {
    if (!bioHardware) {
      showToast('Aucune biométrie configurée sur cet appareil', 'error');
      return;
    }
    if (biometricEnabled) {
      enableBiometric(false);
      showToast('Biométrie désactivée');
      return;
    }
    // Ask biometric to confirm activation
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirme ton identité pour activer la biométrie',
      cancelLabel: 'Annuler',
      fallbackLabel: 'Utiliser le PIN',
    });
    if (result.success) {
      enableBiometric(true);
      showToast('Biométrie activée âœ"');
    }
  };

  const themeLabel = lang === 'en'
    ? { light: 'Light mode', dark: 'Dark mode', sepia: 'Sepia mode' }
    : { light: 'Mode clair', dark: 'Mode sombre', sepia: 'Mode sépia' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title={lang === 'en' ? 'Settings' : 'Paramètres'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Language */}
        <Section title={lang === 'en' ? 'Language' : 'Langue'}>
          <KGCard padding={0}>
            {LANGUAGES.map((l, i) => (
              <TouchableOpacity
                key={l.code}
                onPress={() => setLang(l.code)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.ink06,
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{l.label}</Text>
                {lang === l.code && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={12} color="#fff" strokeWidth={2.5} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </KGCard>
        </Section>

        {/* Appearance / Theme */}
        <Section title={lang === 'en' ? 'Appearance' : 'Apparence'}>
          <KGCard padding={0}>
            {THEME_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setTheme(opt.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.ink06,
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>
                  {lang === 'en' ? opt.labelEn : opt.labelFr}
                </Text>
                {theme === opt.key && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={12} color="#fff" strokeWidth={2.5} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </KGCard>
        </Section>

        {/* Security */}
        <Section title={lang === 'en' ? 'Security' : 'Sécurité'}>
          <KGCard padding={0}>
            <View style={{ overflow: 'hidden' }}>
              <Row
                icon="shield"
                label={lang === 'en' ? 'Change my PIN' : 'Changer mon code PIN'}
                sub={lang === 'en' ? 'Change your account access code' : 'Modifier le code d\'accès à ton compte'}
                onPress={() => setShowPinChange(p => !p)}
                rightLabel={showPinChange ? 'â–²' : undefined}
              />
              {showPinChange && (
                <View style={{ padding: 14, gap: 10, backgroundColor: colors.cream }}>
                  {[
                    { label: lang === 'en' ? 'Current PIN' : 'Code PIN actuel', value: oldPin, set: setOldPin },
                    { label: lang === 'en' ? 'New PIN' : 'Nouveau code PIN', value: newPin, set: setNewPin },
                    { label: lang === 'en' ? 'Confirm new PIN' : 'Confirmer le nouveau PIN', value: confirmPin, set: setConfirmPin },
                  ].map(f => (
                    <View key={f.label}>
                      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, marginBottom: 4 }}>{f.label}</Text>
                      <TextInput
                        value={f.value}
                        onChangeText={f.set}
                        secureTextEntry
                        keyboardType="number-pad"
                        maxLength={8}
                        style={{
                          backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.ink12,
                          paddingHorizontal: 14, paddingVertical: 12, fontFamily: `${fonts.mono}-Regular`,
                          fontSize: 18, letterSpacing: 6, color: colors.ink,
                        }}
                        placeholder="â€¢â€¢â€¢â€¢"
                        placeholderTextColor={colors.ink35}
                      />
                    </View>
                  ))}
                  <KGButton kind="primary" size="md" icon="check" onPress={handlePinChange} disabled={pinLoading}>
                    {pinLoading ? (lang === 'en' ? 'Updatingâ€¦' : 'Modificationâ€¦') : (lang === 'en' ? 'Confirm change' : 'Confirmer le changement')}
                  </KGButton>
                </View>
              )}
              <Row
                icon="eye"
                label={lang === 'en' ? 'Biometric authentication' : 'Authentification biométrique'}
                sub={
                  !bioHardware
                    ? (lang === 'en' ? 'Not available on this device' : 'Non disponible sur cet appareil')
                    : biometricEnabled
                      ? (lang === 'en' ? 'Enabled â€" tap to disable' : 'Activée â€" appuie pour désactiver')
                      : (lang === 'en' ? 'Use Face ID / fingerprint' : 'Utiliser Face ID / empreinte digitale')
                }
                onPress={handleToggleBiometric}
                rightNode={
                  bioHardware ? (
                    <View style={{
                      width: 44, height: 24, borderRadius: 12,
                      backgroundColor: biometricEnabled ? colors.green : colors.ink12,
                      justifyContent: 'center', paddingHorizontal: 2,
                    }}>
                      <View style={{
                        width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                        marginLeft: biometricEnabled ? 20 : 2,
                      }} />
                    </View>
                  ) : null
                }
              />
            </View>
          </KGCard>
        </Section>

        {/* Account */}
        <Section title={lang === 'en' ? 'Account' : 'Compte'}>
          <KGCard padding={0}>
            <View style={{ overflow: 'hidden' }}>
              <Row
                icon="user"
                label={lang === 'en' ? 'Personal information' : 'Informations personnelles'}
                sub={user?.phone || ''}
                onPress={() => showToast(lang === 'en' ? 'Profile editing coming soon' : 'Modification du profil bientôt disponible')}
              />
              <Row
                icon="logout"
                label={lang === 'en' ? 'Sign out' : 'Se déconnecter'}
                sub={lang === 'en' ? 'Close session on this device' : 'Fermer la session sur cet appareil'}
                onPress={() => { logout(); navigation.replace('Welcome'); }}
              />
            </View>
          </KGCard>
        </Section>

        <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 11, color: colors.ink35, textAlign: 'center', paddingVertical: 4 }}>
          KoliGo v1.1
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
