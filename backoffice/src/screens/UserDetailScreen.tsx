import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/api';

export default function UserDetailScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => adminService.listUsers().then((u: any[]) => u.find((x: any) => x.id === userId)) });

  const kycMutation = useMutation({
    mutationFn: (status: 'VERIFIED' | 'REJECTED') => adminService.reviewKyc(userId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); navigation.goBack(); },
  });

  const blockMutation = useMutation({
    mutationFn: (blocked: boolean) => adminService.blockUser(userId, blocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  if (!user) return null;

  return (
    <SafeAreaView style={s.safe}>
      <Pressable onPress={() => navigation.goBack()} style={{ padding: 18 }}>
        <Text style={{ color: '#178A3C', fontWeight: '700' }}>← Retour</Text>
      </Pressable>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <Text style={s.name}>{user.name}</Text>
        <Text style={s.sub}>{user.phone} · {user.activeRole}</Text>

        <View style={s.section}>
          <Text style={s.label}>KYC : {user.kycStatus}</Text>
          {user.kycStatus === 'PENDING' && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable style={[s.btn, { backgroundColor: '#178A3C' }]} onPress={() => kycMutation.mutate('VERIFIED')}>
                <Text style={s.btnTxt}>Approuver</Text>
              </Pressable>
              <Pressable style={[s.btn, { backgroundColor: '#C2410C' }]} onPress={() => kycMutation.mutate('REJECTED')}>
                <Text style={s.btnTxt}>Rejeter</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          style={[s.btn, { backgroundColor: user.isBlocked ? '#178A3C' : '#C2410C', alignSelf: 'flex-start' }]}
          onPress={() => Alert.alert('Confirmer', user.isBlocked ? 'Débloquer ce compte ?' : 'Bloquer ce compte ?', [
            { text: 'Annuler' },
            { text: 'Confirmer', onPress: () => blockMutation.mutate(!user.isBlocked) },
          ])}
        >
          <Text style={s.btnTxt}>{user.isBlocked ? 'Débloquer' : 'Bloquer'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F1' },
  name: { fontSize: 22, fontWeight: '800', color: '#15140F' },
  sub: { fontSize: 14, color: '#76746B' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#3E3D36' },
  btn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
