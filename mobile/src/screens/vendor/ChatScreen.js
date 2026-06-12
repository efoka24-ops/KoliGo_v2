import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

// Inbox tab — shows list of conversations
export default function ChatScreen({ navigation }) {
  const { conversations, role } = useApp();

  const convList = Object.values(conversations || {}).sort((a, b) => {
    if (!a.lastTime) return 1;
    if (!b.lastTime) return -1;
    return a.lastTime > b.lastTime ? -1 : 1;
  });

  const roleColor = (contactRole) =>
    contactRole === 'deliverer' ? colors.green
    : contactRole === 'client'  ? '#C4611A'
    : colors.ink55;

  const roleLabel = (contactRole) =>
    contactRole === 'deliverer' ? 'Livreur'
    : contactRole === 'client'  ? 'Client'
    : 'Contact';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
        <Text style={{ flex: 1, fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: '#0E2116', letterSpacing: -0.5 }}>
          Messages
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF8F1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green }} />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.greenDark }}>En ligne</Text>
        </View>
      </View>

      {convList.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E8DCC8', borderStyle: 'dashed' }}>
            <Icon name="chat" size={30} color={colors.ink35} />
          </View>
          <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 18, color: colors.ink }}>Aucune conversation</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink55, textAlign: 'center', lineHeight: 20, maxWidth: 260 }}>
            Tes échanges avec les livreurs et clients apparaîtront ici.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          {convList.map(conv => (
            <TouchableOpacity
              key={conv.id}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('ChatDetail', { convId: conv.id })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E8DCC8' }}
            >
              {/* Avatar */}
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: roleColor(conv.contactRole), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: '#fff' }}>
                  {conv.contactInitials || '??'}
                </Text>
              </View>

              {/* Text */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14.5, color: colors.ink }} numberOfLines={1}>
                    {conv.contactName || 'Contact'}
                  </Text>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35 }}>
                    {conv.lastTime || ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: roleColor(conv.contactRole), textTransform: 'uppercase', letterSpacing: 0.06 }}>
                    {roleLabel(conv.contactRole)}
                  </Text>
                  <Text style={{ color: colors.ink35, fontSize: 10 }}>·</Text>
                  <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55 }} numberOfLines={1}>
                    {conv.lastMessage || '…'}
                  </Text>
                </View>
              </View>

              {/* Unread badge */}
              {conv.unread > 0 && (
                <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: '#fff' }}>{conv.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
