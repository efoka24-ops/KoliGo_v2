import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const AUDIENCES = [
  { key: 'ALL', label: 'Tout le monde (vendeurs et livreurs)' },
  { key: 'VENDOR', label: 'Tous les vendeurs' },
  { key: 'DELIVERER', label: 'Tous les livreurs' },
  { key: 'USER', label: 'Une personne précise' },
];
const AUD_LABEL = { ALL: 'Tout le monde', VENDOR: 'Vendeurs', DELIVERER: 'Livreurs', USER: 'Une personne' };

export default function Notifications() {
  const qc = useQueryClient();
  const [audience, setAudience] = useState('ALL');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState(null);

  const history = useQuery({ queryKey: ['admin-notifications'], queryFn: adminApi.notifications });
  const users = useQuery({ queryKey: ['admin-users-pick'], queryFn: () => adminApi.users({ page: 1 }), enabled: audience === 'USER' });

  const send = useMutation({
    mutationFn: () => adminApi.sendNotification({ audience, userId: audience === 'USER' ? userId : undefined, title, body }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
      setMsg({ ok: true, text: `Message envoyé à ${r.recipients} personne(s)${r.push ? ' (notification push + application)' : ' (visible dans l\'application ; push téléphone non activé)'}.` });
      setTitle(''); setBody('');
    },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });

  const can = title.trim().length >= 2 && body.trim().length >= 2 && (audience !== 'USER' || userId) && !send.isPending;
  const doSend = () => {
    const who = audience === 'USER' ? 'cette personne' : AUD_LABEL[audience].toLowerCase();
    if (window.confirm(`Envoyer ce message à : ${who} ?`)) { setMsg(null); send.mutate(); }
  };

  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Notifications</h2>
          <div className="sub">
            Envoyez un message aux utilisateurs de l'application. Il apparaît dans leur centre de notifications
            {history.data && !history.data.push ? ' (l\'envoi push sur le téléphone s\'activera dès que Firebase sera configuré).' : ' et en notification push sur le téléphone.'}
          </div>
        </div>
      </div>

      <div className="card pad" style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
        <label>
          <div className="k">Destinataires</div>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} style={{ width: '100%', padding: 10 }}>
            {AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        {audience === 'USER' && (
          <label>
            <div className="k">Personne</div>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: '100%', padding: 10 }}>
              <option value="">— Choisir —</option>
              {(users.data?.items || []).map((u) => <option key={u.id} value={u.id}>{u.name} · {u.phone}</option>)}
            </select>
          </label>
        )}
        <label>
          <div className="k">Titre</div>
          <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Nouveaux tarifs à Douala" style={{ width: '100%', padding: 10 }} />
        </label>
        <label>
          <div className="k">Message ({body.length}/500)</div>
          <textarea value={body} maxLength={500} rows={4} onChange={(e) => setBody(e.target.value)} placeholder="Votre message…" style={{ width: '100%', padding: 10 }} />
        </label>
        {msg && <div style={{ color: msg.ok ? 'var(--green, #0A7A3E)' : '#C00', fontSize: 13 }}>{msg.text}</div>}
        <div><button className="btn pri" disabled={!can} onClick={doSend}>{send.isPending ? 'Envoi…' : 'Envoyer'}</button></div>
      </div>

      <div className="card" style={{ overflow: 'hidden', marginTop: 16 }}>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Destinataires</th><th>Titre</th><th>Message</th><th>Reçu par</th></tr></thead>
          <tbody>
            {history.isLoading ? <tr><td colSpan={5}><Skeleton h={18} /></td></tr>
              : (history.data?.items || []).length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucun message envoyé pour le moment.</td></tr>
              : history.data.items.map((b) => (
                <tr key={b.id}>
                  <td className="mono-sm">{new Date(String(b.createdAt).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR')}</td>
                  <td>{b.audience === 'USER' ? (b.targetName || 'Une personne') : AUD_LABEL[b.audience]}</td>
                  <td><b>{b.title}</b></td>
                  <td style={{ maxWidth: 320 }}>{b.body}</td>
                  <td className="mono-sm">{b.recipients}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
