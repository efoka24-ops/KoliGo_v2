import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api.js';
import { Pill, Avatar } from '../components/ui.jsx';

const FILTERS = [
  { key:'all',         label:'Tous' },
  { key:'open',        label:'Ouverts' },
  { key:'in_progress', label:'En cours' },
  { key:'closed',      label:'Résolus' },
];

const PRIORITY_TONE = { HIGH:'danger', MEDIUM:'warn', LOW:'mut' };
const STATUS_TONE   = { OPEN:'info', IN_PROGRESS:'orange', RESOLVED:'ok', CLOSED:'ok' };
const TYPE_LABELS   = { DAMAGED:'Colis endommagé', MISSING:'Colis manquant', WRONG_ADDRESS:'Mauvaise adresse' };

export default function Support() {
  const [filter,   setFilter]   = useState('all');
  const [items,    setItems]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [page,     setPage]     = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusMap = { all: undefined, open: 'OPEN', in_progress: 'IN_PROGRESS', closed: 'RESOLVED' };
      const data = await adminApi.issues({ status: statusMap[filter], page });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch { setError('Erreur chargement tickets'); }
    finally { setLoading(false); }
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id, status = 'RESOLVED') => {
    setSaving(true);
    try {
      await adminApi.resolveIssue(id, status);
      load();
      if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  return (
    <section className="content">
      {error && (
        <div style={{ background:'#FEE', color:'#C00', padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13 }}>
          {error}<button className="x" onClick={() => setError('')} style={{ float:'right' }}>✕</button>
        </div>
      )}

      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((f) => (
            <span key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`}
              onClick={() => { setFilter(f.key); setPage(1); }}>
              {f.label}
            </span>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:12, color:'var(--muted)' }}>{total} ticket{total > 1 ? 's' : ''}</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1.1fr 1fr', gap:16, alignItems:'start' }}>
        <div className="card" style={{ overflow:'hidden' }}>
          {loading ? (
            <div style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>Chargement…</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>Aucun ticket</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Type</th>
                  <th>Livraison</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((tk) => (
                  <tr key={tk.id}
                    onClick={() => setSelected(tk)}
                    style={{ cursor:'pointer', background: selected?.id === tk.id ? 'var(--app)' : undefined }}>
                    <td>
                      <div className="usr">
                        <Avatar tone="b">{(tk.user?.name || 'U').charAt(0)}</Avatar>
                        <div className="nm">{tk.user?.name || '—'}<div className="sub">{tk.user?.phone}</div></div>
                      </div>
                    </td>
                    <td style={{ fontSize:12, fontWeight:600 }}>{TYPE_LABELS[tk.type] || tk.type}</td>
                    <td style={{ fontSize:11, color:'var(--muted)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {tk.delivery?.pickupAddress?.split(',')[0]} → {tk.delivery?.dropoffAddress?.split(',')[0]}
                    </td>
                    <td><Pill tone={STATUS_TONE[tk.status] || 'mut'}>{tk.status}</Pill></td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(tk.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > 30 && (
            <div style={{ display:'flex', justifyContent:'center', gap:8, padding:12 }}>
              <button className="btn sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Préc.</button>
              <span style={{ fontSize:12, color:'var(--muted)', alignSelf:'center' }}>Page {page}</span>
              <button className="btn sm" onClick={() => setPage(p => p + 1)} disabled={page * 30 >= total}>Suiv. ›</button>
            </div>
          )}
        </div>

        {selected ? (
          <div className="card pad" style={{ position:'sticky', top:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--muted)', marginBottom:4 }}>{selected.id}</div>
                <div style={{ fontWeight:800, fontSize:16 }}>{TYPE_LABELS[selected.type] || selected.type}</div>
              </div>
              <button className="x" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="kv" style={{ marginBottom:16 }}>
              <div><div className="k">Utilisateur</div><div className="v">{selected.user?.name} · {selected.user?.phone}</div></div>
              <div><div className="k">Statut</div><div className="v"><Pill tone={STATUS_TONE[selected.status] || 'mut'}>{selected.status}</Pill></div></div>
              <div><div className="k">Date</div><div className="v muted">{new Date(selected.createdAt).toLocaleString('fr-FR')}</div></div>
              {selected.delivery && (
                <>
                  <div><div className="k">Collecte</div><div className="v">{selected.delivery.pickupAddress}</div></div>
                  <div><div className="k">Livraison</div><div className="v">{selected.delivery.dropoffAddress}</div></div>
                  <div><div className="k">Montant</div><div className="v amt">{(selected.delivery.priceXAF || 0).toLocaleString('fr-FR')} XAF</div></div>
                </>
              )}
            </div>

            {selected.description && (
              <div style={{ background:'var(--app)', borderRadius:12, padding:'12px 14px', fontSize:13, lineHeight:1.6, marginBottom:16 }}>
                {selected.description}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              {selected.status !== 'RESOLVED' && (
                <button className="btn pri" style={{ flex:1 }} onClick={() => handleResolve(selected.id)} disabled={saving}>
                  {saving ? '…' : 'Marquer résolu'}
                </button>
              )}
              {selected.status === 'OPEN' && (
                <button className="btn" style={{ flex:1 }} onClick={() => handleResolve(selected.id, 'IN_PROGRESS')} disabled={saving}>
                  En traitement
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="card pad" style={{ display:'grid', placeItems:'center', height:200, color:'var(--muted)', fontSize:13 }}>
            Sélectionne un ticket pour voir les détails
          </div>
        )}
      </div>
    </section>
  );
}
