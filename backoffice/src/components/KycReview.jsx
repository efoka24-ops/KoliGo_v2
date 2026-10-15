import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api.js';
import KycDocImage from './KycDocImage.jsx';
import { CheckFindings, DecisionPill } from '../modules/KycChecks.jsx';

const DOC_ORDER = ['ID_FRONT', 'ID_BACK', 'SELFIE'];
const DOC_LABELS = { ID_FRONT: 'CNI recto', ID_BACK: 'CNI verso', SELFIE: 'Selfie avec la CNI' };

/**
 * Revue d'un dossier KYC : numéro de CNI, les trois photos, puis approbation ou refus (motif obligatoire).
 * On ne propose plus d'approuver sans voir les documents.
 */
export default function KycReview({ userId, onDecided, readOnly = false }) {
  const { data: u, isLoading } = useQuery({ queryKey: ['admin-user', userId], queryFn: () => adminApi.getUser(userId) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (isLoading || !u) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement du dossier…</div>;

  // Dernière photo de chaque type
  const docs = {};
  (u.kycDocuments || []).forEach((d) => { docs[d.type] = d; });
  const complete = DOC_ORDER.every((t) => docs[t]);

  const decide = async (status) => {
    let reason;
    if (status === 'REJECTED') {
      reason = (window.prompt('Motif du refus (obligatoire, il sera visible par la personne) :') || '').trim();
      if (!reason) return;
    }
    setBusy(true);
    setError('');
    try {
      await adminApi.reviewKyc(userId, status, reason);
      onDecided?.(status);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Dossier KYC</div>
      <div className="kv" style={{ marginBottom: 12 }}>
        <div><div className="k">N° de CNI déclaré</div><div className="v mono-sm">{u.cniNumber || '—'}</div></div>
        <div><div className="k">Envoyé le</div><div className="v">{(u.kycDocuments || [])[0] ? new Date(String(u.kycDocuments[0].createdAt).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR') : '—'}</div></div>
      </div>
      {(u.kycChecks || []).length > 0 && (
        <div style={{ margin: '0 0 12px', padding: 10, borderRadius: 10, background: '#F6F4EE', display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>VÉRIFICATION AUTOMATIQUE</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <DecisionPill check={u.kycChecks[0]} />
            <span className="muted mono-sm">{new Date(String(u.kycChecks[0].createdAt).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR')} · {u.kycChecks[0].triggeredBy}</span>
          </div>
          {u.kycChecks[0].reason && <div style={{ fontSize: 12.5 }}>{u.kycChecks[0].reason}</div>}
          <CheckFindings check={u.kycChecks[0]} />
          <div><button className="btn sm" disabled={busy} onClick={async () => { setBusy(true); try { await adminApi.kycRerun(userId); onDecided?.('RERUN'); } catch (e) { setError(e.response?.data?.error || e.message); } finally { setBusy(false); } }}>Relancer la vérification</button></div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {DOC_ORDER.map((t) => (docs[t]
          ? <KycDocImage key={t} docId={docs[t].id} label={DOC_LABELS[t]} />
          : <div key={t} style={{ flex: 1, minWidth: 120, fontSize: 12, color: '#C00' }}>{DOC_LABELS[t]} : manquante</div>))}
      </div>
      {!readOnly && !complete && <div style={{ color: '#C00', fontSize: 12, marginTop: 8 }}>Dossier incomplet : une photo manque, refusez-le avec un motif.</div>}
      {error && <div style={{ color: '#C00', fontSize: 13, marginTop: 8 }}>{error}</div>}
      {readOnly ? <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>Dossier déjà traité : statut {u.kycStatus}.</div> : <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="btn pri" style={{ flex: 1 }} disabled={busy || !complete} onClick={() => decide('VERIFIED')}>✓ Approuver</button>
        <button className="btn" style={{ flex: 1, color: 'var(--danger)', borderColor: '#F0C9B6' }} disabled={busy} onClick={() => decide('REJECTED')}>✗ Rejeter…</button>
      </div>}
    </div>
  );
}
