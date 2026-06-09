import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { strings } from './strings';

const I18nContext = createContext({ lang: 'fr', t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('fr');

  useEffect(() => {
    AsyncStorage.getItem('koligo_lang').then((v) => {
      if (v === 'fr' || v === 'en') setLangState(v);
    });
  }, []);

  const setLang = (l) => {
    setLangState(l);
    AsyncStorage.setItem('koligo_lang', l).catch(() => {});
  };

  const t = (key) => {
    const entry = strings[key];
    if (!entry) return key;
    return entry[lang] ?? entry.fr ?? key;
  };

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
