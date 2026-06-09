import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Screen, ScreenHeader, Card, Button, Placeholder } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function ReportIssueScreen({ navigation }) {
  const { t } = useI18n();
  const [type_, setType] = useState('damaged');
  const types = [['damaged', t('damaged')], ['missing', t('missing')], ['wrong', t('wrongAddress')]];

  return (
    <Screen footer={<Button title={t('submitReport')} variant="accent" onPress={() => navigation.goBack()} />}>
      <ScreenHeader title={t('reportIssue')} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 12 }}>
        <Text style={type.eyebrow}>Type</Text>
        {types.map(([k, label]) => (
          <Pressable key={k} onPress={() => setType(k)}>
            <Card tone={type_ === k ? 'orange' : 'soft'} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={type.h3}>{label}</Text>
              {type_ === k ? <Text style={{ color: colors.orangeDark, fontWeight: '800' }}>✓</Text> : null}
            </Card>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Placeholder height={56} label="PHOTO" style={{ flex: 1 }} />
          <Placeholder height={56} label="PHOTO" style={{ flex: 1 }} />
          <Placeholder height={56} label="+ MAX 3" style={{ flex: 1 }} />
        </View>
      </View>
    </Screen>
  );
}
