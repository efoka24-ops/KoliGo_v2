import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import Icon from '../../components/Icon';
import { useApp } from '../../context/AppContext';

const OPERATORS = [
  { id: 'MTN_CM',    label: 'MTN MoMo',     color: '#FFC400', logo: '🟡' },
  { id: 'ORANGE_CM', label: 'Orange Money',  color: '#FF6900', logo: '🟠' },
];

export default function PaymentScreen({ navigation, route }) {
  const {
    deliveryId, price, from, to, codeCollect, codeReception,
    orderId, shopName, parcelDesc, recipientName, clientWhatsApp,
  } = route.params;

  const { api, showToast } = useApp();

  const [operator, setOperator] = useState('MTN_CM');
  const [phone,    setPhone]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const phoneNorm = phone.replace(/\s/g, '');

  const handlePay = async () => {
    if (!phoneNorm || !/^6\d{8}$/.test(phoneNorm)) {
      Alert.alert('Numéro invalide', 'Saisis ton numéro MoMo (ex: 677123456)');
      return;
    }
    setLoading(true);
    try {
      const result = await api('/payment/cashout', {
        method: 'POST',
        body: JSON.stringify({ deliveryId, phone: phoneNorm }),
      });

      if (result?.transactionId) {
        showToast('Paiement initié — confirme sur ton téléphone', 'success');
        pollStatus(result.transactionId);
      } else {
        showToast(result?.error || 'Réponse inattendue du service de paiement', 'error');
        setLoading(false);
      }
    } catch (e) {
      showToast(e?.response?.data?.error || e.message || 'Erreur paiement', 'error');
      setLoading(false);
    }
  };

  const pollStatus = (txId, attempts = 0) => {
    if (attempts > 12) {
      setLoading(false);
      showToast('Délai dépassé — vérifie ton téléphone et relance si besoin', 'error');
      return;
    }
    setTimeout(async () => {
      try {
        const result = await api(`/payment/verify/${txId}`);
        const s = (result?.status ?? '').toLowerCase();
        if (s === 'success' || s === 'completed') {
          setLoading(false);
          navigateToSuccess();
        } else if (s === 'failed' || s === 'rejected' || s === 'error') {
          setLoading(false);
          showToast('Paiement refusé — réessaie', 'error');
        } else {
          pollStatus(txId, attempts + 1);
        }
      } catch {
        pollStatus(txId, attempts + 1);
      }
    }, 5000);
  };

  const handleSkip = () => {
    // Allow to skip payment (useful during testing / cash payment)
    Alert.alert(
      'Payer plus tard ?',
      'La livraison sera créée mais non payée. Le livreur peut refuser de collecter sans preuve de paiement.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Continuer quand même', onPress: navigateToSuccess },
      ]
    );
  };

  const navigateToSuccess = () => {
    navigation.replace('VendorCodes', {
      orderId, codeCollect, codeReception, from, to, price,
      shopName, parcelDesc, recipientName, clientWhatsApp,
    });
  };

  const fmt = (n) => n?.toLocaleString('fr-FR') ?? '0';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F5F1' }} edges={['top']}>
      <KGTopBar
        title="Paiement"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
        {/* Amount card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E8DCC8' }}>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>
            Montant à régler
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 34, color: colors.greenDark, marginTop: 4 }}>
            {fmt(price)} <Text style={{ fontSize: 16, color: colors.ink55 }}>XAF</Text>
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink35, marginTop: 4 }}>
            {from} → {to}
          </Text>
        </View>

        {/* Operator selector */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.08 }}>
            Réseau Mobile Money
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {OPERATORS.map(op => {
              const active = operator === op.id;
              return (
                <TouchableOpacity
                  key={op.id}
                  onPress={() => setOperator(op.id)}
                  style={{
                    flex: 1, padding: 14, borderRadius: 14, borderWidth: 2,
                    borderColor: active ? op.color : '#E8DCC8',
                    backgroundColor: active ? op.color + '18' : '#fff',
                    alignItems: 'center', gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{op.logo}</Text>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: active ? colors.ink : colors.ink55 }}>
                    {op.label}
                  </Text>
                  {active && (
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: op.color, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Phone input */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.08 }}>
            Numéro {operator === 'MTN_CM' ? 'MTN' : 'Orange'} du payeur
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="6XX XXX XXX"
            placeholderTextColor={colors.ink35}
            keyboardType="phone-pad"
            style={{
              backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5,
              borderColor: phoneNorm.length === 9 && /^6\d{8}$/.test(phoneNorm) ? colors.green : '#E8DCC8',
              padding: 14, fontSize: 18, fontFamily: `${fonts.ui}-SemiBold`,
              color: colors.ink, letterSpacing: 2,
            }}
          />
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35 }}>
            Une notification sera envoyée sur ce numéro pour confirmer le paiement.
          </Text>
        </View>

        {/* Note */}
        <View style={{ backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10 }}>
          <Icon name="bolt" size={16} color="#F59E0B" />
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18 }}>
            Le paiement est sécurisé via Easy Transact. Ton livreur ne sera notifié qu'après confirmation.
          </Text>
        </View>
      </ScrollView>

      {/* Footer actions */}
      <View style={{ padding: 18, gap: 10, backgroundColor: '#F4F5F1' }}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}>
            <ActivityIndicator color={colors.green} size="large" />
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink55 }}>
              En attente de confirmation…
            </Text>
          </View>
        ) : (
          <>
            <KGButton
              label={`Payer ${fmt(price)} XAF`}
              onPress={handlePay}
              disabled={!phoneNorm || !/^6\d{8}$/.test(phoneNorm)}
            />
            <TouchableOpacity onPress={handleSkip} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink55 }}>
                Payer en espèces (ignorer)
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
