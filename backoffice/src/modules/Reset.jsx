import React, { useState, useEffect } from 'react';
import { adminApi } from '../api.js';

// ── Téléchargement blob helper ─────────────────────────────────────────────
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Section : Nettoyage léger (garde les users) ────────────────────────────
function PartialReset({ onDone }) {
  const [label,      setLabel]      = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [done,       setDone]       = useState(null);
  const WORD = 'RESET';

  const submit = async () => {
    if (confirm !== WORD) { setError(`Tape "${WORD}" pour confirmer`); return; }
    setError(''); setLoading(true);
    try {
      const archiveLabel = label.trim() || `Archive ${new Date().toISOString().slice(0, 10)}`;
      const result = await adminApi.archiveAndReset(archiveLabel);
      setDone(result); setLabel(''); setConfirm('');
      onDone?.();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="card pad">
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
        <span style={{ fontSize:22 }}>🗂</span>
        <div style={{ fontWeight:800, fontSize:15 }}>Archiver et réinitialiser</div>
      </div>
      <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:14 }}>
        Sauvegarde un instantané puis <strong>supprime les livraisons, transactions, GPS et OTP</strong>.
        Les utilisateurs, villes et paramètres sont <strong>conservés</strong>.
      </div>
      <div style={{ background:'#FEF3C7', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:12, color:'#92400E', fontWeight:600 }}>
        ⚠️ Les données transactionnelles seront supprimées — l'archive permet de les restaurer.
      </div>

      {done && (
        <div style={{ background:'#ECFDF5', border:'1px solid #10B981', borderRadius:10, padding:12, marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#065F46', marginBottom:6 }}>✅ Archivage terminé</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {Object.entries(done.snapshot || {}).filter(([k]) => k !== 'date').map(([k, v]) => (
              <div key={k} style={{ background:'#fff', borderRadius:8, padding:'4px 12px', fontSize:12 }}>
                <b>{v}</b> <span style={{ color:'var(--muted)' }}>{k}</span>
              </div>
            ))}
          </div>
          <button className="btn sm" style={{ marginTop:8 }} onClick={() => setDone(null)}>Fermer</button>
        </div>
      )}

      {error && <ErrBanner msg={error} onClose={() => setError('')} />}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <Field label="Libellé de l'archive (facultatif)"
          placeholder={`Archive ${new Date().toISOString().slice(0,10)}`}
          value={label} onChange={setLabel} />
        <ConfirmField word={WORD} value={confirm} onChange={setConfirm} />
        <button
          onClick={submit}
          disabled={loading || confirm !== WORD}
          className="btn"
          style={{
            background: confirm === WORD ? '#D97706' : 'var(--line)',
            color: confirm === WORD ? '#fff' : 'var(--muted)',
            border:'none', fontWeight:800, fontSize:14,
            opacity: loading ? 0.7 : 1,
          }}>
          {loading ? '⏳ Archivage…' : '🗂 Archiver et réinitialiser'}
        </button>
      </div>
    </div>
  );
}

// ── Section : Export JSON ──────────────────────────────────────────────────
function ExportSection() {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  const doExport = async () => {
    setLoading(true); setError(''); setDone(false);
    try {
      const blob = await adminApi.exportDb();
      const filename = `koligo-backup-${new Date().toISOString().slice(0, 16).replace('T', '-')}.json`;
      downloadBlob(blob, filename);
      setDone(true);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="card pad">
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
        <span style={{ fontSize:22 }}>📤</span>
        <div style={{ fontWeight:800, fontSize:15 }}>Exporter la base complète</div>
      </div>
      <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:14 }}>
        Télécharge un fichier JSON contenant <strong>toutes les tables</strong> (utilisateurs, livraisons,
        wallets, transactions, OTP, paramètres). Aucune donnée n'est supprimée.
      </div>

      {done && (
        <div style={{ background:'#ECFDF5', border:'1px solid #10B981', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:13, color:'#065F46', fontWeight:600 }}>
          ✅ Fichier JSON téléchargé
        </div>
      )}
      {error && <ErrBanner msg={error} onClose={() => setError('')} />}

      <button onClick={doExport} disabled={loading} className="btn pri" style={{ fontWeight:700 }}>
        {loading ? '⏳ Préparation…' : '⬇️ Télécharger la sauvegarde JSON'}
      </button>
    </div>
  );
}

