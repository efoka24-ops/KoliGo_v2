import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Animated, Platform } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import { useApp } from '../context/AppContext';
import KGTopBar from '../components/KGTopBar';
import KGButton from '../components/KGButton';
import KGCard from '../components/KGCard';
import Icon from '../components/Icon';

const POLL_MS = 5000;

export default function DelivererWaitingScreen({ navigation, route }) {
  const params = route?.params || {};
  const { api, showToast, user } = useApp();
  const deliveryId = params.deliveryId;
  const isDemo = user?.isTest === true;
  const [dots, setDots] = useState(1);
  const pulse = React.useRef(new Animated.Value(0.9)).current;
  const locationWatchRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setDots(d => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Poll delivery status — navigate to Rating when LIVRE
  const pollStatus = useCallback(async () => {
    if (isDemo || !deliveryId) return;
    try {
      const data = await api(`/api/deliveries/${deliveryId}`);
      if ((data.status || '').toLowerCase() === 'livre') {
        clearInterval(pollRef.current);
        showToast('Livraison validée ✓ — paiement crédité !');
        navigation.replace('Rating', { partner: 'client', deliveryId });
      }
    } catch {}
  }, [api, deliveryId, isDemo, navigation, showToast]);

  useEffect(() => {
    pollRef.current = setInterval(pollStatus, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [pollStatus]);

  // ── GPS streaming to backend ────────────────────────────────────────────────
  useEffect(() => {
    if (!deliveryId) return;
    let stopped = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        locationWatchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 20 },
          async (loc) => {
            if (stopped) return;
            try {
              await api(`/api/deliveries/${deliveryId}/location`, {
                method: 'POST',
                body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
              });
            } catch {}
          }
        );
      } catch {}
    })();
    return () => {
      stopped = true;
      try { locationWatchRef.current?.remove?.(); } catch {}
    };
  }, [deliveryId]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.9, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);

  const dotStr = '.'.repeat(dots);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar
        title="En attente du client"
        onBack={() => navigation.navigate('DeliveryDetail', { deliveryId: params.deliveryId, mode: 'mine' })}
      />
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 22, alignItems: 'center', paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pulsing avatar */}
        <View style={{ marginTop: 20, alignItems: 'center', justifyContent: 'center', width: 140, height: 140 }}>
          <Animated.View style={{
            position: 'absolute',
            width: 140, height: 140, borderRadius: 70,
            borderWidth: 3, borderColor: colors.orange,
            opacity: 0.3,
            transform: [{ scale: pulse }],
          }} />
          <View style={{
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: colors.orangeLight,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="user" size={56} color={colors.orange} />
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, letterSpacing: -0.02 * 24, color: colors.ink, textAlign: 'center' }}>
            En attente du client{dotStr}
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink70, textAlign: 'center', lineHeight: 21, paddingHorizontal: 10 }}>
            Demande au destinataire d'ouvrir son lien KoliGo et de saisir son{' '}
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, color: colors.ink }}>code de réception</Text>.
            Tu seras notifié dès la validation.
          </Text>
        </View>

        <KGCard kind="cream" padding={16} style={{ width: '100%' }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, letterSpacing: 0.04, textTransform: 'uppercase', marginBottom: 10 }}>
            Rappel
          </Text>
          {[
            'Tu ne saisis pas de code toi-même',
            'Le client confirme depuis son téléphone',
            'Le paiement t\'est versé automatiquement à la confirmation',
          ].map((line, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 13, color: colors.green }}>•</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, flex: 1, lineHeight: 19 }}>{line}</Text>
            </View>
          ))}
        </KGCard>

        <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
          <KGButton kind="ghost" full={false} style={{ flex: 1 }} icon="chat" onPress={() => navigation.navigate('Chat', { deliveryId: params.deliveryId })}>
            Chat
          </KGButton>
          <KGButton kind="ghost" full={false} style={{ flex: 1 }} icon="bell">
            Appeler
          </KGButton>
        </View>

        {/* Demo shortcut */}
        <KGButton
          kind="orange"
          size="lg"
          icon="check"
          onPress={() => navigation.navigate('Rating', { partner: 'client' })}
        >
          (Démo) Simuler confirmation client
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
