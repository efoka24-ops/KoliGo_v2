import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api.js';
import { Pill } from '../components/ui.jsx';

const DELIVERY_TYPES = [
  { key: 'TEMPORAIRE',       label: 'Temporaire',     color: '#178A3C' },
  { key: 'EXPRESS',          label: 'Express',         color: '#E8551C' },
  { key: 'VVIP',             label: 'VVIP',            color: '#C4611A' },
  { key: 'PERMANENT',        label: 'Permanent',       color: '#0E2116' },
  { key: 'INTERURBAIN',      label: 'Interurbain',     color: '#6B5BCD' },
  { key: 'FROID_FRAGILE',    label: 'Froid/Fragile',   color: '#0099CC' },
];

const PRICING_KEYS = [
  { key: 'base_rate_xaf',       label: 'Prix de base (XAF)',     unit: 'XAF', desc: 'Tarif minimum avant calcul distance' },
  { key: 'per_km_rate_xaf',     label: 'Prix / km (XAF)',         unit: 'XAF/km', desc: 'Coût par kilomètre de trajet' },
  { key: 'weight_surcharge_xaf',label: 'Surcharge poids (XAF/kg)',unit: 'XAF/kg', desc: 'Supplément par kilo au-dessus de 1kg' },
  { key: 'commission_rate',     label: 'Commission plateforme (%)',unit: '%', desc: 'Part prélevée par KoliGo sur chaque livraison' },
  { key: 'express_multiplier',  label: 'Multiplicateur Express',  unit: '×', desc: 'Appliqué au prix de base pour Express' },
  { key: 'vvip_multiplier',     label: 'Multiplicateur VVIP',     unit: '×', desc: 'Appliqué au prix de base pour VVIP' },
  { key: 'min_delivery_price',  label: 'Prix minimum livraison',  unit: 'XAF', desc: 'Le prix ne peut pas descendre en dessous' },
];

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:999,
      display:'flex', alignItems:'center', justifyContent:'center',
    }} onClick={onClose}>
      <div style={{
        background:'var(--surface)', borderRadius:14, padding:24,
        minWidth:340, maxWidth:480, width:'90%',
        boxShadow:'0 8px 32px rgba(0,0,0,.25)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <span style={{ fontWeight:800, fontSize:15 }}>{title}</span>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Zones() {
  const [tab, setTab] = useState('pricing'); // 'pricing' | 'cities'

  // ── Pricing state ──────────────────────────────────────────────────────────
  const [settings,     setSettings]     = useState({});
  const [editVals,     setEditVals]     = useState({});
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [savingKey,    setSavingKey]    = useState(null);
  const [savedKey,     setSavedKey]     = useState(null);
  const [priceError,   setPriceError]   = useState('');

  // ── Cities state ───────────────────────────────────────────────────────────
  const [cities,       setCities]       = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [neighborhoods,setNeighborhoods]= useState([]);
  const [loadingCities,setLoadingCities]= useState(true);
  const [loadingQ,     setLoadingQ]     = useState(false);
  const [cityError,    setCityError]    = useState('');
  const [searchCity,   setSearchCity]   = useState('');
  const [searchQ,      setSearchQ]      = useState('');
  const [cityModal,    setCityModal]    = useState(null);
  const [qModal,       setQModal]       = useState(null);
  const [cityForm,     setCityForm]     = useState({ name:'', region:'' });
  const [qForm,        setQForm]        = useState({ name:'' });
  const [saving,       setSaving]       = useState(false);

  // ── Load pricing ───────────────────────────────────────────────────────────
  const loadPricing = useCallback(async () => {
    setLoadingPricing(true);
    try {
      const data = await adminApi.settings();
      const map = {};
      (Array.isArray(data) ? data : []).forEach(s => { map[s.key] = s.value; });
      setSettings(map);
      setEditVals(map);
    } catch { setPriceError('Erreur chargement tarifs'); }
    finally { setLoadingPricing(false); }
  }, []);

  useEffect(() => { loadPricing(); }, [loadPricing]);

  const saveKey = async (key) => {
    setSavingKey(key);
    try {
      await adminApi.updateSetting(key, editVals[key] ?? settings[key]);
      setSettings(prev => ({ ...prev, [key]: editVals[key] ?? prev[key] }));
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (e) { setPriceError(e.response?.data?.error || e.message); }
    finally { setSavingKey(null); }
  };

  // Compute sample price for display
  const base = parseFloat(editVals['base_rate_xaf'] ?? settings['base_rate_xaf'] ?? 500);
  const perKm = parseFloat(editVals['per_km_rate_xaf'] ?? settings['per_km_rate_xaf'] ?? 150);
  const exMul = parseFloat(editVals['express_multiplier'] ?? settings['express_multiplier'] ?? 1.5);
  const vvMul = parseFloat(editVals['vvip_multiplier'] ?? settings['vvip_multiplier'] ?? 2.5);
  const comm  = parseFloat(editVals['commission_rate'] ?? settings['commission_rate'] ?? 0.03);
  const SAMPLE_KM = 5;
  const samplePrice = (d) => {
    const mul = d.key === 'EXPRESS' ? exMul : d.key === 'VVIP' ? vvMul : 1;
    return Math.round((base + perKm * SAMPLE_KM) * mul);
  };

  // ── Load cities ─────────────────────────────────────────────────────────────
  const loadCities = useCallback(async () => {
    setLoadingCities(true);
    try { setCities(await adminApi.cities()); }
    catch { setCityError('Erreur chargement villes'); }
    finally { setLoadingCities(false); }
  }, []);

  const loadNeighborhoods = useCallback(async (cityId) => {
    setLoadingQ(true);
    try { setNeighborhoods(await adminApi.neighborhoods(cityId)); }
    catch { setCityError('Erreur chargement quartiers'); }
    finally { setLoadingQ(false); }
  }, []);

  useEffect(() => { loadCities(); }, [loadCities]);
  useEffect(() => {
    if (selectedCity) loadNeighborhoods(selectedCity.id);
    else setNeighborhoods([]);
  }, [selectedCity, loadNeighborhoods]);

  const saveCity = async () => {
    if (!cityForm.name.trim() || !cityForm.region.trim()) return;
    setSaving(true);
    try {
      cityModal === 'create'
        ? await adminApi.createCity(cityForm.name.trim(), cityForm.region.trim())
        : await adminApi.updateCity(cityModal.id, { name: cityForm.name.trim(), region: cityForm.region.trim() });
      setCityModal(null);
      loadCities();
    } catch (e) { setCityError(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const saveQ = async () => {
    if (!qForm.name.trim() || !selectedCity) return;
    setSaving(true);
    try {
      qModal === 'create'
        ? await adminApi.createNeighborhood(selectedCity.id, qForm.name.trim())
        : await adminApi.updateNeighborhood(qModal.id, { name: qForm.name.trim() });
      setQModal(null);
      loadNeighborhoods(selectedCity.id);
      loadCities();
    } catch (e) { setCityError(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const filteredCities = cities.filter(c =>
    c.name.toLowerCase().includes(searchCity.toLowerCase()) ||
    c.region.toLowerCase().includes(searchCity.toLowerCase())
  );
  const filteredQ = neighborhoods.filter(q =>
    q.name.toLowerCase().includes(searchQ.toLowerCase())
  );
  const regions = [...new Set(filteredCities.map(c => c.region))].sort();

  return (
    <section className="content">
      {/* Tab switcher */}
      <div className="chips" style={{ marginBottom:18 }}>
        <span className={`chip ${tab === 'pricing' ? 'on' : ''}`} onClick={() => setTab('pricing')}>Tarifs</span>
        <span className={`chip ${tab === 'cities'  ? 'on' : ''}`} onClick={() => setTab('cities')}>Villes &amp; Quartiers</span>
      </div>

      {/* ── PRICING TAB ────────────────────────────────────────────────────── */}
      {tab === 'pricing' && (
        <div>
          {priceError && (
            <div style={{ background:'#FEE', color:'#C00', padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13 }}>
              {priceError}<button className="x" onClick={() => setPriceError('')} style={{ float:'right' }}>✕</button>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>
            {/* Left: pricing fields */}
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
                Configuration tarifaire
              </div>
              {loadingPricing ? (
                <div style={{ color:'var(--muted)', padding:20 }}>Chargement…</div>
              ) : PRICING_KEYS.map(({ key, label, unit, desc }) => (
                <div key={key} className="card pad" style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{label}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{desc}</div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <div style={{ position:'relative' }}>
                        <input
                          type="number"
                          value={editVals[key] ?? settings[key] ?? ''}
                          onChange={e => setEditVals(v => ({ ...v, [key]: e.target.value }))}
                          style={{ width:90, padding:'6px 10px', borderRadius:8, border:'1px solid var(--line)', fontFamily:'var(--mono)', fontSize:13, outline:'none', textAlign:'right' }}
                          onFocus={e => e.target.style.borderColor = 'var(--green)'}
                          onBlur={e  => e.target.style.borderColor = 'var(--line)'}
                        />
                        <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', fontSize:9, color:'var(--muted)', pointerEvents:'none' }}>{unit}</span>
                      </div>
                      <button className="btn sm"
                        onClick={() => saveKey(key)}
                        disabled={savingKey === key}
                        style={savedKey === key ? { color:'var(--green)' } : {}}>
                        {savedKey === key ? '✓' : savingKey === key ? '…' : 'Sauv.'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: price simulator */}
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
                Simulateur — 5 km, 1 kg
              </div>
              <div className="card" style={{ overflow:'hidden' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Type</th><th>Prix client</th><th>Commission</th><th>Livreur</th></tr>
                  </thead>
                  <tbody>
                    {DELIVERY_TYPES.map(d => {
                      const price = samplePrice(d);
                      const commission = Math.round(price * comm);
                      const earning = price - commission;
                      return (
                        <tr key={d.key}>
                          <td>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                              <i style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background: d.color }} />
                              <span style={{ fontWeight:700, fontSize:12 }}>{d.label}</span>
                            </span>
                          </td>
                          <td className="amt">{price.toLocaleString('fr-FR')} XAF</td>
                          <td style={{ fontSize:12, color:'#E8551C' }}>{commission.toLocaleString('fr-FR')}</td>
                          <td style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>{earning.toLocaleString('fr-FR')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize:11, color:'var(--muted)', padding:'8px 4px' }}>
                Les tarifs s'appliquent immédiatement sur le mobile après sauvegarde.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CITIES TAB ─────────────────────────────────────────────────────── */}
      {tab === 'cities' && (
        <div>
          {cityError && (
            <div style={{ background:'#FEE', color:'#C00', padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13 }}>
              {cityError}<button className="x" onClick={() => setCityError('')} style={{ float:'right' }}>✕</button>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:18, alignItems:'start' }}>
            {/* Cities list */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontWeight:800, fontSize:13 }}>Villes ({cities.length})</span>
                <button className="btn sm" onClick={() => { setCityForm({ name:'', region:'' }); setCityModal('create'); }}>+ Ville</button>
              </div>
              <input className="input" placeholder="Rechercher…" value={searchCity} onChange={e => setSearchCity(e.target.value)} style={{ width:'100%', marginBottom:12 }} />
              {loadingCities ? (
                <div style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>Chargement…</div>
              ) : regions.map(region => (
                <div key={region} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{region}</div>
                  {filteredCities.filter(c => c.region === region).map(c => (
                    <div key={c.id} className="card pad"
                      onClick={() => setSelectedCity(selectedCity?.id === c.id ? null : c)}
                      style={{ cursor:'pointer', marginBottom:6, outline: selectedCity?.id === c.id ? '2px solid var(--green)' : 'none', opacity: c.isActive ? 1 : 0.55 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontWeight:700, fontSize:14 }}>{c.name}</span>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ fontSize:11, color:'var(--muted)' }}>{c._count?.neighborhoods ?? 0} q.</span>
                          <Pill tone={c.isActive ? 'ok' : 'mut'}>{c.isActive ? 'Actif' : 'Inactif'}</Pill>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, marginTop:8 }} onClick={e => e.stopPropagation()}>
                        <button className="btn sm" onClick={() => { setCityForm({ name: c.name, region: c.region }); setCityModal(c); }}>Modifier</button>
                        <button className="btn sm" onClick={() => adminApi.updateCity(c.id, { isActive: !c.isActive }).then(loadCities)} style={{ color: c.isActive ? 'var(--danger)' : 'var(--green)' }}>{c.isActive ? 'Désact.' : 'Activer'}</button>
                        <button className="btn sm" onClick={() => window.confirm(`Supprimer "${c.name}" ?`) && adminApi.deleteCity(c.id).then(() => { if (selectedCity?.id === c.id) setSelectedCity(null); loadCities(); })} style={{ color:'var(--danger)' }}>Suppr.</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Neighborhoods */}
            {!selectedCity ? (
              <div style={{ textAlign:'center', color:'var(--muted)', paddingTop:60 }}>← Sélectionne une ville</div>
            ) : (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontWeight:800, fontSize:13 }}>Quartiers — {selectedCity.name} ({neighborhoods.length})</span>
                  <button className="btn sm" onClick={() => { setQForm({ name:'' }); setQModal('create'); }}>+ Quartier</button>
                </div>
                <input className="input" placeholder="Rechercher…" value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ width:'100%', marginBottom:12 }} />
                {loadingQ ? <div style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>Chargement…</div> : (
                  <div className="card" style={{ overflow:'hidden' }}>
                    <table className="tbl">
                      <thead><tr><th>Quartier</th><th>Statut</th><th style={{ textAlign:'right' }}>Actions</th></tr></thead>
                      <tbody>
                        {filteredQ.length === 0 ? (
                          <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--muted)', padding:20 }}>Aucun quartier</td></tr>
                        ) : filteredQ.map(q => (
                          <tr key={q.id} style={{ opacity: q.isActive ? 1 : 0.5 }}>
                            <td style={{ fontWeight:600 }}>{q.name}</td>
                            <td><Pill tone={q.isActive ? 'ok' : 'mut'}>{q.isActive ? 'Actif' : 'Inactif'}</Pill></td>
                            <td style={{ textAlign:'right' }}>
                              <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                                <button className="btn sm" onClick={() => { setQForm({ name: q.name }); setQModal(q); }}>Modifier</button>
                                <button className="btn sm" onClick={() => adminApi.updateNeighborhood(q.id, { isActive: !q.isActive }).then(() => loadNeighborhoods(selectedCity.id))} style={{ color: q.isActive ? 'var(--danger)' : 'var(--green)' }}>{q.isActive ? 'Désact.' : 'Activer'}</button>
                                <button className="btn sm" onClick={() => window.confirm(`Supprimer "${q.name}" ?`) && adminApi.deleteNeighborhood(q.id).then(() => { loadNeighborhoods(selectedCity.id); loadCities(); })} style={{ color:'var(--danger)' }}>Suppr.</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* City modal */}
          {cityModal && (
            <Modal title={cityModal === 'create' ? 'Nouvelle ville' : `Modifier ${cityModal.name}`} onClose={() => setCityModal(null)}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label style={{ fontSize:12, fontWeight:700, marginBottom:4, display:'block' }}>Nom *</label><input className="input" value={cityForm.name} onChange={e => setCityForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Douala" /></div>
                <div><label style={{ fontSize:12, fontWeight:700, marginBottom:4, display:'block' }}>Région *</label><input className="input" value={cityForm.region} onChange={e => setCityForm(f => ({ ...f, region: e.target.value }))} placeholder="ex: Littoral" /></div>
                <div style={{ display:'flex', gap:10, marginTop:6 }}>
                  <button className="btn" style={{ flex:1 }} onClick={() => setCityModal(null)}>Annuler</button>
                  <button className="btn" style={{ flex:1, background:'var(--green)', color:'#fff' }} onClick={saveCity} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
                </div>
              </div>
            </Modal>
          )}
          {qModal && (
            <Modal title={qModal === 'create' ? `Nouveau quartier — ${selectedCity?.name}` : `Modifier ${qModal.name}`} onClose={() => setQModal(null)}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label style={{ fontSize:12, fontWeight:700, marginBottom:4, display:'block' }}>Nom *</label><input className="input" value={qForm.name} onChange={e => setQForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Bonapriso" /></div>
                <div style={{ display:'flex', gap:10, marginTop:6 }}>
                  <button className="btn" style={{ flex:1 }} onClick={() => setQModal(null)}>Annuler</button>
                  <button className="btn" style={{ flex:1, background:'var(--green)', color:'#fff' }} onClick={saveQ} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}
    </section>
  );
}
