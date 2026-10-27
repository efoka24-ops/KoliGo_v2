// KOLIGO_E2E_MARKER_v3
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { I18nProvider } from './src/i18n';
import { AppProvider } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { navTheme } from './src/theme';
import { initAnalytics, screenView } from './src/services/analytics';

const navRef = createNavigationContainerRef();

export default function App() {
  useEffect(() => { initAnalytics(); }, []);
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppProvider>
          <NavigationContainer
            ref={navRef}
            theme={navTheme}
            onStateChange={() => screenView(navRef.getCurrentRoute()?.name)}
            onReady={() => {
              screenView(navRef.getCurrentRoute()?.name);
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
