import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, Field, Button, Stars, Pill, Avatar } from '../../components';
import { type } from '../../theme';
import { useI18n } from '../../i18n';

export default function ClientRatingScreen({ navigation }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  return (
    <Screen center>
      <Avatar label="J" tone="orange" size={64} />
      <Text style={[type.h1, { textAlign: 'center', marginTop: 8 }]}>{t('rate')} Jean</Text>
      <Stars value={rating} onRate={setRating} size={28} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Pill label="Rapide" tone="ok" />
        <Pill label="Pro" tone="ok" />
        <Pill label="Sympa" tone="muted" />
      </View>
      <View style={{ width: '100%', marginTop: 4 }}>
        <Field placeholder="Commentaire (option)" />
      </View>
      <Button title={t('send')} onPress={() => navigation.popToTop()} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </Screen>
  );
}
