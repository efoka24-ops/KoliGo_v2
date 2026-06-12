import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Kpi, RowHead, Progress, Skeleton } from '../components/ui.jsx';
import { IconFinance, IconBox } from '../components/icons.jsx';
import { adminApi } from '../api.js';

const DEFAULT_TREND = [
  { day:'Lun', gmv:55, count:40 }, { day:'Mar', gmv:68, count:52 },
  { day:'Mer', gmv:60, count:46 }, { day:'Jeu', gmv:82, count:60 },
  { day:'Ven', gmv:74, count:55 }, { day:'Sam', gmv:95, count:72 },
  { day:'Dim', gmv:64, count:48 },
];

export default function Dashboard() {
  const { t } = useI18n();
  const nav   = useNavigate();
  const { data: s, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  adminApi.stats,
    refetchInterval: 30_000,
  });

  const gmvM   = s ? (s.gmv30d / 1_000_000).toFixed(2) : '—';
  const commK  = s ? (s.commission30d / 1_000).toFixed(1) : '—';
  const trend  = (s?.trend?.length ? s.trend : DEFAULT_TREND);
  const maxGmv = Math.max(...trend.map(d => d.gmv), 1);
  const maxCnt = Math.max(...trend.map(d => d.count), 1);

  const sb = s?.statusBreakdown || {};
  const total = Object.values(sb).reduce((a, b) => a + b, 0) || 1;
  const pLivre   = Math.round((sb.LIVRE   || 0) / total * 100);
  const pRoute   = Math.round((sb.EN_ROUTE || sb.ACCEPTE || 0) / total * 100);
  const pAttente = Math.round((sb.EN_ATTENTE || 0) / total * 100);
  const pAnnule  = Math.max(0, 100 - pLivre - pRoute - pAttente);

  const donut = `conic-gradient(#178A3C 0 ${pLivre}%,#E8551C ${pLivre}% ${pLivre+pRoute}%,#B8860B ${pLivre+pRoute}% ${pLivre+pRoute+pAttente}%,#D6D6CE ${pLivre+pRoute+pAttente}% 100%)`;

  return (
    <section className="content">
      <div className="grid" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <Kpi iconTone="g" icon={<IconFinance width={20} height={20}/>}
          delta="12.4%" deltaDir="up" label={t('gmv30')}
          value={isLoading ? '…' : gmvM} unit="M XAF"
          spark={[40,55,48,70,62,80,95]} />
        <Kpi iconTone="b" icon={<IconBox width={20} height={20}/>}
          delta="8.1%" deltaDir="up" label={t('deliveries30')}
          value={isLoading ? '…' : (s?.deliveries30d ?? '—')}
          spark={[50,45,60,55,72,68,88]} />
        <Kpi iconTone="o" icon={<span style={{fontWeight:700}}>₣</span>}
          delta="3.0%" deltaDir="up" label={t('commission30')}
          value={isLoading ? '…' : commK} unit="k XAF"
          spark={[42,58,50,66,60,78,92]} />
        <Kpi iconTone="k" icon={<span style={{fontWeight:700}}>⟳</span>}
          delta="1.2%" deltaDir="down" label={t('activeDeliverers')}
          value={isLoading ? '…' : (s?.activeDeliverers ?? '—')}
          spark={[70,62,75,60,66,58,64]} />
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1.6fr 1fr', marginTop:16 }}>
        <div className="card pad">
          <RowHead
            title={t('volumeDeliveries')} sub={t('last7Douala')}
            right={<div className="legend"><span><i style={{background:'#178A3C'}}/> {t('gmv')}</span><span><i style={{background:'#E8551C'}}/> {t('deliveries')}</span></div>}
          />
          {isLoading ? <Skeleton h={180} /> : (
            <div className="bars">
              {trend.map((d) => (
                <div className="b" key={d.day}>
                  <div className="col"   style={{ height:`${Math.round(d.gmv   / maxGmv * 100)}%` }} />
                  <div className="col o" style={{ height:`${Math.round(d.count / maxCnt * 100)}%`, marginTop:-6 }} />
                  <div className="lb">{d.day}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card pad">
          <RowHead title={t('statusTitle')} />
          {isLoading ? <Skeleton h={150} /> : (
            <div style={{ display:'flex', alignItems:'center', gap:24 }}>
              <div className="donut" style={{ background: donut }} />
              <div className="don-leg" style={{ flex:1 }}>
                <div className="it"><i style={{background:'#178A3C'}}/><span>{t('delivered')}</span><b>{pLivre}%</b></div>
                <div className="it"><i style={{background:'#E8551C'}}/><span>{t('inTransit')}</span><b>{pRoute}%</b></div>
                <div className="it"><i style={{background:'#B8860B'}}/><span>{t('pending')}</span><b>{pAttente}%</b></div>
                <div className="it"><i style={{background:'#D6D6CE'}}/><span>{t('cancelled')}</span><b>{pAnnule}%</b></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1fr 1.1fr', marginTop:16 }}>
        <div className="card pad">
          <RowHead title={t('topZones')} right={<button className="btn ghost sm" onClick={() => nav('/zones')}>{t('viewMap')}</button>} />
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[['Akwa',88,842,''],['Bonapriso',72,689,''],['Bonabéri',58,531,'o'],['Deïdo',44,410,''],['New-Bell',32,298,'o']].map(([n,w,c,tone]) => (
              <div key={n}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}><b>{n}</b><span className="mono muted">{c}</span></div>
                <Progress value={w} tone={tone} />
              </div>
            ))}
          </div>
        </div>

        <div className="card pad">
          <RowHead title={t('liveActivity')} right={<span className="pill ok"><i className="d"/> {t('live')}</span>} />
          <div className="feed">
            {[
              { ic:'✓', tone:'g', text: <><b>KG-2841</b> livrée à Akwa · 2 500 XAF</> },
              { ic:'📦', tone:'b', text: <><b>Jean K.</b> a accepté une course Express</> },
              { ic:'⚠', tone:'o', text: <>Incident signalé sur <b>KG-2836</b></> },
              { ic:'📋', tone:'k', text: <><b>Awa N.</b> a soumis ses documents KYC</> },
              { ic:'💸', tone:'g', text: <>Retrait <b>–45 000 XAF</b> · MTN MoMo</> },
            ].map((item, i) => (
              <div className="it" key={i}>
                <div className={`ic ${item.tone}`}>{item.ic}</div>
                <div><div className="tx">{item.text}</div><div className="tm">il y a {i * 2 + 1} min</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
