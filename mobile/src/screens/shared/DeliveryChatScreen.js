import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KenteStripe from '../../components/KenteStripe';

const ROLE_COLOR = {
  vendor:    { bg: '#EFF8F1', text: colors.greenDark,  label: 'Vendeur'      },
  deliverer: { bg: '#FEF0E3', text: '#C4611A',          label: 'Livreur'      },
  recipient: { bg: '#EEF2FF', text: '#4338CA',          label: 'Destinataire' },
};

function Bubble({ msg, myId }) {
  const isMine = msg.senderId && msg.senderId === myId;
  const rc = ROLE_COLOR[msg.senderRole] ?? ROLE_COLOR.vendor;
  const time = new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={{ flexDirection: isMine ? 'row-reverse' : 'row', marginBottom: 12, paddingHorizontal: 16, gap: 8 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 10, backgroundColor: rc.bg,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 11, color: rc.text }}>
          {msg.senderName.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={{ maxWidth: '72%', gap: 2 }}>
        {!isMine && (
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: rc.text, marginLeft: 2 }}>
            {msg.senderName} · {rc.label}
          </Text>
        )}
        <View style={{
          backgroundColor: isMine ? colors.greenDark : '#fff',
          borderRadius: 14,
          borderBottomRightRadius: isMine ? 4 : 14,
          borderBottomLeftRadius: isMine ? 14 : 4,
          padding: 12,
          borderWidth: isMine ? 0 : 1,
          borderColor: '#E8DCC8',
        }}>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: isMine ? '#fff' : colors.ink, lineHeight: 20 }}>
            {msg.content}
          </Text>
        </View>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: colors.ink35, marginLeft: 4, alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
          {time}
        </Text>
      </View>
    </View>
  );
}

export default function DeliveryChatScreen({ navigation, route }) {
  const { deliveryId, title = 'Chat livraison' } = route?.params || {};
  const { api, user } = useApp();

  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const listRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!deliveryId || !api) return;
    try {
      const data = await api(`/api/deliveries/${deliveryId}/messages`);
      if (Array.isArray(data)) setMessages(data);
    } catch {}
  }, [api, deliveryId]);

  useEffect(() => {
    fetchMessages().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      const msg = await api(`/api/deliveries/${deliveryId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      if (msg?.id) setMessages(prev => [...prev, msg]);
    } catch (e) {
      setText(content); // restore on error
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      <KenteStripe height={4} />
      <KGTopBar title={title} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({ item }) => <Bubble msg={item} myId={user?.id} />}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={(
              <View style={{ alignItems: 'center', paddingVertical: 60, gap: 10 }}>
                <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>Pas encore de messages</Text>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, textAlign: 'center', maxWidth: 240 }}>
                  Échangez ici avec le vendeur et le livreur pour cette livraison.
                </Text>
              </View>
            )}
          />

          {/* Input bar */}
          <View style={{
            flexDirection: 'row', alignItems: 'flex-end', gap: 8,
            paddingHorizontal: 12, paddingVertical: 10,
            borderTopWidth: 1, borderTopColor: '#E8DCC8', backgroundColor: '#fff',
          }}>
            <TextInput
              style={{
                flex: 1, minHeight: 40, maxHeight: 100,
                backgroundColor: colors.cream, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
                fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink,
              }}
              value={text}
              onChangeText={setText}
              placeholder="Votre message…"
              placeholderTextColor={colors.ink35}
              multiline
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: text.trim() ? colors.green : colors.ink12,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>↑</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
