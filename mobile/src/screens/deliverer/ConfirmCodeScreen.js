import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { apiFetch } from '../../services/api';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

function DigitBox({ digit, active }) {
  const filled = digit !== '';
  return (
    <View style={{
      width: 60, height: 72, borderRadius: 16,
      borderWidth: 2,
      borderColor: active ? colors.green : filled ? '#C4611A' : colors.ink12,
      backgroundColor: filled ? '#FEF0E3' : colors.cream,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: '#C4611A' }}>{digit}</Text>
    </View>
  );
}

function NumPad({ onPress, onBack }) {
  return (
    <View style={{ gap: 10 }}>
      {[[1,2,3],[4,5,6],[7,8,9]].map(row => (
        <View key={row[0]} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => onPress(String(n))}
              style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 24, color: colors.ink }}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => onPress('0')}
          style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 24, color: colors.ink }}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onBack}
          style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="back" size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ConfirmCodeScreen({ navigation, route }) {
  const { token } = useApp();
  const deliveryId = route?.params?.deliveryId;
  const [code, setCode]       = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const pressDigit = (digit) => {
    if (loading) return;
    setError(null);
    setCode(prev => {
      const i = prev.findIndex(x => x === '');
      if (i === -1) return prev;
      const next = [...prev];
      next[i] = digit;
      if (i === 3) {
        const finalCode = [...next].join('');
        setTimeout(() => confirmCollect(finalCode), 80);
      }
      return next;
    });
  };

  const backspace = () => {
    if (loading) return;
    setCode(prev => {
      const next = [...prev];
      for (let i = 3; i >= 0; i--) {
        if (next[i] !== '') { next[i] = ''; break; }
      }
      return next;
    });
  };

  const confirmCollect = async (finalCode) => {
    if (!deliveryId) {
      navigation.navigate('Waiting');
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/deliveries/${deliveryId}/confirm-collect`, {
        method: 'PATCH',
        body: JSON.stringify({ collectCode: finalCode }),
      }, token);
      navigation.navigate('Waiting', { deliveryId });
    } catch (e) {
      setCode(['', '', '', '']);
      setError(e?.message || 'Code invalide, réessaie.');
    } finally {
      setLoading(false);
    }
  };

  const filled = code.filter(d => d !== '').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Code de collecte" onBack={() => navigation.goBack()} />

      <View style={{ flex: 1, padding: 24, gap: 0 }}>
        <View style={{ marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={{ backgroundColor: '#FEF0E3', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 12, color: '#C4611A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Chez le vendeur
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', letterSpacing: -0.5 }}>
            Code de collecte
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, marginTop: 6, lineHeight: 20 }}>
            Demande le code 4 chiffres au vendeur pour confirmer la prise en charge du colis.
          </Text>
        </View>

        {/* Code display */}
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
          {code.map((d, i) => (
            <DigitBox key={i} digit={d} active={i === filled && filled < 4} />
          ))}
        </View>

        {error && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <Icon name="flag" size={16} color="#D8472A" />
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: '#D8472A' }}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={colors.green} size="large" />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, marginTop: 8 }}>
              Vérification…
            </Text>
          </View>
        ) : (
          <NumPad onPress={pressDigit} onBack={backspace} />
        )}
      </View>
    </SafeAreaView>
  );
}
