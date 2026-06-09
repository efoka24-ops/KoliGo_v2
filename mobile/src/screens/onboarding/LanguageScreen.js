import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, Logo, Button, Card } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function LanguageScreen({ navigation }) {
  const { t, lang, setLang } = useI18n();
  const [sel, setSel] = useState(lang);

  const Option = ({ code, label }) => {
    const active = sel === code;
    return (
      <Pressable onPress={() => { setSel(code); setLang(code); }}>
        <Card tone={active ? 'green' : 'default'} style={styles.opt}>
          <Text style={type.h2}>{label}</Text>
          <View style={[styles.check, active && { backgroundColor: colors.green, borderColor: colors.greenDark }]}>
            {active ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
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
        <Option code="fr" label="Français" />
        <Option code="en" label="English" />
      </View>
      <Text style={[type.eyebrow, { marginTop: 6 }]}>{t('savedSecure')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
