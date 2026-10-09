import { EN } from './en_dict';
import { FF } from './ff_dict';

let current = 'fr';

/** Langue courante des textes écrits en dur (mise à jour par I18nProvider). */
export function setTrLang(lang) {
  current = lang === 'en' || lang === 'ff' ? lang : 'fr';
}

/** Traduit un texte français ; sans traduction connue, il reste en français. */
export function tr(text) {
  if (typeof text !== 'string') return text;
  if (current === 'en') return EN[text] ?? text;
  if (current === 'ff') return FF[text] ?? text;
  return text;
}
