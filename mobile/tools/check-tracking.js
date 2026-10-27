// Vérifie l'accord entre le code de l'application et le plan de marquage (backend-php/app/database/tracking_plan.json).
//   - un événement utilisé dans le code mais absent du plan serait REFUSÉ par le serveur : erreur ;
//   - un événement du plan jamais émis par l'application : avertissement (utile pour repérer un plan en avance sur le code).
// Usage : cd mobile && node tools/check-tracking.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.resolve(root, '..', 'backend-php', 'app', 'database', 'tracking_plan.json'), 'utf8'));
const appEvents = new Set(plan.events.filter((e) => e.source === 'app').map((e) => e.name));
const serverEvents = new Set(plan.events.filter((e) => e.source === 'server').map((e) => e.name));

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(f.name)) out.push(p);
  }
  return out;
}

const used = new Map(); // nom -> fichiers
const add = (name, file) => { if (!used.has(name)) used.set(name, new Set()); used.get(name).add(path.relative(root, file)); };

for (const file of walk(path.join(root, 'src')).concat([path.join(root, 'App.js')])) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/track\(\s*'([a-z0-9_]+)'/g)) add(m[1], file);
  // Le service crée lui-même l'évènement de début de session (name: '...').
  if (file.endsWith(path.join('services', 'analytics.js'))) {
    for (const m of src.matchAll(/name:\s*'([a-z0-9_]+)'/g)) add(m[1], file);
  }
  // Table de correspondance des appels : les noms d'évènements y sont des chaînes entre apostrophes en snake_case.
  if (file.endsWith(path.join('services', 'apiEvents.js'))) {
    for (const m of src.matchAll(/'([a-z]+(?:_[a-z]+)+)'/g)) add(m[1], file);
  }
}

const unknown = [...used.keys()].filter((n) => !appEvents.has(n));
const serverOnly = unknown.filter((n) => serverEvents.has(n));
const notInPlan = unknown.filter((n) => !serverEvents.has(n));
const unused = [...appEvents].filter((n) => !used.has(n));

let bad = 0;
for (const n of notInPlan) { console.error(`ERREUR  « ${n} » est émis par ${[...used.get(n)].join(', ')} mais absent du plan : le serveur le refuserait.`); bad++; }
for (const n of serverOnly) { console.error(`ERREUR  « ${n} » est réservé au serveur dans le plan mais émis par ${[...used.get(n)].join(', ')}.`); bad++; }
for (const n of unused) console.warn(`avertissement  « ${n} » est dans le plan (source app) mais n'est émis par aucun fichier.`);
const funnelEvents = plan.funnels.flatMap((f) => f.steps.map((s) => s.event));
for (const n of funnelEvents) if (![...appEvents, ...serverEvents].includes(n)) { console.error(`ERREUR  l'entonnoir référence « ${n} », absent du plan.`); bad++; }

console.log(`${appEvents.size} événements de l'application et ${serverEvents.size} du serveur dans le plan ; ${used.size} noms trouvés dans le code ; ${unused.length} non émis.`);
process.exit(bad ? 1 : 0);
