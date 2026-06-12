import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useI18n } from '../i18n';

import VendorHomeScreen from '../screens/vendor/VendorHomeScreen';
import HistoryScreen from '../screens/vendor/HistoryScreen';
import ChatScreen from '../screens/vendor/ChatScreen';
import VendorProfileScreen from '../screens/vendor/VendorProfileScreen';

const Tab = createBottomTabNavigator();

const tabIcon = (active, inactive) => ({ color, focused }) => (
  <Ionicons name={focused ? active : inactive} size={22} color={color} />
);

export default function VendorTabs() {
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
      <Tab.Screen name="VendorHome" component={VendorHomeScreen} options={{ title: t('tabHome'), tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: t('tabHistory'), tabBarIcon: tabIcon('time', 'time-outline') }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: t('tabChat'), tabBarIcon: tabIcon('chatbubble', 'chatbubble-outline') }} />
      <Tab.Screen name="VendorProfile" component={VendorProfileScreen} options={{ title: t('tabProfile'), tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tab.Navigator>
  );
}
