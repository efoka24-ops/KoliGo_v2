import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const EMPTY = { version: '', versionCode: '', downloadUrl: '', notes: '', forceUpdate: true, activate: true };
const fmt = (d) => (d ? new Date(String(d).replace(' ', 'T') + 'Z').toLocaleString('fr-FR') : '—');

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

export default function Versions() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const list = useQuery({ queryKey: ['admin-app-versions'], queryFn: adminApi.appVersions });
  const rows = list.data?.items ?? [];
  const current = rows.find((r) => Number(r.isCurrent) === 1);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-app-versions'] });
  const fail = (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message });
  const create = useMutation({
    mutationFn: (f) => adminApi.createAppVersion({ ...f, versionCode: Number(f.versionCode) }),
    onSuccess: (_, f) => { refresh(); setForm(null); setMsg({ ok: true, text: f.activate ? 'Version publiée et activée : les téléphones sont invités à l\'installer.' : 'Version enregistrée (non activée).' }); },
    onError: fail,
  });
  const activate = useMutation({
    mutationFn: (id) => adminApi.activateAppVersion(id),
    onSuccess: () => { refresh(); setMsg({ ok: true, text: 'Version activée : la page de téléchargement et les téléphones suivent immédiatement.' }); },
    onError: fail,
  });
  const patch = useMutation({ mutationFn: ({ id, b }) => adminApi.updateAppVersion(id, b), onSuccess: refresh, onError: fail });
  const remove = useMutation({ mutationFn: (id) => adminApi.deleteAppVersion(id), onSuccess: refresh, onError: fail });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const switchTo = (r) => {
    const back = current && Number(r.versionCode) < Number(current.versionCode);
    const text = back
      ? `Revenir à la version ${r.version} ?\n\nLes téléphones et la page de téléchargement passeront à cette version. Android refuse d'installer un build plus ancien par-dessus un plus récent : les utilisateurs devront désinstaller l'application avant de réinstaller.`
      : `Activer la version ${r.version} ?\n\nLes téléphones avec une autre version seront ${r.forceUpdate ? 'bloqués jusqu\'à la mise à jour' : 'invités à se mettre à jour'}.`;
    if (window.confirm(text)) { setMsg(null); activate.mutate(r.id); }
  };

  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Versions de l'application</h2>
          <div className="sub">
            La version <b>active</b> est celle que tous les téléphones doivent avoir : si l'application installée est différente, l'utilisateur voit un écran
            « Mise à jour obligatoire » avec le lien de téléchargement (ou une simple proposition si la mise à jour n'est pas obligatoire). La page de téléchargement du site suit aussi la version active.
            Pour revenir en arrière, cliquez « Activer » sur une ancienne version.
          </div>
        </div>
        <button className="btn pri" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>+ Nouvelle version</button>
      </div>

      {msg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 13, background: msg.ok ? '#EFF8F1' : '#FDECEC', color: msg.ok ? '#0A5C2F' : '#C00' }}>{msg.text}</div>}

      <div className="card pad" style={{ marginBottom: 14 }}>
        Version active : <b>{current ? `${current.version} (build ${current.versionCode})` : 'aucune'}</b>
        {current && <span className="muted"> · depuis le {fmt(current.activatedAt)} · {Number(current.forceUpdate) ? 'mise à jour obligatoire' : 'mise à jour facultative'}</span>}
      </div>

      {form && (
        <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 10, maxWidth: 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Version affichée *"><input value={form.version} onChange={set('version')} style={{ width: '100%', padding: 9 }} placeholder="ex : 1.0.22" /></Field>
            <Field label="Numéro de build (versionCode) *"><input type="number" value={form.versionCode} onChange={set('versionCode')} style={{ width: '100%', padding: 9 }} placeholder="ex : 23" /></Field>
          </div>
          <Field label="Lien de téléchargement de l'APK *"><input value={form.downloadUrl} onChange={set('downloadUrl')} style={{ width: '100%', padding: 9 }} placeholder="/landing/koligo-v1.0.22.apk" /></Field>
          <Field label="Nouveautés (affichées aux utilisateurs)"><textarea value={form.notes} onChange={set('notes')} rows={3} style={{ width: '100%', padding: 9 }} /></Field>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!form.forceUpdate} onChange={(e) => setForm((f) => ({ ...f, forceUpdate: e.target.checked }))} /> Mise à jour obligatoire (bloque l'ancienne version)</label>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!form.activate} onChange={(e) => setForm((f) => ({ ...f, activate: e.target.checked }))} /> Activer tout de suite</label>
          <div className="muted" style={{ fontSize: 12 }}>Le build doit être strictement supérieur au précédent pour qu'Android accepte l'installation par-dessus. Envoyez d'abord le fichier APK sur le serveur, puis publiez la version.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn pri" disabled={create.isPending} onClick={() => { setMsg(null); create.mutate(form); }}>{create.isPending ? '…' : 'Publier'}</button>
            <button className="btn" onClick={() => setForm(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead><tr><th>Version</th><th>Build</th><th>Publiée le</th><th>Mise à jour</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {list.isLoading ? <tr><td colSpan={6}><Skeleton h={18} /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>Aucune version enregistrée.</td></tr>
              : rows.map((r) => (
                <tr key={r.id} style={{ background: Number(r.isCurrent) ? '#F1F8F3' : undefined }}>
                  <td><b>{r.version}</b>{r.notes ? <div className="muted mono-sm">{r.notes}</div> : null}<div className="muted mono-sm">{r.downloadUrl}</div></td>
                  <td>{r.versionCode}</td>
                  <td>{fmt(r.createdAt)}</td>
                  <td>
                    <label style={{ fontSize: 12 }}>
                      <input type="checkbox" checked={!!Number(r.forceUpdate)} onChange={(e) => patch.mutate({ id: r.id, b: { forceUpdate: e.target.checked } })} /> obligatoire
                    </label>
                  </td>
                  <td>{Number(r.isCurrent) ? <b style={{ color: '#0A5C2F' }}>● Active</b> : 'Archivée'}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {!Number(r.isCurrent) && <button className="btn sm" disabled={activate.isPending} onClick={() => switchTo(r)}>Activer</button>}{' '}
                    {!Number(r.isCurrent) && <button className="btn sm" style={{ color: 'var(--danger)' }} onClick={() => window.confirm('Supprimer cette version de l\'historique ?') && remove.mutate(r.id)}>Supprimer</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
