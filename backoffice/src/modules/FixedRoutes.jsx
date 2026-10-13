import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const EMPTY = { fromCity: '', fromPlace: '', toCity: '', toPlace: '', priceXAF: '', bothWays: true, isActive: true, note: '' };
const xaf = (n) => `${Number(n || 0).toLocaleString('fr-FR')} F`;

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

export default function FixedRoutes() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null); // null = fermé ; { id?, ...champs }
  const [msg, setMsg] = useState(null);

  const routes = useQuery({ queryKey: ['admin-fixed-routes'], queryFn: adminApi.fixedRoutes });
  const cities = useQuery({ queryKey: ['admin-cities-list'], queryFn: adminApi.cities });
  const cityNames = (cities.data?.items || cities.data || []).map((c) => c.name).filter(Boolean);

  const save = useMutation({
    mutationFn: (f) => (f.id ? adminApi.updateFixedRoute(f.id, f) : adminApi.createFixedRoute(f)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-fixed-routes'] }); setForm(null); setMsg({ ok: true, text: 'Trajet enregistré : il s\'applique aux nouvelles courses.' }); },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  const remove = useMutation({
    mutationFn: (id) => adminApi.deleteFixedRoute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-fixed-routes'] }),
  });
  const toggle = useMutation({
    mutationFn: (r) => adminApi.updateFixedRoute(r.id, { ...r, isActive: !r.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-fixed-routes'] }),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const rows = routes.data?.items ?? [];

  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Trajets fixes</h2>
          <div className="sub">
            Prix fixe pour les trajets habituels (ex. Pitoa ↔ Garoua à 500 F). Il remplace le calcul « base + km » ; seul un colis plus lourd que {routes.data?.lightKg ?? 2} kg ajoute un supplément de poids.
            Le prix saisi est <b>le prix payé par le client</b> ; la commission de la plateforme (3 %) est retirée de la part du livreur.
            Un quartier laissé vide signifie « toute la ville » ; le trajet le plus précis l'emporte. Les courses déjà publiées gardent leur prix.
          </div>
        </div>
        <button className="btn pri" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>+ Trajet fixe</button>
      </div>

      {msg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 13, background: msg.ok ? '#EFF8F1' : '#FDECEC', color: msg.ok ? '#0A5C2F' : '#C00' }}>{msg.text}</div>}

      {form && (
        <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 10, maxWidth: 720 }}>
          <datalist id="fr-cities">{cityNames.map((n) => <option key={n} value={n} />)}</datalist>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Ville de départ *"><input list="fr-cities" value={form.fromCity} onChange={set('fromCity')} style={{ width: '100%', padding: 9 }} placeholder="ex : Garoua" /></Field>
            <Field label="Quartier de départ (facultatif)"><input value={form.fromPlace || ''} onChange={set('fromPlace')} style={{ width: '100%', padding: 9 }} placeholder="vide = toute la ville" /></Field>
            <Field label="Ville d'arrivée *"><input list="fr-cities" value={form.toCity} onChange={set('toCity')} style={{ width: '100%', padding: 9 }} placeholder="ex : Garoua" /></Field>
            <Field label="Quartier d'arrivée (facultatif)"><input value={form.toPlace || ''} onChange={set('toPlace')} style={{ width: '100%', padding: 9 }} placeholder="vide = toute la ville" /></Field>
            <Field label="Prix payé par le client (F) *"><input type="number" value={form.priceXAF} onChange={set('priceXAF')} style={{ width: '100%', padding: 9 }} placeholder="ex : 500" /></Field>
            <Field label="Note interne"><input value={form.note || ''} onChange={set('note')} style={{ width: '100%', padding: 9 }} placeholder="ex : tarif habituel des motos" /></Field>
          </div>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!form.bothWays} onChange={(e) => setForm((f) => ({ ...f, bothWays: e.target.checked }))} /> Valable dans les deux sens</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn pri" disabled={save.isPending} onClick={() => { setMsg(null); save.mutate(form); }}>{save.isPending ? '…' : 'Enregistrer'}</button>
            <button className="btn" onClick={() => setForm(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead><tr><th>Départ</th><th>Arrivée</th><th>Prix client</th><th>Sens</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {routes.isLoading ? <tr><td colSpan={6}><Skeleton h={18} /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>Aucun trajet fixe : tous les prix sont calculés par zone et par distance.</td></tr>
              : rows.map((r) => (
                <tr key={r.id} style={{ opacity: r.isActive ? 1 : 0.5 }}>
                  <td><b>{r.fromCity}</b><div className="muted mono-sm">{r.fromPlace || 'toute la ville'}</div></td>
                  <td><b>{r.toCity}</b><div className="muted mono-sm">{r.toPlace || 'toute la ville'}</div></td>
                  <td><b>{xaf(r.priceXAF)}</b>{r.note ? <div className="muted mono-sm">{r.note}</div> : null}</td>
                  <td>{r.bothWays ? '↔ deux sens' : '→ un sens'}</td>
                  <td>{r.isActive ? 'Actif' : 'Inactif'}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn sm" onClick={() => { setMsg(null); setForm({ ...r, fromPlace: r.fromPlace || '', toPlace: r.toPlace || '', note: r.note || '', bothWays: !!r.bothWays, isActive: !!r.isActive }); }}>Modifier</button>{' '}
                    <button className="btn sm" onClick={() => toggle.mutate(r)}>{r.isActive ? 'Désactiver' : 'Activer'}</button>{' '}
                    <button className="btn sm" style={{ color: 'var(--danger)' }} onClick={() => window.confirm('Supprimer ce trajet fixe ?') && remove.mutate(r.id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
