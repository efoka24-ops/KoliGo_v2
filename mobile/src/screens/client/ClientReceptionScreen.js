import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { apiFetch } from '../../services/api';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import Icon from '../../components/Icon';

function DigitBox({ digit }) {
  const filled = digit !== '';
  return (
    <View style={{
      width: 56, height: 68, borderRadius: 14,
      borderWidth: 2,
      borderColor: filled ? colors.green : colors.ink12,
      backgroundColor: filled ? colors.greenLight : colors.cream,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 30, color: colors.green }}>{digit}</Text>
    </View>
  );
}

function NumPad({ onPress, onBack }) {
  return (
    <View style={{ gap: 8 }}>
      {[[1,2,3],[4,5,6],[7,8,9]].map(row => (
        <View key={row[0]} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => onPress(n)}
              style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 22, color: colors.ink }}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => onPress(0)}
          style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 22, color: colors.ink }}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onBack}
          style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="back" size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ClientReceptionScreen({ navigation, route }) {
  const params = route?.params || {};
  const { deliveryId } = params;
  const [code, setCode] = useState(['', '', '', '']);
  const [momoRef, setMomoRef] = useState('');
  const [paymentNumber, setPaymentNumber] = useState(params.paymentNumber || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isComplete = code.every(d => d !== '');

  const pressDigit = (n) => {
    setCode(prev => {
      const i = prev.findIndex(x => x === '');
      if (i === -1) return prev;
      const next = [...prev];
      next[i] = String(n);
      return next;
    });
  };

  const backspace = () => {
    setCode(prev => {
      const next = [...prev];
      for (let i = 3; i >= 0; i--) {
        if (next[i] !== '') { next[i] = ''; break; }
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setError(null);
    if (!deliveryId) {
      navigation.navigate('ReceptionSuccess', {
        ...params,
        delivererName: params.delivererName || 'Eric',
        vendorName: params.vendorName || 'Mama Africa Boutique',
        merchandise: params.merchandise || params.productPrice || 15000,
        delivery: params.delivery || params.price || 1181,
      });
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch(`/deliveries/${deliveryId}/client-confirm`, {
        method: 'POST',
        body: JSON.stringify({ code: code.join(''), momoRef: momoRef.trim() || undefined, paymentNumber: paymentNumber.trim() || undefined }),
      });
      navigation.navigate('ReceptionSuccess', {
        ...params,
        delivererName: result.delivererName || null,
        delivererId:   result.delivererId || null,
        deliveryId:    deliveryId,
        vendorName:    result.vendorName || result.shopName || params.vendorName,
        parcelDesc:    result.parcelDesc || params.parcelDesc,
        merchandise:   result.productPrice || params.merchandise || 0,
        delivery:      result.price || params.delivery || 0,
        paymentNumber: paymentNumber.trim() || momoRef.trim() || null,
      });
    } catch (err) {
      setError(err.message || 'Code incorrect, réessaie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="Confirmer la réception" onBack={() => navigation.navigate('ClientTracking', params)} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, letterSpacing: -0.02 * 24, color: colors.ink }}>
            Ton colis est arrivé ?
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink70, lineHeight: 20 }}>
            Saisis le{' '}
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, color: colors.ink }}>code de réception à 4 chiffres</Text>
            {' '}que le vendeur t'a communiqué pour confirmer la livraison.
          </Text>
        </View>

        <KGCard padding={16}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 16 }}>
            Code de réception
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
            {code.map((d, i) => <DigitBox key={i} digit={d} />)}
          </View>
          <NumPad onPress={pressDigit} onBack={backspace} />
        </KGCard>

        <KGCard padding={14}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 10 }}>
            Référence paiement MoMo (optionnel)
          </Text>
          <TextInput
            value={momoRef}
            onChangeText={setMomoRef}
            placeholder="ex: 655 123 456 ou réf. transaction"
            placeholderTextColor={colors.ink35}
            keyboardType="default"
            style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.ink12, paddingHorizontal: 14, fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink, backgroundColor: colors.cream }}
          />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, letterSpacing: 0.06, textTransform: 'uppercase', marginTop: 12, marginBottom: 10 }}>
            Numéro de paiement
          </Text>
          <TextInput
            value={paymentNumber}
            onChangeText={setPaymentNumber}
            placeholder="6XX XXX XXX"
            placeholderTextColor={colors.ink35}
            keyboardType="phone-pad"
            style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.ink12, paddingHorizontal: 14, fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink, backgroundColor: colors.cream }}
          />
        </KGCard>

        {error && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="flag" size={16} color="#D8472A" />
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#D8472A' }}>{error}</Text>
          </View>
        )}

        <KGButton
          kind={isComplete && !loading ? 'primary' : 'ghost'}
          size="lg"
          icon={loading ? undefined : 'check'}
          disabled={!isComplete || loading}
          onPress={handleConfirm}
        >
          {loading ? <ActivityIndicator color={colors.green} /> : 'Confirmer la réception'}
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
