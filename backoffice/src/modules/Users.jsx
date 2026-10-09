import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Pill, Avatar, Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';
import KycReview from '../components/KycReview.jsx';

const ROLE_FILTERS = [
  { key:'all',      label:'all',      role: undefined      },
  { key:'vendors',  label:'vendors',  role:'VENDOR'        },
  { key:'delivers', label:'delivers', role:'DELIVERER'     },
  { key:'pending',  label:'kyc',      role:undefined, kyc:'PENDING' },
];

const KYC_MAP = {
  VERIFIED: { tone:'ok',   label:'kycOk'      },
  APPROVED: { tone:'ok',   label:'kycOk'      },  // legacy alias
  PENDING:  { tone:'warn', label:'kycPending'  },
  REJECTED: { tone:'mut',  label:'kycRejected' },
  NONE:     { tone:'mut',  label:'kycPending'  },
};

export default function Users() {
  const { t }   = useI18n();
  const qc      = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [page,   setPage]   = useState(1);
  const [drawer, setDrawer] = useState(null);
  const [pinMsg, setPinMsg] = useState(null);

  const f = ROLE_FILTERS.find(r => r.key === filter) || ROLE_FILTERS[0];

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', filter, page],
    queryFn:  () => adminApi.users({ role: f.role, kycStatus: f.kyc, page }),
    placeholderData: prev => prev,
  });

  const blockMut = useMutation({
    mutationFn: ({ id, blocked }) => adminApi.blockUser(id, blocked),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const kycMut = useMutation({
    mutationFn: ({ id, decision }) => adminApi.reviewKyc(id, decision),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setDrawer(null); },
  });

  const resetPin = useMutation({
    mutationFn: (id) => adminApi.resetPin(id),
    onSuccess: (r) => setPinMsg({ ok: true, text: `PIN temporaire de ${r.name} (${r.phone}) : ${r.tempPin} — notez-le maintenant, il ne sera plus affiché. Communiquez-le à la personne, qui le changera dans Paramètres.` }),
    onError: (e) => setPinMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  const lockPin = useMutation({
    mutationFn: (id) => adminApi.lockPin(id),
    onSuccess: () => setPinMsg({ ok: true, text: 'PIN verrouillé : l’ancien PIN ne fonctionne plus. La personne doit utiliser « PIN oublié » ou demander une réinitialisation.' }),
    onError: (e) => setPinMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });
  const isAdminUser = (u) => String(u.roles || u.role || '').includes('ADMIN');

  const rows = data?.items ?? [];

  return (
    <section className="content">
      <div className="toolbar">
        <div className="chips">
          {ROLE_FILTERS.map((r) => (
            <span key={r.key} className={`chip ${filter === r.key ? 'on' : ''}`}
              onClick={() => { setFilter(r.key); setPage(1); }}>
              {t(r.label)}
            </span>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <button className="btn sm">{t('export')}</button>
      </div>

      <div className="card" style={{ overflow:'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('user')}</th><th>{t('role')}</th><th>{t('phone')}</th>
              <th>{t('status')}</th><th>KYC</th><th>{t('deliveries')}</th><th/>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({length:5}).map((_,i) => (
                <tr key={i}><td colSpan={7}><Skeleton h={18} /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--muted)', padding:28 }}>Aucun utilisateur pour ce filtre.</td></tr>
            ) : rows.map((u) => {
              const id    = u.id || u.name;
              const name  = u.name || u.fullName || '—';
              const roles = Array.isArray(u.roles) ? u.roles : String(u.roles || '').replace(/[[\]"]/g,'').split(',');
              const roleLabel = roles.filter(Boolean).join(', ') || u.role || '—';
              const kyc   = KYC_MAP[u.kycStatus] || { tone:'mut', label:'kycPending' };
              const blocked = u.isBlocked || u.blocked;
              const phone   = u.phone || '—';
              const deliveryCount = u.deliveryCount ?? u.deliveries ?? '—';

              return (
                <tr key={id} onClick={() => { setPinMsg(null); setDrawer(u); }} style={{ cursor:'pointer' }}>
                  <td><div className="usr"><Avatar tone="g">{name.charAt(0)}</Avatar><div className="nm">{name}</div></div></td>
                  <td><Pill tone="b">{roleLabel}</Pill></td>
                  <td className="mono-sm muted">{phone}</td>
                  <td><Pill tone={blocked ? 'mut' : 'ok'}>{blocked ? t('blocked') : t('active')}</Pill></td>
                  <td><Pill tone={kyc.tone}>{t(kyc.label)}</Pill></td>
                  <td className="mono-sm">{deliveryCount}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn sm"
                      onClick={() => blockMut.mutate({ id: u.id, blocked: !blocked })}
                      style={blocked ? {} : { color:'var(--danger)', borderColor:'#F0C9B6' }}>
                      {blocked ? t('unblock') : t('block')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && (
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
          <button className="btn sm" disabled={page === 1} onClick={() => setPage(p => p-1)}>←</button>
          <span style={{ padding:'7px 12px', fontSize:12, color:'var(--muted)' }}>Page {page}</span>
          <button className="btn sm" disabled={data.items?.length < 25} onClick={() => setPage(p => p+1)}>→</button>
        </div>
      )}

      {drawer && (
        <>
          <div className="scrim on" onClick={() => setDrawer(null)} />
          <aside className="drawer on">
            <div className="dw-head">
              <div>
                <div className="id">{drawer.id || '—'}</div>
                <div style={{ fontWeight:800, fontSize:17 }}>{drawer.name || drawer.fullName}</div>
              </div>
              <button className="x" onClick={() => setDrawer(null)}>✕</button>
            </div>
            <div className="dw-body">
              <div className="kv">
                <div><div className="k">{t('phone')}</div><div className="v mono-sm">{drawer.phone || '—'}</div></div>
                <div><div className="k">Email</div><div className="v mono-sm">{drawer.email || '—'}</div></div>
                <div><div className="k">{t('role')}</div><div className="v">{String(drawer.roles || drawer.role || '').replace(/[[\]"]/g,'')}</div></div>
                <div><div className="k">Wallet</div><div className="v">{drawer.walletBalance != null ? `${drawer.walletBalance.toLocaleString('fr-FR')} XAF` : '—'}</div></div>
                <div><div className="k">{t('deliveries')}</div><div className="v">{drawer.deliveryCount ?? drawer.deliveries ?? '—'}</div></div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Identifiants & sécurité</div>
                <div className="kv" style={{ marginBottom: 10 }}>
                  <div><div className="k">Identifiant (téléphone)</div><div className="v mono-sm">{drawer.phone || '—'}</div></div>
                  <div><div className="k">Identifiant (e-mail)</div><div className="v mono-sm">{drawer.email || '—'}</div></div>
                  <div><div className="k">PIN</div><div className="v">Chiffré : impossible à lire, seulement réinitialisable</div></div>
                  <div><div className="k">Compte</div><div className="v">{drawer.isBlocked ? 'Bloqué' : 'Actif'}</div></div>
                </div>
                {isAdminUser(drawer) ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Compte administrateur : non modifiable ici.</div> : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn sm" disabled={resetPin.isPending}
                      onClick={() => { setPinMsg(null); window.confirm(`Réinitialiser le PIN de ${drawer.name} ? Un PIN temporaire sera généré.`) && resetPin.mutate(drawer.id); }}>Réinitialiser le PIN</button>
                    <button className="btn sm" disabled={lockPin.isPending}
                      onClick={() => { setPinMsg(null); window.confirm(`Verrouiller le PIN de ${drawer.name} ? Il ne pourra plus se connecter avec son PIN actuel.`) && lockPin.mutate(drawer.id); }}>Verrouiller le PIN</button>
                    <button className="btn sm" style={drawer.isBlocked ? {} : { color: 'var(--danger)', borderColor: '#F0C9B6' }}
                      onClick={() => window.confirm(drawer.isBlocked ? `Débloquer ${drawer.name} ?` : `Bloquer le compte de ${drawer.name} ? Sa session sera coupée immédiatement.`)
                        && blockMut.mutate({ id: drawer.id, blocked: !drawer.isBlocked }, { onSuccess: () => setDrawer((d) => ({ ...d, isBlocked: !d.isBlocked })) })}>
                      {drawer.isBlocked ? 'Débloquer le compte' : 'Bloquer le compte'}</button>
                  </div>
                )}
                {pinMsg && <div style={{ marginTop: 10, padding: 10, borderRadius: 8, fontSize: 13, background: pinMsg.ok ? '#EFF8F1' : '#FDECEC', color: pinMsg.ok ? '#0A5C2F' : '#C00' }}>{pinMsg.text}</div>}
              </div>

              {['PENDING', 'VERIFIED', 'REJECTED'].includes(drawer.kycStatus) && (
                <KycReview userId={drawer.id} readOnly={drawer.kycStatus !== 'PENDING'} onDecided={() => { qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-user'] }); qc.invalidateQueries({ queryKey: ['admin-analytics'] }); setDrawer(null); }} />
              )}
            </div>
          </aside>
        </>
      )}
    </section>
  );
}
