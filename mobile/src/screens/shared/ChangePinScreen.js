import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import KGToast from '../../components/KGToast';
import KenteStripe from '../../components/KenteStripe';

export default function ChangePinScreen({ navigation }) {
  const { api, toast, showToast } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const onlyDigits = (set) => (v) => set(v.replace(/\D/g, '').slice(0, 6));

  const submit = async () => {
    if (current.length < 4) { showToast('Saisissez votre PIN actuel.', 'error'); return; }
    if (next.length < 4) { showToast('Le nouveau PIN doit contenir 4 à 6 chiffres.', 'error'); return; }
    if (next !== confirm) { showToast('La confirmation ne correspond pas au nouveau PIN.', 'error'); return; }
    setSaving(true);
    try {
      await api('/user/change-pin', { method: 'POST', body: JSON.stringify({ currentPin: current, newPin: next }) });
      showToast('PIN modifié ✓', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}
      <KenteStripe height={4} />
      <KGTopBar title="Changer le PIN" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>
          Pour votre sécurité, saisissez d'abord votre PIN actuel. Vous avez oublié votre PIN ? Déconnectez-vous puis utilisez « PIN oublié » sur l'écran de connexion.
        </Text>
        <KGInput label="PIN actuel" value={current} onChangeText={onlyDigits(setCurrent)} secureTextEntry keyboardType="number-pad" placeholder="••••" />
        <KGInput label="Nouveau PIN (4 à 6 chiffres)" value={next} onChangeText={onlyDigits(setNext)} secureTextEntry keyboardType="number-pad" placeholder="••••" />
        <KGInput label="Confirmer le nouveau PIN" value={confirm} onChangeText={onlyDigits(setConfirm)} secureTextEntry keyboardType="number-pad" placeholder="••••" />
        <KGButton kind="primary" size="lg" onPress={submit} disabled={saving}>{saving ? 'Enregistrement…' : 'Modifier mon PIN'}</KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
