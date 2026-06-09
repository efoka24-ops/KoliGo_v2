import React, { useState } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGCard from '../../components/KGCard';
import KGButton from '../../components/KGButton';
import Icon from '../../components/Icon';

const SECTIONS = [
  {
    title: 'Livraisons',
    items: [
      { key: 'newDelivery',      label: 'Nouvelles courses dispo',  sub: 'AlertÃ© quand une course est publiÃ©e dans ta zone' },
      { key: 'deliveryAccepted', label: 'Course acceptÃ©e',          sub: 'Un livreur a pris en charge ta commande' },
      { key: 'deliveryPickedUp', label: 'Colis collectÃ©',           sub: 'Le livreur a rÃ©cupÃ©rÃ© ton colis' },
      { key: 'deliveryDelivered',label: 'Colis livrÃ©',              sub: 'Le destinataire a confirmÃ© la rÃ©ception' },
    ],
  },
  {
    title: 'Finances',
    items: [
      { key: 'withdrawalValidated', label: 'Retrait validÃ©',   sub: 'Ton retrait MoMo a Ã©tÃ© traitÃ©' },
      { key: 'gainReceived',        label: 'Gain reÃ§u',        sub: 'Nouvelle entrÃ©e sur ton wallet' },
    ],
  },
  {
    title: 'Messages & Compte',
    items: [
      { key: 'newMessage',   label: 'Nouveaux messages', sub: 'Messages des livreurs ou vendeurs' },
      { key: 'kycUpdate',    label: 'Mise Ã  jour KYC',   sub: 'RÃ©sultat de la vÃ©rification d\'identitÃ©' },
      { key: 'promoOffers',  label: 'Offres & promotions', sub: 'Annonces et nouveautÃ©s KoliGo' },
    ],
  },
];

const DEFAULTS = {
  newDelivery: true, deliveryAccepted: true, deliveryPickedUp: true, deliveryDelivered: true,
  withdrawalValidated: true, gainReceived: true, newMessage: true, kycUpdate: true, promoOffers: false,
};

export default function NotificationsScreen({ navigation }) {
  const { showToast } = useApp();
  const [prefs, setPrefs] = useState(DEFAULTS);

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  const save = () => {
    showToast('PrÃ©fÃ©rences enregistrÃ©es âœ“');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar title="Notifications" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {SECTIONS.map(section => (
          <View key={section.title}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 8, paddingHorizontal: 2 }}>
              {section.title}
            </Text>
            <KGCard padding={0}>
              {section.items.map((item, i) => (
                <View
                  key={item.key}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                    borderBottomWidth: i < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: colors.ink06,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{item.label}</Text>
                    <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1, lineHeight: 17 }}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={prefs[item.key]}
                    onValueChange={() => toggle(item.key)}
                    trackColor={{ false: colors.ink12, true: colors.green }}
                    thumbColor="#fff"
                    ios_backgroundColor={colors.ink12}
                  />
                </View>
              ))}
            </KGCard>
          </View>
        ))}

        <KGCard kind="cream" padding={14}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Icon name="bell" size={18} color={colors.ink55} />
            <Text style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink70, lineHeight: 18 }}>
              Les notifications push nÃ©cessitent que l'application soit installÃ©e et que les autorisations soient accordÃ©es dans les paramÃ¨tres de ton tÃ©lÃ©phone.
            </Text>
          </View>
        </KGCard>

        <KGButton kind="primary" size="lg" icon="check" onPress={save}>
          Enregistrer les prÃ©fÃ©rences
        </KGButton>
      </ScrollView>
    </SafeAreaView>
  );
}
