import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/api';

const KYC_COLOR: Record<string, string> = { VERIFIED: '#178A3C', PENDING: '#B8860B', REJECTED: '#C2410C', NONE: '#9A988E' };

export default function UsersScreen({ navigation }: any) {
  const [q, setQ] = useState('');
  const { data = [] } = useQuery({ queryKey: ['users', q], queryFn: () => adminService.listUsers(q) });

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.title}>Utilisateurs</Text>
      <TextInput style={s.search} placeholder="Rechercher nom / téléphone…" value={q} onChangeText={setQ} />
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => navigation.navigate('UserDetail', { userId: item.id })}>
            <View>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.phone}>{item.phone} · {item.activeRole}</Text>
            </View>
            <Text style={[s.kyc, { color: KYC_COLOR[item.kycStatus] }]}>{item.kycStatus}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        contentContainerStyle={{ padding: 18 }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F1' },
  title: { fontSize: 22, fontWeight: '800', color: '#15140F', paddingHorizontal: 18, paddingTop: 18 },
  search: { margin: 18, marginTop: 8, borderWidth: 1, borderColor: '#E7E7E0', borderRadius: 10, padding: 12, backgroundColor: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  name: { fontSize: 14, fontWeight: '700', color: '#15140F' },
  phone: { fontSize: 12, color: '#76746B', marginTop: 2 },
  kyc: { fontSize: 11, fontWeight: '700' },
  sep: { height: 8 },
});
