import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useI18n } from '../i18n';

import DelivererHomeScreen from '../screens/deliverer/DelivererHomeScreen';
import AvailableScreen from '../screens/deliverer/AvailableScreen';
import WalletScreen from '../screens/deliverer/WalletScreen';
import DelivererProfileScreen from '../screens/deliverer/DelivererProfileScreen';
import ChatInboxScreen from '../screens/vendor/ChatScreen';

const Tab = createBottomTabNavigator();

const tabIcon = (active, inactive) => ({ color, focused }) => (
  <Ionicons name={focused ? active : inactive} size={22} color={color} />
);

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
      <Tab.Screen name="DelivererHome" component={DelivererHomeScreen} options={{ title: t('tabHome'), tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tab.Screen name="Available" component={AvailableScreen} options={{ title: t('tabOffers'), tabBarIcon: tabIcon('bicycle', 'bicycle-outline') }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: t('tabWallet'), tabBarIcon: tabIcon('wallet', 'wallet-outline') }} />
      <Tab.Screen name="ChatInbox" component={ChatInboxScreen} options={{ title: t('tabChat'), tabBarIcon: tabIcon('chatbubble', 'chatbubble-outline') }} />
      <Tab.Screen name="DelivererProfile" component={DelivererProfileScreen} options={{ title: t('tabProfile'), tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tab.Navigator>
  );
}
