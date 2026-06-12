import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, ScreenHeader, Card, Button, Placeholder } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

const ICONS = { damaged: 'cube', missing: 'alert-circle', wrong: 'map' };

export default function ReportIssueScreen({ navigation }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState('damaged');
  const types = [['damaged', t('damaged')], ['missing', t('missing')], ['wrong', t('wrongAddress')]];

  return (
    <Screen footer={<Button title={t('submitReport')} variant="accent" onPress={() => navigation.goBack()} />}>
      <ScreenHeader title={t('reportIssue')} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 12 }}>
        <Text style={type.eyebrow}>Type de problème</Text>
        {types.map(([k, label]) => (
          <Pressable key={k} onPress={() => setSelected(k)}>
            <Card tone={selected === k ? 'orange' : 'soft'} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons
                name={ICONS[k]}
                size={20}
                color={selected === k ? colors.orangeDark : colors.muted}
              />
              <Text style={[type.h3, { flex: 1 }]}>{label}</Text>
              {selected === k && <Ionicons name="checkmark-circle" size={20} color={colors.orangeDark} />}
            </Card>
          </Pressable>
        ))}
        <Text style={type.eyebrow}>Photos (max 3)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Placeholder height={70} upload style={{ flex: 1 }} />
          <Placeholder height={70} upload style={{ flex: 1 }} />
          <Placeholder height={70} label="+ Ajouter" style={{ flex: 1 }} />
        </View>
      </View>
    </Screen>
  );
}
