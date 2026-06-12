import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Kpi, RowHead, Progress } from '../components/ui.jsx';
import { IconFinance, IconBox, IconUsers } from '../components/icons.jsx';
import { adminApi } from '../api.js';

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const PERIODS = [
  { key:'7d', label:'7 jours' },
  { key:'30d', label:'30 jours' },
  { key:'12m', label:'12 mois' },
];

// Static fallback data while API loads
const GMV_DATA = [12.4, 15.2, 11.8, 18.6, 22.1, 20.4, 24.8, 28.3, 25.1, 30.2, 27.8, 35.4];
const CNT_DATA = [420, 510, 390, 620, 740, 680, 820, 940, 835, 1010, 925, 1180];

const TOP_VENDORS = [
  { name:'Boutique Centrale Akwa', deliveries:284, gmv:2_840_000 },
  { name:'Express Market Bonapriso', deliveries:231, gmv:2_310_000 },
  { name:'Superette Deïdo', deliveries:198, gmv:1_980_000 },
  { name:'Shop Bonabéri', deliveries:156, gmv:1_560_000 },
  { name:'Dépôt New-Bell', deliveries:120, gmv:1_200_000 },
];

const TOP_DELIVERERS = [
  { name:'Paul Mba', deliveries:342, rating:4.9 },
  { name:'Eric Ngong', deliveries:298, rating:4.8 },
  { name:'Sylvie Ela', deliveries:267, rating:4.8 },
  { name:'Martin Kom', deliveries:241, rating:4.7 },
  { name:'Alice Mbarga', deliveries:218, rating:4.7 },
];

const LABEL_H = 20; // fixed label zone at bottom

function BarChart({ data, colors: barColors, labels, height = 180 }) {
  const allValues = data.flat().filter(Number.isFinite);
  const max = Math.max(...allValues, 1);
  const barArea = height - LABEL_H; // pixels available for bars
  const seriesCount = data.length;

  return (
    <div style={{
      display: 'flex', gap: 6,
      height, overflow: 'hidden', // hard clip — nothing escapes
      overflowX: 'auto',
    }}>
      {labels.map((lb, i) => (
        <div key={lb} style={{
          flex: '0 0 auto',
          minWidth: seriesCount === 1 ? 28 : 40,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
        }}>
          {/* bar zone — fills all space above the label */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2,
          }}>
            {data.map((series, si) => {
              const px = Math.max(3, Math.round((series[i] / max) * barArea));
              return (
                <div key={si} style={{
                  width: seriesCount === 1 ? 26 : 16,
                  height: px,
                  borderRadius: '4px 4px 0 0',
                  background: barColors[si],
                  transition: 'height .3s ease',
                }} />
              );
            })}
          </div>
          {/* label zone — fixed height */}
          <div style={{
            height: LABEL_H, lineHeight: `${LABEL_H}px`,
            fontSize: 10, color: 'var(--muted)', fontWeight: 600,
            textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden',
          }}>
            {lb}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { t } = useI18n();
  const [period, setPeriod] = useState('12m');
  const [stats, setStats]   = useState(null);

  useEffect(() => {
    adminApi.stats().then(setStats).catch(() => {});
  }, []);

  // Use real trend data if available
  const trendData = stats?.trend ?? [];
  const trendLabels = trendData.map(d => d.day);
  const trendGmv  = trendData.map(d => d.gmv / 1000); // thousands XAF
  const trendCnt  = trendData.map(d => d.count);

  const totalUsers     = stats?.users ?? 1240;
  const totalDeliveries = stats?.deliveries ?? 7868;
  const gmv30d         = stats?.gmv30d ?? 28_500_000;

  return (
    <section className="content">
      <div className="toolbar" style={{ marginBottom:16 }}>
        <div className="chips">
          {PERIODS.map((p) => (
            <span key={p.key} className={`chip ${period === p.key ? 'on' : ''}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </span>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <button className="btn sm">{t('export')}</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:16 }}>
        <Kpi iconTone="g" icon={<IconFinance width={20} height={20}/>}
          label="GMV Total" value={(gmv30d / 1_000_000).toFixed(1)} unit="M XAF"
          delta="+22%" deltaDir="up" spark={GMV_DATA.slice(-7)} />
        <Kpi iconTone="b" icon={<IconBox width={20} height={20}/>}
          label="Livraisons totales" value={totalDeliveries.toLocaleString('fr-FR')}
          delta="+18%" deltaDir="up" spark={CNT_DATA.slice(-7)} />
        <Kpi iconTone="o" icon={<IconUsers width={20} height={20}/>}
          label="Utilisateurs actifs" value={totalUsers.toLocaleString('fr-FR')}
          delta="+11%" deltaDir="up" spark={[90,95,102,110,108,115,124]} />
      </div>

      {/* Histogram — fixed, no overflow */}
      <div className="card pad" style={{ marginBottom:16 }}>
        <RowHead title="Volume hebdomadaire" sub="GMV (k XAF) et livraisons — 7 derniers jours"
          right={
            <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--muted)' }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <i style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#178A3C' }} />
                GMV (k XAF)
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <i style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#E8551C' }} />
                Livraisons
              </span>
            </div>
          }
        />
        {trendLabels.length > 0 ? (
          <BarChart
            data={[trendGmv, trendCnt]}
            colors={['#178A3C', '#E8551C']}
            labels={trendLabels}
            height={180}
          />
        ) : (
          <BarChart
            data={[GMV_DATA, CNT_DATA.map(v => v / 10)]}
            colors={['#178A3C', '#E8551C']}
            labels={MONTHS}
            height={180}
          />
        )}
      </div>

      {/* Status breakdown */}
      {stats?.statusBreakdown && (
        <div className="card pad" style={{ marginBottom:16 }}>
          <RowHead title="Statuts des livraisons" sub="répartition en cours" />
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
            {Object.entries(stats.statusBreakdown).map(([status, count]) => (
              <div key={status} style={{ background:'var(--app)', borderRadius:10, padding:'8px 14px', textAlign:'center', minWidth:90 }}>
                <div style={{ fontWeight:800, fontSize:20 }}>{count}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="card pad">
          <RowHead title="Top vendeurs" sub="par nombre de livraisons" />
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {TOP_VENDORS.map((v, i) => (
              <div key={v.name}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                  <span><b style={{ color:'var(--muted)', marginRight:8 }}>#{i+1}</b>{v.name}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{v.deliveries}</span>
                </div>
                <Progress value={Math.round(v.deliveries / TOP_VENDORS[0].deliveries * 100)} />
              </div>
            ))}
          </div>
        </div>

        <div className="card pad">
          <RowHead title="Top livreurs" sub="par volume de courses" />
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {TOP_DELIVERERS.map((d, i) => (
              <div key={d.name} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'var(--muted)', width:18, textAlign:'center' }}>#{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{d.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{d.deliveries} livraisons · {d.rating}</div>
                </div>
                <Progress value={Math.round(d.deliveries / TOP_DELIVERERS[0].deliveries * 100)} style={{ width:80 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
