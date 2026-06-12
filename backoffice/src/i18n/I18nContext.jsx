import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { strings } from './strings.js';

const I18nContext = createContext({ lang: 'fr', t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('koligoBO_lang') || 'fr'; } catch { return 'fr'; }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('koligoBO_lang', lang); } catch { /* noop */ }
  }, [lang]);

  const t = useCallback(
    (key) => {
      const entry = strings[key];
      if (!entry) return key;
      return entry[lang] ?? entry.fr ?? key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, t, setLang: setLangState }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
