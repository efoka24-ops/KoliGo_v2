import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors } from '../theme';
import { useI18n } from '../i18n';

import VendorHomeScreen from '../screens/vendor/VendorHomeScreen';
import HistoryScreen from '../screens/vendor/HistoryScreen';
import ChatScreen from '../screens/vendor/ChatScreen';
import VendorProfileScreen from '../screens/vendor/VendorProfileScreen';

const Tab = createBottomTabNavigator();

const icon = (glyph) => ({ color }) => <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

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
      <Tab.Screen name="VendorHome" component={VendorHomeScreen} options={{ title: t('tabHome'), tabBarIcon: icon('▤') }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: t('tabHistory'), tabBarIcon: icon('≣') }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: t('tabChat'), tabBarIcon: icon('💬') }} />
      <Tab.Screen name="VendorProfile" component={VendorProfileScreen} options={{ title: t('tabProfile'), tabBarIcon: icon('◓') }} />
    </Tab.Navigator>
  );
}
