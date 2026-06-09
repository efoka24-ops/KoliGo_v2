import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, ScreenHeader, Card, ListItem, Toggle } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';

export default function NotificationsScreen({ navigation }) {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState({ deliveries: true, finances: true, messages: true, promos: false });
  const set = (k) => (v) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('notifications')} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 12 }}>
        <Card padded={false} style={{ paddingHorizontal: 14 }}>
          <ListItem label="Livraisons" right={<Toggle value={prefs.deliveries} onValueChange={set('deliveries')} />} />
          <ListItem label="Finances" right={<Toggle value={prefs.finances} onValueChange={set('finances')} />} />
          <ListItem label="Messages" right={<Toggle value={prefs.messages} onValueChange={set('messages')} />} />
          <ListItem label="Promotions" right={<Toggle value={prefs.promos} onValueChange={set('promos')} />} last />
        </Card>
        <Text style={type.lead}>Contrôle granulaire par type de notification.</Text>
      </View>
    </Screen>
  );
}
