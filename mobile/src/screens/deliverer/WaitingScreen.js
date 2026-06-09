import React from 'react';
import { View, Text } from 'react-native';
import { Screen, ScreenHeader, Button, Pill, Placeholder } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';

export default function WaitingScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <Screen
      padded={false}
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title={t('call')} variant="outline" style={{ flex: 1 }} />
          <Button title="Chat" style={{ flex: 1 }} onPress={() => navigation.navigate('Rating')} />
        </View>
      }
    >
      <ScreenHeader title={t('waitingClient')} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, gap: 12 }}>
        <Placeholder map height={170} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pill label="GPS streaming · 8s" tone="ok" />
          <Text style={type.eyebrow}>poll 5s</Text>
        </View>
        <Text style={type.lead}>Navigation auto vers la note dès LIVRÉ.</Text>
      </View>
    </Screen>
  );
}
