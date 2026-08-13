import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Screen, Logo, Numpad } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/auth';
import { apiFetch } from '../../services/api';
import { storage } from '../../utils/storage';

export default function SigninScreen({ navigation }) {
  const { t } = useI18n();
  const { role, loginAs, showToast, biometricEnabled } = useApp();

  // Step: 'phone' (enter identifier) | 'pin' (enter PIN)
  const [step, setStep]           = useState('phone');
  const [identifier, setIdentifier] = useState(''); // phone or email entered by user
  const [storedPhone, setStoredPhone] = useState(null); // from secure storage
  const [pin, setPin]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // On mount: check if we have a stored phone → skip identifier step
  useEffect(() => {
    (async () => {
      const phone = await storage.getItem('user_phone');
      if (phone) {
        setStoredPhone(phone);
        setIdentifier(phone);
        setStep('pin');
      }
      const compat   = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compat && enrolled && biometricEnabled);
    })();
  }, [biometricEnabled]);

  const handleBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Connexion avec biométrie',
        cancelLabel: 'Annuler',
        fallbackLabel: 'Utiliser le PIN',
      });
      if (!result.success) return;
      const storedToken = await storage.getItem('access_token');
      if (!storedToken) {
        showToast('Aucun compte enregistré — utilise ton PIN', 'error');
        return;
      }
      const u = await apiFetch('/user/profile', {}, storedToken);
      if (u?.id) {
        loginAs({ ...u, role: u.activeRole?.toLowerCase() || role }, storedToken);
        navigation.reset({ index: 0, routes: [{ name: u.activeRole === 'DELIVERER' ? 'DelivererApp' : 'VendorApp' }] });
      }
    } catch {
      showToast('Biométrie échouée', 'error');
    }
  };

  // Step 1: user enters phone/email → validate → go to PIN step
  const handleIdentifierNext = async () => {
    const val = identifier.trim();
    if (!val) { setError('Saisis ton numéro ou email.'); return; }
    setLoading(true);
    setError('');
    try {
      // Quick pre-check: verify account exists
      // We do this by attempting signin with a dummy pin — if error is 'Wrong PIN' account exists
      // Better: just let the user proceed to PIN step
      setStep('pin');
    } catch {
      setError('Identifiant introuvable.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: PIN entry
  const onKey = async (k) => {
    if (k === '⌫') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setLoading(true);
      setTimeout(async () => {
        try {
          const val = identifier.trim();
          let data;
          if (val.includes('@')) {
            // Email-based login: look up phone then sign in
            // Backend signin accepts phone — we need to add email support
            data = await apiFetch('/auth/signin', {
              method: 'POST',
              body: JSON.stringify({ email: val, pin: next }),
            });
          } else {
            data = await authService.signin(val, next);
          }
          // Save phone for future auto-login
          const phone = data.user?.phone;
          if (phone) await storage.setItem('user_phone', phone);
          if (data.accessToken) await storage.setItem('access_token', data.accessToken);
          loginAs(
            { id: data.user?.id, name: data.user?.name, phone: data.user?.phone, role: data.user?.activeRole?.toLowerCase() || role, kycStatus: data.user?.kycStatus },
            data.accessToken
          );
          navigation.reset({ index: 0, routes: [{ name: data.user?.activeRole === 'DELIVERER' ? 'DelivererApp' : 'VendorApp' }] });
        } catch (e) {
          const msg = e?.response?.data?.error || e?.message || 'Identifiant ou PIN incorrect';
          setError(msg);
          setPin('');
          setLoading(false);
        }
      }, 180);
    }
  };

  const handleChangeAccount = () => {
    setStep('phone');
    setIdentifier('');
    setStoredPhone(null);
    setPin('');
    setError('');
    storage.deleteItem('user_phone').catch(() => {});
  };

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 18, paddingTop: 60 }}>
          <Logo size={46} />

          {step === 'phone' ? (
            <>
              <Text style={[type.h1, { marginTop: 16 }]}>Connexion</Text>
              <Text style={type.lead}>Numéro de téléphone ou adresse email</Text>
              <View style={{ marginTop: 20, marginBottom: 12 }}>
                <TextInput
                  value={identifier}
                  onChangeText={v => { setIdentifier(v); setError(''); }}
                  placeholder="6XX XX XX XX ou email"
                  placeholderTextColor={colors.muted}
                  keyboardType="default"
                  autoCapitalize="none"
                  autoComplete="tel"
                  returnKeyType="next"
                  onSubmitEditing={handleIdentifierNext}
                  style={styles.identifierInput}
                />
              </View>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              <TouchableOpacity
                onPress={handleIdentifierNext}
                disabled={loading || !identifier.trim()}
                style={[styles.nextBtn, (!identifier.trim()) && { opacity: 0.5 }]}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.nextBtnText}>Continuer →</Text>}
              </TouchableOpacity>

              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={{ alignSelf: 'center', paddingVertical: 12 }}>
                <Text style={{ color: colors.green, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                  Pas encore de compte ? Créer un compte
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[type.h1, { marginTop: 16 }]}>{t('welcomeBack')}</Text>
              <Text style={type.lead}>
                {/* storedPhone is persisted in full international form, so
                    prefixing blindly printed "+237 +2376…". */}
                {storedPhone ? `+237 ${storedPhone.replace(/^\+237/, '')}` : identifier}
              </Text>

              <View style={styles.dots}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: i < pin.length ? (loading ? colors.muted : colors.green) : colors.line }]} />
                ))}
              </View>

              {!!error && <Text style={[styles.errorText, { textAlign: 'center' }]}>{error}</Text>}

              {biometricAvailable && (
                <TouchableOpacity onPress={handleBiometric} style={styles.biometricBtn}>
                  <View style={styles.faceIcon}><Text style={{ fontSize: 18 }}>👤</Text></View>
                  <Text style={[type.lead, { flex: 1 }]}>{t('faceId')}</Text>
                  <Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>Utiliser</Text>
                </TouchableOpacity>
              )}

              <View style={{ flex: 1 }} />
              {loading ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator color={colors.green} size="large" />
                </View>
              ) : (
                <Numpad onKey={onKey} />
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
                <TouchableOpacity onPress={handleChangeAccount}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>Changer de compte</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('ForgotPin')}>
                  <Text style={{ color: colors.green, fontSize: 13, fontWeight: '600' }}>PIN oublié ?</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 13, justifyContent: 'center', marginVertical: 16 },
  dot: { width: 13, height: 13, borderRadius: 7 },
  faceIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  biometricBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line },
  identifierInput: {
    borderWidth: 1.5, borderColor: colors.line, borderRadius: 14,
    padding: 14, fontSize: 16, fontWeight: '500', color: colors.ink,
    backgroundColor: colors.surface,
  },
  nextBtn: {
    backgroundColor: colors.green, borderRadius: 14, padding: 14,
    alignItems: 'center', marginTop: 4,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorText: { color: '#C4611A', fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
