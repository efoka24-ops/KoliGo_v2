import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { getInitials } from '../../utils/helpers';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGChip from '../../components/KGChip';
import KGSectionTitle from '../../components/KGSectionTitle';
import KGTextarea from '../../components/KGTextarea';
import Icon from '../../components/Icon';

const ALL_TAGS = ['Rapide', 'Souriant', 'Pro', 'Soigneux', 'Ponctuel', 'Communique bien'];
const STAR_LABELS = ['', 'Pas top', 'Bof', 'Correct', 'Bien', 'Excellent ðŸ”¥'];

export default function RatingScreen({ navigation, route }) {
  const { showToast, api, token } = useApp();
  const params = route?.params || {};
  const partner = params.partner; // 'deliverer' | 'client'
  const ratedId = params.ratedId || null;
  const deliveryId = params.deliveryId || null;
  const partnerName = params.partnerName || (partner === 'deliverer' ? 'le livreur' : 'le client');
  const partnerInitials = partnerName ? getInitials(partnerName) : (partner === 'deliverer' ? 'LV' : 'CL');

  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState(new Set(['Rapide']));
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleTag = (t) => setTags(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const handleSend = async () => {
    setLoading(true);
    try {
      if (token && ratedId) {
        // Authenticated user (deliverer rating client, or vendor rating deliverer)
        await api('/api/ratings', {
          method: 'POST',
          body: JSON.stringify({ ratedId, stars, comment: comment.trim() || null, deliveryId, tags: [...tags] }),
        });
      } else if (deliveryId) {
        // Unauthenticated client rating deliverer
        const { apiFetch } = require('../../services/api');
        await apiFetch(`/api/ratings/client/${deliveryId}`, {
          method: 'POST',
          body: JSON.stringify({ stars, comment: comment.trim() || null, tags: [...tags] }),
        });
      }
      showToast('Merci pour ta note â­');
    } catch (err) {
      showToast(err?.message || 'Erreur', 'error');
    } finally {
      setLoading(false);
      // Navigate based on context
      if (token) {
        navigation.navigate('DelivererHome');
      } else {
        navigation.navigate('ClientLanding', params);
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KGTopBar title="Noter la course" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Success header */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ width: 80, height: 80, borderRadius: 22, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={42} color={colors.green} strokeWidth={2.4} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 24, color: colors.ink, letterSpacing: -0.02 * 24 }}>Livraison terminÃ©e !</Text>
          </View>
        </View>

        {/* Rating card */}
        <KGCard padding={16} style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 12, color: colors.ink }}>{partnerInitials}</Text>
            </View>
            <View>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink55 }}>Comment c'Ã©tait avec</Text>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.ink }}>{partnerName} ?</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 6 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <TouchableOpacity key={i} onPress={() => setStars(i)} style={{ padding: 4 }}>
                <Icon name="star" size={42} color={i <= stars ? colors.orange : colors.ink12} strokeWidth={1.4} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink70, marginTop: 4 }}>{STAR_LABELS[stars]}</Text>
        </KGCard>

        <View style={{ gap: 10 }}>
          <KGSectionTitle>Ce que tu as aimÃ©</KGSectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_TAGS.map(t => (
              <KGChip key={t} active={tags.has(t)} color={tags.has(t) ? 'orange' : 'ink'} onPress={() => toggleTag(t)}>
                {tags.has(t) ? 'âœ“ ' : ''}{t}
              </KGChip>
            ))}
          </View>
        </View>

        <KGTextarea label="Commentaire (facultatif)" placeholder="Ã‰cris quelques motsâ€¦" value={comment} onChangeText={setComment} rows={3} />

        <KGButton kind="primary" size="lg" onPress={handleSend} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : 'Envoyer la note'}
        </KGButton>

        {partner === 'deliverer' && (
          <TouchableOpacity
            style={{ alignItems: 'center' }}
            onPress={() => navigation.navigate('ReportIssue', { deliveryId })}
          >
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.orange }}>Signaler un problÃ¨me</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