// ── Section : Nettoyage total ──────────────────────────────────────────────
function WipeTotal({ onDone }) {
  const [label,   setLabel]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(null);
  const [phase,   setPhase]   = useState('idle'); // idle | exporting | wiping
  const WORD = 'TOUT SUPPRIMER';

  const submit = async () => {
    if (confirm !== WORD) { setError(`Tape exactement "${WORD}" pour confirmer`); return; }
    setError(''); setLoading(true);

    try {
      // 1. Export d'abord
      setPhase('exporting');
      const blob = await adminApi.exportDb();
      const filename = `koligo-backup-avant-wipe-${new Date().toISOString().slice(0, 16).replace('T', '-')}.json`;
      downloadBlob(blob, filename);

      // 2. Suppression totale
      setPhase('wiping');
      const archiveLabel = label.trim() || `WipeTotal ${new Date().toISOString().slice(0, 10)}`;
      const result = await adminApi.wipeTotal(archiveLabel);

      setDone(result); setLabel(''); setConfirm('');
      onDone?.();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); setPhase('idle'); }
  };

  const phaseLabel = phase === 'exporting' ? '⏳ Export en cours…'
    : phase === 'wiping' ? '⏳ Suppression en cours…'
    : '💥 Exporter puis tout supprimer';

  return (
    <div className="card pad" style={{ borderColor:'#EF4444', borderWidth:2 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
        <span style={{ fontSize:22 }}>💥</span>
        <div style={{ fontWeight:800, fontSize:15, color:'#DC2626' }}>Nettoyage total de la base</div>
      </div>
      <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:14 }}>
        <strong>Supprime absolument tout</strong> : livraisons, transactions, wallets, OTP, KYC
        et <strong>tous les utilisateurs sauf votre compte admin</strong>.
        Les villes, quartiers et paramètres sont conservés.
      </div>
      <div style={{ background:'#FEF2F2', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#B91C1C', fontWeight:700, lineHeight:1.6 }}>
        🚨 <strong>Action irréversible.</strong><br/>
        Un export JSON est automatiquement téléchargé <em>avant</em> la suppression.
        Tous les comptes (vendeurs, livreurs) seront effacés.
      </div>

      {done && (
        <div style={{ background:'#ECFDF5', border:'1px solid #10B981', borderRadius:10, padding:12, marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#065F46', marginBottom:6 }}>✅ Nettoyage terminé — sauvegarde téléchargée</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {Object.entries(done.snapshot || {}).filter(([k]) => k !== 'date').map(([k, v]) => (
              <div key={k} style={{ background:'#fff', borderRadius:8, padding:'4px 12px', fontSize:12 }}>
                <b>{v}</b> <span style={{ color:'var(--muted)' }}>{k}</span>
              </div>
            ))}
          </div>
          <button className="btn sm" style={{ marginTop:8 }} onClick={() => setDone(null)}>Fermer</button>
        </div>
      )}

      {error && <ErrBanner msg={error} onClose={() => setError('')} />}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <Field label="Libellé de l'archive (facultatif)"
          placeholder={`WipeTotal ${new Date().toISOString().slice(0,10)}`}
          value={label} onChange={setLabel} />
        <ConfirmField word={WORD} value={confirm} onChange={setConfirm} monospace />
        <button
          onClick={submit}
          disabled={loading || confirm !== WORD}
          className="btn"
          style={{
            background: confirm === WORD ? '#DC2626' : 'var(--line)',
            color: confirm === WORD ? '#fff' : 'var(--muted)',
            border:'none', fontWeight:800, fontSize:14,
            opacity: loading ? 0.7 : 1,
          }}>
          {loading ? phaseLabel : '💥 Exporter puis tout supprimer'}
        </button>
      </div>
    </div>
  );
}

