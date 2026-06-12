import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, ScreenHeader, Field, Button, Stars, Pill } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

const TAGS = ['Rapide', 'Pro', 'Soigneux', 'Sympa', 'Ponctuel'];

export default function RatingScreen({ navigation }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(4);
  const [selected, setSelected] = useState(['Rapide', 'Pro']);

  const toggle = (tag) => setSelected((s) => s.includes(tag) ? s.filter((t) => t !== tag) : [...s, tag]);

  return (
    <Screen center>
      <ScreenHeader title={t('howWasIt')} />
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="happy" size={34} color={colors.green} />
      </View>
      <Text style={[type.h1, { textAlign: 'center', marginTop: 8 }]}>{t('howWasIt')}</Text>
      <Stars value={rating} onRate={setRating} size={30} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {TAGS.map((tag) => (
          <Pressable key={tag} onPress={() => toggle(tag)}>
            <View style={[styles.tag, selected.includes(tag) && styles.tagOn]}>
              <Text style={[styles.tagTxt, selected.includes(tag) && { color: '#fff' }]}>{tag}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ width: '100%', marginTop: 4 }}>
        <Field placeholder="Commentaire (option)" />
      </View>
      <Button title={t('sendRating')} onPress={() => navigation.popToTop()} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tag: { borderWidth: 1.5, borderColor: colors.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: colors.surface },
  tagOn: { backgroundColor: colors.green, borderColor: colors.greenDark },
  tagTxt: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
});
