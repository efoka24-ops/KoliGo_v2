import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Logo, Button, Card } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function LanguageScreen({ navigation }) {
  const { t, lang, setLang } = useI18n();
  const [sel, setSel] = useState(lang);

  const Option = ({ code, label, flag }) => {
    const active = sel === code;
    return (
      <Pressable onPress={() => { setSel(code); setLang(code); }}>
        <Card tone={active ? 'green' : 'default'} style={styles.opt}>
          <Text style={styles.flag}>{flag}</Text>
          <Text style={[type.h2, { flex: 1 }]}>{label}</Text>
          <View style={[styles.check, active && { backgroundColor: colors.green, borderColor: colors.greenDark }]}>
            {active && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen center footer={<Button title={t('continue')} onPress={() => navigation.replace('Welcome')} />}>
      <Logo size={56} />
      <Text style={[type.h1, { textAlign: 'center', marginTop: 8 }]}>{t('chooseLanguage')}</Text>
      <View style={{ width: '100%', gap: 10, marginTop: 6 }}>
        <Option code="fr" label="Français" flag="🇫🇷" />
        <Option code="en" label="English" flag="🇬🇧" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <Ionicons name="lock-closed" size={11} color={colors.muted} />
        <Text style={type.eyebrow}>{t('savedSecure')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flag: { fontSize: 24 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
