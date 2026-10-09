import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nextProvider } from 'react-i18next';
import i18n, { LANGUAGES, LANG_CODES } from './config';

export { LANGUAGES };

const I18nContext = createContext({ lang: 'fr', t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(i18n.language || 'fr');

  // Langue mémorisée (clé historique « koligo_lang », ou « kg_lang » écrite par AppContext).
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('koligo_lang').catch(() => null),
      AsyncStorage.getItem('kg_lang').catch(() => null),
    ]).then(([a, b]) => {
      const v = a ?? b;
      if (LANG_CODES.includes(v)) i18n.changeLanguage(v);
    });
  }, []);

  // Source de vérité : i18next. Tout changement de langue relance le rendu des écrans qui utilisent useI18n.
  useEffect(() => {
    const on = (l) => setLangState(l);
    i18n.on('languageChanged', on);
    return () => i18n.off('languageChanged', on);
  }, []);

  const setLang = (l) => {
    if (!LANG_CODES.includes(l)) return;
    i18n.changeLanguage(l);
    AsyncStorage.setItem('koligo_lang', l).catch(() => {});
  };

  const t = (key) => i18n.t(key, { defaultValue: key });

  return (
    <I18nextProvider i18n={i18n}>
      <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>
    </I18nextProvider>
  );
}

export const useI18n = () => useContext(I18nContext);
