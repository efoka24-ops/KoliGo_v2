import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from './src/i18n';
import { AppProvider } from './src/context/AppContext';
import { ThemeProvider } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navTheme } from './src/theme';

const queryClient = new QueryClient();
const navRef = createNavigationContainerRef<any>();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <AppProvider>
              <NavigationContainer
                ref={navRef}
                theme={navTheme}
                onReady={() => {
                  if (typeof window !== 'undefined') {
                    (window as any).__koligo_navigate = (name: string, params?: object) => navRef.navigate(name as never, params as never);
                    (window as any).__koligo_nav_ready = () => navRef.isReady();
                  }
                }}
              >
                <StatusBar style="dark" />
                <RootNavigator />
              </NavigationContainer>
            </AppProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
