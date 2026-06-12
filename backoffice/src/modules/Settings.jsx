import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Skeleton, Toggle } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const DEFAULT_SETTINGS = [
  { key:'commission_rate',     label:'Taux de commission (%)',     type:'number', value:'3'    },
  { key:'express_multiplier',  label:'Multiplicateur Express',      type:'number', value:'1.5'  },
  { key:'vvip_multiplier',     label:'Multiplicateur VVIP',         type:'number', value:'2.5'  },
  { key:'min_delivery_price',  label:'Prix minimum livraison (XAF)',type:'number', value:'1500' },
  { key:'maintenance_mode',    label:'Mode maintenance',            type:'toggle', value:'false'},
  { key:'sms_notifications',   label:'Notifications SMS',           type:'toggle', value:'true' },
];

export default function Settings() {
  const { t } = useI18n();
  const qc    = useQueryClient();
  const [local, setLocal] = useState({});
  const [saved, setSaved] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn:  adminApi.settings,
    retry:    false,
  });

  useEffect(() => {
    if (data) {
      const map = {};
      (Array.isArray(data) ? data : Object.entries(data).map(([k,v]) => ({ key:k, value:String(v) }))).forEach(s => { map[s.key] = s.value; });
      setLocal(map);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: ({ key, value }) => adminApi.updateSetting(key, value),
    onSuccess:  (_, { key }) => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    },
  });

  const settings = data
    ? DEFAULT_SETTINGS.map(def => ({ ...def, value: local[def.key] ?? def.value }))
    : DEFAULT_SETTINGS;

  function handleChange(key, val) {
    setLocal(prev => ({ ...prev, [key]: String(val) }));
  }

  function handleSave(key, type) {
    const value = local[key] ?? settings.find(s => s.key === key)?.value;
    saveMut.mutate({ key, value });
  }

  return (
    <section className="content">
      <div style={{ maxWidth:600 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {isLoading ? (
            Array.from({length:6}).map((_,i) => (
              <div key={i} className="card pad"><Skeleton h={24} /></div>
            ))
          ) : settings.map((s) => (
            <div key={s.key} className="card pad" style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{s.label}</div>
                <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'var(--mono)' }}>{s.key}</div>
              </div>

              {s.type === 'toggle' ? (
                <Toggle
                  on={local[s.key] === 'true' || (local[s.key] === undefined && s.value === 'true')}
                  onToggle={(v) => {
                    handleChange(s.key, v ? 'true' : 'false');
                    saveMut.mutate({ key: s.key, value: v ? 'true' : 'false' });
                  }}
                />
              ) : (
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input
                    type={s.type}
                    value={local[s.key] ?? s.value}
                    onChange={e => handleChange(s.key, e.target.value)}
                    style={{ width:100, padding:'7px 11px', borderRadius:9, border:'1px solid var(--line)', fontFamily:'var(--mono)', fontSize:14, outline:'none', textAlign:'right' }}
                    onFocus={e => e.target.style.borderColor = 'var(--green)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--line)'}
                  />
                  <button className="btn sm"
                    onClick={() => handleSave(s.key, s.type)}
                    disabled={saveMut.isPending}>
                    {saved === s.key ? '✓' : t('save')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
