import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '../store';

// Onboarding
import LanguageScreen from '../screens/onboarding/LanguageScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import SignupScreen from '../screens/onboarding/SignupScreen';
import OtpScreen from '../screens/onboarding/OtpScreen';
import PinScreen from '../screens/onboarding/PinScreen';
import SigninScreen from '../screens/onboarding/SigninScreen';
import KycScreen from '../screens/onboarding/KycScreen';
import LocationScreen from '../screens/onboarding/LocationScreen';
import RoleSelectScreen from '../screens/onboarding/RoleSelectScreen';
import PaymentSetupScreen from '../screens/onboarding/PaymentSetupScreen';
import MaintenanceScreen from '../screens/onboarding/MaintenanceScreen';

// Role tab navigators
import VendorTabs from './VendorTabs';
import DelivererTabs from './DelivererTabs';

// Vendor stack extras
import PostDeliveryScreen from '../screens/vendor/PostDeliveryScreen';
import VendorCodesScreen from '../screens/vendor/VendorCodesScreen';
import DeliveryDetailScreen from '../screens/vendor/DeliveryDetailScreen';

// Deliverer stack extras
import OfferDetailScreen from '../screens/deliverer/OfferDetailScreen';
import ConfirmCodeScreen from '../screens/deliverer/ConfirmCodeScreen';
import WaitingScreen from '../screens/deliverer/WaitingScreen';
import RatingScreen from '../screens/deliverer/RatingScreen';
import ReportIssueScreen from '../screens/deliverer/ReportIssueScreen';
import KycStatusScreen from '../screens/deliverer/KycStatusScreen';

// Client flow
import ClientLandingScreen from '../screens/client/ClientLandingScreen';
import ClientTrackingScreen from '../screens/client/ClientTrackingScreen';
import ClientReceptionScreen from '../screens/client/ClientReceptionScreen';
import ReceptionSuccessScreen from '../screens/client/ReceptionSuccessScreen';
import ClientRatingScreen from '../screens/client/ClientRatingScreen';

// Shared
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import TermsScreen from '../screens/shared/TermsScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { role } = useApp();

  return (
    <Stack.Navigator initialRouteName="Language" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F4F5F1' } }}>
      {/* Onboarding */}
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="Pin" component={PinScreen} />
      <Stack.Screen name="Signin" component={SigninScreen} />
      <Stack.Screen name="Kyc" component={KycScreen} />
      <Stack.Screen name="Location" component={LocationScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="PaymentSetup" component={PaymentSetupScreen} />

      {/* Main app — role decides which tab set */}
      <Stack.Screen name="VendorApp" component={VendorTabs} />
      <Stack.Screen name="DelivererApp" component={DelivererTabs} />

      {/* Vendor extras */}
      <Stack.Screen name="PostDelivery" component={PostDeliveryScreen} />
      <Stack.Screen name="VendorCodes" component={VendorCodesScreen} />
      <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} />

      {/* Deliverer extras */}
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} />
      <Stack.Screen name="ConfirmCode" component={ConfirmCodeScreen} />
      <Stack.Screen name="Waiting" component={WaitingScreen} />
      <Stack.Screen name="Rating" component={RatingScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
      <Stack.Screen name="KycStatus" component={KycStatusScreen} />

      {/* Client */}
      <Stack.Screen name="ClientLanding" component={ClientLandingScreen} />
      <Stack.Screen name="ClientTracking" component={ClientTrackingScreen} />
      <Stack.Screen name="ClientReception" component={ClientReceptionScreen} />
      <Stack.Screen name="ReceptionSuccess" component={ReceptionSuccessScreen} />
      <Stack.Screen name="ClientRating" component={ClientRatingScreen} />

      {/* Shared / modals */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
