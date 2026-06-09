import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors } from '../theme';
import { useI18n } from '../i18n';

import DelivererHomeScreen from '../screens/deliverer/DelivererHomeScreen';
import AvailableScreen from '../screens/deliverer/AvailableScreen';
import WalletScreen from '../screens/deliverer/WalletScreen';
import DelivererProfileScreen from '../screens/deliverer/DelivererProfileScreen';

const Tab = createBottomTabNavigator();

const icon = (glyph) => ({ color }) => <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

export default function DelivererTabs() {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.greenDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: colors.surface, height: 64, paddingBottom: 10, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen name="DelivererHome" component={DelivererHomeScreen} options={{ title: t('tabHome'), tabBarIcon: icon('▤') }} />
      <Tab.Screen name="Available" component={AvailableScreen} options={{ title: t('tabOffers'), tabBarIcon: icon('🛵') }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: t('tabWallet'), tabBarIcon: icon('▣') }} />
      <Tab.Screen name="DelivererProfile" component={DelivererProfileScreen} options={{ title: t('tabProfile'), tabBarIcon: icon('◓') }} />
    </Tab.Navigator>
  );
}
