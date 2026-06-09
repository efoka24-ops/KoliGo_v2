import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import Icon from '../components/Icon';

const OPTIONS = [
  { id: 'fr', label: '🇫🇷 Français', subtitle: 'Continuer en français' },
  { id: 'en', label: '🇬🇧 English', subtitle: 'Continue in English' },
];

export default function LanguageGateScreen({ onSelected }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream, padding: 24, justifyContent: 'center' }} edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', marginBottom: 26 }}>
        <Image
          source={require('../../assets/koligo-logo-1024.png')}
          style={{ width: 84, height: 84, marginBottom: 18, resizeMode: 'contain' }}
        />
        <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: colors.ink, textAlign: 'center', letterSpacing: -0.04 * 28 }}>
          Choisir la langue / Choose Language
        </Text>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14.5, color: colors.ink55, textAlign: 'center', lineHeight: 21, marginTop: 8, maxWidth: 320 }}>
          Sélectionne ta langue pour commencer / Select your language to start
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {OPTIONS.map(option => (
          <TouchableOpacity
            key={option.id}
            onPress={() => onSelected?.(option.id)}
            style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.ink12, flexDirection: 'row', alignItems: 'center', gap: 14 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: option.id === 'fr' ? colors.orangeLight : colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>{option.id === 'fr' ? '🇫🇷' : '🇬🇧'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>{option.label}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12.5, color: colors.ink55, marginTop: 2 }}>{option.subtitle}</Text>
            </View>
            <Icon name="arrow" size={18} color={colors.ink35} />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}