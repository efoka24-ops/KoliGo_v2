import { tr } from '../../i18n/tr';
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
  // Délai avant un nouvel envoi : le serveur limite le nombre de codes par numéro, inutile de le dépasser.
  const [wait, setWait] = useState(30);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const phone = pendingUser?.phone ?? '+237 6•• ••• •12';
  const email = pendingUser?.email;

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
    if (wait > 0) return;
    setResending(true);
    try {
      const res = await authService.sendOtp(phone, email, pendingUser?.name);
      // Resending invalidates the previous code, so replace the shown one and
      // let the new one submit itself too.
      setCode('');
      autoSubmitted.current = false;
      setDevCode(res?.devCode);
      setPendingUser(u => ({ ...(u ?? {}), devCode: res?.devCode, emailSent: res?.email, smsSent: res?.sms, smsError: res?.smsError }));
      setWait(30);
      showToast(res?.sms ? tr('Code renvoyé par SMS') : res?.email ? tr('Code renvoyé par e-mail') : tr("Le code n'a pas pu être envoyé. Réessaie dans un instant."), res?.sms || res?.email ? undefined : 'error');
    } catch {
      showToast(tr("Erreur réseau"), 'error');
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
      <ScreenHeader title={t('verification')} subtitle={email ? `${phone} · ${email}` : phone} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 20 }}>

        {/* Ce qui a réellement été envoyé : jamais un canal annoncé sans confirmation du serveur */}
        {(() => {
          const smsOk = pendingUser?.smsSent === true;
          const emailOk = !!email && pendingUser?.emailSent === true;
          const failed = !smsOk && !emailOk && pendingUser?.smsSent === false;
          const smsReason = pendingUser?.smsError === 'rate_limited' ? tr('Trop de demandes pour ce numéro : attends quelques minutes avant de réessayer.')
            : pendingUser?.smsError === 'invalid_phone' ? tr('Ce numéro ne semble pas valide.')
            : tr('Le service SMS est momentanément indisponible.');
          const title = smsOk ? tr('Vérifie tes SMS') : emailOk ? tr('Vérifie ta boîte mail') : failed ? tr('Code non envoyé') : tr('Vérification en cours');
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: failed ? '#FEF0E3' : colors.green50, borderRadius: 12, padding: 14 }}>
              <Ionicons name={failed ? 'warning' : smsOk ? 'chatbubble-ellipses' : 'mail'} size={18} color={failed ? '#C4611A' : colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={[type.h3, { color: failed ? '#C4611A' : colors.greenDark }]}>{title}</Text>
                {smsOk ? (
                  <Text style={[type.lead, { marginTop: 2 }]}>
                    {tr('Un SMS avec ton code a été envoyé au')} <Text style={{ fontWeight: '700', color: colors.ink }}>{phone}</Text>. {tr('Il peut arriver en moins d’une minute.')}
                  </Text>
                ) : pendingUser?.smsSent === false ? (
                  <Text style={[type.lead, { marginTop: 2 }]}>{smsReason}</Text>
                ) : null}
                {emailOk ? (
                  <Text style={[type.lead, { marginTop: 2 }]}>
                    {tr('Un e-mail a aussi été envoyé à')} <Text style={{ fontWeight: '700', color: colors.ink }}>{email}</Text>. {tr('Pense à vérifier les spams.')}
                  </Text>
                ) : email && pendingUser?.emailSent === false ? (
                  <Text style={[type.lead, { marginTop: 2 }]}>{tr("L'e-mail n'a pas pu être envoyé.")}</Text>
                ) : null}
                {failed ? (
                  <Text style={[type.lead, { marginTop: 6 }]}>{tr('Appuie sur « Renvoyer le code » dans un instant, ou contacte le support si cela continue.')}</Text>
                ) : null}
              </View>
            </View>
          );
        })()}

        {devCode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF8F1', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.green }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: colors.greenDark }]}>Code détecté : {devCode}</Text>
              <Text style={[type.lead, { marginTop: 2, color: colors.greenDark }]}>
                {tr("Vérification automatique, rien à saisir.")}
              </Text>
            </View>
          </View>
        ) : null}

        {!devCode && <Text style={type.lead}>{t('otpHint')}</Text>}
        <CodeBoxes value={code} length={4} />

        <Numpad onKey={onKey} />

        <Text
          style={[type.eyebrow, { textAlign: 'center', color: wait > 0 ? colors.ink35 : colors.green }]}
          onPress={resending || wait > 0 ? undefined : handleResend}
        >
          {resending ? tr('Envoi...') : wait > 0 ? `${tr('Renvoyer le code dans')} ${wait} s` : tr('↺  Renvoyer le code')}
        </Text>
      </View>
    </Screen>
  );
}
