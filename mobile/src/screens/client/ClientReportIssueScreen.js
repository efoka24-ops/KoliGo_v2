import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE } from '../../config';

const ISSUE_TYPES = [
  { id: 'DAMAGED',       label: 'Colis endommagé',       icon: 'warning',          color: '#DC2626' },
  { id: 'MISSING',       label: 'Colis incomplet',        icon: 'help-circle',      color: '#F59E0B' },
  { id: 'WRONG_ADDRESS', label: 'Mauvaise adresse',       icon: 'location',         color: '#3B82F6' },
  { id: 'LATE',          label: 'Retard important',       icon: 'time',             color: '#8B5CF6' },
  { id: 'OTHER',         label: 'Autre problème',         icon: 'chatbox-ellipses', color: '#6B7280' },
];

export default function ClientReportIssueScreen({ navigation, route }) {
  const { clientToken } = route?.params ?? {};
  const [issueType,    setIssueType]    = useState(null);
  const [description,  setDescription]  = useState('');
  const [loading,      setLoading]      = useState(false);

  const handleSubmit = async () => {
    if (!issueType) { Alert.alert('Sélectionnez un type d\'incident'); return; }
    if (!clientToken) { Alert.alert('Erreur', 'Lien de livraison manquant.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/deliveries/client-report`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clientToken, type: issueType, description: description.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur');
      Alert.alert('Signalement envoyé', 'Notre équipe va examiner votre signalement sous 24h.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (e) {
      setLoading(false);
      Alert.alert('Erreur', e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F5F1' }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: 20, gap: 18 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 17, fontWeight: '700' }}>Signaler un incident</Text>
            <Text style={{ fontSize: 12, color: '#888' }}>Décrivez le problème rencontré</Text>
          </View>
        </View>

        {/* Issue types */}
        <View style={{ gap: 8 }}>
          <Text style={s.label}>Type d'incident</Text>
          {ISSUE_TYPES.map(it => {
            const active = issueType === it.id;
            return (
              <TouchableOpacity
                key={it.id}
                onPress={() => setIssueType(it.id)}
                style={[s.typeBtn, active && { borderColor: it.color, backgroundColor: it.color + '11' }]}
                activeOpacity={0.75}
              >
                <View style={[s.typeIcon, { backgroundColor: it.color + '22' }]}>
                  <Ionicons name={it.icon} size={18} color={it.color} />
                </View>
                <Text style={[s.typeTxt, active && { color: it.color, fontWeight: '700' }]}>{it.label}</Text>
                {active && <Ionicons name="checkmark-circle" size={18} color={it.color} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>Description (optionnel)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez le problème en détail…"
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={4}
            style={s.textarea}
          />
        </View>

        <View style={{ flex: 1 }} />

        {loading ? (
          <ActivityIndicator color="#DC2626" size="large" />
        ) : (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!issueType}
            style={[s.submitBtn, !issueType && { opacity: 0.4 }]}
          >
            <Ionicons name="alert-circle" size={16} color="#fff" />
            <Text style={s.submitTxt}>Envoyer le signalement</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  backBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8E8E8' },
  label:     { fontSize: 11, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  typeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 2, borderColor: '#E8E8E8' },
  typeIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeTxt:   { fontSize: 14, fontWeight: '500', color: '#333' },
  textarea:  { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E0E0E0', padding: 14, fontSize: 14, color: '#1A1A1A', minHeight: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
