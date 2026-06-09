import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Button, ListItem } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function SettingsScreen({ navigation }) {
  const { t, lang, setLang } = useI18n();
  const [theme, setTheme] = useState('light');
  const themes = [['light', t('light')], ['dark', t('dark')], ['sepia', t('sepia')]];

  return (
    <Screen padded={false} footer={<Button title={t('logout')} variant="outline" style={{ borderColor: colors.orange }} />}>
      <ScreenHeader title={t('settings')} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 14 }}>
        <Text style={type.eyebrow}>{t('language')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['fr', 'Français'], ['en', 'English']].map(([k, label]) => (
            <Pressable key={k} style={{ flex: 1 }} onPress={() => setLang(k)}>
              <Card tone={lang === k ? 'green' : 'default'} style={styles.opt}>
                <Text style={[type.h3, lang === k && { color: colors.greenDark }]}>{label}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
        <Text style={type.eyebrow}>{t('theme')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {themes.map(([k, label]) => (
            <Pressable key={k} style={{ flex: 1 }} onPress={() => setTheme(k)}>
              <Card tone={theme === k ? 'green' : 'default'} style={styles.opt}>
                <Text style={[type.lead, theme === k && { color: colors.greenDark, fontWeight: '700' }]}>{label}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
        <Card padded={false} style={{ paddingHorizontal: 14, marginTop: 4 }}>
          <ListItem icon="🔑" label={t('changePin')} onPress={() => {}} />
          <ListItem icon="📄" label={t('terms')} onPress={() => navigation.navigate('Terms')} last />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: { alignItems: 'center', paddingVertical: 14 },
});
