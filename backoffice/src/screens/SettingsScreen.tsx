import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/api';

export default function SettingsScreen() {
  const qc = useQueryClient();
  const { data: settings = [] } = useQuery({ queryKey: ['settings'], queryFn: adminService.getSettings });
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => adminService.updateSetting(key, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setEditing(null); },
  });

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.title}>Paramètres plateforme</Text>
      <FlatList
        data={settings}
        keyExtractor={(i: any) => i.key}
        renderItem={({ item }: any) => (
          <Pressable style={s.row} onPress={() => setEditing({ key: item.key, value: item.value })}>
            <Text style={s.key}>{item.key}</Text>
            <Text style={s.val}>{item.value}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ padding: 18 }}
      />
      {editing && (
        <View style={s.modal}>
          <Text style={s.key}>{editing.key}</Text>
          <TextInput style={s.input} value={editing.value} onChangeText={(v) => setEditing({ ...editing, value: v })} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[s.btn, { backgroundColor: '#178A3C', flex: 1 }]} onPress={() => updateMutation.mutate(editing)}>
              <Text style={s.btnTxt}>Enregistrer</Text>
            </Pressable>
            <Pressable style={[s.btn, { backgroundColor: '#E7E7E0', flex: 1 }]} onPress={() => setEditing(null)}>
              <Text style={[s.btnTxt, { color: '#3E3D36' }]}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F1' },
  title: { fontSize: 22, fontWeight: '800', color: '#15140F', padding: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  key: { fontSize: 13, fontWeight: '700', color: '#3E3D36' },
  val: { fontSize: 13, color: '#76746B' },
  modal: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 18, gap: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: '#E7E7E0' },
  input: { borderWidth: 1, borderColor: '#E7E7E0', borderRadius: 10, padding: 12, fontSize: 14 },
  btn: { borderRadius: 10, padding: 12, alignItems: 'center' },
  btnTxt: { fontWeight: '700', color: '#fff' },
});
