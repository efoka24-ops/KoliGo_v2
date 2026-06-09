import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Field, Pill, Avatar } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

function Bubble({ mine, children }) {
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text style={[type.body, mine && { color: '#fff' }]}>{children}</Text>
    </View>
  );
}

export default function ChatScreen() {
  const { t } = useI18n();
  return (
    <Screen padded={false} scroll={false}>
      <ScreenHeader
        title="Jean · ★4.9"
        subtitle={`${t('deliverer')} · ${t('online')}`}
        right={<Avatar label="J" tone="orange" size={34} />}
      />
      <View style={{ flex: 1, padding: 18, gap: 10 }}>
        <Bubble>Bonjour, je pars de la boutique 👍</Bubble>
        <Bubble mine>Parfait, le client attend à Bonapriso.</Bubble>
        <Bubble>J'y serai dans 10 min.</Bubble>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pill label="J'arrive" tone="muted" />
          <Pill label="Je suis là" tone="muted" />
          <Pill label="OK 👍" tone="muted" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Field placeholder={t('message')} /></View>
          <Pressable style={styles.sendBtn}><Text style={{ color: '#fff', fontSize: 16 }}>➤</Text></Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '78%', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 13 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.green },
  sendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
