import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { apiFetch } from '../../services/api';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

const NUMPAD = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [null, 0, 'del']];

// Step 1: email entry → POST /auth/forgot-pin → OTP sent by email
// Step 2: OTP code verification
// Step 3: new PIN + confirm PIN
// Step 4: success

export default function ForgotPinScreen({ navigation, route }) {
  const [step, setStep]               = useState(1);
  const [email, setEmail]             = useState('');
  const [emailHint, setEmailHint]     = useState('');
  const [phoneInternal, setPhoneInternal] = useState(''); // returned by backend, used for verify/reset
  const [otp, setOtp]                 = useState(['', '', '', '']);
  const [newPin, setNewPin]           = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin]   = useState(['', '', '', '']);
  const [confirmMode, setConfirmMode] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const emailTrimmed = email.trim().toLowerCase();

  const pressDigit = (n) => {
    if (step === 2) {
      setOtp(prev => {
        const i = prev.findIndex(x => x === '');
        if (i === -1) return prev;
        const next = [...prev]; next[i] = String(n); return next;
      });
    } else if (step === 3) {
      const setter = confirmMode ? setConfirmPin : setNewPin;
      setter(prev => {
        const i = prev.findIndex(x => x === '');
        if (i === -1) return prev;
        const next = [...prev]; next[i] = String(n); return next;
      });
    }
  };

  const backDigit = () => {
    if (step === 2) {
      setOtp(prev => {
        const next = [...prev];
        for (let i = 3; i >= 0; i--) { if (next[i] !== '') { next[i] = ''; break; } }
        return next;
      });
    } else if (step === 3) {
      const setter = confirmMode ? setConfirmPin : setNewPin;
      setter(prev => {
        const next = [...prev];
        for (let i = 3; i >= 0; i--) { if (next[i] !== '') { next[i] = ''; break; } }
        return next;
      });
    }
  };

  const handleSendOtp = async () => {
    setError(null);
    if (!emailTrimmed || !emailTrimmed.includes('@')) {
      setError('Adresse email invalide.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/auth/forgot-pin', { method: 'POST', body: JSON.stringify({ email: emailTrimmed }) });
      setEmailHint(res?.emailHint || emailTrimmed);
      if (res?._phone) setPhoneInternal(res._phone);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Email introuvable — vérifie l\'adresse.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    const code = otp.join('');
    if (code.length < 4) return;
    setLoading(true);
    try {
      await apiFetch('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ email: emailTrimmed, code }) });
      setStep(3);
    } catch (err) {
      setError(err.message || 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const filled = newPin.every(d => d !== '');
    if (filled && !confirmMode) setConfirmMode(true);
  }, [newPin]);

  const handleResetPin = async () => {
    setError(null);
    const pinCode     = newPin.join('');
    const confirmCode = confirmPin.join('');
    if (pinCode !== confirmCode) {
      setError('Les codes ne correspondent pas. Recommence.');
      setConfirmPin(['', '', '', '']);
      setConfirmMode(false);
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/reset-pin', {
        method: 'POST',
        body: JSON.stringify({ email: emailTrimmed, otp: otp.join(''), newPin: pinCode }),
      });
      setStep(4);
    } catch (err) {
      setError(err.message || 'Réinitialisation impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 1) navigation.goBack();
    else if (step === 2) setStep(1);
    else if (step === 3) {
      if (confirmMode) { setConfirmMode(false); setConfirmPin(['', '', '', '']); }
      else setStep(2);
    } else navigation.goBack();
  };

  const currentDisplay = step === 2 ? otp : (confirmMode ? confirmPin : newPin);
  const allFilled      = currentDisplay.every(d => d !== '');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar
        title={step === 4 ? 'PIN réinitialisé' : 'PIN oublié'}
        onBack={step === 4 ? undefined : handleBack}
      />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Step 1 : email ─────────────────────────────── */}
        {step === 1 && (
          <>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#0E2116', letterSpacing: -0.5 }}>
                Réinitialiser le PIN
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, lineHeight: 20 }}>
                Saisis l'adresse{' '}
                <Text style={{ fontFamily: `${fonts.ui}-Bold`, color: '#0E2116' }}>email</Text>
                {' '}associée à ton compte. Tu recevras un code de vérification.
              </Text>
            </View>

            <KGInput
              label="Adresse email"
              value={email}
              onChangeText={v => { setEmail(v); setError(null); }}
              icon="bell"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="exemple@gmail.com"
            />

            {error && <ErrorBox msg={error} />}

            <View style={{ flex: 1, minHeight: 16 }} />
            <KGButton kind="primary" size="lg" icon={loading ? undefined : 'arrow'} onPress={handleSendOtp} disabled={loading || !emailTrimmed.includes('@')}>
              {loading ? <ActivityIndicator color="#fff" /> : 'Envoyer le code'}
            </KGButton>

            <TouchableOpacity onPress={() => navigation.navigate('Signin')} style={{ alignSelf: 'center', paddingVertical: 8 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.green }}>
                Retour à la connexion
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2 : OTP ────────────────────────────────── */}
        {step === 2 && (
          <>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#0E2116', letterSpacing: -0.5 }}>
                Code de vérification
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, lineHeight: 21 }}>
                Un code a été envoyé à{' '}
                <Text style={{ fontFamily: `${fonts.ui}-Bold`, color: '#0E2116' }}>{emailHint}</Text>.
                {'\n'}Vérifie ta boîte de réception.
              </Text>
            </View>

            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E8DCC8', alignItems: 'center', gap: 12 }}>
              <Icon name="shield" size={28} color={colors.green} />
              <TextInput
                value={otp.join('')}
                onChangeText={v => {
                  const digits = (v || '').replace(/\D/g, '').slice(0, 4);
                  setOtp([digits[0] || '', digits[1] || '', digits[2] || '', digits[3] || '']);
                  setError(null);
                }}
                placeholder="0000"
                placeholderTextColor={colors.ink35}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                underlineColorAndroid="transparent"
                style={{
                  width: '100%', height: 64, borderRadius: 14, borderWidth: 2,
                  borderColor: otp.some(Boolean) ? colors.green : '#E8DCC8',
                  backgroundColor: '#F5F0E8',
                  textAlign: 'center', letterSpacing: 14,
                  fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: colors.ink,
                }}
              />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink35 }}>
                Valide 5 minutes
              </Text>
            </View>

            {error && <ErrorBox msg={error} />}

            <View style={{ flex: 1, minHeight: 16 }} />
            <KGButton kind={allFilled ? 'primary' : 'ghost'} size="lg" icon={loading ? undefined : 'arrow'} onPress={handleVerifyOtp} disabled={loading || !allFilled}>
              {loading ? <ActivityIndicator color="#fff" /> : 'Valider le code'}
            </KGButton>
          </>
        )}

        {/* ── Step 3 : nouveau PIN ─────────────────────────── */}
        {step === 3 && (
          <>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#0E2116', letterSpacing: -0.5 }}>
                {confirmMode ? 'Confirme ton PIN' : 'Nouveau PIN'}
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, lineHeight: 20 }}>
                {confirmMode
                  ? 'Saisis à nouveau le même code pour confirmer.'
                  : 'Choisis un nouveau code PIN à 4 chiffres.'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
              {(confirmMode ? confirmPin : newPin).map((d, i) => (
                <View key={i} style={{
                  width: 64, height: 76, borderRadius: 14, borderWidth: 2,
                  borderColor: d ? colors.green : '#E8DCC8',
                  backgroundColor: d ? '#EFF8F1' : '#F5F0E8',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: colors.ink }}>{d ? '●' : ''}</Text>
                </View>
              ))}
            </View>

            {error && <ErrorBox msg={error} />}

            <View style={{ flex: 1, minHeight: 8 }} />

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
                        style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 24, color: colors.ink }}>{key}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {confirmMode && (
              <KGButton kind={allFilled ? 'primary' : 'ghost'} size="lg" icon={loading ? undefined : 'check'} onPress={handleResetPin} disabled={loading || !allFilled}>
                {loading ? <ActivityIndicator color="#fff" /> : 'Réinitialiser le PIN'}
              </KGButton>
            )}
          </>
        )}

        {/* ── Step 4 : succès ─────────────────────────────── */}
        {step === 4 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 40 }}>
            <View style={{ width: 90, height: 90, borderRadius: 24, backgroundColor: '#EFF8F1', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.green }}>
              <Icon name="check" size={44} color={colors.green} />
            </View>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#0E2116', textAlign: 'center', letterSpacing: -0.5 }}>
                PIN mis à jour !
              </Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 21, maxWidth: 270 }}>
                Ton nouveau PIN est actif. Tu peux maintenant te connecter.
              </Text>
            </View>
            <KGButton kind="primary" size="lg" icon="arrow" onPress={() => navigation.navigate('Signin')}>
              Se connecter
            </KGButton>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function ErrorBox({ msg }) {
  return (
    <View style={{ backgroundColor: '#FEF0E3', padding: 12, borderRadius: 12, flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#F5D0B8' }}>
      <Icon name="shield" size={16} color="#C4611A" />
      <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#C4611A' }}>{msg}</Text>
    </View>
  );
}
