import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  WelcomeScreen,
  AuthScreen,
  VerificationScreen,
  ProfileChoiceScreen,
  LanguageGateScreen,
  PermissionsGateScreen,
  KYCScreen,
  VendorHomeScreen,
  PostDeliveryScreen,
  VendorCodesScreen,
  DelivererHomeScreen,
  AvailableScreen,
  DelivererWaitingScreen,
  ClientLandingScreen,
  ClientTrackingScreen,
  ClientReceptionScreen,
  ClientReceptionSuccessScreen,
  DeliveryDetailScreen,
  PaymentAccountScreen,
  ConfirmScreen,
  ChatInboxScreen,
  ChatScreen,
  RatingScreen,
  ReportIssueScreen,
  ProfileScreen,
  HistoryScreen,
  NotificationsScreen,
  SettingsScreen,
  TermsScreen,
  PrivacyScreen,
  WalletScreen,
} from '../screens';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#fff' } }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="ProfileChoice" component={ProfileChoiceScreen} />
      <Stack.Screen name="LanguageGate" component={LanguageGateScreen} />
      <Stack.Screen name="PermissionsGate" component={PermissionsGateScreen} />
      <Stack.Screen name="KYC" component={KYCScreen} />
      <Stack.Screen name="PaymentAccount" component={PaymentAccountScreen} />

      <Stack.Screen name="VendorHome" component={VendorHomeScreen} />
      <Stack.Screen name="PostDelivery" component={PostDeliveryScreen} />
      <Stack.Screen name="VendorCodes" component={VendorCodesScreen} />

      <Stack.Screen name="DelivererHome" component={DelivererHomeScreen} />
      <Stack.Screen name="Available" component={AvailableScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="DelivererWaiting" component={DelivererWaitingScreen} />

      <Stack.Screen name="ClientLanding" component={ClientLandingScreen} />
      <Stack.Screen name="ClientTracking" component={ClientTrackingScreen} />
      <Stack.Screen name="ClientReception" component={ClientReceptionScreen} />
      <Stack.Screen name="ClientReceptionSuccess" component={ClientReceptionSuccessScreen} />

      <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} />
      <Stack.Screen name="Confirm" component={ConfirmScreen} />
      <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Rating" component={RatingScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
    </Stack.Navigator>
  );
}
