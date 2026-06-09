import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, Card, Button, Toggle } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';
import { useApp } from '../../store';

export default function RoleSelectScreen({ navigation }) {
  const { t } = useI18n();
  const { role, setRole } = useApp();
  const [dual, setDual] = useState(false);

  const Role = ({ value, glyph, title, sub, tint }) => {
    const active = role === value;
    return (
      <Pressable onPress={() => setRole(value)}>
        <Card tone={active ? (tint === 'orange' ? 'orange' : 'green') : 'default'} style={styles.role}>
          <View style={[styles.icon, { backgroundColor: active ? (tint === 'orange' ? '#F8E0D2' : colors.green100) : '#EFEFEA' }]}>
            <Text style={{ fontSize: 22 }}>{glyph}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>{title}</Text>
            <Text style={type.lead}>{sub}</Text>
          </View>
          <View style={[styles.check, active && { backgroundColor: tint === 'orange' ? colors.orange : colors.green, borderColor: 'transparent' }]}>
            {active ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen footer={<Button title={t('continue')} onPress={() => navigation.navigate('PaymentSetup')} />}>
      <View style={{ paddingHorizontal: 18, paddingTop: 18, gap: 12 }}>
        <Text style={type.h1}>{t('howUse')}</Text>
        <Role value="vendor" glyph="🏪" title={t('vendor')} sub={t('iSend')} tint="green" />
        <Role value="deliverer" glyph="🛵" title={t('deliverer')} sub={t('iDeliver')} tint="orange" />
        <Card tone="soft" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.lead}>{t('dualProfile')}</Text>
          <Toggle value={dual} onValueChange={setDual} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  role: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
