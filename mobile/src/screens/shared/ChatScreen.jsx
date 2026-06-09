import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';

const QUICK_REPLIES_VENDOR    = ['Je suis là', 'Merci !', 'OK reçu 👍', 'Code SVP', 'En route ?'];
const QUICK_REPLIES_DELIVERER = ['En route', 'Je suis là', 'OK reçu 👍', 'Code SVP', 'À bientôt'];

const AUTO_REPLIES = [
  'Ok reçu 👍',
  'Je regarde ça de suite.',
  "D'accord, merci !",
  'Super, parfait.',
  'Noté !',
];

export default function ChatScreen({ route, navigation }) {
  const { role, conversations, sendMessage, receiveMessage } = useApp();
  const convId = route?.params?.convId;
  const conv = conversations[convId];

  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  // Scroll to bottom whenever messages change
  const messages = conv?.messages || [];
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length]);

  const handleSend = (text) => {
    if (!text.trim() || !convId) return;
    sendMessage(convId, text.trim());
    setInput('');
    // Simulate reply after short delay
    setTimeout(() => {
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      receiveMessage(convId, reply);
    }, 900 + Math.random() * 600);
  };

  if (!conv) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, color: colors.ink55 }}>Conversation introuvable.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, color: colors.green }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const quickReplies = role === 'vendor' ? QUICK_REPLIES_VENDOR : QUICK_REPLIES_DELIVERER;
  const roleColor = conv.contactRole === 'deliverer' ? colors.green
    : conv.contactRole === 'client' ? colors.orange : colors.ink;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.ink06 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ width: 40, height: 40, backgroundColor: colors.ink06, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 13, color: '#fff' }}>{conv.contactInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: colors.ink }}>{conv.contactName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: roleColor }} />
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: roleColor }}>
                {conv.contactRole === 'deliverer' ? 'Livreur' : conv.contactRole === 'client' ? 'Client' : 'Vendeur'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={{ width: 40, height: 40, backgroundColor: colors.ink06, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignSelf: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 4 }}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55 }}>Aujourd'hui</Text>
          </View>

          {messages.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 50, gap: 10 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink12, borderStyle: 'dashed' }}>
                <Icon name="chat" size={24} color={colors.ink35} />
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink55, textAlign: 'center' }}>
                Commence la conversation avec {conv.contactName.split(' ')[0]} !
              </Text>
            </View>
          )}

          {messages.map(m => (
            <View key={m.id} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
              <View style={{
                backgroundColor: m.from === 'me' ? colors.green : '#fff',
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
                borderBottomLeftRadius: m.from === 'them' ? 4 : 16,
                borderBottomRightRadius: m.from === 'me' ? 4 : 16,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: m.from === 'them' ? 0.04 : 0, shadowRadius: 2, elevation: m.from === 'them' ? 1 : 0,
              }}>
                <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14.5, lineHeight: 20, color: m.from === 'me' ? '#fff' : colors.ink }}>
                  {m.text}
                </Text>
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: colors.ink35, marginTop: 2, paddingHorizontal: 4, textAlign: m.from === 'me' ? 'right' : 'left' }}>
                {m.time}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Quick replies */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }} style={{ flexGrow: 0 }}>
          {quickReplies.map(q => (
            <TouchableOpacity
              key={q}
              onPress={() => handleSend(q)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.ink12, backgroundColor: '#fff' }}
            >
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink70 }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 6, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.cream }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, paddingLeft: 16, paddingRight: 4, height: 46, borderWidth: 1, borderColor: colors.ink12 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message…"
              placeholderTextColor={colors.ink35}
              style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: colors.ink, outlineWidth: 0 }}
              onSubmitEditing={() => handleSend(input)}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={() => handleSend(input)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: input.trim() ? colors.green : colors.ink12, alignItems: 'center', justifyContent: 'center', margin: 2 }}
            >
              <Icon name="send" size={16} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
