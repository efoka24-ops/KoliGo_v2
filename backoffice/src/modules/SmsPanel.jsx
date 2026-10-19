import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

/** Raison lisible d'un échec d'envoi SMS (code renvoyé par le serveur). */
export function smsErrorText(code) {
  return ({
    not_configured: 'clé de la passerelle SMS absente (Notifications → Passerelle SMS)',
    invalid_phone: 'numéro non valide (mobile camerounais attendu)',
    unreachable: 'passerelle SMS injoignable ou téléphone passerelle hors ligne',
    auth: 'clé refusée par la passerelle SMS',
    rate_limited: 'trop de codes pour ce numéro (3 par 15 minutes)',
    quota: 'quota quotidien de la passerelle atteint',
    rejected: 'refusé par la passerelle SMS',
  })[code] || (code ? `échec (${code})` : 'échec');
}

const STATUS = {
  SUBMITTED: ['Transmis à la passerelle', '#667085'],
  QUEUED: ['En file d\'attente', '#C4611A'],
  SENDING: ['Envoi en cours', '#C4611A'],
  SENT: ['Envoyé', '#0A7A3E'],
  DELIVERED: ['Délivré', '#0A7A3E'],
  FAILED: ['Échec', '#B42318'],
  EXPIRED: ['Expiré (jamais envoyé)', '#B42318'],
};
const PURPOSE = { OTP: 'Code', TEST: 'Test', SMS: 'Message' };
const utc = (iso) => (iso ? new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z')).toLocaleString('fr-FR') : '—');

/** Passerelle SMS (teeeotp) : état de la clé, quota, envoi de test et journal des derniers SMS. */
export default function SmsPanel() {
  const qc = useQueryClient();
  const [key, setKey] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState(null);

  const status = useQuery({ queryKey: ['admin-sms-status'], queryFn: adminApi.smsStatus, refetchInterval: 20000 });
  const d = status.data;
  const set = (data) => qc.setQueryData(['admin-sms-status'], data);
  const fail = (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message });

  const save = useMutation({
    mutationFn: (k) => adminApi.smsConfig(k),
    onSuccess: (r, k) => { set(r); setKey(''); setMsg({ ok: true, text: k ? 'Clé enregistrée.' : 'Clé effacée.' }); },
    onError: fail,
  });
  const test = useMutation({
    mutationFn: (p) => adminApi.smsTest(p),
    onSuccess: (r) => {
      set(r.overview);
      setMsg(r.ok ? { ok: true, text: 'SMS de test accepté par la passerelle. S\'il n\'arrive pas, le téléphone passerelle est probablement hors ligne.' } : { ok: false, text: `SMS de test refusé : ${smsErrorText(r.error)}.` });
    },
    onError: fail,
  });
  const refresh = useMutation({ mutationFn: adminApi.smsRefresh, onSuccess: set, onError: fail });

  const g = d?.gateway;
  const gwInfo = g && !g.error
    ? Object.entries(g).filter(([, v]) => ['number', 'string'].includes(typeof v)).slice(0, 6).map(([k, v]) => `${k} : ${v}`).join(' · ')
    : null;

  return (
    <div className="card pad" style={{ marginBottom: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Passerelle SMS (teeeotp)</div>
          <div className="muted" style={{ fontSize: 12.5 }}>Envoie les codes de vérification et les SMS. Un téléphone Android avec SIM, branché et connecté, envoie réellement les messages.</div>
        </div>
        <button className="btn sm" disabled={refresh.isPending} onClick={() => { setMsg(null); refresh.mutate(); }}>{refresh.isPending ? '…' : 'Actualiser'}</button>
      </div>

      {status.isLoading ? <Skeleton h={18} /> : d && (
        <div style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, background: d.configured && !g?.error ? '#EFF8F1' : '#FDECEC', color: d.configured && !g?.error ? '#0A5C2F' : '#B42318' }}>
          {!d.configured
            ? <>Clé <b>ABSENTE</b> : aucun SMS ne peut partir. Saisissez la clé du projet KoliGo ci-dessous.</>
            : g?.error
              ? <>Clé {d.keyHint} ({d.source}) · la passerelle répond : <b>{smsErrorText(g.error)}</b></>
              : <>Clé <b>{d.keyHint}</b> ({d.source}) · passerelle <b>{d.host}</b> joignable{gwInfo ? <> · {gwInfo}</> : null}</>}
        </div>
      )}

      {msg && <div style={{ padding: 10, borderRadius: 8, fontSize: 13, background: msg.ok ? '#EFF8F1' : '#FDECEC', color: msg.ok ? '#0A5C2F' : '#B42318' }}>{msg.text}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 260px' }}>
          <div className="k">Clé API du projet (sk_…)</div>
          <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={d?.configured ? 'Saisir une nouvelle clé pour remplacer' : 'sk_…'} style={{ width: '100%', padding: 9 }} />
        </label>
        <button className="btn pri" disabled={save.isPending || key.trim().length < 12} onClick={() => { setMsg(null); save.mutate(key.trim()); }}>Enregistrer la clé</button>
        {d?.source === 'back-office' && <button className="btn" disabled={save.isPending} onClick={() => window.confirm('Effacer la clé enregistrée ? Plus aucun SMS ne partira.') && save.mutate('')}>Effacer</button>}
      </div>
      {d?.source === 'serveur' && <div className="muted" style={{ fontSize: 12 }}>La clé actuelle vient de la configuration du serveur : elle a priorité sur celle saisie ici.</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 260px' }}>
          <div className="k">Envoyer un SMS de test au numéro</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="6XXXXXXXX" style={{ width: '100%', padding: 9 }} />
        </label>
        <button className="btn" disabled={test.isPending || phone.replace(/\D/g, '').length < 9 || !d?.configured} onClick={() => { setMsg(null); test.mutate(phone.trim()); }}>{test.isPending ? 'Envoi…' : 'Envoyer le test'}</button>
      </div>

      <div style={{ overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Numéro</th><th>Usage</th><th>État</th></tr></thead>
          <tbody>
            {(d?.logs ?? []).length === 0
              ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>Aucun SMS envoyé pour le moment.</td></tr>
              : d.logs.map((l) => {
                const [label, color] = STATUS[l.status] || [l.status, '#667085'];
                return (
                  <tr key={l.id}>
                    <td>{utc(l.createdAt)}</td>
                    <td>{l.phone}</td>
                    <td>{PURPOSE[l.purpose] || l.purpose}</td>
                    <td><b style={{ color }}>{label}</b>{l.error ? <div className="muted mono-sm">{smsErrorText(l.error)}</div> : null}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** E-mail : comment le serveur envoie, et test d'envoi avec l'erreur réelle. */
export function EmailPanel() {
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState(null);
  const st = useQuery({ queryKey: ['admin-email-status'], queryFn: adminApi.emailStatus });
  const test = useMutation({
    mutationFn: (t) => adminApi.emailTest(t),
    onSuccess: (r) => setMsg(r.ok
      ? { ok: true, text: 'E-mail accepté par le serveur d\'envoi. S\'il n\'arrive pas, regardez les spams : « accepté » ne garantit pas la réception.' }
      : { ok: false, text: `E-mail refusé : ${r.error}` }),
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  const d = st.data;
  return (
    <div className="card pad" style={{ marginBottom: 16, display: 'grid', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>E-mail</div>
        <div className="muted" style={{ fontSize: 12.5 }}>Codes de vérification et messages envoyés par e-mail.</div>
      </div>
      {d && (
        <div style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, background: d.smtpConfigured && !d.disabled ? '#EFF8F1' : '#FFF6E5', color: d.smtpConfigured && !d.disabled ? '#0A5C2F' : '#8A5A00' }}>
          {d.disabled ? <b>Envoi d'e-mails DÉSACTIVÉ (MAIL_DISABLED).</b>
            : d.smtpConfigured
              ? <>Envoi par <b>SMTP</b> : {d.host}:{d.port} ({d.secure || 'tls'}) · mot de passe {d.passwordSet ? 'renseigné' : <b>ABSENT</b>} · expéditeur {d.from}</>
              : <><b>Aucun SMTP configuré</b> : le serveur utilise la fonction mail() de l'hébergeur. Elle accepte les messages sans les authentifier, et Gmail les rejette ou les classe en spam sans avertir. Expéditeur {d.from}</>}
        </div>
      )}
      {msg && <div style={{ padding: 10, borderRadius: 8, fontSize: 13, background: msg.ok ? '#EFF8F1' : '#FDECEC', color: msg.ok ? '#0A5C2F' : '#B42318' }}>{msg.text}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 260px' }}>
          <div className="k">Envoyer un e-mail de test à</div>
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="prenom@exemple.com" style={{ width: '100%', padding: 9 }} />
        </label>
        <button className="btn" disabled={test.isPending || !/^\S+@\S+\.\S+$/.test(to)} onClick={() => { setMsg(null); test.mutate(to.trim()); }}>{test.isPending ? 'Envoi…' : 'Envoyer le test'}</button>
      </div>
    </div>
  );
}
