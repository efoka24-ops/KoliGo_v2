import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KenteStripe from '../../components/KenteStripe';
import { errMsg } from '../../utils/apiError';

// Le véhicule détermine les gabarits qu'un livreur peut accepter (moto : XS à L, tricycle : jusqu'à XL, etc.).
export const VEHICLES = [
  { id: 'MOTO',       title: 'Moto',        sub: 'Colis jusqu\'au gabarit L' },
  { id: 'TRICYCLE',   title: 'Tricycle',    sub: 'Colis jusqu\'au gabarit XL' },
  { id: 'VOITURE',    title: 'Voiture',     sub: 'Colis volumineux' },
  { id: 'UTILITAIRE', title: 'Utilitaire',  sub: 'Meubles, gros électroménager' },
];

export default function VehicleScreen({ navigation }) {
  const { api, setUser, showToast } = useApp();
  const [vehicle, setVehicle] = useState('MOTO');
  const [saving, setSaving] = useState(false);

  // Demandé une seule fois à la première bascule en livreur : pas de retour possible.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [navigation]);

  const save = async () => {
    setSaving(true);
    try {
      await api('/user/profile', { method: 'PATCH', body: JSON.stringify({ vehicleType: vehicle }) });
      setUser((prev) => (prev ? { ...prev, vehicleType: vehicle } : prev));
      navigation.goBack();
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title="Ton véhicule" />
      <View style={{ flex: 1, padding: 20, gap: 14 }}>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, lineHeight: 21 }}>
          Choisis le véhicule avec lequel tu livres. Tu ne verras comme acceptables que les colis qu'il peut transporter.
          Tu pourras le modifier dans ton profil.
        </Text>
        {VEHICLES.map((v) => {
          const on = vehicle === v.id;
          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => setVehicle(v.id)}
              activeOpacity={0.85}
              style={{ backgroundColor: on ? '#EFF8F1' : '#fff', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: on ? colors.green : '#E8DCC8' }}
            >
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: '#0E2116' }}>{v.title}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, marginTop: 2 }}>{v.sub}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ flex: 1 }} />
        <KGButton kind="primary" size="lg" icon="check" disabled={saving} onPress={save}>
          {saving ? '…' : 'Confirmer'}
        </KGButton>
      </View>
    </SafeAreaView>
  );
}
