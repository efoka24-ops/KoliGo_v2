import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Pill, RowHead } from './ui.jsx';

const STATUS_MAP = {
  EN_ATTENTE: { key:'pending',   tone:'warn'   },
  ACCEPTE:    { key:'inTransit', tone:'info'   },
  EN_ROUTE:   { key:'inTransit', tone:'info'   },
  LIVRE:      { key:'delivered', tone:'ok'     },
  ANNULE:     { key:'cancelled', tone:'mut'    },
};

export default function DeliveryDrawer({ delivery, onClose }) {
  const { t } = useI18n();
  const open = Boolean(delivery);
  const d    = delivery || {};

  const st = STATUS_MAP[d.status] || STATUS_MAP[d.statusKey] || { key: d.statusKey || 'pending', tone: d.statusTone || 'warn' };
  const price = d.priceXAF ? `${d.priceXAF.toLocaleString('fr-FR')}` : (d.price || '—');
  const from  = d.pickupAddress  || d.from  || '—';
  const to    = d.dropoffAddress || d.to    || '—';

  return (
    <>
      <div className={`scrim ${open ? 'on' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'on' : ''}`}>
        <div className="dw-head">
          <div>
            <div className="id">{d.id || d.clientToken || 'KG-0000'}</div>
            <div style={{ fontWeight:800, fontSize:17 }}>{t('deliveryDetail')}</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="dw-body">
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <Pill tone={st.tone}>{t(st.key)}</Pill>
            <Pill tone="orange">{d.delivererType || d.type || 'Standard'}</Pill>
            <span className="muted mono-sm" style={{ marginLeft:'auto' }}>
              {d.createdAt ? new Date(d.createdAt).toLocaleString('fr-FR', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' }) : '—'}
            </span>
          </div>

          <div className="card pad">
            <div className="kv">
              <div><div className="k">{t('vendor')}</div><div className="v">{d.vendor?.name || d.vendor || '—'}</div></div>
              <div><div className="k">{t('deliverer')}</div><div className="v">{d.deliverer?.name || d.deliverer || '—'}</div></div>
              <div><div className="k">{t('weight')}</div><div className="v">{d.weightKg ? `${d.weightKg} kg` : '—'}</div></div>
              <div><div className="k">{t('route')}</div><div className="v" style={{ fontSize:12 }}>{from} → {to}</div></div>
              <div><div className="k">{t('pickup')}</div><div className="v" style={{ fontFamily:'var(--mono)', letterSpacing:'.1em' }}>{d.collectCode || '—'}</div></div>
              <div><div className="k">{t('reception')}</div><div className="v" style={{ fontFamily:'var(--mono)', letterSpacing:'.1em' }}>{d.deliverCode || '—'}</div></div>
            </div>
          </div>

          <div>
            <RowHead title={<span style={{ fontSize:14 }}>{t('trustCodes')}</span>} />
            <div style={{ display:'flex', gap:12 }}>
              <div className="codecard o" style={{ flex:1 }}>
                <div>
                  <div className="k" style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--orange-700)', fontWeight:700 }}>{t('pickup')}</div>
                  <div className="code">{d.collectCode || '——'}</div>
                </div>
              </div>
              <div className="codecard g" style={{ flex:1 }}>
                <div>
                  <div className="k" style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--green-700)', fontWeight:700 }}>{t('reception')}</div>
                  <div className="code">{d.deliverCode || '——'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card pad">
            <RowHead title={<span style={{ fontSize:14 }}>{t('paymentSplit')}</span>} right={<span className="amt b">{price} XAF</span>} />
            <div className="split"><div className="l"><Pill tone="ok">{t('vendor')}</Pill></div><span className="amt">{d.priceXAF ? Math.round(d.priceXAF * 0.82).toLocaleString('fr-FR') : '—'}</span></div>
            <div className="split"><div className="l"><Pill tone="orange">{t('deliverer')}</Pill></div><span className="amt">{d.delivererEarning ? d.delivererEarning.toLocaleString('fr-FR') : '—'}</span></div>
            <div className="split"><div className="l"><Pill tone="mut">KoliGo · 3%</Pill></div><span className="amt">{d.commissionXAF ? d.commissionXAF.toLocaleString('fr-FR') : '—'}</span></div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button className="btn" style={{ flex:1 }}>{t('paymentReceipt')}</button>
            <button className="btn" style={{ flex:1 }}>{t('contact')}</button>
          </div>
        </div>
      </aside>
    </>
  );
}
