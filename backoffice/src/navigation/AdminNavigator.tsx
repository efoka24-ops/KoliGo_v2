import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import UsersScreen from '../screens/UsersScreen';
import UserDetailScreen from '../screens/UserDetailScreen';
import DeliveriesScreen from '../screens/DeliveriesScreen';
import DeliveryDetailScreen from '../screens/DeliveryDetailScreen';
import FinanceScreen from '../screens/FinanceScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const icon = (g: string) => ({ color }: { color: string }) => <Text style={{ fontSize: 18, color }}>{g}</Text>;

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard', tabBarIcon: icon('📊') }} />
      <Tab.Screen name="Users" component={UsersScreen} options={{ title: 'Utilisateurs', tabBarIcon: icon('👥') }} />
      <Tab.Screen name="Deliveries" component={DeliveriesScreen} options={{ title: 'Livraisons', tabBarIcon: icon('📦') }} />
      <Tab.Screen name="Finance" component={FinanceScreen} options={{ title: 'Finance', tabBarIcon: icon('💰') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Paramètres', tabBarIcon: icon('⚙️') }} />
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="AdminApp" component={AdminTabs} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} />
      <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} />
    </Stack.Navigator>
  );
}
