import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import Icon from '../components/Icon';

export default function MaintenanceScreen({ onRetry }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 32 }} edges={['top', 'bottom']}>
      <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        <Icon name="settings" size={38} color={colors.orange} />
      </View>

      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 32, color: '#fff', letterSpacing: -0.02 * 32, textAlign: 'center', marginBottom: 12 }}>
        Koli<Text style={{ color: colors.orange }}>Go</Text>
      </Text>

      <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 20, color: '#fff', textAlign: 'center', marginBottom: 12 }}>
        Maintenance en cours
      </Text>

      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22, maxWidth: 280, marginBottom: 40 }}>
        L'application est temporairement indisponible pour des opérations de maintenance. Elle sera de retour très bientôt.
      </Text>

      <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, width: '100%', marginBottom: 32 }}>
        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 6 }}>
          Contact support
        </Text>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          support@koligo.cm
        </Text>
      </View>

      <TouchableOpacity
        onPress={onRetry}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14, backgroundColor: colors.orange, borderRadius: 16 }}
        activeOpacity={0.85}
      >
        <Icon name="history" size={16} color="#fff" />
        <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 15, color: '#fff' }}>Réessayer</Text>
      </TouchableOpacity>

      <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 32 }}>
        KoliGo v1.1
      </Text>
    </SafeAreaView>
  );
}
