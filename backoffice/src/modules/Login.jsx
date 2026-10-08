import React, { useState } from 'react';
import { adminApi } from '../api.js';

// Connexion par e-mail, en étapes :
//   email    -> saisie de l'adresse
//   code     -> première connexion (ou oubli) : code à 6 chiffres reçu par e-mail
//   create   -> création du mot de passe (PIN de 6 à 12 chiffres) pour les connexions suivantes
//   password -> connexions suivantes : e-mail + mot de passe
export default function Login({ onLogin }) {
  const [step,     setStep]     = useState('email');
  const [email,    setEmail]    = useState('');
  const [code,     setCode]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');
  const [loading,  setLoading]  = useState(false);

  const fail = (err, fallback) => setError(err?.response?.data?.error || fallback);

  function finish(data) {
    const u = data.user ?? {};
    const roles = Array.isArray(u.roles) ? u.roles : String(u.roles ?? '').replace(/[[\]"]/g, '').split(',').map(r => r.trim());
    if (u.activeRole !== 'ADMIN' && !roles.includes('ADMIN')) {
      setError('Accès refusé — ce compte ne possède pas le rôle ADMIN.');
      return;
    }
    onLogin(data.accessToken, data.user);
  }

  async function run(fn) {
    setLoading(true);
    setError('');
    try { await fn(); } finally { setLoading(false); }
  }

  const startEmail = (e, reset = false) => {
    e?.preventDefault();
    return run(async () => {
      try {
        const r = await adminApi.adminEmailStart(email.trim(), reset);
        setCode(''); setPassword('');
        setInfo(r.step === 'code' ? `Un code à 6 chiffres vient d'être envoyé à ${email.trim()} (valable 10 minutes). Pensez à vérifier les courriers indésirables.` : '');
        setStep(r.step);
      } catch (err) { fail(err, 'Serveur indisponible.'); }
    });
  };

  const verifyCode = (e) => {
    e.preventDefault();
    return run(async () => {
      try {
        const r = await adminApi.adminEmailVerify(email.trim(), code.trim());
        setSetupToken(r.setupToken);
        setInfo('');
        setStep('create');
      } catch (err) { fail(err, 'Code incorrect.'); }
    });
  };

  const createPassword = (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    return run(async () => {
      try { finish(await adminApi.adminEmailSetPassword(setupToken, password)); }
      catch (err) { fail(err, 'Création impossible.'); }
    });
  };

  const signIn = (e) => {
    e.preventDefault();
    return run(async () => {
      try { finish(await adminApi.loginEmail(email.trim(), password)); }
      catch (err) { fail(err, 'E-mail ou mot de passe incorrect.'); }
    });
  };

  const back = () => { setStep('email'); setError(''); setInfo(''); setPassword(''); setConfirm(''); setCode(''); };

  return (
    <div style={{ display:'grid', placeItems:'center', height:'100vh', background:'var(--app)' }}>
      <div style={{ width:400 }}>
        <div className="card pad" style={{ padding:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
            <img src="/admin/koligo-logo-1024.svg" alt="KoliGo" style={{ width:44, height:44, borderRadius:11, objectFit:'contain' }} />
            <div>
              <div style={{ fontWeight:800, fontSize:22, letterSpacing:'-.02em' }}>
                Koli<em style={{ fontStyle:'normal', color:'var(--green)' }}>Go</em>
              </div>
              <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>
                Console Admin
              </div>
            </div>
          </div>

          {step === 'email' && (
            <form onSubmit={startEmail} style={formStyle}>
              <Field label="Adresse e-mail" value={email} onChange={setEmail} placeholder="prenom@exemple.com" type="email" autoFocus />
              <Message error={error} />
              <Submit disabled={loading || !email} loading={loading} label="Continuer" />
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={signIn} style={formStyle}>
              <Recap email={email} onBack={back} />
              <Field label="Mot de passe" value={password} onChange={setPassword} placeholder="••••••" type="password" autoFocus />
              <Message error={error} />
              <Submit disabled={loading || !password} loading={loading} label="Se connecter" />
              <button type="button" onClick={(e) => startEmail(e, true)} disabled={loading} style={linkStyle}>
                Mot de passe oublié ? Recevoir un code par e-mail
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={verifyCode} style={formStyle}>
              <Recap email={email} onBack={back} />
              <Message info={info} />
              <Field label="Code reçu par e-mail" value={code} onChange={setCode} placeholder="6 chiffres" inputMode="numeric" autoFocus />
              <Message error={error} />
              <Submit disabled={loading || code.trim().length < 6} loading={loading} label="Vérifier le code" />
              <button type="button" onClick={(e) => startEmail(e, true)} disabled={loading} style={linkStyle}>Renvoyer un code</button>
            </form>
          )}

          {step === 'create' && (
            <form onSubmit={createPassword} style={formStyle}>
              <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>
                E-mail confirmé. Créez le mot de passe (6 à 12 chiffres, comme un PIN) que vous utiliserez à votre prochaine connexion.
              </div>
              <Field label="Nouveau mot de passe" value={password} onChange={setPassword} placeholder="6 à 12 chiffres" type="password" inputMode="numeric" autoFocus />
              <Field label="Confirmer" value={confirm} onChange={setConfirm} placeholder="••••••" type="password" inputMode="numeric" />
              <Message error={error} />
              <Submit disabled={loading || password.length < 6 || !confirm} loading={loading} label="Créer et entrer" />
            </form>
          )}
        </div>
        <div style={{ textAlign:'center', marginTop:16, fontSize:12, color:'var(--muted)' }}>
          KoliGo Back Office · v2.0
        </div>
      </div>
    </div>
  );
}

const formStyle = { display:'flex', flexDirection:'column', gap:16 };
const linkStyle = { background:'none', border:'none', color:'var(--green)', fontSize:12.5, fontWeight:600, cursor:'pointer', padding:0, textAlign:'center' };

function Recap({ email, onBack }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, fontWeight:600 }}>
      <span>{email}</span>
      <button type="button" onClick={onBack} style={linkStyle}>Changer</button>
    </div>
  );
}

function Message({ error, info }) {
  if (!error && !info) return null;
  return error ? (
    <div style={{ color:'var(--danger)', fontSize:13, fontWeight:600, padding:'10px 13px', background:'var(--danger-bg)', borderRadius:10 }}>{error}</div>
  ) : (
    <div style={{ color:'var(--green)', fontSize:13, fontWeight:600, padding:'10px 13px', background:'#EAF7EE', borderRadius:10 }}>{info}</div>
  );
}

function Submit({ disabled, loading, label }) {
  return (
    <button className="btn pri" type="submit" disabled={disabled}
      style={{ justifyContent:'center', marginTop:4, padding:'13px 18px', fontSize:14 }}>
      {loading ? 'Patientez…' : label}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', inputMode, autoFocus }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
        placeholder={placeholder}
        required
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off'}
        style={{ width:'100%', padding:'10px 13px', borderRadius:11, border:'1px solid var(--line)', fontFamily:'inherit', fontSize:14, outline:'none', boxSizing:'border-box' }}
        onFocus={e => e.target.style.borderColor = 'var(--green)'}
        onBlur={e  => e.target.style.borderColor = 'var(--line)'}
      />
    </div>
  );
}
