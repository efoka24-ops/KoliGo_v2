import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Kpi, RowHead, Progress, Skeleton } from '../components/ui.jsx';
import { IconFinance, IconBox, IconUsers } from '../components/icons.jsx';
import { adminApi } from '../api.js';

const PERIODS = [
  { key:'7d',  label:'7 jours',  sub:'7 derniers jours' },
  { key:'30d', label:'30 jours', sub:'30 derniers jours' },
  { key:'12m', label:'12 mois',  sub:'12 derniers mois' },
];

const LABEL_H = 20;

const deltaProps = (d) => (d == null ? {} : { delta: `${Math.abs(d)}%`, deltaDir: d >= 0 ? 'up' : 'down' });
const xafShort = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}` : `${(n / 1_000).toFixed(1)}`);

function BarChart({ data, colors: barColors, labels, height = 180 }) {
  const max = Math.max(...data.flat().filter(Number.isFinite), 1);
  const barArea = height - LABEL_H;
  const many = labels.length > 14;
  return (
    <div style={{ display:'flex', gap: many ? 3 : 6, height, overflowX:'auto', overflowY:'hidden' }}>
      {labels.map((lb, i) => (
        <div key={`${lb}-${i}`} style={{ flex:'1 0 auto', minWidth: many ? 14 : 40, display:'flex', flexDirection:'column', alignItems:'center', height:'100%' }}>
          <div style={{ flex:1, display:'flex', alignItems:'flex-end', gap:2 }}>
            {data.map((series, si) => (
              <div key={si} style={{
                width: many ? 6 : 16, height: Math.max(3, Math.round((series[i] / max) * barArea)),
                borderRadius:'4px 4px 0 0', background: barColors[si], transition:'height .3s ease',
              }} />
            ))}
          </div>
          <div style={{ height: LABEL_H, lineHeight:`${LABEL_H}px`, fontSize: many ? 8 : 10, color:'var(--muted)', fontWeight:600, whiteSpace:'nowrap' }}>
            {many && i % 3 !== 0 ? '' : lb}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState('30d');
  const { data: a, isLoading, error } = useQuery({
    queryKey: ['admin-analytics', period],
    queryFn:  () => adminApi.analytics(period),
    placeholderData: (prev) => prev,
  });

  const sub = PERIODS.find(p => p.key === period).sub;
  const series = a?.series ?? [];
  const k = a?.kpis;
  const vendors = a?.topVendors ?? [];
  const deliverers = a?.topDeliverers ?? [];

  const exportCsv = () => {
    if (!a) return;
    const rows = [['Période', 'GMV (XAF)', 'Livraisons'], ...a.series.map(s => [s.label, s.gmv, s.count])];
    const blob = new Blob([rows.map(r => r.join(';')).join('\n')], { type:'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `koligo-analytique-${period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (error) return <section className="content"><div className="card pad" style={{ color:'#C00' }}>Impossible de charger l'analytique.</div></section>;

  return (
    <section className="content">
      <div className="toolbar" style={{ marginBottom:16 }}>
        <div className="chips">
          {PERIODS.map((p) => (
            <span key={p.key} className={`chip ${period === p.key ? 'on' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</span>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <button className="btn sm" onClick={exportCsv} disabled={!a}>Exporter (CSV)</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:16 }}>
        <Kpi iconTone="g" icon={<IconFinance width={20} height={20}/>}
          label="GMV livré" value={isLoading ? '…' : xafShort(k.gmv.value)} unit={k && k.gmv.value >= 1_000_000 ? 'M XAF' : 'k XAF'}
          {...deltaProps(k?.gmv.delta)} spark={series.map(s => s.gmv)} />
        <Kpi iconTone="b" icon={<IconBox width={20} height={20}/>}
          label="Livraisons" value={isLoading ? '…' : k.deliveries.value.toLocaleString('fr-FR')}
          {...deltaProps(k?.deliveries.delta)} spark={series.map(s => s.count)} />
        <Kpi iconTone="o" icon={<IconUsers width={20} height={20}/>}
          label="Utilisateurs actifs" value={isLoading ? '…' : k.activeUsers.value.toLocaleString('fr-FR')}
          {...deltaProps(k?.activeUsers.delta)} />
      </div>

      <div className="card pad" style={{ marginBottom:16 }}>
        <RowHead title="Volume" sub={`GMV (k XAF) et livraisons — ${sub}`}
          right={
            <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--muted)' }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><i style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#178A3C' }} />GMV (k XAF)</span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><i style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#E8551C' }} />Livraisons</span>
            </div>
          }
        />
        {isLoading ? <Skeleton h={180} /> : (
          <BarChart data={[series.map(s => s.gmv / 1000), series.map(s => s.count)]} colors={['#178A3C', '#E8551C']} labels={series.map(s => s.label)} height={180} />
        )}
      </div>

      <div className="card pad" style={{ marginBottom:16 }}>
        <RowHead title="Statuts des livraisons" sub={sub} />
        {Object.keys(a?.statusBreakdown ?? {}).length === 0 ? (
          <div style={{ color:'var(--muted)', fontSize:13 }}>{isLoading ? '…' : 'Aucune livraison sur la période.'}</div>
        ) : (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
            {Object.entries(a.statusBreakdown).map(([status, count]) => (
              <div key={status} style={{ background:'var(--app)', borderRadius:10, padding:'8px 14px', textAlign:'center', minWidth:90 }}>
                <div style={{ fontWeight:800, fontSize:20 }}>{count}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="card pad">
          <RowHead title="Top vendeurs" sub={`par nombre de livraisons — ${sub}`} />
          {vendors.length === 0 ? <div style={{ color:'var(--muted)', fontSize:13 }}>{isLoading ? '…' : 'Aucune donnée sur la période.'}</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {vendors.map((v, i) => (
                <div key={v.id}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                    <span><b style={{ color:'var(--muted)', marginRight:8 }}>#{i + 1}</b>{v.name}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{v.deliveries} · {v.gmv.toLocaleString('fr-FR')} XAF</span>
                  </div>
                  <Progress value={Math.round(v.deliveries / vendors[0].deliveries * 100)} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card pad">
          <RowHead title="Top livreurs" sub={`courses livrées — ${sub}`} />
          {deliverers.length === 0 ? <div style={{ color:'var(--muted)', fontSize:13 }}>{isLoading ? '…' : 'Aucune donnée sur la période.'}</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {deliverers.map((d, i) => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'var(--muted)', width:18, textAlign:'center' }}>#{i + 1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{d.name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{d.deliveries} livraison{d.deliveries > 1 ? 's' : ''}{d.rating != null ? ` · ${d.rating}` : ' · pas encore noté'}</div>
                  </div>
                  <Progress value={Math.round(d.deliveries / deliverers[0].deliveries * 100)} style={{ width:80 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
