import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGSectionTitle from '../../components/KGSectionTitle';
import KGTextarea from '../../components/KGTextarea';
import Icon from '../../components/Icon';

const ISSUES = [
  { id: 'damaged',  label: 'Colis endommagÃ©',  icon: 'package', color: colors.orange },
  { id: 'missing',  label: 'Colis manquant',   icon: 'flag',    color: '#B43A1B' },
  { id: 'address',  label: 'Mauvaise adresse', icon: 'pin',     color: '#1F5BB0' },
  { id: 'behavior', label: 'Comportement',     icon: 'user',    color: colors.ink },
  { id: 'other',    label: 'Autre',            icon: 'dot3',    color: colors.ink55 },
];

export default function ReportIssueScreen({ navigation, route }) {
  const { showToast } = useApp();
  const deliveryId = route?.params?.deliveryId || null;
  const [issue, setIssue] = useState(null);
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState([null, null, null]);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async (index) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (cam.status !== 'granted') {
          Alert.alert('Permission requise', "Autorise l'accÃ¨s Ã  la galerie ou Ã  l'appareil photo.");
          return;
        }
      }
      Alert.alert('Ajouter une photo', 'Choisir une source', [
        {
          text: 'Appareil photo',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [4, 3] });
            if (!result.canceled) {
              setPhotos(prev => { const n = [...prev]; n[index] = result.assets[0].uri; return n; });
            }
          },
        },
        {
          text: 'Galerie',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [4, 3] });
            if (!result.canceled) {
              setPhotos(prev => { const n = [...prev]; n[index] = result.assets[0].uri; return n; });
            }
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } catch {
      showToast('Erreur lors de la sÃ©lection de la photo', 'error');
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => { const n = [...prev]; n[index] = null; return n; });
  };

  const handleSend = async () => {
    if (!issue) return;
    setLoading(true);
    try {
      // Encode photos as base64
      const photoUris = photos.filter(Boolean);
      const photoBase64s = await Promise.all(
        photoUris.map(uri => FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }))
      );

      const endpoint = deliveryId
        ? `/api/deliveries/${deliveryId}/report`
        : '/api/deliveries/unknown/report';

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          issueType: issue,
          details: details.trim() || null,
          photos: photoBase64s.length > 0 ? photoBase64s : undefined,
        }),
      });
      showToast('Signalement envoyÃ© Â· rÃ©ponse sous 1h');
      navigation.goBack();
    } catch (err) {
      showToast(err?.message || 'Erreur lors de l\'envoi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showPhotos = issue === 'damaged' || issue === 'missing';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="Signaler un problÃ¨me" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        <View>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink, letterSpacing: -0.02 * 22 }}>
            Qu'est-ce qui s'est passÃ© ?
          </Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink70, marginTop: 6 }}>
            Choisis le type. On te rappelle sous 1h.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          {ISSUES.map(i => {
            const on = issue === i.id;
            return (
              <TouchableOpacity
                key={i.id}
                onPress={() => setIssue(i.id)}
                style={{
                  borderWidth: 1.5, borderColor: on ? i.color : colors.ink12,
                  backgroundColor: on ? `${i.color}10` : '#fff',
                  borderRadius: 14, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? i.color : colors.cream, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={i.icon} size={20} color={on ? '#fff' : i.color} />
                </View>
                <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 15, color: colors.ink }}>{i.label}</Text>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? i.color : colors.ink12, backgroundColor: on ? i.color : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  {on && <Icon name="check" size={12} color="#fff" strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ gap: 10 }}>
          <KGSectionTitle>DÃ©tails</KGSectionTitle>
          <KGTextarea placeholder="DÃ©cris la situation en quelques motsâ€¦" value={details} onChangeText={setDetails} rows={3} />
        </View>

        {showPhotos && (
          <View style={{ gap: 10 }}>
            <KGSectionTitle>Photos (max 3)</KGSectionTitle>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {photos.map((uri, i) => (
                <View key={i} style={{ flex: 1, aspectRatio: 1 }}>
                  {uri ? (
                    <TouchableOpacity onLongPress={() => removePhoto(i)} style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }}>
                      <Image source={{ uri }} style={{ flex: 1, borderRadius: 14 }} resizeMode="cover" />
                      <TouchableOpacity
                        onPress={() => removePhoto(i)}
                        style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Ã—</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => pickPhoto(i)}
                      style={{ flex: 1, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <Icon name="camera" size={22} color={colors.ink55} />
                      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: colors.ink35 }}>Ajouter</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35 }}>
              Appuie sur une photo pour la supprimer
            </Text>
          </View>
        )}

        <KGButton kind="primary" size="lg" icon={loading ? undefined : 'send'} disabled={!issue || loading} onPress={handleSend}>
          {loading ? <ActivityIndicator color="#fff" /> : 'Envoyer le signalement'}
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
