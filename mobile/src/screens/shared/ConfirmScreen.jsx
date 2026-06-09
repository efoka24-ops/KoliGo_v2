import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import { useApp } from '../context/AppContext';
import KGTopBar from '../components/KGTopBar';
import KGButton from '../components/KGButton';
import Icon from '../components/Icon';

const NUMPAD = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [null, 0, 'del']];

export default function ConfirmScreen({ navigation, route }) {
  const { deliveryId, phase = 'collect' } = route?.params || {};
  const { user, token, api, showToast } = useApp();
  const isDemo = user?.isTest === true;
  const [digits, setDigits] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isComplete = digits.every(d => d !== '');
  const isCollect = phase === 'collect';

  const press = (n) => {
    setDigits(prev => {
      const i = prev.findIndex(x => x === '');
      if (i === -1) return prev;
      const next = [...prev]; next[i] = String(n); return next;
    });
  };

  const backspace = () => {
    setDigits(prev => {
      const i = prev.findIndex(x => x === '');
      const idx = i === -1 ? 3 : i - 1;
      if (idx < 0) return prev;
      const next = [...prev]; next[idx] = ''; return next;
    });
  };

  const handleConfirm = async () => {
    const code = digits.join('');
    setError(null);

    if (isDemo) {
      if (isCollect) navigation.navigate('DeliveryDetail', { deliveryId, mode: 'mine' });
      else navigation.navigate('DelivererWaiting', { deliveryId });
      return;
    }

    setLoading(true);
    try {
      if (isCollect) {
        await api(`/api/deliveries/${deliveryId}/confirm-collect`, {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        showToast('Collecte confirmée ! En route 🚀');
        navigation.navigate('DeliveryDetail', { deliveryId, mode: 'mine' });
      } else {
        await api(`/api/deliveries/${deliveryId}/confirm-deliver`, {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        showToast('Livraison validée ! Paiement crédité ✅');
        navigation.navigate('DelivererHome');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar
        title={isCollect ? 'Code de collecte' : 'Code de livraison'}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, flexGrow: 1 }} showsVerticalScrollIndicator={false}>

        <View style={{
          width: 64, height: 64, borderRadius: 18,
          backgroundColor: isCollect ? colors.orangeLight : colors.greenLight,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="shield" size={32} color={isCollect ? colors.orange : colors.green} />
        </View>

        <View>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: colors.ink, letterSpacing: -0.02 * 26 }}>
            {isCollect ? 'Demande le code au vendeur' : 'Demande le code au destinataire'}
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink70, marginTop: 8, lineHeight: 20 }}>
            {isCollect
              ? 'Saisis le code à 4 chiffres affiché dans son app pour confirmer la collecte.'
              : "Saisis le code à 4 chiffres reçu par SMS. Sans ce code, la livraison n'est pas validée."}
          </Text>
        </View>

        {/* Digit display */}
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 8 }}>
          {digits.map((d, i) => (
            <View key={i} style={{
              width: 64, height: 76, borderRadius: 14,
              borderWidth: 2, borderColor: d ? colors.green : colors.ink12,
              backgroundColor: d ? colors.greenLight : colors.cream,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: colors.ink }}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* Numpad */}
        <View style={{ gap: 8 }}>
          {NUMPAD.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
              {row.map((key, ki) => {
                if (key === null) return <View key={ki} style={{ flex: 1 }} />;
                if (key === 'del') return (
                  <TouchableOpacity
                    key={ki}
                    onPress={backspace}
                    style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="back" size={22} color={colors.ink} />
                  </TouchableOpacity>
                );
                return (
                  <TouchableOpacity
                    key={ki}
                    onPress={() => press(key)}
                    style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 24, color: colors.ink }}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {error && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 }}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#D8472A' }}>{error}</Text>
          </View>
        )}

        <KGButton
          kind={isComplete && !loading ? 'primary' : 'ghost'}
          disabled={!isComplete || loading}
          size="lg"
          icon={loading ? undefined : 'check'}
          onPress={handleConfirm}
        >
          {loading
            ? <ActivityIndicator color={colors.green} />
            : (isCollect ? 'Valider la collecte' : 'Valider la livraison')}
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
