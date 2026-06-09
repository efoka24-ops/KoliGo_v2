import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, Field, Button, Stars, Pill } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function RatingScreen({ navigation }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(4);
  return (
    <Screen center>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30 }}>😊</Text>
      </View>
      <Text style={[type.h1, { textAlign: 'center', marginTop: 8 }]}>{t('howWasIt')}</Text>
      <Stars value={rating} onRate={setRating} size={28} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Pill label="Rapide" tone="ok" />
        <Pill label="Pro" tone="ok" />
        <Pill label="Soigneux" tone="muted" />
      </View>
      <View style={{ width: '100%', marginTop: 4 }}>
        <Field placeholder="Commentaire (option)" />
      </View>
      <Button title={t('sendRating')} onPress={() => navigation.popToTop()} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </Screen>
  );
}
