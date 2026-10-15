import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const FILTERS = [
  { key: '', label: 'Toutes' },
  { key: 'REVIEW', label: 'À examiner' },
  { key: 'APPROVE', label: 'Validées' },
  { key: 'REJECT', label: 'Refusées' },
  { key: 'FAILED', label: 'En échec' },
];
const DEC = { APPROVE: ['Validé', '#0A7A3E'], REJECT: ['Refusé', '#B42318'], REVIEW: ['À examiner', '#C4611A'] };
const MODES = [
  { key: 'AUTO', label: 'Automatique', hint: 'Le système valide ou refuse les dossiers sans doute ; les cas douteux restent pour vous.' },
  { key: 'SUGGEST', label: 'Recommandation seule', hint: 'Le système analyse et recommande, vous décidez toujours.' },
  { key: 'OFF', label: 'Désactivée', hint: 'Aucune vérification automatique.' },
];
const utc = (iso) => (iso ? new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR') : '—');
const mark = (f) => (f.ok === true ? '✓' : f.ok === false ? '✗' : '–');
const markColor = (f) => (f.ok === true ? '#0A7A3E' : f.ok === false ? (f.severity === 'FRAUD' ? '#B42318' : '#C4611A') : '#667085');

/** Détail d'une vérification : chaque contrôle, son résultat et sa valeur mesurée. */
export function CheckFindings({ check }) {
  return (
    <div style={{ display: 'grid', gap: 3, fontSize: 12.5 }}>
      {(check.findings || []).map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: markColor(f), fontWeight: 800, width: 14 }}>{mark(f)}</span>
          <span><b style={{ fontWeight: f.ok === false ? 700 : 400 }}>{f.label}</b>{f.detail ? <span className="muted"> — {f.detail}</span> : null}</span>
        </div>
      ))}
    </div>
  );
}

export function DecisionPill({ check }) {
  if (check.status === 'FAILED') return <span style={{ color: '#B42318', fontWeight: 700, fontSize: 12 }}>Échec technique</span>;
  if (check.status !== 'DONE') return <span className="muted" style={{ fontSize: 12 }}>En cours…</span>;
  const [label, color] = DEC[check.decision] || ['—', '#667085'];
  return <span style={{ color, fontWeight: 800, fontSize: 12 }}>{label}{check.applied ? ' · appliqué' : check.decision === 'REVIEW' ? '' : ' · non appliqué'}</span>;
}

