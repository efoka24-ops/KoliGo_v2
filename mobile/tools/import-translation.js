// Réintègre la colonne « ff » du fichier CSV rempli dans l'application.
// Usage : cd mobile && node tools/import-translation.js ../docs/traduction-fulfulde.csv
// Écrit src/i18n/ff_dict.js (textes d'écran) et src/i18n/strings_ff.js (menus). Les lignes sans traduction restent en français.
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('Usage : node tools/import-translation.js <fichier.csv>'); process.exit(1); }

/** Lecteur CSV minimal : guillemets, virgules ou points-virgules, retours à la ligne dans les champs. */
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0];
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const head = rows.shift().map((h) => h.trim().toLowerCase());
const col = (n) => head.indexOf(n);
const [iT, iK, iF, iFF] = [col('type'), col('cle'), col('fr'), col('ff')];
if ([iT, iK, iF, iFF].includes(-1)) { console.error('Colonnes attendues : type, cle, fr, en, ff'); process.exit(1); }

const ffDict = {}, ffIds = {};
let n = 0; const warns = [];
const tokens = (s) => (String(s).match(/\{\{[^}]+\}\}/g) || []).sort().join('|');
for (const r of rows) {
  const ff = (r[iFF] || '').trim();
  if (!ff) continue;
  const type = (r[iT] || '').trim(), key = r[iK];
  if (tokens(ff) !== tokens(r[iF])) warns.push(`« ${key} » : les marques {{…}} ne correspondent pas au français`);
  (type === 'id' ? ffIds : ffDict)[key] = ff;
  n++;
}

const lit = (o) => JSON.stringify(o, null, 2);
const root = path.resolve(__dirname, '..', 'src', 'i18n');
fs.writeFileSync(path.join(root, 'ff_dict.js'), `// Fulfulde : texte français (clé) -> fulfulde. Généré par tools/import-translation.js depuis docs/traduction-fulfulde.csv.\n// Les textes absents s'affichent en français.\nexport const FF = ${lit(ffDict)};\n`);
fs.writeFileSync(path.join(root, 'strings_ff.js'), `// Fulfulde pour les textes à code (strings.js). Généré par tools/import-translation.js. Toute clé absente s'affiche en français.\nexport const stringsFf = ${lit(ffIds)};\n`);
console.log(`${n} traductions importées (${Object.keys(ffIds).length} menus, ${Object.keys(ffDict).length} écrans).`);
if (warns.length) { console.warn('\nAttention :\n- ' + warns.join('\n- ')); }
