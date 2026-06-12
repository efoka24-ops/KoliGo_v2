import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Pill, Avatar, Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';
import { deliveries as mockData } from '../data.js';

const FILTERS = [
  { key:'all',       label:'all',       status: undefined         },
  { key:'inTransit', label:'inTransit', status:'EN_ROUTE'         },
  { key:'pending',   label:'pending',   status:'EN_ATTENTE'       },
  { key:'delivered', label:'delivered', status:'LIVRE'            },
  { key:'issue',     label:'issues',    status:'ANNULE'           },
];

const STATUS_MAP = {
  EN_ATTENTE: { key:'pending',   tone:'warn' },
  ACCEPTE:    { key:'inTransit', tone:'info' },
  EN_ROUTE:   { key:'inTransit', tone:'info' },
  LIVRE:      { key:'delivered', tone:'ok'   },
  ANNULE:     { key:'cancelled', tone:'mut'  },
};

export default function Deliveries({ onOpen }) {
  const { t }   = useI18n();
  const qc      = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [page, setPage]     = useState(1);

  const f = FILTERS.find(f => f.key === filter) || FILTERS[0];

  const { data, isLoading } = useQuery({
    queryKey: ['admin-deliveries', filter, page],
    queryFn:  () => adminApi.deliveries({ status: f.status, page }),
    placeholderData: (prev) => prev,
  });

  const cancelMut = useMutation({
    mutationFn: adminApi.cancelDelivery,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-deliveries'] }),
  });

  const rows = data?.items ?? mockData;

  return (
    <section className="content">
      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((f) => (
            <span key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`}
              onClick={() => { setFilter(f.key); setPage(1); }}>
              {t(f.label)}
            </span>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <button className="btn sm">{t('filters')}</button>
        <button className="btn sm">{t('export')}</button>
      </div>

      <div className="card" style={{ overflow:'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th><th>{t('vendor')}</th><th>{t('deliverer')}</th><th>{t('route')}</th>
              <th>{t('type')}</th><th>{t('price')}</th><th>{t('status')}</th><th/>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({length:5}).map((_,i) => (
                <tr key={i}><td colSpan={8}><Skeleton h={18} /></td></tr>
              ))
            ) : rows.map((d) => {
              const id    = d.id || d.clientToken;
              const vName = d.vendor?.name  || d.vendor  || '—';
              const lName = d.deliverer?.name || d.deliverer || '—';
              const from  = d.pickupAddress  || d.from  || '—';
              const to    = d.dropoffAddress || d.to    || '—';
              const priceStr = d.priceXAF ? d.priceXAF.toLocaleString('fr-FR') : (d.price || '—');
              const st    = STATUS_MAP[d.status] || { key: d.statusKey || 'pending', tone: d.statusTone || 'warn' };
              const type  = d.delivererType || d.type || 'Standard';
              const typeTone = { TEMPORAIRE:'mut', PERMANENT:'mut', EXPRESS:'orange', VVIP:'info', INTERURBAIN:'b' }[type] || d.typeTone || 'mut';

              return (
                <tr key={id} onClick={() => onOpen(d)}>
                  <td className="id">{id}</td>
                  <td><div className="usr"><Avatar tone="g">{vName.charAt(0)}</Avatar><div className="nm">{vName}</div></div></td>
                  <td>
                    {lName === '—'
                      ? <span className="muted">—</span>
                      : <div className="usr"><Avatar tone="o">{lName.charAt(0)}</Avatar><div className="nm">{lName}</div></div>}
                  </td>
                  <td><div className="trip"><span className="dot"/>{from} <span className="arr">→</span> <span className="dot g"/>{to}</div></td>
                  <td><Pill tone={typeTone}>{type}</Pill></td>
                  <td className="amt">{priceStr}</td>
                  <td><Pill tone={st.tone}>{t(st.key)}</Pill></td>
                  <td onClick={e => e.stopPropagation()}>
                    {d.status !== 'LIVRE' && d.status !== 'ANNULE' && (
                      <button className="btn sm" style={{ color:'var(--danger)', borderColor:'#F0C9B6' }}
                        onClick={() => cancelMut.mutate(d.id)}>✕</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && (
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
          <button className="btn sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
          <span style={{ padding:'7px 12px', fontSize:12, color:'var(--muted)' }}>Page {page}</span>
          <button className="btn sm" disabled={data.items?.length < 25} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      )}
    </section>
  );
}
