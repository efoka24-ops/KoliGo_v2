import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, ScreenHeader, CodeBoxes, Numpad, Button } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/auth';

export default function OtpScreen({ navigation }) {
  const { t } = useI18n();
  const { pendingUser, setPendingUser, showToast } = useApp();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const phone = pendingUser?.phone ?? '+237 6•• ••• •12';
  const email = pendingUser?.email;
  const dest = email ?? phone;

  // Code handed back by the backend so the screen can complete on its own.
  // Undefined when OTP_RETURN_CODE=false, in which case this screen behaves
  // like a normal manual entry.
  const [devCode, setDevCode] = useState(pendingUser?.devCode);
  // Guards against a second submit when the effect re-runs.
  const autoSubmitted = useRef(false);

  const handleVerify = useCallback(async (value) => {
    const submitted = value ?? code;
    if (submitted.length < 4) return;
    setLoading(true);
    try {
      await authService.verifyOtp(phone, submitted);
      navigation.navigate('Pin');
    } catch (e) {
      showToast(e?.response?.data?.error || 'Code incorrect', 'error');
      setCode('');
      // Let the user retry by hand rather than looping on a rejected code.
      autoSubmitted.current = true;
    } finally {
      setLoading(false);
    }
  }, [code, phone, navigation, showToast]);

  // Fill and submit without the user touching anything.
  useEffect(() => {
    if (!devCode || autoSubmitted.current) return;
    autoSubmitted.current = true;
    setCode(devCode);
    handleVerify(devCode);
  }, [devCode, handleVerify]);

  const onKey = (k) => {
    if (k === '⌫') setCode(c => c.slice(0, -1));
    else if (code.length < 4) setCode(c => c + k);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await authService.sendOtp(phone, email, pendingUser?.name);
      // Resending invalidates the previous code, so replace the shown one and
      // let the new one submit itself too.
      setCode('');
      autoSubmitted.current = false;
      setDevCode(res?.devCode);
      setPendingUser(u => ({ ...(u ?? {}), devCode: res?.devCode }));
      showToast(email ? `Code renvoyé à ${email}` : 'Code renvoyé');
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen footer={
      <Button
        title={loading ? '...' : t('verify')}
        disabled={code.length < 4 || loading}
        onPress={() => handleVerify()}
      />
    }>
      <ScreenHeader title={t('verification')} subtitle={email ? `Code envoyé à ${email}` : phone} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 20 }}>

        {/* Email delivery info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.green50, borderRadius: 12, padding: 14 }}>
          <Ionicons name="mail" size={18} color={colors.green} />
          <View style={{ flex: 1 }}>
            <Text style={[type.h3, { color: colors.greenDark }]}>Vérifiez votre boîte mail</Text>
            <Text style={[type.lead, { marginTop: 2 }]}>
              Code envoyé à <Text style={{ fontWeight: '700', color: colors.ink }}>{dest}</Text>
            </Text>
          </View>
        </View>

        {devCode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF8F1', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.green }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: colors.greenDark }]}>Code détecté : {devCode}</Text>
              <Text style={[type.lead, { marginTop: 2, color: colors.greenDark }]}>
                Vérification automatique, rien à saisir.
              </Text>
            </View>
          </View>
        ) : null}

        {!devCode && <Text style={type.lead}>{t('otpHint')}</Text>}
        <CodeBoxes value={code} length={4} />

        <Numpad onKey={onKey} />

        <Text
          style={[type.eyebrow, { textAlign: 'center', color: colors.green }]}
          onPress={resending ? undefined : handleResend}
        >
          {resending ? 'Envoi...' : '↺  Renvoyer le code'}
        </Text>
      </View>
    </Screen>
  );
}
