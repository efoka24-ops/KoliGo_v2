import i18n from './config';

/** Traduit un texte français écrit dans un écran (clé = le texte). Sans traduction : le français. */
export function tr(text) {
  return typeof text === 'string' ? i18n.t(text, { defaultValue: text }) : text;
}

export function setTrLang(lang) {
  if (lang && i18n.language !== lang) i18n.changeLanguage(lang);
}
