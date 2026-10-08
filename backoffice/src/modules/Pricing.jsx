import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const COEFS = { TEMPORAIRE: 1, PERMANENT: 1.15, EXPRESS: 1.25, VVIP: 1.4 };
const VEHICLE_LABELS = { MOTO: 'Moto', TRICYCLE: 'Tricycle', VOITURE: 'Voiture', UTILITAIRE: 'Utilitaire' };
const GABARIT_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const num = (v) => (v === '' || v === null || Number.isNaN(Number(v)) ? '' : Number(v));

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{hint}</div>}
    </label>
  );
}

export default function Pricing() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-pricing'], queryFn: adminApi.pricing, retry: false });
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [sim, setSim] = useState({ zone: '', km: 6, size: 'S', type: 'TEMPORAIRE' });

  useEffect(() => {
    if (!data) return;
    setForm({
      zones: JSON.parse(JSON.stringify(data.zones)),
      gabarits: JSON.parse(JSON.stringify(data.gabarits)),
      defaultZone: data.defaultZone,
      minPriceXAF: data.minPriceXAF,
      weightRateXAF: data.weightRateXAF,
      commissionPct: Math.round(data.commissionRate * 1000) / 10,
      cancelFeeXAF: data.cancelFeeXAF,
      revisionTimeoutMin: data.revisionTimeoutMin,
      cancelGraceMin: data.cancelGraceMin,
      strikeThreshold: data.strikeThreshold,
      strikeWindowDays: data.strikeWindowDays,
    });
    setSim((s) => ({ ...s, zone: s.zone || data.zones[0]?.name || '' }));
  }, [data]);

  const save = useMutation({
    mutationFn: (f) => adminApi.updatePricing({
      zones: f.zones, defaultZone: f.defaultZone, gabarits: f.gabarits,
      minPriceXAF: f.minPriceXAF, weightRateXAF: f.weightRateXAF, commissionRate: Number(f.commissionPct) / 100,
      cancelFeeXAF: f.cancelFeeXAF, revisionTimeoutMin: f.revisionTimeoutMin, cancelGraceMin: f.cancelGraceMin,
      strikeThreshold: f.strikeThreshold, strikeWindowDays: f.strikeWindowDays,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pricing'] }); setMsg({ ok: true, text: 'Tarifs enregistrés. Ils s\'appliquent aux nouvelles livraisons ; les livraisons et factures existantes ne changent pas.' }); },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });

  if (isLoading || !form) return <section className="content">{error ? <div className="card pad" style={{ color: '#C00' }}>Impossible de charger les tarifs.</div> : <Skeleton h={300} />}</section>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setZone = (i, patch) => setForm((f) => ({ ...f, zones: f.zones.map((z, j) => (j === i ? { ...z, ...patch } : z)) }));
  const toggleRegion = (i, region) => setForm((f) => ({
    ...f,
    zones: f.zones.map((z, j) => {
      if (j === i) return { ...z, regions: z.regions.includes(region) ? z.regions.filter((r) => r !== region) : [...z.regions, region] };
      return { ...z, regions: z.regions.filter((r) => r !== region) }; // une région n'est que dans une zone
    }),
  }));
  const setGab = (code, patch) => setForm((f) => ({ ...f, gabarits: { ...f.gabarits, [code]: { ...f.gabarits[code], ...patch } } }));
  const setGabEx = (code, lang, v) => setGab(code, { examples: { ...(form.gabarits[code].examples || {}), [lang]: v } });

  // Aperçu : même formule que le serveur (le serveur reste la seule source du prix réel).
  const zone = form.zones.find((z) => z.name === sim.zone) || form.zones[0];
  const g = form.gabarits[sim.size];
  const preview = zone && g && g.bookable && g.refKg
    ? Math.max(Number(form.minPriceXAF), Math.round((Number(zone.base) + Number(sim.km) * Number(zone.perKm) + Number(form.weightRateXAF) * Number(g.refKg)) * COEFS[sim.type]))
    : null;

  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Tarification</h2>
          <div className="sub">Prix = (prise en charge + prix/km × distance + {form.weightRateXAF} F × poids de référence du gabarit) × coefficient du livreur, avec un minimum.</div>
        </div>
        <button className="btn pri" disabled={save.isPending} onClick={() => { setMsg(null); save.mutate(form); }}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.ok ? '#EAF7EE' : '#FEE', color: msg.ok ? '#178A3C' : '#C00', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{msg.text}</div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr', maxWidth: 1040 }}>
        {/* Zones */}
        <div className="card pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Zones tarifaires</h3>
            <button className="btn sm" onClick={() => setForm((f) => ({ ...f, zones: [...f.zones, { name: 'Nouvelle zone', regions: [], base: 400, perKm: 150 }] }))}>+ Ajouter une zone</button>
          </div>
          {form.zones.map((z, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--line, #eee)', marginTop: 14, paddingTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                <Field label="Nom"><input value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} /></Field>
                <Field label="Prise en charge (XAF)"><input type="number" min="0" value={z.base} onChange={(e) => setZone(i, { base: num(e.target.value) })} /></Field>
                <Field label="Prix au km (XAF)"><input type="number" min="0" value={z.perKm} onChange={(e) => setZone(i, { perKm: num(e.target.value) })} /></Field>
                <button className="btn sm" style={{ marginBottom: 10 }} disabled={form.zones.length <= 1} onClick={() => setForm((f) => ({ ...f, zones: f.zones.filter((_, j) => j !== i), defaultZone: f.defaultZone === z.name ? f.zones.find((_, j) => j !== i)?.name : f.defaultZone }))}>Supprimer</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.regions.map((r) => {
                  const on = z.regions.includes(r);
                  return (
                    <span key={r} className={`chip ${on ? 'on' : ''}`} onClick={() => toggleRegion(i, r)} style={{ cursor: 'pointer' }}>{r}</span>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, maxWidth: 320 }}>
            <Field label="Zone de repli" hint="Appliquée si la région d'une livraison n'appartient à aucune zone.">
              <select value={form.defaultZone} onChange={(e) => set('defaultZone', e.target.value)}>
                {form.zones.map((z) => <option key={z.name}>{z.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Gabarits */}
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Gabarits</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Le poids de référence fixe la part « poids » du prix. Le véhicule est le minimum requis pour accepter ce gabarit. Un gabarit non réservable se fait sur devis.
          </div>
          {GABARIT_ORDER.map((code) => {
            const x = form.gabarits[code];
            return (
              <div key={code} style={{ borderTop: '1px solid var(--line, #eee)', paddingTop: 12, marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '50px 1.4fr 1fr 1fr 1.2fr auto', gap: 10, alignItems: 'end' }}>
                  <div style={{ fontWeight: 800, fontSize: 18, paddingBottom: 12 }}>{code}</div>
                  <Field label="Dimensions max (cm)"><input value={x.dims || ''} disabled={!x.bookable} onChange={(e) => setGab(code, { dims: e.target.value })} /></Field>
                  <Field label="Poids max (kg)"><input type="number" min="0" step="0.1" disabled={!x.bookable} value={x.maxKg ?? ''} onChange={(e) => setGab(code, { maxKg: num(e.target.value) })} /></Field>
                  <Field label="Poids de référence (kg)"><input type="number" min="0" step="0.1" disabled={!x.bookable} value={x.refKg ?? ''} onChange={(e) => setGab(code, { refKg: num(e.target.value) })} /></Field>
                  <Field label="Véhicule minimum">
                    <select value={x.vehicle} onChange={(e) => setGab(code, { vehicle: e.target.value })}>
                      {data.vehicles.map((v) => <option key={v} value={v}>{VEHICLE_LABELS[v] || v}</option>)}
                    </select>
                  </Field>
                  <label style={{ fontSize: 12, paddingBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={!!x.bookable} onChange={(e) => setGab(code, { bookable: e.target.checked, ...(e.target.checked ? { maxKg: x.maxKg ?? 1, refKg: x.refKg ?? 1 } : {}) })} /> Réservable
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Exemples (français)"><input value={x.examples?.fr || ''} onChange={(e) => setGabEx(code, 'fr', e.target.value)} /></Field>
                  <Field label="Exemples (anglais)"><input value={x.examples?.en || ''} onChange={(e) => setGabEx(code, 'en', e.target.value)} /></Field>
                </div>
              </div>
            );
          })}
        </div>

        {/* Frais et règles */}
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Frais et règles</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <Field label="Prix minimum d'une course (XAF)"><input type="number" min="0" value={form.minPriceXAF} onChange={(e) => set('minPriceXAF', num(e.target.value))} /></Field>
            <Field label="Prix du poids (XAF par kg de référence)"><input type="number" min="0" value={form.weightRateXAF} onChange={(e) => set('weightRateXAF', num(e.target.value))} /></Field>
            <Field label="Commission KoliGo (%)"><input type="number" min="0" max="50" step="0.1" value={form.commissionPct} onChange={(e) => set('commissionPct', e.target.value)} /></Field>
            <Field label="Frais d'annulation (XAF)" hint="Dus au livreur quand le vendeur refuse le prix révisé. Affichés dans l'app et les CGU."><input type="number" min="0" value={form.cancelFeeXAF} onChange={(e) => set('cancelFeeXAF', num(e.target.value))} /></Field>
            <Field label="Délai de réponse du vendeur (min)" hint="Sans réponse : course annulée sans frais."><input type="number" min="1" value={form.revisionTimeoutMin} onChange={(e) => set('revisionTimeoutMin', num(e.target.value))} /></Field>
            <Field label="Annulation gratuite après acceptation (min)" hint="Au-delà, les frais d'annulation s'appliquent."><input type="number" min="0" value={form.cancelGraceMin} onChange={(e) => set('cancelGraceMin', num(e.target.value))} /></Field>
            <Field label="Écarts avant contrôle renforcé"><input type="number" min="1" value={form.strikeThreshold} onChange={(e) => set('strikeThreshold', num(e.target.value))} /></Field>
            <Field label="Fenêtre de calcul des écarts (jours)"><input type="number" min="1" value={form.strikeWindowDays} onChange={(e) => set('strikeWindowDays', num(e.target.value))} /></Field>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Ces montants et délais sont repris automatiquement dans le texte des CGU (jetons {'{{cancel_fee}}'}, {'{{revision_timeout}}'}…).</div>
        </div>

        {/* Simulateur */}
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Simulateur</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 12, alignItems: 'end' }}>
            <Field label="Zone"><select value={sim.zone} onChange={(e) => setSim({ ...sim, zone: e.target.value })}>{form.zones.map((z) => <option key={z.name}>{z.name}</option>)}</select></Field>
            <Field label="Distance (km)"><input type="number" min="0" step="0.5" value={sim.km} onChange={(e) => setSim({ ...sim, km: num(e.target.value) })} /></Field>
            <Field label="Gabarit"><select value={sim.size} onChange={(e) => setSim({ ...sim, size: e.target.value })}>{GABARIT_ORDER.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Livreur"><select value={sim.type} onChange={(e) => setSim({ ...sim, type: e.target.value })}>{Object.keys(COEFS).map((c) => <option key={c}>{c}</option>)}</select></Field>
            <div style={{ fontWeight: 800, fontSize: 22, paddingBottom: 10 }}>{preview != null ? `${preview.toLocaleString('fr-FR')} XAF` : 'Sur devis'}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Aperçu avec les valeurs saisies, avant enregistrement.</div>
        </div>
      </div>
    </section>
  );
}
