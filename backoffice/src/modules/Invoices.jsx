import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api.js';
import { Pill } from '../components/ui.jsx';

// Factures par livraison : vente (vendeur), paiement (destinataire), livraison (livreur).
// Les montants viennent du serveur ; l'impression / PDF passe par le navigateur.

const STATUS_TONE = { EN_ATTENTE: 'info', ACCEPTE: 'orange', EN_ROUTE: 'warn', LIVRE: 'ok', ANNULE: 'danger' };
const STATUS_LABELS = { EN_ATTENTE: 'En attente', ACCEPTE: 'Accepté', EN_ROUTE: 'En route', LIVRE: 'Livré', ANNULE: 'Annulé' };
const TYPES = [
  { key: 'sale', label: 'Vente', who: 'Vendeur' },
  { key: 'payment', label: 'Paiement', who: 'Destinataire' },
  { key: 'delivery', label: 'Livraison', who: 'Livreur' },
];

const xaf = (n) => `${n < 0 ? '- ' : ''}${Math.abs(Number(n || 0)).toLocaleString('fr-FR')} XAF`;
const dt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #kg-invoice, #kg-invoice * { visibility: visible !important; }
  #kg-invoice { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; }
  .kg-noprint { display: none !important; }
}`;

function Party({ label, p }) {
  if (!p) return null;
  return (
    <div style={{ flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#76746B', fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{p.shopName || p.name || '—'}</div>
      {p.shopName && p.name && <div style={{ fontSize: 12, color: '#555' }}>{p.name}</div>}
      {p.phone && <div style={{ fontSize: 12, color: '#555' }}>{p.phone}</div>}
    </div>
  );
}

function InvoiceView({ inv, onClose }) {
  return (
    <div className="kg-noprint-wrap" style={{ position: 'fixed', inset: 0, background: 'rgba(14,42,28,.55)', zIndex: 1000, overflowY: 'auto', padding: '30px 16px' }}>
      <style>{PRINT_CSS}</style>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="kg-noprint" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 10 }}>
          <button className="btn primary" onClick={() => window.print()}>Imprimer / Enregistrer en PDF</button>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
        <div id="kg-invoice" style={{ background: '#fff', borderRadius: 14, border: '1px solid #E7E7E0', padding: 32, color: '#15140F', boxShadow: '0 10px 40px rgba(0,0,0,.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '3px solid #178A3C', paddingBottom: 16 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>Koli<span style={{ color: '#E8551C' }}>Go</span></div>
              <div style={{ fontSize: 12, color: '#76746B' }}>La livraison collaborative au Cameroun</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{inv.title}</div>
              <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 }}>N° {inv.number}</div>
              <div style={{ fontSize: 12, color: '#76746B' }}>{dt(inv.issuedAt)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', margin: '20px 0' }}>
            <Party label="Vendeur" p={inv.vendor} />
            <Party label="Destinataire" p={inv.recipient} />
            <Party label="Livreur" p={inv.deliverer} />
          </div>

          <div style={{ background: '#F4F5F1', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 18 }}>
            <b>Colis {inv.delivery.ref}</b> · {inv.delivery.pickupAddress} → {inv.delivery.dropoffAddress}
            {inv.delivery.description ? ` · ${inv.delivery.description}` : ''}
            {inv.delivery.weightKg ? ` · ${inv.delivery.weightKg} kg` : ''}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#76746B', fontSize: 12 }}>
                <th style={{ padding: '8px 0', borderBottom: '1px solid #E7E7E0' }}>Désignation</th>
                <th style={{ padding: '8px 0', borderBottom: '1px solid #E7E7E0', textAlign: 'right' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F0EDE4' }}>{l.label}</td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F0EDE4', textAlign: 'right', color: l.amountXAF < 0 ? '#D8472A' : undefined, whiteSpace: 'nowrap' }}>{xaf(l.amountXAF)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '14px 0', fontWeight: 800 }}>TOTAL</td>
                <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: 900, fontSize: 20, color: '#095C2E', whiteSpace: 'nowrap' }}>{xaf(inv.total)}</td>
              </tr>
            </tbody>
          </table>

          {inv.payment && (
            <div style={{ marginTop: 10, border: '1px solid #E7E7E0', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.7 }}>
              <b>Paiement</b> : {inv.payment.method} — <b style={{ color: '#178A3C' }}>{inv.payment.status}</b><br />
              {inv.payment.reference && <>Référence : <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{inv.payment.reference}</span><br /></>}
              {inv.payment.transactionId && <>Transaction : <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{inv.payment.transactionId}</span><br /></>}
              {inv.payment.payerPhone && <>Numéro payeur : {inv.payment.payerPhone}<br /></>}
              {inv.payment.paidAt && <>Payé le : {dt(inv.payment.paidAt)}</>}
            </div>
          )}

          {(inv.notes || []).map((n, i) => <p key={i} style={{ fontSize: 12.5, color: '#444', marginTop: 12 }}>{n}</p>)}
          <p style={{ fontSize: 11, color: '#9A988E', marginTop: 18, borderTop: '1px solid #E7E7E0', paddingTop: 10 }}>{inv.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

export default function Invoices() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('LIVRE');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.invoices({ status: status || 'all', q: search || undefined, page });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch { setError('Erreur chargement des factures'); }
    finally { setLoading(false); }
  }, [status, search, page]);

  useEffect(() => { load(); }, [load]);

  const open = async (deliveryId, type) => {
    try { setInvoice(await adminApi.invoice(deliveryId, type)); }
    catch (e) { setError(e?.response?.data?.error || 'Facture indisponible'); }
  };

  return (
    <section className="content">
      {error && (
        <div style={{ background: '#FEE', color: '#C00', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}<button className="x" onClick={() => setError('')} style={{ float: 'right' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" placeholder="Réf, boutique, destinataire, adresse…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 220 }} />
        <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ width: 170 }}>
          <option value="LIVRE">Livrées</option>
          <option value="">Toutes</option>
          <option value="EN_ROUTE">En route</option>
          <option value="ACCEPTE">Acceptées</option>
          <option value="ANNULE">Annulées</option>
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Chargement…</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Aucune livraison.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Réf</th><th>Trajet</th><th>Vendeur</th><th>Livreur</th><th>Statut</th><th>Montant</th><th>Factures</th></tr>
            </thead>
            <tbody>
              {items.map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{d.ref}</td>
                  <td style={{ fontSize: 12.5 }}>{d.pickupAddress} → {d.dropoffAddress}<div style={{ color: 'var(--muted)', fontSize: 11 }}>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</div></td>
                  <td>{d.shopName || d.vendor?.name || '—'}</td>
                  <td>{d.deliverer?.name || '—'}</td>
                  <td><Pill tone={STATUS_TONE[d.status] || 'mut'}>{STATUS_LABELS[d.status] || d.status}</Pill></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{xaf(d.priceXAF)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {TYPES.map(t => {
                        const num = d.invoices?.[t.key];
                        return (
                          <button key={t.key} className="btn" disabled={!num} title={num ? `${t.who} · ${num}` : 'Disponible après la livraison'}
                            onClick={() => open(d.id, t.key)} style={{ padding: '4px 10px', fontSize: 12, opacity: num ? 1 : 0.4 }}>
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
        <span>{total} livraison(s)</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button>
          Page {page}
          <button className="btn" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>→</button>
        </span>
      </div>

      {invoice && <InvoiceView inv={invoice} onClose={() => setInvoice(null)} />}
    </section>
  );
}
