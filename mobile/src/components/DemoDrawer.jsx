import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import { useApp } from '../context/AppContext';
import Icon from './Icon';

const ONBOARDING_TRIMMED = {
  label: 'Onboarding',
  color: colors.ink,
  screens: [
    { label: 'Compte de paiement', screen: 'PaymentAccount', icon: 'wallet' },
    { label: 'Choix du profil', screen: 'ProfileChoice', icon: 'star' },
  ],
};

const VENDOR_SECTION = {
  label: 'Vendeur',
  color: colors.green,
  screens: [
    { label: 'Tableau de bord', screen: 'VendorHome', icon: 'home' },
    { label: 'Créer une livraison', screen: 'PostDelivery', icon: 'plus' },
    { label: 'Codes annonce', screen: 'VendorCodes', icon: 'shield', params: { codeCollect: '4827', codeReception: '9163', orderId: 'KG-001' } },
    { label: 'Historique', screen: 'History', icon: 'history' },
    { label: 'Détail livraison', screen: 'DeliveryDetail', icon: 'package', params: { deliveryId: 'KG-001', mode: 'mine' } },
  ],
};

const DELIVERER_SECTION = {
  label: 'Livreur',
  color: colors.orange,
  screens: [
    { label: 'Tableau de bord', screen: 'DelivererHome', icon: 'home' },
    { label: 'Courses dispo', screen: 'Available', icon: 'flag' },
    { label: 'Code de collecte', screen: 'Confirm', icon: 'shield', params: { phase: 'collect', deliveryId: 'KG-001' } },
    { label: 'En route → vendeur', screen: 'DeliveryDetail', icon: 'moto', params: { deliveryId: 'KG-001', mode: 'going_vendor' } },
    { label: 'En route → client', screen: 'DeliveryDetail', icon: 'pin', params: { deliveryId: 'KG-001', mode: 'mine' } },
    { label: 'En attente client', screen: 'DelivererWaiting', icon: 'clock', params: { deliveryId: 'KG-001' } },
    { label: 'Wallet livreur', screen: 'Wallet', icon: 'wallet' },
  ],
};

const TRANSVERSE_SECTION = {
  label: 'Transverse',
  color: colors.ink55,
  screens: [
    { label: 'Chat', screen: 'Chat', icon: 'chat' },
    { label: 'Notation', screen: 'Rating', icon: 'star' },
    { label: 'Signalement', screen: 'ReportIssue', icon: 'bell' },
    { label: 'Profil', screen: 'Profile', icon: 'user' },
  ],
};

function getSections(role) {
  if (role === 'vendor') return [ONBOARDING_TRIMMED, VENDOR_SECTION, TRANSVERSE_SECTION];
  if (role === 'deliverer') return [ONBOARDING_TRIMMED, DELIVERER_SECTION, TRANSVERSE_SECTION];
  return [ONBOARDING_TRIMMED, VENDOR_SECTION, DELIVERER_SECTION, TRANSVERSE_SECTION];
}

export default function DemoDrawer({ navigation }) {
  const { role } = useApp();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const sections = getSections(role);

  const go = (screen, params) => {
    setOpen(false);
    setTimeout(() => navigation.navigate(screen, params), 150);
  };

  return (
    <>
      {/* Floating trigger */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 90,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: 13,
          backgroundColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
          elevation: 8,
          zIndex: 100,
        }}
      >
        <Icon name="dot3" size={20} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setOpen(false)} />
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '85%',
          paddingBottom: insets.bottom + 8,
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.ink12 }} />
          </View>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 17, color: colors.ink }}>Sauter vers</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Icon name="close" size={20} color={colors.ink55} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 18 }}>
            {sections.map(section => (
              <View key={section.label}>
                <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: section.color, textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 8, opacity: 0.85 }}>
                  {section.label}
                </Text>
                <View style={{ gap: 4 }}>
                  {section.screens.map(({ label, screen, icon, params }) => (
                    <TouchableOpacity
                      key={screen + label}
                      onPress={() => go(screen, params)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.cream }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.ink06 }}>
                        <Icon name={icon} size={15} color={section.color} />
                      </View>
                      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
