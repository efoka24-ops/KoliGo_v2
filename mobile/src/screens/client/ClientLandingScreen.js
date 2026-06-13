import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import KGButton from '../../components/KGButton';
import KGCard from '../../components/KGCard';
import KGStatusPill from '../../components/KGStatusPill';
import Icon from '../../components/Icon';

export default function ClientLandingScreen({ navigation, route }) {
  const params = route?.params || {};
  const clientName = params.clientName || 'Aïcha';
  const vendorName = params.vendorName || 'Mama Africa Boutique';
  const parcelDesc = params.parcelDesc || 'Robe wax';
  const orderId = params.orderId || 'KG-2026-0512';
  const orderLabel = String(orderId).slice(-8).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <View style={{ backgroundColor: colors.green, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 20, color: '#fff', letterSpacing: -0.02 * 20 }}>
            Koli<Text style={{ color: '#ffcb72' }}>Go</Text>
          </Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>
              koligo.cm/c/Kx7m9
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 28, color: '#fff', letterSpacing: -0.02 * 28, lineHeight: 32 }}>
          Salut {clientName}
        </Text>
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 20 }}>
          Ton colis de <Text style={{ fontFamily: `${fonts.ui}-SemiBold` }}>{vendorName}</Text> est en route. Il a été ajouté à ton historique.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <KGCard kind="soft" padding={16} style={{ gap: 12, marginTop: -14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="package" size={26} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: colors.ink }}>{parcelDesc}</Text>
              <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 11, color: colors.ink55, marginTop: 2 }}>{orderLabel}</Text>
            </View>
            <KGStatusPill status="en_route" />
          </View>
          <View style={{ backgroundColor: colors.greenLight, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12 }}>
            <Icon name="check" size={20} color={colors.green} />
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.greenDark, lineHeight: 19 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold` }}>Ajouté à ton historique.</Text>{' '}
              Retrouve ce colis à tout moment dans l'app KoliGo, onglet{' '}
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold` }}>Mes réceptions</Text>.
            </Text>
          </View>
        </KGCard>

        <KGCard padding={14} style={{ gap: 10 }}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.04 }}>Aperçu du colis</Text>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, letterSpacing: -0.03 * 22, color: colors.ink }}>{parcelDesc}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink70, lineHeight: 19 }}>
            Boutique: <Text style={{ fontFamily: `${fonts.ui}-SemiBold` }}>{vendorName}</Text> · Référence <Text style={{ fontFamily: `${fonts.ui}-SemiBold` }}>{orderLabel}</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: colors.greenLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.greenDark }}>En route</Text>
            </View>
            <View style={{ backgroundColor: '#fff3e8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.orange }}>Suivi actif</Text>
            </View>
          </View>
        </KGCard>

        <KGButton
          kind="primary"
          size="lg"
          icon="pin"
          onPress={() => navigation.navigate('ClientTracking', params)}
        >
          Suivre le colis en direct
        </KGButton>

        <KGButton
          kind="ghost"
          size="md"
          icon="history"
          onPress={() => navigation.navigate('History')}
        >
          Mes réceptions
        </KGButton>

        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 }}>
          Quand le livreur arrive, ouvre la page de suivi et confirme la réception avec ton{' '}
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, color: colors.ink }}>code B</Text> et ton numéro de paiement.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
