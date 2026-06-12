// KOLIGO_E2E_MARKER_v3
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { I18nProvider } from './src/i18n';
import { AppProvider } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { navTheme } from './src/theme';

const navRef = createNavigationContainerRef();

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppProvider>
          <NavigationContainer
            ref={navRef}
            theme={navTheme}
            onReady={() => {
              if (typeof window !== 'undefined') {
                window.__koligo_navigate = (name, params) => navRef.navigate(name, params);
                window.__koligo_nav_ready = () => navRef.isReady();
              }
            }}
          >
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </AppProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