export default function KycChecks() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('REVIEW');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState(null);

  const params = { decision: ['APPROVE', 'REJECT', 'REVIEW'].includes(filter) ? filter : undefined, status: filter === 'FAILED' ? 'FAILED' : undefined, page };
  const { data, isLoading } = useQuery({ queryKey: ['admin-kyc-checks', filter, page], queryFn: () => adminApi.kycChecks(params), placeholderData: (p) => p, refetchInterval: 20000 });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-kyc-checks'] }); qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-user'] }); };
  const rerun = useMutation({
    mutationFn: (userId) => adminApi.kycRerun(userId),
    onSuccess: (r) => { refresh(); setMsg({ ok: true, text: `Vérification relancée pour ${r.userName} : ${(DEC[r.decision] || ['résultat indisponible'])[0].toLowerCase()}.` }); },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  const reopen = useMutation({
    mutationFn: (userId) => adminApi.kycReopen(userId),
    onSuccess: (r) => { refresh(); setMsg({ ok: true, text: `Dossier de ${r.userName} remis en attente et reverifié : ${(DEC[r.decision] || ['résultat indisponible'])[0].toLowerCase()}.` }); },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  const setMode = useMutation({
    mutationFn: (key) => adminApi.updateSetting('kyc_auto_mode', key),
    onSuccess: () => { refresh(); setMsg({ ok: true, text: 'Mode enregistré : il s\'applique aux prochaines vérifications.' }); },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });

  const rows = data?.items ?? [];
  const st = data?.stats;
  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Vérifications KYC automatiques</h2>
          <div className="sub">
            Le système analyse chaque dossier envoyé (photos lisibles, nettes, bien éclairées, jamais utilisées par un autre compte, numéro de CNI plausible et unique).
            Il ne lit pas la CNI et <b>ne compare pas le visage</b> du selfie avec celui de la CNI : en cas de doute, ouvrez les photos dans « Sécurité &amp; KYC ».
          </div>
        </div>
      </div>

      {data && !data.gd && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: '#FFF4EE', color: '#8A3B10', fontSize: 13 }}>L'analyse d'image (extension GD) n'est pas disponible sur ce serveur : les dossiers sont envoyés à l'examen humain.</div>}
      {msg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 13, background: msg.ok ? '#EFF8F1' : '#FDECEC', color: msg.ok ? '#0A5C2F' : '#C00' }}>{msg.text}</div>}

      <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 8 }}>
        <div className="k">Mode de décision</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MODES.map((m) => (
            <button key={m.key} className={`btn sm ${data?.mode === m.key ? 'pri' : ''}`} disabled={setMode.isPending} onClick={() => data?.mode !== m.key && setMode.mutate(m.key)}>{m.label}</button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{(MODES.find((m) => m.key === data?.mode) || MODES[0]).hint}</div>
      </div>

      {st && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          {[['À examiner', st.review], ['Validées par le système', st.autoApproved], ['Refusées par le système', st.autoRejected], ['En file', st.queued], ['En échec', st.failed]].map(([k, v]) => (
            <div key={k} className="card pad" style={{ minWidth: 130 }}><div className="k">{k}</div><div style={{ fontWeight: 800, fontSize: 20 }}>{v}</div></div>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((f) => <span key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`} onClick={() => { setFilter(f.key); setPage(1); setMsg(null); }}>{f.label}</span>)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {isLoading ? <div className="card pad"><Skeleton h={60} /></div>
          : rows.length === 0 ? <div className="card pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>Aucune vérification pour ce filtre.</div>
          : rows.map((c) => (
            <div key={c.id} className="card pad" style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 15 }}>{c.userName || c.userId}</b>
                <span className="muted mono-sm">{c.userPhone}</span>
                <DecisionPill check={c} />
                {c.score != null && <span className="muted" style={{ fontSize: 12 }}>score {c.score}/100</span>}
                <span className="muted mono-sm" style={{ marginLeft: 'auto' }}>{utc(c.createdAt)} · {c.triggeredBy} · mode {c.mode}</span>
              </div>
              {c.reason && <div style={{ fontSize: 13, color: c.decision === 'REJECT' ? '#B42318' : '#8A3B10' }}>{c.reason}</div>}
              {c.error && <div style={{ fontSize: 12, color: '#B42318' }}>Erreur : {c.error}</div>}
              {openId === c.id && <CheckFindings check={c} />}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => setOpenId(openId === c.id ? null : c.id)}>{openId === c.id ? 'Masquer le détail' : 'Voir le détail'}</button>
                <span style={{ flex: 1 }} />
                <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>Dossier : {c.kycStatus}</span>
                <button className="btn sm" disabled={rerun.isPending || reopen.isPending} onClick={() => { setMsg(null); rerun.mutate(c.userId); }}>Relancer la vérification</button>
                {['VERIFIED', 'REJECTED'].includes(c.kycStatus) && (
                  <button className="btn sm" style={{ color: 'var(--danger)', borderColor: '#F0C9B6' }} disabled={rerun.isPending || reopen.isPending}
                    onClick={() => window.confirm(`Remettre le dossier de ${c.userName} en attente et le reverifier ? ${c.kycStatus === 'VERIFIED' ? 'Si le résultat n\'est pas « validé », la personne ne pourra plus publier ni livrer en attendant.' : ''}`) && (setMsg(null), reopen.mutate(c.userId))}>Remettre en attente</button>
                )}
              </div>
            </div>
          ))}
      </div>
      {data && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span style={{ padding: '7px 12px', fontSize: 12, color: 'var(--muted)' }}>Page {page} · {data.total} vérification(s)</span>
          <button className="btn sm" disabled={rows.length < 25} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </section>
  );
}
