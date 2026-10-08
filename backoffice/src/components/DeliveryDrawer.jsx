import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Pill, RowHead } from './ui.jsx';

const STATUS_MAP = {
  EN_ATTENTE: { key:'pending',   tone:'warn' },
  ACCEPTE:    { key:'inTransit', tone:'info' },
  EN_ROUTE:   { key:'inTransit', tone:'info' },
  LIVRE:      { key:'delivered', tone:'ok'   },
  ANNULE:     { key:'cancelled', tone:'mut'  },
};

const xaf = (n) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`;

/** Détail d'une livraison : uniquement des données de la base, rien n'est affiché sans livraison sélectionnée. */
export default function DeliveryDrawer({ delivery, onClose }) {
  const { t } = useI18n();
  const d = delivery;
  const open = Boolean(d);
  const st = (d && STATUS_MAP[d.status]) || STATUS_MAP.EN_ATTENTE;
  const ref = d ? `KG-${String(d.id || '').slice(-8).toUpperCase()}` : '';
  const phone = d?.deliverer?.phone || d?.vendor?.phone || null;

  return (
    <>
      <div className={`scrim ${open ? 'on' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'on' : ''}`}>
        {d && (
          <>
            <div className="dw-head">
              <div>
                <div className="id">{ref}</div>
                <div style={{ fontWeight:800, fontSize:17 }}>{t('deliveryDetail')}</div>
              </div>
              <button className="x" onClick={onClose}>✕</button>
            </div>

            <div className="dw-body">
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <Pill tone={st.tone}>{t(st.key)}</Pill>
                {d.delivererType && <Pill tone="orange">{d.delivererType}</Pill>}
                {d.size && <Pill tone="mut">Gabarit {d.size}</Pill>}
                <span className="muted mono-sm" style={{ marginLeft:'auto' }}>
                  {d.createdAt ? new Date(`${String(d.createdAt).replace(' ', 'T')}Z`).toLocaleString('fr-FR', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' }) : ''}
                </span>
              </div>

              <div className="card pad">
                <div className="kv">
                  <div><div className="k">{t('vendor')}</div><div className="v">{d.vendor?.name || '—'}</div></div>
                  <div><div className="k">{t('deliverer')}</div><div className="v">{d.deliverer?.name || 'Pas encore assignée'}</div></div>
                  <div><div className="k">Colis</div><div className="v">{d.description || d.category || '—'}</div></div>
                  <div><div className="k">{t('weight')}</div><div className="v">{d.weightKg ? `${d.weightKg} kg (référence)` : '—'}</div></div>
                  <div style={{ gridColumn:'1 / -1' }}><div className="k">{t('route')}</div><div className="v" style={{ fontSize:12 }}>{d.pickupAddress || '—'} → {d.dropoffAddress || '—'}{d.distanceKm ? ` · ${d.distanceKm} km` : ''}</div></div>
                  <div><div className="k">Destinataire</div><div className="v">{d.recipientName || '—'}</div></div>
                  <div><div className="k">Valeur marchandise</div><div className="v">{d.productPriceXAF ? xaf(d.productPriceXAF) : '—'}</div></div>
                </div>
              </div>

              {(d.collectCode || d.deliverCode) && (
                <div>
                  <RowHead title={<span style={{ fontSize:14 }}>{t('trustCodes')}</span>} />
                  <div style={{ display:'flex', gap:12 }}>
                    <div className="codecard o" style={{ flex:1 }}>
                      <div>
                        <div className="k" style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--orange-700)', fontWeight:700 }}>{t('pickup')}</div>
                        <div className="code">{d.collectCode || '—'}</div>
                      </div>
                    </div>
                    <div className="codecard g" style={{ flex:1 }}>
                      <div>
                        <div className="k" style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--green-700)', fontWeight:700 }}>{t('reception')}</div>
                        <div className="code">{d.deliverCode || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="card pad">
                <RowHead title={<span style={{ fontSize:14 }}>{t('paymentSplit')}</span>} right={<span className="amt b">{xaf(d.priceXAF)}</span>} />
                <div className="split"><div className="l"><Pill tone="orange">{t('deliverer')}</Pill></div><span className="amt">{xaf(d.delivererEarning)}</span></div>
                <div className="split"><div className="l"><Pill tone="mut">KoliGo{d.priceXAF ? ` · ${(d.commissionXAF / d.priceXAF * 100).toFixed(1).replace('.0', '')} %` : ''}</Pill></div><span className="amt">{xaf(d.commissionXAF)}</span></div>
              </div>

              {phone && (
                <div style={{ display:'flex', gap:10 }}>
                  <a className="btn" style={{ flex:1, textAlign:'center', textDecoration:'none' }} href={`tel:${phone}`}>Appeler {d.deliverer?.phone ? 'le livreur' : 'le vendeur'}</a>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
