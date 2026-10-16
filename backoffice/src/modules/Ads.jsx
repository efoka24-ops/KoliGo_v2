import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import api, { adminApi } from '../api.js';

const FILTERS = [
  { key: 'SUSPENDUE', label: 'À vérifier' },
  { key: 'REPORTED', label: 'Signalées' },
  { key: 'ACTIVE', label: 'En ligne' },
  { key: 'EXPIREE', label: 'Expirées' },
  { key: 'SUPPRIMEE', label: 'Retirées' },
  { key: 'ALL', label: 'Toutes' },
];
const STATUS_LABEL = { BROUILLON: 'Brouillon (Boost non payé)', ACTIVE: 'En ligne', EXPIREE: 'Expirée', SUSPENDUE: 'À vérifier / suspendue', SUPPRIMEE: 'Retirée' };
const STATUS_COLOR = { BROUILLON: '#667085', ACTIVE: '#0A7A3E', EXPIREE: '#667085', SUSPENDUE: '#C4611A', SUPPRIMEE: '#B42318' };
const xaf = (n) => `${Number(n || 0).toLocaleString('fr-FR')} F`;
const utc = (iso) => (iso ? new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR') : '—');

function left(sec) {
  if (!sec || sec <= 0) return 'expirée';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d} j ${h} h` : `${h} h ${Math.floor((sec % 3600) / 60)} min`;
}

/** Photo d'annonce : chargée avec l'authentification de l'administrateur (voit aussi les annonces non publiques). */
function AdThumb({ id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url = null;
    api.get(`/public/ads/${id}/photo/0`, { responseType: 'blob' }).then((r) => { url = URL.createObjectURL(r.data); setSrc(url); }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return src
    ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} /></a>
    : <div style={{ width: 88, height: 88, borderRadius: 10, background: 'var(--cream)' }} />;
}

/** Paiements Boost récents : permet de revérifier auprès de Sungku un paiement qui tarde à être confirmé. */
function PaymentsPanel() {
  const qc = useQueryClient();
  const [res, setRes] = useState({});
  const list = useQuery({ queryKey: ['admin-ad-payments'], queryFn: adminApi.adPayments, refetchInterval: 15000 });
  const check = useMutation({
    mutationFn: (id) => adminApi.checkAdPayment(id),
    onSuccess: (r, id) => { setRes((m) => ({ ...m, [id]: r.message })); qc.invalidateQueries({ queryKey: ['admin-ad-payments'] }); qc.invalidateQueries({ queryKey: ['admin-ads'] }); },
    onError: (e, id) => setRes((m) => ({ ...m, [id]: e.response?.data?.error || e.message })),
  });
  const rows = list.data?.items ?? [];
  const wh = list.data?.lastWebhook;
  const gw = list.data?.gateway;
  const COLOR = { PENDING: '#C4611A', SUCCESS: '#0A7A3E', FAILED: '#B42318' };
  const LABEL = { PENDING: 'En attente', SUCCESS: 'Payé', FAILED: 'Échoué' };
  return (
    <div className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
      {gw && (
        <div style={{ padding: '8px 14px', fontSize: 12.5, background: gw.apiKey && gw.webhookSecret && !gw.mock ? '#F4F7F5' : '#FDECEC' }}>
          Passerelle <b>{gw.host}</b> · clé API : <b>{gw.apiKey ? 'configurée' : 'ABSENTE'}</b> · secret de signature des confirmations : <b>{gw.webhookSecret ? 'configuré' : 'ABSENT (toutes les confirmations seront refusées)'}</b>{gw.mock ? ' · MODE TEST ACTIF' : ''}
        </div>
      )}
      <div style={{ padding: '10px 14px', fontSize: 13, background: wh ? (wh.ok ? '#EFF8F1' : '#FDECEC') : '#FFF6E5' }}>
        {wh
          ? <>Dernier appel reçu de Sungku : <b>{utc(wh.at)}</b> — {wh.ok ? 'accepté' : 'REFUSÉ'} <span className="muted mono-sm">{wh.detail}</span></>
          : <>Aucun appel de confirmation reçu de Sungku depuis la mise en place de ce suivi : vérifiez que l'adresse <b>/api/payment/webhook/sungku</b> est bien enregistrée chez Sungku.</>}
      </div>
      <table className="tbl">
        <thead><tr><th>Date</th><th>Annonce</th><th>Payeur</th><th>Montant</th><th>Statut</th><th /></tr></thead>
        <tbody>
          {list.isLoading ? <tr><td colSpan={6}><Skeleton h={18} /></td></tr>
            : rows.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 22 }}>Aucun paiement Boost.</td></tr>
            : rows.map((p) => (
              <tr key={p.id}>
                <td>{utc(p.createdAt)}</td>
                <td><b>{p.title || '—'}</b><div className="muted mono-sm">{p.vendorName || ''} · {p.type} {p.durationHours ? Math.round(p.durationHours / 24) + ' j' : ''} · annonce {STATUS_LABEL[p.adStatus] || p.adStatus || '—'}</div></td>
                <td>{p.phone}<div className="muted mono-sm">{p.externalRef}</div></td>
                <td>{xaf(p.amountXAF)}</td>
                <td><b style={{ color: COLOR[p.status] }}>{LABEL[p.status] || p.status}</b>{res[p.id] ? <div className="muted mono-sm" style={{ maxWidth: 260 }}>{res[p.id]}</div> : null}{p.gatewayInfo ? <div className="muted mono-sm" style={{ maxWidth: 320, wordBreak: 'break-all' }}>Sungku : {p.gatewayInfo}</div> : null}</td>
                <td style={{ textAlign: 'right' }}>{p.status === 'PENDING' && <button className="btn sm" disabled={check.isPending} onClick={() => check.mutate(p.id)}>Revérifier chez Sungku</button>}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigPanel() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ['admin-ads-config'], queryFn: adminApi.adsConfig });
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (cfg.data) setForm({ tariffs: cfg.data.tariffs.map((t) => ({ ...t })), flashPerDay: cfg.data.flashPerDay, maxActive: cfg.data.maxActive }); }, [cfg.data]);
  const save = useMutation({
    mutationFn: (f) => adminApi.saveAdsConfig({ tariffs: f.tariffs.map((t) => ({ days: Number(t.days), priceXAF: Number(t.priceXAF) })), flashPerDay: Number(f.flashPerDay), maxActive: Number(f.maxActive) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-ads-config'] }); setMsg({ ok: true, text: 'Tarifs enregistrés : ils s\'appliquent aux nouvelles annonces.' }); },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  if (!form) return null;
  const setT = (i, k, v) => setForm((f) => ({ ...f, tariffs: f.tariffs.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  return (
    <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 10, maxWidth: 640 }}>
      <div style={{ fontWeight: 800 }}>Tarifs Boost et limites</div>
      <div className="muted" style={{ fontSize: 12 }}>Le Flash (24 h) est toujours gratuit. Un Boost n'est pas remboursable (CGU art. 12).</div>
      {form.tariffs.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" min="1" value={t.days} onChange={(e) => setT(i, 'days', e.target.value)} style={{ width: 90, padding: 8 }} /> jours
          <input type="number" min="0" value={t.priceXAF} onChange={(e) => setT(i, 'priceXAF', e.target.value)} style={{ width: 120, padding: 8 }} /> F
          <button className="btn sm" onClick={() => setForm((f) => ({ ...f, tariffs: f.tariffs.filter((_, j) => j !== i) }))}>✕</button>
        </div>
      ))}
      <div><button className="btn sm" onClick={() => setForm((f) => ({ ...f, tariffs: [...f.tariffs, { days: '', priceXAF: '' }] }))}>+ Palier</button></div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13 }}>Flash gratuits par vendeur et par jour <input type="number" min="1" value={form.flashPerDay} onChange={(e) => setForm((f) => ({ ...f, flashPerDay: e.target.value }))} style={{ width: 70, padding: 6, marginLeft: 6 }} /></label>
        <label style={{ fontSize: 13 }}>Annonces actives max par vendeur <input type="number" min="1" value={form.maxActive} onChange={(e) => setForm((f) => ({ ...f, maxActive: e.target.value }))} style={{ width: 70, padding: 6, marginLeft: 6 }} /></label>
      </div>
      {msg && <div style={{ color: msg.ok ? '#0A5C2F' : '#C00', fontSize: 13 }}>{msg.text}</div>}
      <div><button className="btn pri" disabled={save.isPending} onClick={() => { setMsg(null); save.mutate(form); }}>Enregistrer</button></div>
    </div>
  );
}

export default function Ads() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('SUSPENDUE');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCfg, setShowCfg] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [msg, setMsg] = useState(null);

  const params = { status: ['ALL', 'REPORTED'].includes(filter) ? undefined : filter, reported: filter === 'REPORTED' ? 1 : undefined, q: search || undefined, page };
  const { data, isLoading } = useQuery({ queryKey: ['admin-ads', filter, search, page], queryFn: () => adminApi.ads(params), placeholderData: (p) => p, refetchInterval: 30000 });

  const decide = useMutation({
    mutationFn: ({ id, action, reason }) => adminApi.decideAd(id, action, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-ads'] }); setMsg({ ok: true, text: 'Décision enregistrée : le vendeur est prévenu.' }); },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  const act = (ad, action) => {
    let reason = '';
    if (action !== 'restore') {
      reason = window.prompt(action === 'remove' ? 'Motif du retrait (visible par le vendeur) :' : 'Motif de la suspension (visible par le vendeur) :') || '';
      if (!reason.trim()) return;
    } else if (!window.confirm(`Valider l'annonce « ${ad.title} » ? Elle sera mise en ligne.`)) return;
    setMsg(null);
    decide.mutate({ id: ad.id, action, reason });
  };

  const rows = data?.items ?? [];
  const st = data?.stats;
  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Annonces</h2>
          <div className="sub">Annonces Flash (24 h gratuites) et Boost (payantes). Une annonce qui contient un mot surveillé est mise en attente de votre validation.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowPay((v) => !v)}>Paiements Boost</button>
          <button className="btn" onClick={() => setShowCfg((v) => !v)}>Tarifs et limites</button>
        </div>
      </div>

      {st && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          {[['En ligne', st.active], ['À vérifier', st.pending], ['Signalées', st.reported], ['Revenus Boost', xaf(st.boostRevenueXAF)]].map(([k, v]) => (
            <div key={k} className="card pad" style={{ minWidth: 140 }}><div className="k">{k}</div><div style={{ fontWeight: 800, fontSize: 20 }}>{v}</div></div>
          ))}
        </div>
      )}
      {showPay && <PaymentsPanel />}
      {showCfg && <ConfigPanel />}
      {msg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 13, background: msg.ok ? '#EFF8F1' : '#FDECEC', color: msg.ok ? '#0A5C2F' : '#C00' }}>{msg.text}</div>}

      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((f) => <span key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`} onClick={() => { setFilter(f.key); setPage(1); setMsg(null); }}>{f.label}</span>)}
        </div>
        <div style={{ flex: 1 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setSearch(q.trim()), setPage(1))} placeholder="Titre, ville ou vendeur…" style={{ padding: 8, minWidth: 220 }} />
        <button className="btn sm" onClick={() => { setSearch(q.trim()); setPage(1); }}>Chercher</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {isLoading ? <div className="card pad"><Skeleton h={60} /></div>
          : rows.length === 0 ? <div className="card pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>Aucune annonce pour ce filtre.</div>
          : rows.map((a) => (
            <div key={a.id} className="card pad" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {a.photoCount > 0 ? <AdThumb id={a.id} /> : null}
              <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15 }}>{a.title}</b>
                  <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[a.status] }}>{STATUS_LABEL[a.status] || a.status}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: a.type === 'BOOST' ? '#FFF1D6' : '#EEF2F6' }}>{a.type === 'BOOST' ? `Boost ${Math.round(a.durationHours / 24)} j` : 'Flash 24 h'}</span>
                </div>
                <div style={{ fontSize: 13 }}>{xaf(a.priceXAF)} · {a.city}{a.quartier ? `, ${a.quartier}` : ''} · {a.vendorName || '—'} <span className="muted mono-sm">{a.vendorPhone}</span></div>
                <div className="muted" style={{ fontSize: 12 }}>{a.description.length > 160 ? `${a.description.slice(0, 160)}…` : a.description}</div>
                <div className="muted mono-sm">Créée {utc(a.createdAt)} · {a.live ? `reste ${left(Math.max(0, Math.round((new Date(String(a.expiresAt).replace(' ', 'T') + 'Z') - Date.now()) / 1000)))}` : `expire ${utc(a.expiresAt)}`} · {a.views} vues · {a.contacts} contacts</div>
                {a.suspendReason && <div style={{ color: '#C4611A', fontSize: 12 }}>⚠ {a.suspendReason}</div>}
                {a.removeReason && <div className="muted" style={{ fontSize: 12 }}>Retrait : {a.removeReason}</div>}
                {a.reportList?.length > 0 && <div style={{ fontSize: 12, background: '#FFF4EE', padding: 8, borderRadius: 8 }}><b>{a.reports} signalement(s)</b> : {a.reportList.map((r) => r.reason).join(' · ')}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'stretch' }}>
                {a.status === 'SUSPENDUE' && <button className="btn sm pri" disabled={decide.isPending} onClick={() => act(a, 'restore')}>Valider</button>}
                {['ACTIVE', 'BROUILLON'].includes(a.status) && <button className="btn sm" disabled={decide.isPending} onClick={() => act(a, 'suspend')}>Suspendre</button>}
                {a.status !== 'SUPPRIMEE' && <button className="btn sm" style={{ color: 'var(--danger)', borderColor: '#F0C9B6' }} disabled={decide.isPending} onClick={() => act(a, 'remove')}>Retirer</button>}
              </div>
            </div>
          ))}
      </div>
      {data && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span style={{ padding: '7px 12px', fontSize: 12, color: 'var(--muted)' }}>Page {page} · {data.total} annonce(s)</span>
          <button className="btn sm" disabled={rows.length < 25} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </section>
  );
}
