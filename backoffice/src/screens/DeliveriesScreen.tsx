import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/api';

const STATUS_COLOR: Record<string, string> = {
  EN_ATTENTE: '#B8860B', ACCEPTE: '#1F6FB2', EN_ROUTE: '#178A3C', LIVRE: '#0B5224', ANNULE: '#9A988E',
};
const FILTERS = ['', 'EN_ATTENTE', 'EN_ROUTE', 'LIVRE', 'ANNULE'];

export default function DeliveriesScreen({ navigation }: any) {
  const [status, setStatus] = useState('');
  const { data = [] } = useQuery({ queryKey: ['deliveries', status], queryFn: () => adminService.listDeliveries(status || undefined) });

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.title}>Livraisons</Text>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 18, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setStatus(f)} style={[s.chip, status === f && s.chipOn]}>
            <Text style={[s.chipTxt, status === f && { color: '#fff' }]}>{f || 'Toutes'}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: item.id })}>
            <View>
              <Text style={s.id}>#{item.id.slice(-6).toUpperCase()}</Text>
              <Text style={s.addr} numberOfLines={1}>{item.pickupAddress} → {item.dropoffAddress}</Text>
            </View>
            <Text style={[s.status, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ padding: 18 }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F1' },
  title: { fontSize: 22, fontWeight: '800', color: '#15140F', padding: 18, paddingBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#E7E7E0', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff', marginBottom: 10 },
  chipOn: { backgroundColor: '#178A3C', borderColor: '#0F6B2E' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: '#3E3D36' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  id: { fontSize: 13, fontWeight: '700', color: '#15140F' },
  addr: { fontSize: 12, color: '#76746B', marginTop: 2, maxWidth: 220 },
  status: { fontSize: 11, fontWeight: '700' },
});
