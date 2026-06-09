import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/api';

export default function DeliveryDetailScreen({ route, navigation }: any) {
  const { deliveryId } = route.params;
  const qc = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => adminService.cancelDelivery(deliveryId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); navigation.goBack(); },
  });

  return (
    <SafeAreaView style={s.safe}>
      <Pressable onPress={() => navigation.goBack()} style={{ padding: 18 }}>
        <Text style={{ color: '#178A3C', fontWeight: '700' }}>← Retour</Text>
      </Pressable>
      <View style={{ padding: 18, gap: 14 }}>
        <Text style={s.title}>Livraison #{deliveryId.slice(-6).toUpperCase()}</Text>
        <Pressable
          style={[s.btn, { backgroundColor: '#C2410C' }]}
          onPress={() => Alert.alert('Forcer annulation ?', '', [
            { text: 'Annuler' },
            { text: 'Confirmer', style: 'destructive', onPress: () => cancelMutation.mutate() },
          ])}
        >
          <Text style={s.btnTxt}>Forcer l'annulation</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F1' },
  title: { fontSize: 20, fontWeight: '800', color: '#15140F' },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
