import React, { useState, useEffect, useCallback } from 'react';
import api, { adminApi } from '../api.js';
import { Pill, Avatar } from '../components/ui.jsx';

const KYC_TONE   = { NONE:'mut', PENDING:'warn', VERIFIED:'ok', REJECTED:'danger' };
const KYC_LABELS = { NONE:'Non soumise', PENDING:'En attente', VERIFIED:'Vérifiée', REJECTED:'Rejetée' };
const DOC_LABELS = { ID_FRONT:'CNI Recto', ID_BACK:'CNI Verso', SELFIE:'Selfie' };

// Fetches a protected image (requires auth header) and renders it via blob URL
function KycDocImage({ docId, label }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let url = null;
    api.get(`/admin/kyc-doc/${docId}`, { responseType: 'blob' })
      .then(r => { url = URL.createObjectURL(r.data); setSrc(url); })
      .catch(() => setErr(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [docId]);

  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      {err ? (
        <div style={{ height: 140, background: 'var(--cream)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
          Indisponible
        </div>
      ) : !src ? (
        <div style={{ height: 140, background: 'var(--cream)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
          Chargement…
        </div>
      ) : (
        <img
          src={src}
          alt={label}
          style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
        />
      )}
    </div>
  );
}

// Modal showing all KYC documents for a user + approve/reject with reason
function KycDocsModal({ user, onClose, onApprove, onReject }) {
  const [rejectMode, setRejectMode] = useState(!!user._rejectDirect);
  const [reason, setReason]         = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const docs = user.kycDocuments ?? [];

  const handleApprove = async () => {
    setSaving(true);
    try { await onApprove(user.id); onClose(); }
    catch (e) { setError(e.response?.data?.error || e.message); setSaving(false); }
  };

  const handleReject = async () => {
    if (!reason.trim()) { setError('Le motif est obligatoire'); return; }
    setSaving(true);
    try { await onReject(user.id, reason.trim()); onClose(); }
    catch (e) { setError(e.response?.data?.error || e.message); setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:16, padding:24, width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 16px 48px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16 }}>{user.name}</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4, display:'flex', alignItems:'center', gap:8 }}>
              {user.phone}
              <Pill tone={KYC_TONE[user.kycStatus]}>{KYC_LABELS[user.kycStatus]}</Pill>
            </div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        {/* Error */}
        {error && <div style={{ background:'#FEE', color:'#C00', padding:'8px 12px', borderRadius:8, marginBottom:14, fontSize:12 }}>{error}</div>}

        {/* Documents */}
        {docs.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--muted)', padding:'32px 0', fontSize:13, background:'var(--cream)', borderRadius:10, marginBottom:20 }}>
            Aucun document soumis par cet utilisateur
          </div>
        ) : (
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
            {docs.map(doc => (
              <KycDocImage key={doc.id} docId={doc.id} label={DOC_LABELS[doc.type] ?? doc.type} />
            ))}
          </div>
        )}

        {/* Previous rejection reason */}
        {user.kycRejectionReason && (
          <div style={{ marginBottom:14, padding:'10px 12px', background:'#FEE', borderRadius:8, fontSize:12, color:'#C00' }}>
            <strong>Dernier motif de rejet :</strong> {user.kycRejectionReason}
          </div>
        )}

        {/* Rejection reason input */}
        {rejectMode && (
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:700, display:'block', marginBottom:6 }}>Motif du rejet *</label>
            <textarea
              className="input"
              placeholder="Ex: Photo floue, document expiré, selfie non conforme…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              style={{ width:'100%', resize:'vertical', fontFamily:'inherit', fontSize:13, boxSizing:'border-box' }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10 }}>
          {!rejectMode ? (
            <>
              <button className="btn" style={{ flex:1 }} onClick={() => { setRejectMode(true); setError(''); }}>
                Rejeter…
              </button>
              <button className="btn" style={{ flex:1, background:'var(--green)', color:'#fff' }} onClick={handleApprove} disabled={saving}>
                {saving ? '…' : '✓ Approuver'}
              </button>
            </>
          ) : (
            <>
              <button className="btn" style={{ flex:1 }} onClick={() => { setRejectMode(false); setReason(''); setError(''); }}>
                Annuler
              </button>
              <button className="btn"
                style={{ flex:1, background:'#DC2626', color:'#fff', opacity: (!reason.trim() || saving) ? 0.5 : 1 }}
                onClick={handleReject}
                disabled={saving || !reason.trim()}>
                {saving ? '…' : 'Confirmer le rejet'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const ROLES = ['VENDOR', 'DELIVERER', 'ADMIN'];
  const [form, setForm] = useState({ name:'', phone:'', email:'', pin:'', role:'VENDOR' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.name || !form.phone || !form.pin) { setError('Nom, téléphone et PIN requis'); return; }
    if (form.pin.length !== 4 || !/^\d+$/.test(form.pin)) { setError('PIN doit être 4 chiffres'); return; }
    setSaving(true);
    try {
      await adminApi.createUser(form);
      onCreated();
      onClose();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:14, padding:24, width:420, boxShadow:'0 8px 32px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <span style={{ fontWeight:800, fontSize:15 }}>Créer un compte</span>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background:'#FEE', color:'#C00', padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:12 }}>{error}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[
            { key:'name',  label:'Nom complet *',     type:'text',     placeholder:'ex: Efoka Stephane' },
            { key:'phone', label:'Téléphone *',        type:'tel',      placeholder:'ex: 678758976' },
            { key:'email', label:'Email (facultatif)', type:'email',    placeholder:'ex: user@gmail.com' },
            { key:'pin',   label:'PIN (4 chiffres) *', type:'password', placeholder:'••••' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize:12, fontWeight:700, marginBottom:4, display:'block' }}>{f.label}</label>
              <input type={f.type} className="input" placeholder={f.placeholder}
                value={form[f.key]} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize:12, fontWeight:700, marginBottom:4, display:'block' }}>Rôle *</label>
            <div style={{ display:'flex', gap:8 }}>
              {ROLES.map(r => (
                <button key={r} onClick={() => setForm(v => ({ ...v, role: r }))}
                  className="btn sm" style={{ flex:1, background: form.role === r ? 'var(--green)' : undefined, color: form.role === r ? '#fff' : undefined }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button className="btn" style={{ flex:1 }} onClick={onClose}>Annuler</button>
            <button className="btn" style={{ flex:1, background:'var(--green)', color:'#fff' }} onClick={save} disabled={saving}>{saving ? '…' : 'Créer'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Security() {
  const [tab, setTab] = useState('kyc');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [kycModal, setKycModal] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try { setData(await adminApi.securityEvents()); }
    catch { setError('Erreur chargement'); }
    finally { setLoading(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminApi.users({ q: usersSearch || undefined, page: usersPage });
      setUsers(d.items ?? []);
      setUsersTotal(d.total ?? 0);
    } catch { setError('Erreur chargement'); }
    finally { setLoading(false); }
  }, [usersSearch, usersPage]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else loadEvents();
  }, [tab, loadEvents, loadUsers]);

  const openKycDocs = async (userId) => {
    try {
      const user = await adminApi.getUser(userId);
      setKycModal(user);
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const handleApprove = async (userId) => {
    await adminApi.reviewKyc(userId, 'VERIFIED');
    loadEvents(); loadUsers();
  };

  const handleReject = async (userId, reason) => {
    await adminApi.reviewKyc(userId, 'REJECTED', reason);
    loadEvents(); loadUsers();
  };

  const toggleBlock = async (userId, blocked) => {
    try {
      await adminApi.blockUser(userId, blocked);
      loadUsers();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  return (
    <section className="content">
      {error && (
        <div style={{ background:'#FEE', color:'#C00', padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13 }}>
          {error}<button className="x" onClick={() => setError('')} style={{ float:'right' }}>✕</button>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div className="chips">
          <span className={`chip ${tab === 'kyc'   ? 'on':''}`} onClick={() => setTab('kyc')}>KYC à vérifier</span>
          <span className={`chip ${tab === 'otp'   ? 'on':''}`} onClick={() => setTab('otp')}>Événements PIN/OTP</span>
          <span className={`chip ${tab === 'users' ? 'on':''}`} onClick={() => setTab('users')}>Tous les comptes</span>
        </div>
        <button className="btn sm" onClick={() => setShowCreateModal(true)}>+ Créer un compte</button>
      </div>

      {showCreateModal && (
        <CreateUserModal onClose={() => setShowCreateModal(false)} onCreated={() => { loadUsers(); loadEvents(); }} />
      )}

      {kycModal && (
        <KycDocsModal
          user={kycModal}
          onClose={() => setKycModal(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {loading ? (
        <div style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>Chargement…</div>
      ) : tab === 'kyc' ? (
        <div>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>
            {data?.kycUsers?.length ?? 0} compte(s) avec KYC en attente ou rejeté
          </div>
          {(!data?.kycUsers?.length) ? (
            <div className="card pad" style={{ textAlign:'center', color:'var(--muted)', padding:30 }}>Aucun KYC à traiter</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {data.kycUsers.map(u => (
                <div key={u.id} className="card pad" style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <Avatar tone="o">{u.name.charAt(0)}</Avatar>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{u.name}</div>
                    <div style={{ fontSize:12, color:'var(--muted)' }}>{u.phone}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                      {u.kycDocuments?.length ?? 0} document(s) soumis
                      {u.kycRejectionReason && (
                        <span style={{ marginLeft:8, color:'#C05' }}>· Motif précédent : {u.kycRejectionReason}</span>
                      )}
                    </div>
                  </div>
                  <Pill tone={KYC_TONE[u.kycStatus]}>{KYC_LABELS[u.kycStatus]}</Pill>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn sm" onClick={() => openKycDocs(u.id)}>
                      Voir docs
                    </button>
                    <button className="btn sm" onClick={() => handleApprove(u.id)}
                      style={{ background:'var(--green)', color:'#fff' }}>Approuver</button>
                    <button className="btn sm"
                      onClick={() => openKycDocs(u.id).then(() => {})}
                      style={{ color:'var(--danger)', borderColor:'#F5D0B8' }}
                      title="Ouvre le modal avec le formulaire de rejet"
                    >
                      Rejeter…
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'otp' ? (
        <div className="card" style={{ overflow:'hidden' }}>
          <table className="tbl">
            <thead>
              <tr><th>Téléphone</th><th>Code</th><th>Statut</th><th>Tentatives</th><th>Expire</th><th>Créé le</th></tr>
            </thead>
            <tbody>
              {(!data?.otps?.length) ? (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:20 }}>Aucun événement</td></tr>
              ) : data.otps.map(otp => (
                <tr key={otp.id}>
                  <td style={{ fontFamily:'var(--mono)' }}>{otp.phone}</td>
                  <td style={{ fontFamily:'var(--mono)', fontWeight:800, letterSpacing:4 }}>{otp.code}</td>
                  <td><Pill tone={otp.used ? 'ok' : otp.expiresAt < new Date().toISOString() ? 'danger' : 'info'}>{otp.used ? 'Utilisé' : otp.expiresAt < new Date().toISOString() ? 'Expiré' : 'Actif'}</Pill></td>
                  <td>{otp.attempts}</td>
                  <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(otp.expiresAt).toLocaleTimeString('fr-FR')}</td>
                  <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(otp.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input className="input" placeholder="Rechercher…" value={usersSearch}
              onChange={e => { setUsersSearch(e.target.value); setUsersPage(1); }} style={{ flex:1 }} />
          </div>
          <div className="card" style={{ overflow:'hidden' }}>
            <table className="tbl">
              <thead>
                <tr><th>Utilisateur</th><th>Rôle</th><th>KYC</th><th>Statut</th><th>Inscription</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:20 }}>Aucun compte</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="usr">
                        <Avatar tone="g">{(u.name || 'U').charAt(0)}</Avatar>
                        <div className="nm">{u.name}<div className="sub">{u.phone}{u.email ? ` · ${u.email}` : ''}</div></div>
                      </div>
                    </td>
                    <td><Pill tone={u.activeRole === 'ADMIN' ? 'danger' : u.activeRole === 'DELIVERER' ? 'b' : 'g'}>{u.activeRole}</Pill></td>
                    <td><Pill tone={KYC_TONE[u.kycStatus] || 'mut'}>{KYC_LABELS[u.kycStatus] || u.kycStatus}</Pill></td>
                    <td><Pill tone={u.isBlocked ? 'danger' : 'ok'}>{u.isBlocked ? 'Bloqué' : 'Actif'}</Pill></td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        {(u.kycStatus === 'PENDING' || u.kycStatus === 'REJECTED') && (
                          <button className="btn sm" onClick={() => openKycDocs(u.id)}>Docs KYC</button>
                        )}
                        {u.kycStatus === 'PENDING' && (
                          <button className="btn sm" onClick={() => handleApprove(u.id)} style={{ background:'var(--green)', color:'#fff' }}>KYC ✓</button>
                        )}
                        <button className="btn sm"
                          onClick={() => toggleBlock(u.id, !u.isBlocked)}
                          style={{ color: u.isBlocked ? 'var(--green)' : 'var(--danger)' }}>
                          {u.isBlocked ? 'Débloquer' : 'Bloquer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {usersTotal > 25 && (
            <div style={{ display:'flex', justifyContent:'center', gap:8, padding:12 }}>
              <button className="btn sm" onClick={() => setUsersPage(p => Math.max(1,p-1))} disabled={usersPage===1}>‹</button>
              <span style={{ fontSize:12, color:'var(--muted)', alignSelf:'center' }}>{usersPage}</span>
              <button className="btn sm" onClick={() => setUsersPage(p => p+1)} disabled={usersPage*25>=usersTotal}>›</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
