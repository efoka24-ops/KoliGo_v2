import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { Skeleton, Toggle } from '../components/ui.jsx';
import { adminApi } from '../api.js';

// Uniquement des réglages qui ont un effet réel : ils sont lus par le serveur et par l'application mobile.
// Les prix, gabarits, frais d'annulation et délais se règlent dans « Tarification ».
const SETTINGS = [
  {
    key: 'commission_rate', label: 'Commission KoliGo (%)', type: 'percent', def: '0.03',
    desc: "Part prélevée sur chaque livraison. S'applique aux nouvelles livraisons ; les livraisons existantes gardent leur taux.",
  },
  {
    key: 'min_withdrawal_xaf', label: 'Retrait minimum (XAF)', type: 'number', def: '500',
    desc: 'Montant minimal qu\'un livreur ou un vendeur peut retirer de son portefeuille.',
  },
  {
    key: 'maintenance_mode', label: 'Mode maintenance', type: 'toggle', def: 'false',
    desc: "Quand il est actif, l'application mobile affiche l'écran de maintenance et le serveur refuse les opérations des utilisateurs. Le back-office et les paiements restent accessibles.",
  },
];

const asPercent = (v) => { const n = Number(v); return Number.isFinite(n) ? String(n > 1 ? n : Math.round(n * 1000) / 10) : v; };

export default function Settings() {
  const qc = useQueryClient();
  const [local, setLocal] = useState({});
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');

  const { data, isLoading, error: loadError } = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.settings, retry: false });

  useEffect(() => {
    if (!data) return;
    const map = {};
    (Array.isArray(data) ? data : []).forEach((s) => { map[s.key] = s.value; });
    setLocal(map);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: ({ key, value }) => adminApi.updateSetting(key, value),
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    },
    onError: (e) => setError(e.response?.data?.error || e.message),
  });

  const valueOf = (s) => {
    const v = local[s.key] ?? s.def;
    return s.type === 'percent' ? asPercent(v) : v;
  };

  function save(s, raw) {
    setError('');
    if (s.type === 'percent') {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 50) { setError('La commission doit être comprise entre 0 et 50 %.'); return; }
      saveMut.mutate({ key: s.key, value: String(n / 100) });
    } else if (s.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 100) { setError('Le montant doit être d\'au moins 100 XAF.'); return; }
      saveMut.mutate({ key: s.key, value: String(Math.round(n)) });
    } else {
      saveMut.mutate({ key: s.key, value: String(raw) });
    }
  }

  if (loadError) return <section className="content"><div className="card pad" style={{ color:'#C00' }}>Impossible de charger les paramètres.</div></section>;

  return (
    <section className="content">
      <div style={{ maxWidth: 680 }}>
        <div className="card pad" style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
          Les prix, gabarits, frais d&apos;annulation et délais se règlent dans <NavLink to="/pricing"><b>Tarification</b></NavLink>.
          Le texte des conditions d&apos;utilisation se modifie dans <NavLink to="/cgu"><b>CGU</b></NavLink>.
        </div>

        {error && <div style={{ background:'#FEE', color:'#C00', padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13 }}>{error}</div>}

        {isLoading ? <Skeleton h={200} /> : SETTINGS.map((s) => (
          <div key={s.key} className="card pad" style={{ marginBottom: 12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{s.label}</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:4, lineHeight:1.5 }}>{s.desc}</div>
              </div>
              {s.type === 'toggle' ? (
                <Toggle on={String(valueOf(s)) === 'true'} onToggle={(on) => { setLocal((p) => ({ ...p, [s.key]: String(on) })); save(s, on); }} />
              ) : (
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input style={{ width:110 }} type="number" min="0" step={s.type === 'percent' ? '0.1' : '1'} value={valueOf(s)}
                    onChange={(e) => setLocal((p) => ({ ...p, [s.key]: s.type === 'percent' ? String(Number(e.target.value) / 100) : e.target.value }))} />
                  <button className="btn sm pri" disabled={saveMut.isPending} onClick={() => save(s, valueOf(s))}>
                    {saved === s.key ? 'Enregistré' : 'Sauvegarder'}
                  </button>
                </div>
              )}
            </div>
            {s.key === 'maintenance_mode' && saved === s.key && <div style={{ fontSize:12, color:'var(--green)', marginTop:8 }}>Enregistré.</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
