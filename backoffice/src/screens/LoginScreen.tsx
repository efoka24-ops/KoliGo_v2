import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminService } from '../services/api';

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    setLoading(true);
    setError('');
    try {
      await adminService.login(phone, pin);
      navigation.replace('AdminApp');
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.logo}>KoliGo Admin</Text>
      <TextInput style={s.input} placeholder="+237 6xx xxx xxx" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={s.input} placeholder="PIN" value={pin} onChangeText={setPin} secureTextEntry maxLength={4} keyboardType="number-pad" />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pressable style={s.btn} onPress={login} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Se connecter</Text>}
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, padding: 24, justifyContent: 'center', gap: 14, backgroundColor: '#F4F5F1' },
  logo: { fontSize: 28, fontWeight: '800', color: '#178A3C', textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E7E7E0', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#fff' },
  btn: { backgroundColor: '#178A3C', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#C2410C', textAlign: 'center', fontSize: 13 },
});
