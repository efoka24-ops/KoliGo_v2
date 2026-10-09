import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { strings } from './strings';
import { stringsFf } from './strings_ff';
import { EN } from './en_dict';
import { FF } from './ff_dict';
import { TRANSLATIONS } from './translations';

export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ff', label: 'Fulfulde', flag: '🇨🇲' },
];
export const LANG_CODES = LANGUAGES.map((l) => l.code);

// Deux familles de clés, une seule ressource par langue :
//  - les identifiants de strings.js (« tabHome », « continue »…)
//  - les textes français écrits dans les écrans (la clé EST le texte français)
const fr = {};
const en = { ...(TRANSLATIONS.en || {}), ...EN };
const ff = { ...FF, ...stringsFf };
Object.entries(strings).forEach(([key, v]) => {
  fr[key] = v.fr;
  if (v.en) en[key] = v.en;
});

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en }, ff: { translation: ff } },
  lng: 'fr',
  fallbackLng: 'fr',          // tout texte non traduit reste en français
  supportedLngs: LANG_CODES,
  keySeparator: false,        // les textes contiennent des « . » et des « : »
  nsSeparator: false,
  returnEmptyString: false,
  compatibilityJSON: 'v3',    // pas d'Intl.PluralRules requis sous Hermes
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