// ── Section : Historique des archives ─────────────────────────────────────
function ArchiveHistory({ refresh }) {
  const [archives,  setArchives]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [done,      setDone]      = useState(null);
  const [error,     setError]     = useState('');

  const load = async () => {
    setLoading(true);
    try { setArchives(await adminApi.listArchives()); }
    catch { setError('Erreur chargement archives'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [refresh]);

  const handleRestore = async (a) => {
    if (!window.confirm(`Restaurer "${a.label}" ? Les données archivées seront ré-insérées (doublons ignorés).`)) return;
    setError(''); setRestoring(a.id);
    try {
      const r = await adminApi.restoreArchive(a.id);
      setDone({ label: a.label, counts: r.counts });
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setRestoring(null); }
  };

  return (
    <div>
      <div style={{ fontWeight:800, fontSize:13, marginBottom:10 }}>
        Historique des archives ({archives.length})
      </div>

      {done && (
        <div style={{ background:'#ECFDF5', border:'1px solid #10B981', borderRadius:10, padding:12, marginBottom:12 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#065F46', marginBottom:4 }}>
            ✅ Restauration terminée — "{done.label}"
          </div>
          <div style={{ fontSize:12, color:'#065F46' }}>
            {done.counts?.deliveries ?? 0} livraison(s) · {done.counts?.transactions ?? 0} transaction(s) · {done.counts?.otps ?? 0} OTP(s)
          </div>
          <button className="btn sm" style={{ marginTop:8 }} onClick={() => setDone(null)}>Fermer</button>
        </div>
      )}
      {error && <ErrBanner msg={error} onClose={() => setError('')} />}

      {loading ? (
        <div style={{ color:'var(--muted)', padding:20 }}>Chargement…</div>
      ) : archives.length === 0 ? (
        <div className="card pad" style={{ textAlign:'center', color:'var(--muted)', padding:30 }}>
          Aucune archive. La première sera créée au prochain reset.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {archives.map(a => {
            let snap = {};
            try { snap = JSON.parse(a.snapshotJson); } catch {}
            const hasData = !!snap._data;
            const isWipe  = a.label?.startsWith('[WIPE]');
            return (
              <div key={a.id} className="card pad" style={{ borderLeft: isWipe ? '3px solid #EF4444' : '3px solid #10B981' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{a.label}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                      {new Date(a.archivedAt).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                    <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--muted)' }}>{a.id.slice(-8)}</div>
                    {hasData && (
                      <button
                        className="btn sm"
                        onClick={() => handleRestore(a)}
                        disabled={restoring === a.id}
                        style={{ fontSize:11 }}
                      >
                        {restoring === a.id ? '…' : '↩ Restaurer'}
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
                  {['users','deliveries','transactions','otps','wallets'].map(k => snap[k] !== undefined && k !== 'date' && (
                    <div key={k} style={{ background:'var(--app)', borderRadius:8, padding:'3px 10px', fontSize:11 }}>
                      <b>{snap[k]}</b> <span style={{ color:'var(--muted)' }}>{k}</span>
                    </div>
                  ))}
                  <div style={{
                    background: hasData ? '#ECFDF5' : 'var(--app)',
                    color: hasData ? '#065F46' : 'var(--muted)',
                    borderRadius:8, padding:'3px 10px', fontSize:11, fontWeight:700,
                  }}>
                    {hasData ? '✅ restaurable' : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Composants génériques ──────────────────────────────────────────────────
function ErrBanner({ msg, onClose }) {
  return (
    <div style={{ background:'#FEE2E2', color:'#991B1B', padding:'9px 13px', borderRadius:8, marginBottom:10, fontSize:13, fontWeight:600 }}>
      {msg}
      <button onClick={onClose} style={{ float:'right', background:'none', border:'none', cursor:'pointer', color:'inherit', fontWeight:700 }}>✕</button>
    </div>
  );
}

function Field({ label, placeholder, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize:12, fontWeight:700, marginBottom:4, display:'block', color:'var(--muted)' }}>{label}</label>
      <input className="input" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ConfirmField({ word, value, onChange, monospace }) {
  return (
    <div>
      <label style={{ fontSize:12, fontWeight:700, marginBottom:4, display:'block', color:'var(--muted)' }}>
        Tape{' '}
        <span style={{ fontFamily:'var(--mono)', background:'#FEE2E2', color:'#991B1B', padding:'1px 6px', borderRadius:4 }}>
          {word}
        </span>
        {' '}pour confirmer
      </label>
      <input
        className="input"
        placeholder={word}
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        style={{
          fontFamily: monospace ? 'var(--mono)' : undefined,
          borderColor: value === word ? 'var(--green)' : undefined,
          color: value === word ? 'var(--green)' : undefined,
          fontWeight: 700,
        }}
      />
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────
export default function Reset() {
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey(k => k + 1);

  return (
    <section className="content">
      <div style={{ marginBottom:20 }}>
        <div style={{ fontWeight:800, fontSize:18, marginBottom:4 }}>Gestion de la base de données</div>
        <div style={{ fontSize:13, color:'var(--muted)' }}>
          Export, archivage et nettoyage des données — toutes les opérations créent une sauvegarde avant d'agir.
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, alignItems:'start' }}>

        {/* Colonne gauche : actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <ExportSection />
          <PartialReset onDone={reload} />
          <WipeTotal onDone={reload} />
        </div>

        {/* Colonne droite : archives */}
        <ArchiveHistory refresh={refreshKey} />
      </div>
    </section>
  );
}
