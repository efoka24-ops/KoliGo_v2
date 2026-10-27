// Exporte le plan de marquage (backend-php/app/database/tracking_plan.json) en tableau CSV pour les équipes produit et marketing.
// Colonnes : Module, Écran, Événement, Source, Déclencheur, Paramètres. S'ouvre directement dans Excel.
// Usage : cd mobile && node tools/export-tracking-plan.js
const fs = require('fs');
const path = require('path');

const plan = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend-php', 'app', 'database', 'tracking_plan.json'), 'utf8'));
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const head = ['Module', 'Écran', 'Événement', 'Source', 'Déclencheur', 'Paramètres'];
const rows = plan.events.map((e) => [e.module, e.screen, e.name, e.source === 'server' ? 'Serveur' : 'Application', e.trigger, (e.params || []).join(', ')]);
const funnels = plan.funnels.flatMap((f) => f.steps.map((s, i) => [f.label, i + 1, s.label, s.event, s.screen || '', s.where ? JSON.stringify(s.where) : '']));

const csv = '\uFEFF' + [head, ...rows].map((r) => r.map(q).join(',')).join('\n') + '\n';
const dest = path.resolve(__dirname, '..', '..', 'docs', 'plan-de-marquage-koligo.csv');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, csv);

const fcsv = '\uFEFF' + [['Entonnoir', 'Étape', 'Libellé', 'Événement', 'Écran', 'Filtre'], ...funnels].map((r) => r.map(q).join(',')).join('\n') + '\n';
const fdest = path.resolve(__dirname, '..', '..', 'docs', 'plan-de-marquage-entonnoirs-koligo.csv');
fs.writeFileSync(fdest, fcsv);
console.log(`${rows.length} événements exportés vers ${dest}\n${funnels.length} étapes d'entonnoirs exportées vers ${fdest}`);
