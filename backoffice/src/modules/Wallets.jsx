import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api.js';
import { Pill, Avatar } from '../components/ui.jsx';

const TX_TONE = { EARNING:'ok', WITHDRAWAL:'warn', COMMISSION:'b', REFUND:'orange' };

export default function Wallets() {
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [totalBal,setTotalBal]= useState(0);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [selected,setSelected]= useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.wallets({ q: search || undefined, page });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalBal(data.totalBalance ?? 0);
    } catch { setError('Erreur chargement portefeuilles'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="content">
      {error && (
        <div style={{ background:'#FEE', color:'#C00', padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13 }}>
          {error}<button className="x" onClick={() => setError('')} style={{ float:'right' }}>✕</button>
        </div>
      )}

      {/* Summary KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:18 }}>
        {[
          { label:'Total en circulation', value:`${(totalBal / 1000).toFixed(0)} k XAF`, tone:'g' },
          { label:'Portefeuilles', value:total, tone:'b' },
          { label:'Retraits en attente', value:items.reduce((s, w) => s + (w.withdrawals?.length ?? 0), 0), tone:'o' },
        ].map(kpi => (
          <div key={kpi.label} className="card kpi" style={{ padding:14 }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>{kpi.label}</div>
            <div style={{ fontWeight:800, fontSize:22 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <input className="input" placeholder="Rechercher un utilisateur…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ flex:1 }} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap:16, alignItems:'start' }}>
        <div className="card" style={{ overflow:'hidden' }}>
          {loading ? (
            <div style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>Chargement…</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Solde</th>
                  <th>Opérateur</th>
                  <th>Retraits en attente</th>
                  <th>Dernières transactions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:30 }}>Aucun portefeuille</td></tr>
                ) : items.map(w => (
                  <tr key={w.id} onClick={() => setSelected(selected?.id === w.id ? null : w)}
                    style={{ cursor:'pointer', background: selected?.id === w.id ? 'var(--app)' : undefined }}>
                    <td>
                      <div className="usr">
                        <Avatar tone="g">{(w.user?.name || 'U').charAt(0)}</Avatar>
                        <div className="nm">{w.user?.name || '—'}<div className="sub">{w.user?.phone}</div></div>
                      </div>
                    </td>
                    <td><Pill tone={w.user?.activeRole === 'DELIVERER' ? 'b' : 'g'}>{w.user?.activeRole}</Pill></td>
                    <td className="amt" style={{ fontWeight:800 }}>{(w.balanceXAF || 0).toLocaleString('fr-FR')} XAF</td>
                    <td style={{ fontSize:12 }}>{w.paymentProvider || '—'}</td>
                    <td>
                      {w.withdrawals?.length > 0
                        ? <Pill tone="warn">{w.withdrawals.length} retrait{w.withdrawals.length > 1 ? 's' : ''}</Pill>
                        : <span style={{ color:'var(--muted)', fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>
                      {w.transactions?.slice(0, 2).map(t => (
                        <div key={t.id}><Pill tone={TX_TONE[t.type] || 'mut'}>{t.type}</Pill> {(t.amountXAF || 0).toLocaleString('fr-FR')}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > 25 && (
            <div style={{ display:'flex', justifyContent:'center', gap:8, padding:12 }}>
              <button className="btn sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              <span style={{ fontSize:12, color:'var(--muted)', alignSelf:'center' }}>{page}</span>
              <button className="btn sm" onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total}>›</button>
            </div>
          )}
        </div>

        {selected && (
          <div className="card pad" style={{ position:'sticky', top:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15 }}>{selected.user?.name}</div>
              <button className="x" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="kv" style={{ marginBottom:14 }}>
              <div><div className="k">Téléphone</div><div className="v">{selected.user?.phone}</div></div>
              <div><div className="k">Rôle</div><div className="v">{selected.user?.activeRole}</div></div>
              <div><div className="k">Solde actuel</div><div className="v amt" style={{ fontWeight:800, fontSize:18 }}>{(selected.balanceXAF || 0).toLocaleString('fr-FR')} XAF</div></div>
              <div><div className="k">Opérateur</div><div className="v">{selected.paymentProvider || '—'}</div></div>
            </div>

            {/* Recent transactions */}
            <div style={{ fontWeight:800, fontSize:12, marginBottom:8 }}>Dernières transactions</div>
            {selected.transactions?.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {selected.transactions.map(t => (
                  <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'var(--app)', borderRadius:8 }}>
                    <div>
                      <Pill tone={TX_TONE[t.type] || 'mut'}>{t.type}</Pill>
                      {t.description && <span style={{ fontSize:11, color:'var(--muted)', marginLeft:6 }}>{t.description}</span>}
                    </div>
                    <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700,
                      color: ['EARNING','REFUND'].includes(t.type) ? 'var(--green)' : '#E8551C' }}>
                      {['EARNING','REFUND'].includes(t.type) ? '+' : '-'}{(t.amountXAF || 0).toLocaleString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            ) : <div style={{ color:'var(--muted)', fontSize:12 }}>Aucune transaction</div>}

            {/* Pending withdrawals */}
            {selected.withdrawals?.length > 0 && (
              <>
                <div style={{ fontWeight:800, fontSize:12, marginTop:14, marginBottom:8 }}>Retraits en attente</div>
                {selected.withdrawals.map(w => (
                  <div key={w.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'#FEF8E7', borderRadius:8, marginBottom:6 }}>
                    <div>
                      <span style={{ fontSize:13, fontWeight:700 }}>{(w.amountXAF || 0).toLocaleString('fr-FR')} XAF</span>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>{w.provider} · {w.phone}</div>
                    </div>
                    <button className="btn sm" onClick={() => adminApi.payWithdrawal(w.id).then(load)}>Payer</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
