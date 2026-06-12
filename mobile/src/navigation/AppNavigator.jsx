import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Onboarding
import WelcomeScreen from '../screens/WelcomeScreen';
import AuthScreen from '../screens/AuthScreen';
import ForgotPinScreen from '../screens/ForgotPinScreen';
import VerificationScreen from '../screens/VerificationScreen';
import ProfileChoiceScreen from '../screens/ProfileChoiceScreen';

// Vendor
import VendorHomeScreen from '../screens/VendorHomeScreen';
import PostDeliveryScreen from '../screens/PostDeliveryScreen';

// Vendor extras
import VendorCodesScreen from '../screens/VendorCodesScreen';

// Deliverer
import DelivererHomeScreen from '../screens/DelivererHomeScreen';
import AvailableScreen from '../screens/AvailableScreen';
import WalletScreen from '../screens/WalletScreen';
import DelivererWaitingScreen from '../screens/DelivererWaitingScreen';

// Client flow
import ClientLandingScreen from '../screens/ClientLandingScreen';
import ClientTrackingScreen from '../screens/ClientTrackingScreen';
import ClientReceptionScreen from '../screens/ClientReceptionScreen';
import ClientReceptionSuccessScreen from '../screens/ClientReceptionSuccessScreen';

// Shared
import DeliveryDetailScreen from '../screens/DeliveryDetailScreen';
import PaymentAccountScreen from '../screens/PaymentAccountScreen';
import ConfirmScreen from '../screens/ConfirmScreen';
import ChatInboxScreen from '../screens/ChatInboxScreen';
import ChatScreen from '../screens/ChatScreen';
import RatingScreen from '../screens/RatingScreen';
import ReportIssueScreen from '../screens/ReportIssueScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HistoryScreen from '../screens/HistoryScreen';
import KYCScreen from '../screens/KYCScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#fff' } }}
    >
      {/* Auth flow */}
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="ForgotPin" component={ForgotPinScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="PaymentAccount" component={PaymentAccountScreen} />
      <Stack.Screen name="ProfileChoice" component={ProfileChoiceScreen} />

      {/* Vendor */}
      <Stack.Screen name="VendorHome" component={VendorHomeScreen} />
      <Stack.Screen name="PostDelivery" component={PostDeliveryScreen} />
      <Stack.Screen name="VendorCodes" component={VendorCodesScreen} />

      {/* Deliverer */}
      <Stack.Screen name="DelivererHome" component={DelivererHomeScreen} />
      <Stack.Screen name="Available" component={AvailableScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="DelivererWaiting" component={DelivererWaitingScreen} />

      {/* Client flow */}
      <Stack.Screen name="ClientLanding" component={ClientLandingScreen} />
      <Stack.Screen name="ClientTracking" component={ClientTrackingScreen} />
      <Stack.Screen name="ClientReception" component={ClientReceptionScreen} />
      <Stack.Screen name="ClientReceptionSuccess" component={ClientReceptionSuccessScreen} />

      {/* Shared */}
      <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} />
      <Stack.Screen name="Confirm" component={ConfirmScreen} />
      <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Rating" component={RatingScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="KYC" component={KYCScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
    </Stack.Navigator>
  );
}
