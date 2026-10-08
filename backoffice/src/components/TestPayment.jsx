import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../api.js';

const AMOUNTS = [100, 200, 300, 500];

const LABELS = {
  PENDING: { text: 'En attente de validation sur le téléphone…', color: '#C4611A' },
  SUCCESS: { text: 'Paiement confirmé : le montant a été reçu et crédité à votre portefeuille.', color: '#178A3C' },
  FAILED: { text: 'Paiement refusé ou expiré.', color: '#C00' },
};

/**
 * Test de bout en bout de la passerelle Sungku : demande 100 FCFA au numéro saisi.
 * Le montant est fixé par le serveur ; seul le webhook signé de Sungku confirme le paiement.
 */
export default function TestPayment() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState(null); // { id, status }
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const poll = (id) => {
    clearInterval(timer.current);
    let n = 0;
    timer.current = setInterval(async () => {
      n += 1;
      try {
        const t = await adminApi.testPaymentStatus(id);
        setTest({ id, status: t.status });
        if (t.status !== 'PENDING' || n > 60) clearInterval(timer.current);
      } catch { /* on réessaie */ }
    }, 4000);
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    setTest(null);
    try {
      const r = await adminApi.startTestPayment(phone.trim(), amount);
      if (r.status === 'FAILED') throw new Error(r.message || 'Paiement refusé');
      setTest({ id: r.topUpId, status: 'PENDING', message: r.message, mock: r.mock, unverified: r.unverified });
      poll(r.topUpId);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const label = test ? LABELS[test.status] || LABELS.PENDING : null;

  return (
    <div className="card pad" style={{ marginBottom: 18, maxWidth: 720 }}>
      <h3 style={{ marginTop: 0 }}>Test de paiement Sungku · {amount} FCFA</h3>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
        Envoie une demande de paiement (100 à 500 FCFA) au numéro Mobile Money saisi. Le paiement n&apos;est confirmé que par le webhook signé de Sungku.
        S&apos;il aboutit, le montant est crédité à votre portefeuille administrateur. Limité à 10 essais par heure.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          style={{ maxWidth: 220 }}
          placeholder="6XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
        />
        <select value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ maxWidth: 110 }}>
          {AMOUNTS.map((a) => <option key={a} value={a}>{a} FCFA</option>)}
        </select>
        <button className="btn pri" disabled={busy || !phone.trim() || test?.status === 'PENDING'} onClick={start}>
          {busy ? 'Envoi…' : `Payer ${amount} FCFA`}
        </button>
      </div>
      {error && <div style={{ marginTop: 10, color: '#C00', fontSize: 13 }}>{error}</div>}
      {label && (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: label.color }}>
          {label.text}
          {test.mock && <span style={{ fontWeight: 400 }}> (mode simulation : aucun argent réel)</span>}
          {test.unverified && <span style={{ fontWeight: 400 }}> Réponse de Sungku incertaine : le statut sera mis à jour à la réception du webhook.</span>}
        </div>
      )}
    </div>
  );
}
