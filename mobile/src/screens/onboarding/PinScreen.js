import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/auth';
import { storage } from '../../utils/storage';
import KGTopBar from '../../components/KGTopBar';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

function NumPad({ onPress, onBack }) {
  return (
    <View style={{ gap: 10 }}>
      {[[1,2,3],[4,5,6],[7,8,9]].map(row => (
        <View key={row[0]} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => onPress(String(n))}
              style={{ flex: 1, height: 60, borderRadius: 16, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: colors.ink }}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => onPress('0')}
          style={{ flex: 1, height: 60, borderRadius: 16, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: colors.ink }}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onBack}
          style={{ flex: 1, height: 60, borderRadius: 16, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="back" size={24} color={colors.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PinScreen({ navigation }) {
  const { pendingUser, loginAs, showToast } = useApp();
  const [pin, setPin]     = useState('');
  const [loading, setLoading] = useState(false);

  const onPress = async (digit) => {
    if (loading) return;
    const next = pin + digit;
    if (next.length > 4) return;
    setPin(next);
    if (next.length === 4) {
      setLoading(true);
      try {
        const data = await authService.signup({
          name: pendingUser?.name ?? '',
          phone: pendingUser?.phone ?? '',
          email: pendingUser?.email,
          gender: pendingUser?.gender,
          shopName: pendingUser?.shopName,
          pin: next,
          role: 'VENDOR',
        });
        if (pendingUser?.phone) {
          await storage.setItem('user_phone', pendingUser.phone);
        }
        loginAs(
          {
            id: data.user?.id,
            name: data.user?.name,
            phone: data.user?.phone,
            kycStatus: data.user?.kycStatus,
            gender: data.user?.gender,
            shopName: data.user?.shopName,
            role: data.user?.activeRole?.toLowerCase() || 'vendor',
          },
          data.accessToken
        );
        navigation.reset({ index: 0, routes: [{ name: 'VendorApp' }] });
      } catch (e) {
        showToast(e?.response?.data?.error || 'Inscription échouée', 'error');
        setPin('');
      } finally {
        setLoading(false);
      }
    }
  };

  const onBack = () => {
    if (loading) return;
    setPin(p => p.slice(0, -1));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Crée ton code PIN" onBack={() => navigation.goBack()} />
      <View style={{ flex: 1, padding: 24, gap: 0 }}>

        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#B8A48A', textTransform: 'uppercase', letterSpacing: 0.08 }}>
            Étape 3 / 3
          </Text>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 26, color: '#0E2116', letterSpacing: -0.5, marginTop: 4 }}>
            Ton code PIN
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink55, marginTop: 6 }}>
            4 chiffres pour sécuriser ton compte. Ne le partage jamais.
          </Text>
        </View>

        {/* Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 40 }}>
          {[0,1,2,3].map(i => (
            <View key={i} style={{
              width: 18, height: 18, borderRadius: 9,
              backgroundColor: i < pin.length ? colors.green : '#E8DCC8',
            }} />
          ))}
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator color={colors.green} size="large" />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, marginTop: 12 }}>
              Création du compte…
            </Text>
          </View>
        ) : (
          <NumPad onPress={onPress} onBack={onBack} />
        )}
      </View>
    </SafeAreaView>
  );
}
