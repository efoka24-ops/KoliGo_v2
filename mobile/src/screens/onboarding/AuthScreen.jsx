import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage as SecureStore } from '../../utils/storage';
import { colors, fonts } from '../../constants/colors';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput'; // Assuming KGInput is a component, not a helper
import Icon from '../../components/Icon';
import { useApp, getInitials } from '../../context/AppContext';
import { useI18n } from '../../i18n';
import { TEST_ACCOUNTS, TEST_OTP } from '../../constants/testAccounts';
import { apiFetch } from '../../services/api';

const NUMPAD = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [null, 0, 'del']];

const TEST_PHONES = {
  [TEST_ACCOUNTS.vendor.phone]:    TEST_ACCOUNTS.vendor,
  [TEST_ACCOUNTS.deliverer.phone]: TEST_ACCOUNTS.deliverer,
};

// Ã‰tape 1 : Saisie tÃ©lÃ©phone + nom (signup) ou tÃ©lÃ©phone (signin)
// Ã‰tape 2 : OTP reÃ§u par SMS/WhatsApp (signup) ou directement PIN (signin)
// Ã‰tape 3 : CrÃ©ation PIN (signup uniquement)

export default function AuthScreen({ navigation, route }) {
  const { loginAs, setPendingUser, biometricEnabled, lang } = useApp();
  const { t } = useI18n();
  const isEn = lang === 'en';
  const initialMode = route?.params?.mode || 'signup';
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [pin, setPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Terms acceptance handshake â€” TermsScreen navigates back with termsAccepted:true
  useEffect(() => {
    if (route?.params?.termsAccepted) {
      setAgreed(true);
      navigation.setParams({ termsAccepted: undefined });
    }
  }, [route?.params?.termsAccepted]);

  const phoneNorm = phone.replace(/\s/g, '');
  const testAccount = TEST_PHONES[phone] || TEST_PHONES[phoneNorm];
  const pressDigit = (n) => {
    const setter = step === 2 ? setOtp : setPin;
    setter(prev => {
      const i = prev.findIndex(x => x === '');
      if (i === -1) return prev;
      const next = [...prev]; next[i] = String(n); return next;
    });
  };

  const backDigit = () => {
    const setter = step === 2 ? setOtp : setPin;
    setter(prev => {
      const next = [...prev];
      for (let i = 3; i >= 0; i--) {
        if (next[i] !== '') { next[i] = ''; break; }
      }
      return next;
    });
  };

  // Step 1 â†’ Step 2 : send OTP (signup) or go directly to PIN (signin)
  const handleContinue = async () => {
    setError(null);
    if (mode === 'signup' && !name.trim()) { setError('Entre ton nom complet.'); return; }
    if (!phoneNorm || phoneNorm.length < 9) { setError('NumÃ©ro invalide (format : 6XXXXXXXX).'); return; }
    if (mode === 'signup' && !agreed) { setError('Accepte les conditions pour continuer.'); return; }

    // Test account shortcut
    if (testAccount) { setStep(mode === 'signup' ? 2 : 2); return; }

    if (mode === 'signup') {
      setLoading(true);
      try {
        const result = await apiFetch('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone: phoneNorm }) });
        setStep(2);
        const returnedCode = result?.code || result?.devCode;
        if (returnedCode) setOtp(String(returnedCode).replace(/\D/g, '').slice(0, 4).split(''));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Signin: skip OTP, go directly to PIN
      setStep(2);
    }
  };

  // Step 2 OTP verified â†’ Step 3 (signup) or login (signin)
  const handleOtpVerify = async () => {
    const code = otp.join('');
    setError(null);

    // Test account bypass
    if (testAccount && code === TEST_OTP) {
      loginAs(testAccount);
      if (testAccount.role === 'vendor') navigation.replace('VendorHome');
      else navigation.replace('DelivererHome');
      return;
    }

    if (mode === 'signin') {
      // For signin, the "OTP" step is actually the PIN step
      await handleSignin(code);
      return;
    }

    // Verify OTP for signup
    setLoading(true);
    try {
      await apiFetch('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone: phoneNorm, code }) });
      setStep(3);
      setOtp(['', '', '', '']);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignin = async (code) => {
    setLoading(true);
    try {
      const result = await apiFetch('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNorm, password: code }),
      });
      const roleNorm = (result.user.role || 'vendor').toLowerCase();
      loginAs({ ...result.user, role: roleNorm, avatar: getInitials(result.user.name) }, result.token);
      navigation.replace(roleNorm === 'vendor' ? 'VendorHome' : 'DelivererHome');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: create account with PIN
  const handleCreateAccount = async () => {
    const code = pin.join('');
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNorm, name: name.trim(), password: code }),
      });
      loginAs({ ...result.user, role: (result.user.role || 'vendor').toLowerCase(), avatar: getInitials(result.user.name) }, result.token);
      setPendingUser(null);
      navigation.navigate('Verification');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Connecte-toi avec ta biomÃ©trie',
      cancelLabel: 'Annuler',
      fallbackLabel: 'Utiliser le PIN',
    });
    if (!result.success) return;
    const storedToken = await SecureStore.getItem('kg_token').catch(() => null);
    if (!storedToken) { setError('Session expirÃ©e â€” saisis ton PIN.'); return; }
    setLoading(true);
    try {
      const u = await apiFetch('/api/users/me', {}, storedToken);
      const roleNorm = (u.role || 'vendor').toLowerCase();
      loginAs({ ...u, role: roleNorm, avatar: getInitials(u.name) }, storedToken);
      navigation.replace(roleNorm === 'vendor' ? 'VendorHome' : 'DelivererHome');
    } catch {
      setError('Session expirÃ©e â€” saisis ton PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 3) { setStep(2); setPin(['', '', '', '']); }
    else if (step === 2) { setStep(1); setOtp(['', '', '', '']); }
    else navigation.goBack();
  };

  const getTitle = () => {
    if (step === 1) return mode === 'signup' ? (isEn ? 'Create account' : 'CrÃ©er un compte') : (isEn ? 'Sign in' : 'Connexion');
    if (step === 2) return mode === 'signup' ? (isEn ? 'Verification code' : 'Code de vÃ©rification') : (isEn ? 'Your PIN code' : 'Ton code PIN');
    return isEn ? 'Create your PIN' : 'CrÃ©e ton PIN';
  };

  const currentDigits = step === 2 ? otp : pin;
  const allFilled = currentDigits.every(d => d !== '');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title={getTitle()} onBack={handleBack} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40, flexGrow: 1 }} showsVerticalScrollIndicator={false}>

        {/* Step 1: phone + name */}
        {step === 1 && (
          <View style={styles.step1Container}>
            <View style={styles.modeToggleContainer}>
              {[['signup', t('CrÃ©er un compte')], ['signin', t('Se connecter')]].map(([id, label]) => (
                <TouchableOpacity key={id} onPress={() => { setMode(id); setError(null); }}
                  style={[styles.modeToggleButton, mode === id && styles.modeToggleButtonActive]}>
                  <Text style={[styles.modeToggleButtonText, mode === id && styles.modeToggleButtonTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              {mode === 'signup' && (
                <KGInput label={t('Nom complet')} placeholder="Mama Africa" value={name} onChangeText={v => { setName(v); setError(null); }} icon="user" />
              )}
              <KGInput
                label={t('NumÃ©ro de tÃ©lÃ©phone')} placeholder="6 XX XX XX XX"
                value={phone} onChangeText={v => { setPhone(v); setError(null); }}
                icon="bell" suffix="ðŸ‡¨ðŸ‡² +237" keyboardType="phone-pad"
                hint={mode === 'signup' ? t('Un code de vÃ©rification sera gÃ©nÃ©rÃ© pour ce numÃ©ro.') : t('Saisis ensuite ton code PIN Ã  4 chiffres.')}
              />
            </View>

            {mode === 'signup' && ( // Assuming this block is for signup only
              <View style={styles.termsContainer}>
                <TouchableOpacity onPress={() => setAgreed(a => !a)} style={styles.termsCheckboxRow}>
                  <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                    {agreed && <Icon name="check" size={14} color="#fff" strokeWidth={2.4} />}
                  </View>
                  <Text style={styles.termsText}>
                    {t("J'accepte les ")}
                    <Text style={styles.termsLink}
                      onPress={() => navigation.navigate('Terms', { fromSignup: true })}>
                      {t("Conditions d'utilisation")}
                    </Text>
                    {t(' et la ')}
                    <Text style={styles.termsLink}
                      onPress={() => navigation.navigate('Privacy')}>
                      {t('Politique de confidentialitÃ©')}
                    </Text>.
                  </Text>
                </TouchableOpacity>
                <View style={styles.termsLinksRow}>
                  <TouchableOpacity onPress={() => navigation.navigate('Terms', { fromSignup: true })} style={styles.termsLinkButton}>
                    <Icon name="link" size={12} color={colors.green} />
                    <Text style={styles.termsLinkButtonText}>{t('Lire les CGU')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.termsLinkSeparator}>Â·</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Privacy')} style={styles.termsLinkButton}>
                    <Icon name="shield" size={12} color={colors.green} />
                    <Text style={styles.termsLinkButtonText}>{t('ConfidentialitÃ©')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            <KGButton kind="primary" size="lg" onPress={handleContinue} disabled={loading || (mode === 'signup' && !agreed)} style={styles.continueButton}>
              {loading ? <ActivityIndicator color="#fff" /> : t('Continuer')}
            </KGButton>

            {mode === 'signin' && biometricEnabled && (
              <TouchableOpacity onPress={handleBiometricLogin} style={styles.biometricButton}>
                <Text style={{ fontSize: 22 }}>ðŸ‘†</Text>
                <Text style={styles.biometricButtonText}>
                  {t('Se connecter avec biomÃ©trie')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 2 signup: display generated code */}
        {step === 2 && mode === 'signup' && ( // Assuming this block is for signup only
          <View style={styles.step2SignupContainer}>
            <View style={styles.titleGroup}>
              <Text style={styles.title}>{t('Ton code de vÃ©rification')}</Text>
              <Text style={styles.subtitle}>
                {t("Le code Ã  4 chiffres a Ã©tÃ© transmis directement dans l'application pour le +237 {{phone}}.", { phone: phoneNorm })}
              </Text>
            </View>

            <View style={styles.otpInputContainer}>
              <Icon name="shield" size={24} color={colors.green} />

              <TextInput
                value={otp.join('')}
                onChangeText={(v) => {
                  const digits = (v || '').replace(/\D/g, '').slice(0, 4);
                  const next = [digits[0] || '', digits[1] || '', digits[2] || '', digits[3] || ''];
                  setOtp(next);
                  if (error) setError(null);
                }}
                placeholder="0000"
                placeholderTextColor={colors.ink35}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                style={{
                  ...styles.otpTextInput,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: otp.some(Boolean) ? colors.green : colors.ink12,
                  backgroundColor: '#fff',
                  textAlign: 'center',
                  letterSpacing: 10,
                  fontFamily: `${fonts.display}-ExtraBold`,
                  fontSize: 28, // Keep this inline for specific sizing
                  color: colors.ink,
                  paddingHorizontal: 10,
                }}
              />

              <Text style={styles.otpHintText}>
                {t('Tu peux le modifier si besoin Â· valide 10 minutes')}
              </Text>
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            <View style={{ flex: 1, minHeight: 16 }} />

            <KGButton
              kind={allFilled && !loading ? 'primary' : 'ghost'}
              disabled={loading || !allFilled}
              size="lg" icon={loading ? undefined : 'arrow'}
              onPress={handleOtpVerify}>
              {loading ? <ActivityIndicator color={colors.green} /> : t('Suivant')}
            </KGButton>
          </View>
        )}

        {/* Step 2 signin: PIN numpad */}
        {step === 2 && mode === 'signin' && ( // Assuming this block is for signin only
          <View style={styles.step2SigninContainer}>
            <View style={styles.titleGroup}>
              <Text style={styles.title}>
                {t('Ton code PIN')}
              </Text>
              <Text style={styles.subtitle}>
                {t('Saisis ton PIN pour te connecter au +237 {{phone}}.', { phone: phoneNorm })}
              </Text>
            </View>

            <View style={styles.pinDisplayContainer}>
              {otp.map((d, i) => (
                <View key={i} style={{ width: 64, height: 76, borderRadius: 14, borderWidth: 2, borderColor: d ? colors.green : colors.ink12, backgroundColor: d ? colors.greenLight : colors.cream, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: colors.ink }}>{d ? 'â—' : ''}</Text>
                </View>
              ))}
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            <View style={{ flex: 1, minHeight: 16 }} />

            <View style={styles.numpadContainer}>
              {NUMPAD.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
                  {row.map((key, ki) => {
                    if (key === null) return <View key={ki} style={{ flex: 1 }} />;
                    if (key === 'del') return (
                      <TouchableOpacity key={ki} onPress={backDigit}
                        style={{ flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="back" size={22} color={colors.ink} />
                      </TouchableOpacity>
                    );
                    return (
                      <TouchableOpacity key={ki} onPress={() => pressDigit(key)}
                        style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 24, color: colors.ink }}>{key}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <KGButton
              kind={allFilled && !loading ? 'primary' : 'ghost'}
              disabled={!allFilled || loading}
              size="lg" icon={loading ? undefined : 'check'}
              onPress={handleOtpVerify}>
              {loading ? <ActivityIndicator color={colors.green} /> : t('Se connecter')}
            </KGButton>
          </View>
        )}

        {/* Step 3: Create PIN (signup only) */}
        {step === 3 && ( // Assuming this block is for signup only
          <View style={styles.step3Container}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, letterSpacing: -0.5, color: colors.ink }}>
                CrÃ©e ton code PIN
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink70, lineHeight: 20 }}>
                Ce code Ã  4 chiffres est ton mot de passe KoliGo. MÃ©morise-le bien â€” il te servira Ã  chaque connexion.
              </Text>
            </View>

            <View style={{ backgroundColor: colors.greenLight, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name="shield" size={16} color={colors.greenDark} />
              <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12.5, color: colors.greenDark }}>
                NumÃ©ro vÃ©rifiÃ© âœ“ +237 {phoneNorm} Â· {name}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 8 }}>
              {pin.map((d, i) => (
                <View key={i} style={{ width: 64, height: 76, borderRadius: 14, borderWidth: 2, borderColor: d ? colors.green : colors.ink12, backgroundColor: d ? colors.greenLight : colors.cream, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: colors.ink }}>{d ? 'â—' : ''}</Text>
                </View>
              ))}
            </View>

            {error && <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 }}><Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#D8472A' }}>{error}</Text></View>}

            <View style={{ flex: 1, minHeight: 16 }} />

            <View style={{ gap: 8 }}>
              {NUMPAD.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
                  {row.map((key, ki) => {
                    if (key === null) return <View key={ki} style={{ flex: 1 }} />;
                    if (key === 'del') return (
                      <TouchableOpacity key={ki} onPress={backDigit}
                        style={{ flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="back" size={22} color={colors.ink} />
                      </TouchableOpacity>
                    );
                    return (
                      <TouchableOpacity key={ki} onPress={() => pressDigit(key)}
                        style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 24, color: colors.ink }}>{key}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <KGButton
              kind={pin.every(d => d !== '') && !loading ? 'primary' : 'ghost'}
              disabled={!pin.every(d => d !== '') || loading}
              size="lg" icon={loading ? undefined : 'check'}
              onPress={handleCreateAccount}
            >
              {loading ? <ActivityIndicator color={colors.green} /> : t('CrÃ©er mon compte')}
            </KGButton>

            <TouchableOpacity onPress={() => setPin(['', '', '', ''])} style={styles.clearPinButton}>
              <Text style={styles.clearPinButtonText}>{t('Effacer')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  step1Container: {
    flex: 1,
  },
  modeToggleContainer: {
    backgroundColor: colors.cream,
    padding: 4,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 4,
  },
  modeToggleButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  modeToggleButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
  },
  modeToggleButtonText: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 13,
    color: colors.ink55,
  },
  modeToggleButtonTextActive: {
    color: colors.ink,
  },
  inputGroup: {
    gap: 12,
  },
  termsContainer: {
    gap: 10,
  },
  termsCheckboxRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  termsText: {
    flex: 1,
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 13,
    color: colors.ink70,
    lineHeight: 19,
  },
  termsLink: {
    color: colors.green,
    fontFamily: `${fonts.ui}-SemiBold`,
  },
  termsLinksRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 32,
  },
  termsLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  termsLinkButtonText: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 11,
    color: colors.green,
  },
  termsLinkSeparator: {
    color: colors.ink35,
    fontSize: 11,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 13,
    color: '#D8472A',
  },
  continueButton: {
    // Styles for KGButton are handled by the component itself
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  biometricButtonText: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 14,
    color: colors.green,
  },
  step2SignupContainer: {
    flex: 1,
  },
  titleGroup: {
    gap: 6,
  },
  title: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 14,
    color: colors.ink70,
    lineHeight: 20,
  },
  otpInputContainer: {
    backgroundColor: colors.greenLight,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  otpTextInput: {
    width: 180,
    height: 56,
  },
  otpHintText: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 12,
    color: colors.ink55,
  },
  step2SigninContainer: {
    flex: 1,
  },
  pinDisplayContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  numpadContainer: {
    gap: 8,
  },
  step3Container: {
    flex: 1,
  },
  clearPinButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  clearPinButtonText: {
    fontFamily: `${fonts.ui}-SemiBold`,
    fontSize: 13,
    color: colors.green,
  },
});
