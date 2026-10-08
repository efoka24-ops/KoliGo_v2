import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Kpi, RowHead, Progress, Skeleton } from '../components/ui.jsx';
import { IconFinance, IconBox } from '../components/icons.jsx';
import { adminApi } from '../api.js';

const KIND_ICON = { delivered: ['✓', 'g'], inroute: ['🛵', 'b'], accepted: ['📦', 'b'], created: ['＋', 'k'], cancelled: ['✕', 'k'], issue: ['⚠', 'o'], kyc: ['📋', 'k'], withdrawal: ['💸', 'g'] };

/** « il y a 5 min » à partir d'une date UTC de la base. */
export function ago(at) {
  if (!at) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(`${String(at).replace(' ', 'T')}Z`).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

const deltaProps = (d) => (d == null ? {} : { delta: `${Math.abs(d)}%`, deltaDir: d >= 0 ? 'up' : 'down' });

export default function Dashboard() {
  const { t } = useI18n();
  const nav   = useNavigate();
  const { data: a, isLoading, error } = useQuery({
    queryKey: ['admin-analytics', '30d'],
    queryFn:  () => adminApi.analytics('30d'),
    refetchInterval: 30_000,
  });

  const k      = a?.kpis;
  const last7  = a?.last7 ?? [];
  const maxGmv = Math.max(...last7.map(d => d.gmv), 1);
  const maxCnt = Math.max(...last7.map(d => d.count), 1);

  const sb = a?.statusBreakdown || {};
  const total = Object.values(sb).reduce((x, y) => x + y, 0);
  const pct = (n) => (total ? Math.round(n / total * 100) : 0);
  const pLivre   = pct(sb.LIVRE || 0);
  const pRoute   = pct((sb.EN_ROUTE || 0) + (sb.ACCEPTE || 0));
  const pAttente = pct(sb.EN_ATTENTE || 0);
  const pAnnule  = total ? Math.max(0, 100 - pLivre - pRoute - pAttente) : 0;
  const donut = total
    ? `conic-gradient(#178A3C 0 ${pLivre}%,#E8551C ${pLivre}% ${pLivre + pRoute}%,#B8860B ${pLivre + pRoute}% ${pLivre + pRoute + pAttente}%,#D6D6CE ${pLivre + pRoute + pAttente}% 100%)`
    : 'conic-gradient(#EEE 0 100%)';

  const zones = a?.topZones ?? [];
  const maxZone = Math.max(...zones.map(z => z.deliveries), 1);

  if (error) return <section className="content"><div className="card pad" style={{ color:'#C00' }}>Impossible de charger les statistiques.</div></section>;

  return (
    <section className="content">
      <div className="grid" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <Kpi iconTone="g" icon={<IconFinance width={20} height={20}/>}
          {...deltaProps(k?.gmv.delta)} label={t('gmv30')}
          value={isLoading ? '…' : (k.gmv.value / 1_000_000).toFixed(2)} unit="M XAF"
          spark={last7.map(d => d.gmv)} />
        <Kpi iconTone="b" icon={<IconBox width={20} height={20}/>}
          {...deltaProps(k?.deliveries.delta)} label={t('deliveries30')}
          value={isLoading ? '…' : k.deliveries.value}
          spark={last7.map(d => d.count)} />
        <Kpi iconTone="o" icon={<span style={{fontWeight:700}}>₣</span>}
          {...deltaProps(k?.commission.delta)} label={t('commission30')}
          value={isLoading ? '…' : (k.commission.value / 1_000).toFixed(1)} unit="k XAF" />
        <Kpi iconTone="k" icon={<span style={{fontWeight:700}}>⟳</span>}
          label={t('activeDeliverers')}
          value={isLoading ? '…' : k.activeDeliverers} />
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1.6fr 1fr', marginTop:16 }}>
        <div className="card pad">
          <RowHead
            title={t('volumeDeliveries')} sub="7 derniers jours"
            right={<div className="legend"><span><i style={{background:'#178A3C'}}/> {t('gmv')}</span><span><i style={{background:'#E8551C'}}/> {t('deliveries')}</span></div>}
          />
          {isLoading ? <Skeleton h={180} /> : (
            <div className="bars">
              {last7.map((d, i) => (
                <div className="b" key={i}>
                  <div className="col"   style={{ height:`${Math.round(d.gmv   / maxGmv * 100)}%` }} />
                  <div className="col o" style={{ height:`${Math.round(d.count / maxCnt * 100)}%`, marginTop:-6 }} />
                  <div className="lb">{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card pad">
          <RowHead title={t('statusTitle')} sub="30 derniers jours" />
          {isLoading ? <Skeleton h={150} /> : (
            <div style={{ display:'flex', alignItems:'center', gap:24 }}>
              <div className="donut" style={{ background: donut }} />
              <div className="don-leg" style={{ flex:1 }}>
                <div className="it"><i style={{background:'#178A3C'}}/><span>{t('delivered')}</span><b>{pLivre}%</b></div>
                <div className="it"><i style={{background:'#E8551C'}}/><span>{t('inTransit')}</span><b>{pRoute}%</b></div>
                <div className="it"><i style={{background:'#B8860B'}}/><span>{t('pending')}</span><b>{pAttente}%</b></div>
                <div className="it"><i style={{background:'#D6D6CE'}}/><span>{t('cancelled')}</span><b>{pAnnule}%</b></div>
                {!total && <div style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>Aucune livraison sur la période.</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1fr 1.1fr', marginTop:16 }}>
        <div className="card pad">
          <RowHead title={t('topZones')} sub="lieux de collecte, 30 jours" right={<button className="btn ghost sm" onClick={() => nav('/zones')}>{t('viewMap')}</button>} />
          {isLoading ? <Skeleton h={150} /> : zones.length === 0 ? (
            <div style={{ color:'var(--muted)', fontSize:13 }}>Aucune livraison sur la période.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {zones.map((z, i) => (
                <div key={z.name}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}><b>{z.name}</b><span className="mono muted">{z.deliveries}</span></div>
                  <Progress value={Math.round(z.deliveries / maxZone * 100)} tone={i % 2 ? 'o' : ''} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card pad">
          <RowHead title={t('liveActivity')} right={<span className="pill ok"><i className="d"/> {t('live')}</span>} />
          {isLoading ? <Skeleton h={150} /> : (a.activity.length === 0 ? (
            <div style={{ color:'var(--muted)', fontSize:13 }}>Aucune activité pour le moment.</div>
          ) : (
            <div className="feed">
              {a.activity.map((ev, i) => {
                const [ic, tone] = KIND_ICON[ev.kind] || ['•', 'k'];
                return (
                  <div className="it" key={i}>
                    <div className={`ic ${tone}`}>{ic}</div>
                    <div><div className="tx">{ev.text}</div><div className="tm">{ago(ev.at)}</div></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
