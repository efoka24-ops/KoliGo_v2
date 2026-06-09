import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { getInitials } from '../../utils/helpers';
import Icon from '../../components/Icon';
import KGTabBar from '../../components/KGTabBar';

const ROLE_LABELS = { vendor: 'Vendeur', deliverer: 'Livreur', client: 'Client' };
const ROLE_COLORS = {
  vendor:    { bg: '#EEF6FF', text: '#2B7BE5' },
  deliverer: { bg: '#F0FDF4', text: '#16A34A' },
  client:    { bg: '#FFF7ED', text: '#C2410C' },
};

// Demo contacts the current user can start a conversation with
const NEW_CONTACTS_VENDOR = [
  { id: 'herve_nk',   name: 'HervÃ© Nkouamba',  initials: 'HN', role: 'deliverer' },
  { id: 'aicha_mb',   name: 'AÃ¯cha Mballa',    initials: 'AM', role: 'client' },
  { id: 'paul_et',    name: 'Paul Etoundi',     initials: 'PE', role: 'deliverer' },
];
const NEW_CONTACTS_DELIVERER = [
  { id: 'marie_ng',     name: 'Marie Ngono',      initials: 'MN', role: 'vendor' },
  { id: 'alphonse_mb',  name: 'Alphonse Mboa',    initials: 'AM', role: 'client' },
  { id: 'cecile_nd',    name: 'Maman CÃ©cile',     initials: 'MC', role: 'vendor' },
];

export default function ChatInboxScreen({ navigation }) {
  const { role, conversations, markRead, startConversation, token, api, user } = useApp();
  const isDemo = user?.isTest === true;
  const [showPicker, setShowPicker] = React.useState(false);
  // Demo users see fake contacts; real users start empty and get real contacts from API
  const [contacts, setContacts] = React.useState(
    isDemo ? (role === 'vendor' ? NEW_CONTACTS_VENDOR : NEW_CONTACTS_DELIVERER) : []
  );
  const [loadingContacts, setLoadingContacts] = React.useState(false);

  React.useEffect(() => {
    if (isDemo || !token) return;
    setLoadingContacts(true);
    api('/api/auth/contacts')
      .then(data => { if (Array.isArray(data)) setContacts(data); })
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, [token, isDemo]);

  const convList = Object.values(conversations).sort((a, b) => {
    if (!a.lastTime) return 1;
    if (!b.lastTime) return -1;
    return b.lastTime.localeCompare(a.lastTime);
  });

  const totalUnread = convList.reduce((acc, c) => acc + (c.unread || 0), 0);

  const openConv = (conv) => {
    markRead(conv.id);
    navigation.navigate('Chat', { convId: conv.id });
  };

  const pickContact = (contact) => {
    setShowPicker(false);
    const convId = startConversation(contact);
    navigation.navigate('Chat', { convId });
  };

  const handleTab = (tab) => {
    if (role === 'vendor') {
      if (tab === 'home') navigation.navigate('VendorHome');
      else if (tab === 'history') navigation.navigate('History');
      else if (tab === 'profile') navigation.navigate('Profile');
    } else {
      if (tab === 'home') navigation.navigate('DelivererHome');
      else if (tab === 'wallet') navigation.navigate('Wallet');
      else if (tab === 'profile') navigation.navigate('Profile');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.ink06, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 22, color: colors.ink }}>Messages</Text>
            {totalUnread > 0 && (
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>
                {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowPicker(p => !p)}
            style={{ width: 40, height: 40, backgroundColor: colors.ink, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* New conversation picker */}
      {showPicker && (
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.ink06, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Nouvelle conversation
          </Text>
          {loadingContacts && (
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, textAlign: 'center', paddingVertical: 8 }}>Chargementâ€¦</Text>
          )}
          {!loadingContacts && contacts.length === 0 && (
            <View style={{ paddingVertical: 14, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink55 }}>Aucun contact pour l'instant</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink35, textAlign: 'center', lineHeight: 17 }}>Tes contacts apparaissent automatiquement une fois qu'une livraison vous connecte.</Text>
            </View>
          )}
          <View style={{ gap: 6 }}>
            {contacts.map(c => {
              const rc = ROLE_COLORS[c.role] || ROLE_COLORS.client;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => pickContact(c)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, backgroundColor: colors.cream }}
                  activeOpacity={0.75}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13, color: '#fff' }}>{c.initials}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{c.name}</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: rc.bg }}>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: rc.text }}>{ROLE_LABELS[c.role]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Conversation list */}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 4, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {convList.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 80, gap: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink12, borderStyle: 'dashed' }}>
              <Icon name="chat" size={32} color={colors.ink35} />
            </View>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 17, color: colors.ink }}>Aucun message</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, textAlign: 'center', maxWidth: 260, lineHeight: 19 }}>
              Tes conversations avec les {role === 'vendor' ? 'livreurs et clients' : 'vendeurs et clients'} apparaÃ®tront ici.
            </Text>
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.ink, borderRadius: 14 }}
            >
              <Icon name="plus" size={16} color="#fff" />
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: '#fff' }}>Nouvelle conversation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          convList.map(conv => {
            const rc = ROLE_COLORS[conv.contactRole] || ROLE_COLORS.client;
            return (
              <TouchableOpacity
                key={conv.id}
                onPress={() => openConv(conv)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#fff', borderRadius: 16 }}
                activeOpacity={0.75}
              >
                {/* Avatar + unread badge */}
                <View style={{ position: 'relative' }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: '#fff' }}>{conv.contactInitials}</Text>
                  </View>
                  {conv.unread > 0 && (
                    <View style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                      <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 9, color: '#fff' }}>{conv.unread}</Text>
                    </View>
                  )}
                </View>
                {/* Text */}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ flex: 1, fontFamily: `${fonts.display}-Bold`, fontSize: 14, color: colors.ink }}>{conv.contactName}</Text>
                    <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink35 }}>{conv.lastTime || ''}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: rc.bg }}>
                      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: rc.text }}>{ROLE_LABELS[conv.contactRole]}</Text>
                    </View>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: conv.unread > 0 ? colors.ink70 : colors.ink35 }}>
                      {conv.lastMessage || 'DÃ©marrer la conversationâ€¦'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <KGTabBar active="chat" onTab={handleTab} role={role} />
    </SafeAreaView>
  );
}
