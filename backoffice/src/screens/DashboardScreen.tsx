import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/api';

function StatCard({ label, value, color = '#178A3C' }: { label: string; value: any; color?: string }) {
  return (
    <View style={s.card}>
      <Text style={[s.val, { color }]}>{value ?? '—'}</Text>
      <Text style={s.lbl}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: adminService.getStats, refetchInterval: 30000 });

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.title}>Dashboard</Text>
      <ScrollView contentContainerStyle={s.grid}>
        <StatCard label="Utilisateurs" value={data?.users} />
        <StatCard label="Livraisons" value={data?.deliveries} />
        <StatCard label="KYC en attente" value={data?.pendingKyc} color="#E8551C" />
        <StatCard label="Courses actives" value={data?.activeDeliveries} color="#1F6FB2" />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F1' },
  title: { fontSize: 22, fontWeight: '800', color: '#15140F', padding: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 10 },
  card: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E7E7E0' },
  val: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lbl: { fontSize: 12, color: '#76746B', marginTop: 4, fontWeight: '600' },
});
