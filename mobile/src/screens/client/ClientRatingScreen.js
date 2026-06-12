import React, { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'http://localhost:3001';
const TAGS = ['Rapide', 'Professionnel', 'Sympa', 'Soigneux', 'Ponctuel'];

export default function ClientRatingScreen({ navigation, route }) {
  const { clientToken, delivererName = 'Le livreur' } = route?.params ?? {};
  const [rating,   setRating]   = useState(5);
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const toggle = (tag) => setSelected(s => s.includes(tag) ? s.filter(t => t !== tag) : [...s, tag]);

  const handleSubmit = async () => {
    if (!clientToken) { navigation.goBack(); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/deliveries/client-rate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clientToken, score: rating, tags: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur');
      navigation.popToTop();
    } catch (e) {
      setLoading(false);
      Alert.alert('Erreur', e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F5F1' }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: 24, alignItems: 'center', gap: 20 }}>
        {/* Back */}
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', marginLeft: 12 }}>Évaluer le livreur</Text>
        </View>

        {/* Avatar */}
        <View style={s.avatar}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>{(delivererName[0] ?? '?').toUpperCase()}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' }}>
          Comment s'est passée la livraison ?
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: -12 }}>{delivererName}</Text>

        {/* Stars */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <Pressable key={n} onPress={() => setRating(n)}>
              <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={38} color={n <= rating ? '#F59E0B' : '#D1D5DB'} />
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 13, color: '#F59E0B', fontWeight: '700' }}>
          {['', 'Très mauvais', 'Mauvais', 'Moyen', 'Bien', 'Excellent !'][rating]}
        </Text>

        {/* Tags */}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {TAGS.map(tag => {
            const on = selected.includes(tag);
            return (
              <Pressable key={tag} onPress={() => toggle(tag)}
                style={[s.tag, on && s.tagOn]}>
                <Text style={[s.tagTxt, on && { color: '#fff' }]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        {loading ? (
          <ActivityIndicator color="#178A3C" size="large" />
        ) : (
          <TouchableOpacity onPress={handleSubmit} style={s.submitBtn}>
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={s.submitTxt}>Envoyer l'évaluation</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.popToTop()} style={{ paddingVertical: 8 }}>
          <Text style={{ fontSize: 13, color: '#aaa' }}>Passer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  backBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8E8E8' },
  avatar:    { width: 76, height: 76, borderRadius: 38, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  tag:       { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#fff' },
  tagOn:     { backgroundColor: '#178A3C', borderColor: '#178A3C' },
  tagTxt:    { fontSize: 13, fontWeight: '600', color: '#555' },
  submitBtn: { backgroundColor: '#178A3C', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  submitTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
