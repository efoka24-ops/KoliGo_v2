import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import api, { adminApi } from '../api.js';

const FILTERS = [
  { key: 'OPEN', label: 'À traiter' },
  { key: 'APPEAL', label: 'Avec recours' },
  { key: 'CONFIRMED', label: 'Confirmés' },
  { key: 'CLEARED', label: 'Annulés' },
  { key: 'ALL', label: 'Tous' },
];
const STATUS_LABEL = { OPEN: 'À traiter', CONFIRMED: 'Confirmé', CLEARED: 'Annulé', EXPIRED: 'Sans suite' };
const STATUS_COLOR = { OPEN: '#C4611A', CONFIRMED: '#B42318', CLEARED: '#667085', EXPIRED: '#667085' };
const utc = (iso) => new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR');

/** Photo jointe par le livreur : elle exige l'authentification, on la charge puis on l'affiche via une URL locale. */
function IncidentPhoto({ id }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let url = null;
    api.get(`/admin/incidents/${id}/photo`, { responseType: 'blob' })
      .then((r) => { url = URL.createObjectURL(r.data); setSrc(url); })
      .catch(() => setErr(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  if (err) return <div className="muted" style={{ fontSize: 12 }}>Photo indisponible</div>;
  if (!src) return <div className="muted" style={{ fontSize: 12 }}>Chargement de la photo…</div>;
  return <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo du livreur" style={{ height: 90, borderRadius: 8, border: '1px solid var(--border)' }} /></a>;
}

export default function Incidents() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState(null);

  const params = { status: filter === 'APPEAL' ? 'ALL' : filter, appeal: filter === 'APPEAL' ? 1 : undefined, page };
  const { data, isLoading } = useQuery({
    queryKey: ['admin-incidents', filter, page],
    queryFn: () => adminApi.incidents(params),
    placeholderData: (p) => p,
    refetchInterval: 30000,
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-incidents'] }); qc.invalidateQueries({ queryKey: ['admin-users'] }); };
  const decide = useMutation({
    mutationFn: ({ id, action, note }) => adminApi.decideIncident(id, action, note),
    onSuccess: (r) => {
      refresh();
      setMsg({ ok: true, text: r.canUnsuspend ? 'Incident annulé. Le compte du vendeur est toujours suspendu : levez la suspension si le recours est accepté.' : 'Décision enregistrée.' });
    },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  const unsuspend = useMutation({
    mutationFn: (userId) => adminApi.unsuspendUser(userId),
    onSuccess: () => { refresh(); setMsg({ ok: true, text: 'Suspension levée : le vendeur peut de nouveau publier.' }); },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });

  const act = (i, action) => {
    const verb = action === 'confirm' ? 'Confirmer cet incident ? Il comptera dans le compteur du vendeur' : 'Annuler cet incident ? Il ne comptera plus';
    if (!window.confirm(`${verb} (${i.vendorName}).`)) return;
    const note = window.prompt('Note interne / message au vendeur (facultatif) :') || '';
    setMsg(null);
    decide.mutate({ id: i.id, action, note });
  };

  const rows = data?.items ?? [];
  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Incidents de déclaration</h2>
          <div className="sub">
            Colis non conformes, contenus interdits ou dangereux signalés par les livreurs. Un incident confirmé compte pour le vendeur ;
            à {data?.threshold ?? 3} incidents confirmés, son compte est suspendu (il garde l'accès à son historique et à son recours).
            {data ? <> · <b>{data.open}</b> à traiter</> : null}
          </div>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 13, background: msg.ok ? '#EFF8F1' : '#FDECEC', color: msg.ok ? '#0A5C2F' : '#C00' }}>{msg.text}</div>}

      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((f) => (
            <span key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`} onClick={() => { setFilter(f.key); setPage(1); setMsg(null); }}>{f.label}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {isLoading ? <div className="card pad"><Skeleton h={60} /></div>
          : rows.length === 0 ? <div className="card pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>Aucun incident pour ce filtre.</div>
          : rows.map((i) => (
            <div key={i.id} className="card pad" style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{i.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[i.status] }}>{STATUS_LABEL[i.status] || i.status}</span>
                <span className="muted mono-sm" style={{ marginLeft: 'auto' }}>{utc(i.createdAt)}</span>
              </div>
              <div className="kv">
                <div><div className="k">Vendeur</div><div className="v">{i.vendorName || '—'}<div className="mono-sm muted">{i.vendorPhone}</div></div></div>
                <div><div className="k">Livreur</div><div className="v">{i.delivererName || '—'}<div className="mono-sm muted">{i.delivererPhone}</div></div></div>
                <div style={{ gridColumn: '1 / -1' }}><div className="k">Course</div><div className="v" style={{ fontSize: 12 }}>{i.pickupAddress} → {i.dropoffAddress} · gabarit {i.size || '—'}{i.declaredValueXAF ? ` · valeur déclarée ${Number(i.declaredValueXAF).toLocaleString('fr-FR')} F` : ''}</div></div>
              </div>
              {i.comment && <div style={{ fontSize: 13 }}><b>Constat du livreur :</b> {i.comment}{i.measuredWeightKg ? ` (poids constaté : ${i.measuredWeightKg} kg)` : ''}</div>}
              {i.hasPhoto && <IncidentPhoto id={i.id} />}
              {i.appealText && <div style={{ fontSize: 13, background: '#FFF8E3', padding: 10, borderRadius: 8 }}><b>Recours du vendeur ({i.appealAt ? utc(i.appealAt) : ''}) :</b> {i.appealText}</div>}
              {i.decisionNote && <div className="muted" style={{ fontSize: 12 }}>Décision : {i.decisionNote}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: i.vendorConfirmed >= (data?.threshold ?? 3) ? '#B42318' : 'var(--muted)' }}>
                  Compteur du vendeur : {i.vendorConfirmed} / {data?.threshold ?? 3}{i.vendorSuspendedAt ? ' · COMPTE SUSPENDU' : ''}
                </span>
                <span style={{ flex: 1 }} />
                {i.status !== 'CONFIRMED' && <button className="btn sm" style={{ color: 'var(--danger)', borderColor: '#F0C9B6' }} disabled={decide.isPending} onClick={() => act(i, 'confirm')}>Confirmer l'incident</button>}
                {i.status !== 'CLEARED' && <button className="btn sm" disabled={decide.isPending} onClick={() => act(i, 'clear')}>Annuler l'incident</button>}
                {i.vendorSuspendedAt && <button className="btn sm" disabled={unsuspend.isPending} onClick={() => window.confirm(`Lever la suspension de ${i.vendorName} ?`) && unsuspend.mutate(i.vendorId)}>Lever la suspension</button>}
              </div>
            </div>
          ))}
      </div>

      {data && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span style={{ padding: '7px 12px', fontSize: 12, color: 'var(--muted)' }}>Page {page} · {data.total} incident(s)</span>
          <button className="btn sm" disabled={rows.length < 25} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </section>
  );
}
