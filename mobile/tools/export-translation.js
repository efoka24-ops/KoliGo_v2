// Exporte tous les textes de l'application vers docs/traduction-fulfulde.csv (colonnes : type, cle, fr, en, ff).
// Usage : cd mobile && node tools/export-translation.js
// Les traductions fulfulde déjà saisies (ff_dict.js, strings_ff.js) sont conservées dans la colonne « ff ».
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

/** Charge un module ES simple (export const / export function) sans dépendance. */
function load(rel, names) {
  const src = fs.readFileSync(path.join(root, 'src', 'i18n', rel), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/export\s+(const|function|let)\s/g, '$1 ');
  return new Function(`${src}\nreturn { ${names.join(', ')} };`)();
}

const { strings } = load('strings.js', ['strings']);
const { EN } = load('en_dict.js', ['EN']);
const { EN_EXTRA } = load('en_extra.js', ['EN_EXTRA']);
const { FF } = load('ff_dict.js', ['FF']);
const { stringsFf } = load('strings_ff.js', ['stringsFf']);
const { TRANSLATIONS } = load('translations.js', ['TRANSLATIONS']);

const en = { ...(TRANSLATIONS.en || {}), ...EN, ...EN_EXTRA };
const ff = { ...FF, ...stringsFf };
const rows = [];
// 1) textes de menus et d'écrans identifiés par un code (strings.js)
for (const [id, v] of Object.entries(strings)) rows.push(['id', id, v.fr, v.en || '', ff[id] || '']);
// 2) textes français écrits dans les écrans (la clé EST le texte)
const seen = new Set(Object.keys(strings));
for (const k of new Set([...Object.keys(en), ...Object.keys(FF)])) {
  if (seen.has(k) || /^[a-z][A-Za-z0-9]*$/.test(k)) continue;
  rows.push(['texte', k, k, en[k] || '', ff[k] || '']);
}
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = '﻿type,cle,fr,en,ff\n' + rows.map((r) => r.map(q).join(',')).join('\n') + '\n';
const dest = path.resolve(root, '..', 'docs', 'traduction-fulfulde.csv');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, csv);
console.log(`${rows.length} textes exportés vers ${dest} (${rows.filter((r) => r[4]).length} déjà traduits en fulfulde)`);
