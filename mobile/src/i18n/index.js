import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { strings } from './strings';
import { stringsFf } from './strings_ff';

export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ff', label: 'Fulfulde', flag: '🇨🇲' },
];
const CODES = LANGUAGES.map((l) => l.code);

const I18nContext = createContext({ lang: 'fr', t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('fr');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('koligo_lang').catch(() => null),
      AsyncStorage.getItem('kg_lang').catch(() => null),
    ]).then(([a, b]) => {
      const v = a ?? b;
      if (CODES.includes(v)) setLangState(v);
    });
  }, []);

  const setLang = (l) => {
    if (!CODES.includes(l)) return;
    setLangState(l);
    AsyncStorage.setItem('koligo_lang', l).catch(() => {});
  };

  const t = (key) => {
    const entry = strings[key];
    if (!entry) return key;
    if (lang === 'ff') return stringsFf[key] || entry.fr || key;
    return entry[lang] ?? entry.fr ?? key;
  };

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
