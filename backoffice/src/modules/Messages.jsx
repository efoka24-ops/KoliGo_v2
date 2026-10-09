import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const fmt = (iso) => new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR');

export default function Messages() {
  const qc = useQueryClient();
  const [flagged, setFlagged] = useState(true);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editWords, setEditWords] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-messages', flagged, search, page],
    queryFn: () => adminApi.messages({ flagged: flagged ? 1 : 0, q: search || undefined, page }),
    placeholderData: (p) => p,
    refetchInterval: 30000,
  });
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.settings });
  const words = (settings.data || []).find((s) => s.key === 'moderation_keywords')?.value;

  const clear = useMutation({
    mutationFn: (id) => adminApi.clearMessage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-messages'] }),
  });
  const block = useMutation({
    mutationFn: (id) => adminApi.blockUser(id, true),
    onSuccess: () => alert('Compte bloqué : la personne ne peut plus se connecter.'),
    onError: (e) => alert(e.response?.data?.error || e.message),
  });
  const saveWords = useMutation({
    mutationFn: (v) => adminApi.updateSetting('moderation_keywords', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-settings'] }); setEditWords(null); },
  });

  const rows = data?.items ?? [];
  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Messages</h2>
          <div className="sub">
            Tous les échanges vendeur ↔ livreur. Les messages contenant un mot surveillé (drogues, armes, faux documents…) sont signalés.
            {data ? <> · <b>{data.flaggedOpen}</b> signalé(s) à examiner</> : null}
          </div>
        </div>
        <button className="btn" onClick={() => setEditWords(words ?? '')}>Mots surveillés</button>
      </div>

      {editWords !== null && (
        <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 8 }}>
          <div className="k">Un mot ou une expression par ligne (sans accents, majuscules ignorées)</div>
          <textarea rows={8} value={editWords} onChange={(e) => setEditWords(e.target.value)} style={{ width: '100%', padding: 10, fontFamily: 'monospace' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn pri" disabled={saveWords.isPending} onClick={() => saveWords.mutate(editWords)}>Enregistrer</button>
            <button className="btn" onClick={() => setEditWords(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="chips">
          <span className={`chip ${flagged ? 'on' : ''}`} onClick={() => { setFlagged(true); setPage(1); }}>Signalés</span>
          <span className={`chip ${!flagged ? 'on' : ''}`} onClick={() => { setFlagged(false); setPage(1); }}>Tous les messages</span>
        </div>
        <div style={{ flex: 1 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setSearch(q.trim()), setPage(1))}
          placeholder="Rechercher un mot ou un nom…" style={{ padding: 8, minWidth: 240 }} />
        <button className="btn sm" onClick={() => { setSearch(q.trim()); setPage(1); }}>Chercher</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead><tr><th>Date</th><th>De</th><th>Message</th><th>Course</th><th /></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5}><Skeleton h={18} /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>{flagged ? 'Aucun message signalé.' : 'Aucun message.'}</td></tr>
              : rows.map((m) => (
                <tr key={m.id} style={m.flagged ? { background: '#FFF4EE' } : undefined}>
                  <td className="mono-sm">{fmt(m.createdAt)}</td>
                  <td><b>{m.senderName}</b><div className="mono-sm muted">{m.senderRole}</div></td>
                  <td style={{ maxWidth: 380 }}>
                    {m.content}
                    {m.flagged ? <div style={{ color: '#C4611A', fontSize: 12, marginTop: 4 }}>⚠ Mot surveillé : {m.flagReason}</div> : null}
                  </td>
                  <td className="mono-sm">{m.vendorName || '—'} → {m.delivererName || '—'}<div className="muted">{m.pickupAddress} → {m.dropoffAddress}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {m.flagged ? <button className="btn sm" onClick={() => clear.mutate(m.id)}>Sans suite</button> : null}
                    {m.flagged && m.senderId ? <button className="btn sm" style={{ color: 'var(--danger)', borderColor: '#F0C9B6', marginLeft: 6 }}
                      onClick={() => window.confirm(`Bloquer le compte de ${m.senderName} ?`) && block.mutate(m.senderId)}>Bloquer l'expéditeur</button> : null}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {data && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span style={{ padding: '7px 12px', fontSize: 12, color: 'var(--muted)' }}>Page {page} · {data.total} message(s)</span>
          <button className="btn sm" disabled={rows.length < 30} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </section>
  );
}
