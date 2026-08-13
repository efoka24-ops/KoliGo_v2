import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import { strings } from './strings';

type Lang = 'fr' | 'en';

interface I18nCtx { lang: Lang; t: (key: string) => string; setLang: (l: Lang) => void }

const I18nContext = createContext<I18nCtx>({ lang: 'fr', t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');

  useEffect(() => {
    // kg_lang is what AppContext persists; koligo_lang is the older key kept
    // for sessions written before the two were reconciled.
    Promise.all([
      storage.getItem('kg_lang').catch(() => null),
      storage.getItem('koligo_lang').catch(() => null),
    ]).then(([shared, legacy]) => {
      const v = shared ?? legacy;
      if (v === 'fr' || v === 'en') setLangState(v as Lang);
    }).catch(() => {});
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    storage.setItem('kg_lang', l).catch(() => {});
    storage.setItem('koligo_lang', l).catch(() => {});
  };

  const t = (key: string): string => {
    const entry = (strings as Record<string, Record<Lang, string>>)[key];
    if (!entry) return key;
    return entry[lang] ?? entry.fr ?? key;
  };

  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
