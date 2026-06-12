import React, { useState } from 'react';
import { adminApi } from '../api.js';

export default function Login({ onLogin }) {
  const [phone,   setPhone]   = useState('');
  const [pin,     setPin]     = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.login(phone.trim(), pin.trim());
      const u = data.user ?? {};
      // activeRole check (always present) + roles array check (present after backend restart)
      const parsedRoles = Array.isArray(u.roles)
        ? u.roles
        : String(u.roles ?? '').replace(/[\[\]"]/g, '').split(',').map(r => r.trim());
      const isAdmin = u.activeRole === 'ADMIN' || parsedRoles.includes('ADMIN');
      if (!isAdmin) {
        setError('Accès refusé — ce compte ne possède pas le rôle ADMIN.');
        return;
      }
      onLogin(data.accessToken, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiants incorrects ou serveur indisponible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display:'grid', placeItems:'center', height:'100vh', background:'var(--app)' }}>
      <div style={{ width:400 }}>
        <div className="card pad" style={{ padding:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
            <img src="/koligo-logo-1024.svg" alt="KoliGo" style={{ width:44, height:44, borderRadius:11, objectFit:'contain' }} />
            <div>
              <div style={{ fontWeight:800, fontSize:22, letterSpacing:'-.02em' }}>
                Koli<em style={{ fontStyle:'normal', color:'var(--green)' }}>Go</em>
              </div>
              <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>
                Console Admin
              </div>
            </div>
          </div>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+237 6XX XXX XXX" />
            <Field label="Code PIN"  value={pin}   onChange={setPin}   placeholder="••••••" type="password" />
            {error && (
              <div style={{ color:'var(--danger)', fontSize:13, fontWeight:600, padding:'10px 13px', background:'var(--danger-bg)', borderRadius:10 }}>
                {error}
              </div>
            )}
            <button
              className="btn pri"
              type="submit"
              disabled={loading || !phone || !pin}
              style={{ justifyContent:'center', marginTop:4, padding:'13px 18px', fontSize:14 }}
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
        <div style={{ textAlign:'center', marginTop:16, fontSize:12, color:'var(--muted)' }}>
          KoliGo Back Office · v2.0
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        required
        style={{ width:'100%', padding:'10px 13px', borderRadius:11, border:'1px solid var(--line)', fontFamily:'inherit', fontSize:14, outline:'none', boxSizing:'border-box' }}
        onFocus={e => e.target.style.borderColor = 'var(--green)'}
        onBlur={e  => e.target.style.borderColor = 'var(--line)'}
      />
    </div>
  );
}
