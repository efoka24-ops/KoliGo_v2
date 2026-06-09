import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage as SecureStore } from '../utils/storage';
import { colors, THEMES } from '../constants/colors';

const ThemeContext = createContext(null);

export const THEME_OPTIONS = [
  { key: 'light', labelFr: 'Mode clair',   labelEn: 'Light mode',  icon: '☀️' },
  { key: 'dark',  labelFr: 'Mode sombre',  labelEn: 'Dark mode',   icon: '🌙' },
  { key: 'sepia', labelFr: 'Mode sépia',   labelEn: 'Sepia mode',  icon: '📜' },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    SecureStore.getItem('kg_theme').then(saved => {
      if (saved && THEMES[saved]) applyTheme(saved, false);
    }).catch(() => {});
  }, []);

  function applyTheme(key, persist = true) {
    if (!THEMES[key]) return;
    // Mutate in-place so every screen importing `colors` picks up the new values on next render
    Object.assign(colors, THEMES[key]);
    setThemeState(key);
    if (persist) SecureStore.setItem('kg_theme', key).catch(() => {});
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
