import React, { useEffect, useState } from 'react';
import api from '../api.js';

/** Photo d'un dossier KYC. Elle exige l'en-tête d'authentification : on la charge puis on l'affiche via une URL locale (blob). */
export default function KycDocImage({ docId, label }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let url = null;
    api.get(`/admin/kyc-doc/${docId}`, { responseType: 'blob' })
      .then((r) => { url = URL.createObjectURL(r.data); setSrc(url); })
      .catch(() => setErr(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [docId]);

  const box = { height: 150, background: 'var(--cream)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 };
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      {err ? <div style={box}>Indisponible</div> : !src ? <div style={box}>Chargement…</div> : (
        <a href={src} target="_blank" rel="noreferrer" title="Ouvrir en grand">
          <img src={src} alt={label} style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
        </a>
      )}
    </div>
  );
}
