import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api.js';
import { Pill, Avatar } from '../components/ui.jsx';

const STATUS_TONE = {
  EN_ATTENTE:'info', ACCEPTE:'orange', EN_ROUTE:'warn',
  LIVRE:'ok', ANNULE:'danger',
};
const STATUS_LABELS = {
  EN_ATTENTE:'En attente', ACCEPTE:'Accepté', EN_ROUTE:'En route',
  LIVRE:'Livré', ANNULE:'Annulé',
};
const TYPE_COLORS = {
  TEMPORAIRE:'#178A3C', EXPRESS:'#E8551C', VVIP:'#C4611A',
  PERMANENT:'#0E2116', INTERURBAIN:'#6B5BCD', FROID_FRAGILE:'#0099CC',
};

const ALL_STATUSES = [
  { key:'', label:'Tous' },
  { key:'EN_ATTENTE', label:'En attente' },
  { key:'ACCEPTE', label:'Acceptés' },
  { key:'EN_ROUTE', label:'En route' },
  { key:'LIVRE', label:'Livrés' },
  { key:'ANNULE', label:'Annulés' },
];

function TrackingTimeline({ locations }) {
  if (!locations?.length) return <div style={{ color:'var(--muted)', fontSize:12, padding:12 }}>Aucun point GPS enregistré.</div>;
  return (
    <div style={{ maxHeight:260, overflowY:'auto' }}>
      {locations.map((loc, i) => (
        <div key={loc.id} style={{ display:'flex', gap:12, padding:'6px 0', borderBottom: i < locations.length - 1 ? '1px solid var(--line)' : 'none' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', marginTop:6, flexShrink:0 }} />
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--muted)' }}>
              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
            </div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:1 }}>
              {new Date(loc.createdAt).toLocaleString('fr-FR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Receipt({ pkg }) {
  const d = pkg;
  const date = new Date(d.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const lines = [
    ['N° livraison', d.id],
    ['Date', date],
    ['Statut', STATUS_LABELS[d.status] || d.status],
    ['Vendeur', `${d.vendor?.name ?? '—'} · ${d.vendor?.phone ?? ''}`],
    ['De', d.pickupAddress],
    ['Vers', d.dropoffAddress],
    ['Type', d.delivererType],
    ['Poids', `${d.weightKg} kg`],
    d.description ? ['Description', d.description] : null,
    ['Prix client', `${(d.priceXAF || 0).toLocaleString('fr-FR')} XAF`],
    ['Commission', `${(d.commissionXAF || 0).toLocaleString('fr-FR')} XAF`],
    ['Gain livreur', `${(d.delivererEarning || 0).toLocaleString('fr-FR')} XAF`],
  ].filter(Boolean);

  return (
    <div style={{ fontFamily:'var(--mono)', fontSize:12, background:'#F8F5EE', borderRadius:12, padding:16, lineHeight:1.8, border:'1px solid #E8DCC8' }}>
      <div style={{ fontWeight:800, fontSize:14, textAlign:'center', marginBottom:8 }}>REÇU DE LIVRAISON — KoliGo</div>
      {lines.map(([k, v]) => (
        <div key={k} style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px dashed #DDD', padding:'2px 0' }}>
          <span style={{ color:'var(--muted)' }}>{k}</span>
          <span style={{ fontWeight:600, maxWidth:'60%', textAlign:'right', wordBreak:'break-word' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export default function Packages() {
  const [status,   setStatus]   = useState('');
  const [search,   setSearch]   = useState('');
  const [items,    setItems]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState(null);
  const [detail,   setDetail]   = useState(null); // full package with GPS + issues
  const [loading,  setLoading]  = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState('info'); // 'info' | 'tracking' | 'receipt'
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.packages({ status: status || undefined, q: search || undefined, page });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch { setError('Erreur chargement livraisons'); }
    finally { setLoading(false); }
  }, [status, search, page]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (pkg) => {
    setSelected(pkg);
    setDetailTab('info');
    setLoadingDetail(true);
    try {
      const full = await adminApi.getPackage(pkg.id);
      setDetail(full);
    } catch { setDetail(pkg); }
    finally { setLoadingDetail(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  // Build tracking link for client
  const trackingLink = (pkg) => `${window.location.origin.replace('5174', '3000')}/track/${pkg.clientToken}`;

  return (
    <section className="content">
      {error && (
        <div style={{ background:'#FEE', color:'#C00', padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13 }}>
          {error}<button className="x" onClick={() => setError('')} style={{ float:'right' }}>✕</button>
        </div>
      )}

      <div className="toolbar">
        <div className="chips">
          {ALL_STATUSES.map(s => (
            <span key={s.key} className={`chip ${status === s.key ? 'on' : ''}`}
              onClick={() => { setStatus(s.key); setPage(1); }}>
              {s.label}
            </span>
          ))}
        </div>
        <form onSubmit={handleSearch} style={{ display:'flex', gap:8 }}>
          <input className="input" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:180 }} />
        </form>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap:16, alignItems:'start' }}>
        {/* Table */}
        <div className="card" style={{ overflow:'hidden' }}>
          {loading ? (
            <div style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>Chargement…</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>De → Vers</th>
                  <th>Poids</th>
                  <th>Description</th>
                  <th>Vendeur</th>
                  <th>Prix</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--muted)', padding:30 }}>Aucune livraison</td></tr>
                ) : items.map(pkg => (
                  <tr key={pkg.id}
                    onClick={() => openDetail(pkg)}
                    style={{ cursor:'pointer', background: selected?.id === pkg.id ? 'var(--app)' : undefined }}>
                    <td className="id mono-sm" style={{ maxWidth:80, overflow:'hidden', textOverflow:'ellipsis' }}>{pkg.id.slice(-8)}</td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:700, color: TYPE_COLORS[pkg.delivererType] || '#555' }}>
                        {pkg.delivererType}
                      </span>
                    </td>
                    <td style={{ fontSize:11, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {pkg.pickupAddress?.split(',')[0]} → {pkg.dropoffAddress?.split(',')[0]}
                    </td>
                    <td style={{ fontSize:12 }}>{pkg.weightKg} kg</td>
                    <td style={{ fontSize:11, color:'var(--muted)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {pkg.description || '—'}
                    </td>
                    <td>
                      <div className="usr">
                        <Avatar tone="g">{(pkg.vendor?.name || 'V').charAt(0)}</Avatar>
                        <div className="nm">{pkg.vendor?.name || '—'}</div>
                      </div>
                    </td>
                    <td className="amt">{(pkg.priceXAF || 0).toLocaleString('fr-FR')}</td>
                    <td><Pill tone={STATUS_TONE[pkg.status] || 'mut'}>{STATUS_LABELS[pkg.status] || pkg.status}</Pill></td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(pkg.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > 25 && (
            <div style={{ display:'flex', justifyContent:'center', gap:8, padding:12 }}>
              <button className="btn sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              <span style={{ fontSize:12, color:'var(--muted)', alignSelf:'center' }}>{page} / {Math.ceil(total / 25)}</span>
              <button className="btn sm" onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total}>›</button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card pad" style={{ position:'sticky', top:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--muted)' }}>{selected.id}</div>
                <div style={{ fontWeight:800, fontSize:14, marginTop:2 }}>
                  <span style={{ color: TYPE_COLORS[selected.delivererType] }}>{selected.delivererType}</span>
                  {' · '}<Pill tone={STATUS_TONE[selected.status] || 'mut'}>{STATUS_LABELS[selected.status]}</Pill>
                </div>
              </div>
              <button className="x" onClick={() => { setSelected(null); setDetail(null); }}>✕</button>
            </div>

            {/* Tabs */}
            <div className="chips" style={{ marginBottom:12 }}>
              {['info','tracking','receipt'].map(t => (
                <span key={t} className={`chip ${detailTab === t ? 'on' : ''}`} onClick={() => setDetailTab(t)}
                  style={{ fontSize:11 }}>
                  {t === 'info' ? 'Détails' : t === 'tracking' ? 'Suivi GPS' : 'Reçu'}
                </span>
              ))}
            </div>

            {loadingDetail ? (
              <div style={{ textAlign:'center', color:'var(--muted)', padding:30 }}>Chargement…</div>
            ) : detailTab === 'info' ? (
              <div>
                <div className="kv">
                  <div><div className="k">De</div><div className="v">{(detail || selected).pickupAddress}</div></div>
                  <div><div className="k">Vers</div><div className="v">{(detail || selected).dropoffAddress}</div></div>
                  <div><div className="k">Poids</div><div className="v">{(detail || selected).weightKg} kg</div></div>
                  {(detail || selected).description && <div><div className="k">Description</div><div className="v">{(detail || selected).description}</div></div>}
                  <div><div className="k">Prix</div><div className="v amt">{((detail || selected).priceXAF || 0).toLocaleString('fr-FR')} XAF</div></div>
                  <div><div className="k">Vendeur</div><div className="v">{(detail || selected).vendor?.name} · {(detail || selected).vendor?.phone}</div></div>
                  {(detail || selected).vendor?.email && <div><div className="k">Email vendeur</div><div className="v">{(detail || selected).vendor.email}</div></div>}
                  {(detail || selected).deliverer && <div><div className="k">Livreur</div><div className="v">{(detail || selected).deliverer.name} · {(detail || selected).deliverer.phone}</div></div>}
                  <div><div className="k">Code collecte</div><div className="v" style={{ fontFamily:'var(--mono)', letterSpacing:4 }}>{(detail || selected).collectCode}</div></div>
                  <div><div className="k">Code livraison</div><div className="v" style={{ fontFamily:'var(--mono)', letterSpacing:4 }}>{(detail || selected).deliverCode}</div></div>
                </div>
                {/* Tracking link */}
                <div style={{ marginTop:12, padding:'10px 12px', background:'var(--app)', borderRadius:10, fontSize:11 }}>
                  <div style={{ fontWeight:700, marginBottom:4, color:'var(--muted)' }}>Lien de suivi client</div>
                  <a href={trackingLink(detail || selected)} target="_blank" rel="noreferrer"
                    style={{ color:'var(--green)', wordBreak:'break-all', fontFamily:'var(--mono)', fontSize:10 }}>
                    {trackingLink(detail || selected)}
                  </a>
                </div>
                {/* Issues */}
                {detail?.issues?.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ fontWeight:800, fontSize:12, marginBottom:8 }}>Litiges ({detail.issues.length})</div>
                    {detail.issues.map(issue => (
                      <div key={issue.id} style={{ background:'#FEF0E3', borderRadius:8, padding:'8px 10px', marginBottom:6, fontSize:12 }}>
                        <span style={{ fontWeight:700, color:'#C4611A' }}>{issue.type}</span>
                        {' — '}{issue.description || '—'}
                        <span style={{ float:'right', fontSize:10, color:'var(--muted)' }}>{issue.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : detailTab === 'tracking' ? (
              <TrackingTimeline locations={detail?.locations} />
            ) : (
              <Receipt pkg={detail || selected} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
