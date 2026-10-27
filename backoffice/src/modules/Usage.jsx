import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const PERIODS = [[7, '7 jours'], [30, '30 jours'], [90, '90 jours']];
const TABS = [['overview', 'Vue d\'ensemble'], ['plan', 'Plan de marquage'], ['journey', 'Parcours d\'un utilisateur']];
const utc = (iso) => (iso ? new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR') : '—');
const hm = (iso) => (iso ? new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
const dur = (s) => `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
const n = (v) => Number(v || 0).toLocaleString('fr-FR');
const ROLE = { vendor: 'Vendeur', deliverer: 'Livreur' };

function Tile({ label, value, hint }) {
  return (
    <div className="card pad" style={{ minWidth: 150, flex: '1 1 150px' }}>
      <div className="k">{label}</div>
      <div style={{ fontWeight: 800, fontSize: 24, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint ? <div className="muted" style={{ fontSize: 12 }}>{hint}</div> : null}
    </div>
  );
}

/** Appareils actifs par jour. */
function DailyChart({ daily }) {
  const W = 720, H = 150, P = 26;
  const max = Math.max(1, ...daily.map((d) => d.devices));
  const bw = (W - P * 2) / daily.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Appareils actifs par jour" style={{ width: '100%', height: 'auto', maxHeight: 190 }}>
      <line x1={P} y1={H - 22} x2={W - P} y2={H - 22} stroke="var(--border)" />
      {daily.map((d, i) => {
        const h = Math.round((d.devices / max) * (H - 56));
        const x = P + i * bw + bw * 0.15;
        return (
          <g key={d.day}>
            <rect x={x} y={H - 22 - h} width={Math.max(2, bw * 0.7)} height={h} rx="2" fill="var(--green)"><title>{`${d.day} : ${d.devices} appareil(s), ${d.sessions} session(s), ${d.events} évènement(s)`}</title></rect>
            {d.devices > 0 && daily.length <= 31 ? <text x={x + bw * 0.35} y={H - 26 - h} textAnchor="middle" fontSize="10" fill="currentColor">{d.devices}</text> : null}
          </g>
        );
      })}
      <text x={P} y={H - 6} fontSize="10" fill="currentColor">{daily[0]?.day.slice(5)}</text>
      <text x={W - P} y={H - 6} fontSize="10" textAnchor="end" fill="currentColor">{daily[daily.length - 1]?.day.slice(5)}</text>
      <text x={P} y={12} fontSize="10" fill="currentColor">max {max}</text>
    </svg>
  );
}

function Funnel({ f }) {
  return (
    <div className="card pad" style={{ flex: '1 1 380px', minWidth: 0 }}>
      <div style={{ fontWeight: 800 }}>{f.label}</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Compté en {f.unit}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {f.steps.map((s, i) => (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
              <span>{s.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}><b>{n(s.count)}</b>{i > 0 && s.rate !== null ? <span className="muted"> · {s.rate} %</span> : null}</span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${s.rate === null ? 0 : Math.min(100, s.rate)}%`, height: '100%', background: i === 0 ? 'var(--muted)' : 'var(--green)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview({ days }) {
  const q = useQuery({ queryKey: ['usage-overview', days], queryFn: () => adminApi.usageOverview(days), refetchInterval: 60000 });
  if (q.isLoading) return <Skeleton h={120} />;
  if (q.isError) return <div className="card pad" style={{ color: 'var(--danger)' }}>{q.error?.response?.data?.error || q.error.message}</div>;
  const d = q.data;
  const t = d.totals;
  return (
    <>
      {t.events === 0 && (
        <div className="card pad" style={{ marginBottom: 14, background: '#FFF6E5' }}>
          Aucun évènement reçu sur cette période. Les données arrivent dès que les téléphones ont installé la version de l'application qui inclut le suivi d'usage.
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Tile label="Appareils actifs" value={n(t.devices)} hint="appareils distincts" />
        <Tile label="Sessions" value={n(t.sessions)} />
        <Tile label="Utilisateurs connectés" value={n(t.users)} hint="comptes distincts" />
        <Tile label="Durée moyenne" value={dur(t.avgSessionSeconds)} hint="d'une session" />
        <Tile label="Évènements" value={n(t.events)} hint={`${t.avgEventsPerSession} par session`} />
        <Tile label="Erreurs par session" value={t.errorsPerSession} hint={`${n(t.errors)} erreurs au total`} />
      </div>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Appareils actifs par jour</div>
        <DailyChart daily={d.daily} />
      </div>

      <h3 style={{ margin: '20px 0 10px' }}>Entonnoirs</h3>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Chaque barre est comparée à la première étape. Un entonnoir compte les appareils (ou les évènements pour une course) qui ont atteint l'étape sur la période, pas forcément dans l'ordre.</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {d.funnels.map((f) => <Funnel key={f.id} f={f} />)}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '2 1 360px', minWidth: 0, overflow: 'hidden' }}>
          <div className="scroll-x"><table className="tbl">
            <thead><tr><th>Écran le plus vu</th><th>Vues</th><th>Appareils</th></tr></thead>
            <tbody>{d.screens.length === 0 ? <tr><td colSpan={3} className="muted">Aucune donnée</td></tr> : d.screens.map((s) => <tr key={s.screen}><td><b>{s.screen}</b></td><td>{n(s.views)}</td><td>{n(s.devices)}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="tbl"><thead><tr><th>Version</th><th>Appareils</th></tr></thead>
              <tbody>{d.versions.length === 0 ? <tr><td colSpan={2} className="muted">Aucune donnée</td></tr> : d.versions.map((v) => <tr key={v.appVersion}><td><b>{v.appVersion}</b></td><td>{n(v.devices)}</td></tr>)}</tbody></table>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="tbl"><thead><tr><th>Rôle actif</th><th>Appareils</th></tr></thead>
              <tbody>{d.roles.length === 0 ? <tr><td colSpan={2} className="muted">Aucune donnée</td></tr> : d.roles.map((v) => <tr key={v.role}><td><b>{ROLE[v.role] || v.role}</b></td><td>{n(v.devices)}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, overflow: 'hidden' }}>
        <table className="tbl">
          <thead><tr><th>Appels en échec (route · code)</th><th>Fois</th></tr></thead>
          <tbody>{d.apiErrors.length === 0 ? <tr><td colSpan={2} className="muted">Aucune erreur d'appel sur la période</td></tr> : d.apiErrors.map((e) => <tr key={e.key}><td className="mono-sm">{e.key}</td><td>{n(e.count)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function csvOf(items) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Module', 'Écran', 'Événement', 'Source', 'Déclencheur', 'Paramètres', 'Reçus', 'Appareils ou comptes', 'Dernier reçu'];
  return '﻿' + [head.map(q).join(',')].concat(items.map((e) => [e.module, e.screen, e.name, e.source === 'server' ? 'Serveur' : 'Application', e.trigger, (e.params || []).join(', '), e.count, e.uniques, e.last || ''].map(q).join(','))).join('\n');
}

function Plan({ days }) {
  const q = useQuery({ queryKey: ['usage-events', days], queryFn: () => adminApi.usageEvents(days), refetchInterval: 60000 });
  const [module, setModule] = useState('ALL');
  const [only, setOnly] = useState('ALL');
  const [search, setSearch] = useState('');
  const items = q.data?.items ?? [];
  const modules = useMemo(() => ['ALL', ...Array.from(new Set(items.map((i) => i.module)))], [items]);
  const rows = items.filter((e) => (module === 'ALL' || e.module === module) && (only === 'ALL' || (only === 'MISSING' ? e.count === 0 : e.count > 0))
    && (!search || `${e.name} ${e.trigger} ${e.screen}`.toLowerCase().includes(search.toLowerCase())));
  const missing = items.filter((e) => e.count === 0).length;
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([csvOf(items)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'plan-de-marquage-koligo.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (q.isLoading) return <Skeleton h={120} />;
  return (
    <>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10, maxWidth: 780 }}>
        Le plan liste chaque évènement mesuré, ce qui le déclenche et ce qui a été reçu sur la période. Le serveur refuse tout évènement absent du plan. Un évènement « jamais reçu » est soit nouveau (version de l'application pas encore installée), soit une action que personne n'a faite, soit un défaut de mesure à vérifier.
      </div>
      <div className="toolbar" style={{ marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div className="chips">
          {modules.map((m) => <span key={m} className={`chip ${module === m ? 'on' : ''}`} onClick={() => setModule(m)}>{m === 'ALL' ? 'Tous les modules' : m}</span>)}
        </div>
        <div className="chips">
          {[['ALL', 'Tous'], ['MISSING', `Jamais reçus (${missing})`], ['SEEN', 'Reçus']].map(([k, l]) => <span key={k} className={`chip ${only === k ? 'on' : ''}`} onClick={() => setOnly(k)}>{l}</span>)}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un évènement" style={{ padding: 8, minWidth: 200 }} />
        <button className="btn sm" onClick={exportCsv}>Exporter en CSV</button>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="scroll-x" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Module</th><th>Écran</th><th>Évènement</th><th>Déclencheur</th><th>Paramètres</th><th>Reçus</th><th>Dernier</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.name} style={{ opacity: e.count === 0 ? 0.6 : 1 }}>
                  <td>{e.module}</td><td>{e.screen}</td>
                  <td><b className="mono-sm">{e.name}</b>{e.source === 'server' ? <span className="muted" style={{ fontSize: 11 }}> · serveur</span> : null}</td>
                  <td style={{ maxWidth: 360 }}>{e.trigger}</td>
                  <td className="mono-sm">{(e.params || []).join(', ') || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}><b>{n(e.count)}</b>{e.count ? <div className="muted" style={{ fontSize: 11 }}>{n(e.uniques)} distinct(s)</div> : null}</td>
                  <td className="mono-sm">{e.last ? utc(e.last) : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>Aucun évènement ne correspond.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ParamChips({ p }) {
  if (!p) return null;
  return <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{Object.entries(p).map(([k, v]) => <span key={k} className="mono-sm" style={{ background: 'var(--border)', borderRadius: 4, padding: '0 5px' }}>{k}={String(v)}</span>)}</span>;
}

function Journey() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const res = useQuery({ queryKey: ['usage-journey', q], queryFn: () => adminApi.usageJourney(q), enabled: q.length > 0, retry: false });
  const d = res.data;
  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setQ(input.trim()); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <input id="journey-q" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Numéro, e-mail, identifiant d'utilisateur, d'appareil ou de session" style={{ flex: '1 1 320px', padding: 10 }} />
        <button className="btn pri" type="submit" disabled={!input.trim()}>Voir le parcours</button>
      </form>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 12, maxWidth: 760 }}>
        Pour un utilisateur, le parcours réunit ses évènements connectés, ceux de ses appareils avant la connexion (écrans de l'inscription, par exemple) et ceux du serveur (paiement confirmé, livraison terminée). Les 400 derniers évènements sont affichés.
      </div>
      {res.isFetching && <Skeleton h={80} />}
      {res.isError && <div className="card pad" style={{ color: 'var(--danger)' }}>{res.error?.response?.data?.error || res.error.message}</div>}
      {d && (
        <>
          <div className="card pad" style={{ marginBottom: 12 }}>
            {d.user
              ? <div><b>{d.user.name}</b> · {d.user.phone}{d.user.email ? ` · ${d.user.email}` : ''}<div className="muted" style={{ fontSize: 12 }}>Rôle {ROLE[String(d.user.activeRole).toLowerCase()] || d.user.activeRole} · KYC {d.user.kycStatus} · inscrit le {utc(d.user.createdAt)} · {d.devices.length} appareil(s)</div></div>
              : <div><b>Appareil ou session</b> <span className="mono-sm">{q}</span><div className="muted" style={{ fontSize: 12 }}>Aucun compte rattaché à cette recherche.</div></div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{d.total} évènement(s) en {d.sessions.length} session(s){d.truncated ? ' (liste tronquée)' : ''}</div>
          </div>
          {d.sessions.map((s) => (
            <div key={s.id} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--border)', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <b>{s.id === 'serveur' ? 'Évènements du serveur' : 'Session'} <span className="mono-sm">{s.id === 'serveur' ? '' : s.id}</span></b>
                <span className="muted">{utc(s.start)} → {hm(s.end)} · {s.events.length} évènement(s)</span>
              </div>
              <div style={{ padding: '4px 14px 10px' }}>
                {s.events.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: i < s.events.length - 1 ? '1px dashed var(--border)' : 'none', fontSize: 13, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span className="mono-sm muted" style={{ minWidth: 64 }}>{hm(e.t)}</span>
                    <b className="mono-sm" style={{ color: /failed|error/.test(e.name) ? 'var(--danger)' : undefined }}>{e.name}</b>
                    {e.screen ? <span className="muted">{e.screen}</span> : null}
                    {e.source === 'server' ? <span className="muted" style={{ fontSize: 11 }}>serveur</span> : null}
                    <ParamChips p={e.params} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

export default function Usage() {
  const [tab, setTab] = useState('overview');
  const [days, setDays] = useState(7);
  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Suivi d'usage</h2>
          <div className="sub">
            Ce que les utilisateurs font dans l'application : écrans vus, actions, erreurs. Les données sont anonymes côté appareil (aucun numéro, code, PIN, e-mail ni nom n'est collecté) ; l'identité d'un compte n'apparaît que par son jeton de connexion. Chaque utilisateur peut tout désactiver dans les paramètres de l'application. Conservation : 90 jours.
          </div>
        </div>
      </div>
      <div className="toolbar" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="chips">{TABS.map(([k, l]) => <span key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</span>)}</div>
        {tab !== 'journey' && <div className="chips">{PERIODS.map(([d, l]) => <span key={d} className={`chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>{l}</span>)}</div>}
      </div>
      {tab === 'overview' && <Overview days={days} />}
      {tab === 'plan' && <Plan days={days} />}
      {tab === 'journey' && <Journey />}
    </section>
  );
}
