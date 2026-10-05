import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api.js';

const EMPTY_MEMBER = { name: '', role: '', bio: '' };
const EMPTY_NEWS = { title: '', summary: '' };

export default function SiteContent() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['site-content'],
    queryFn: adminApi.siteContent,
  });

  const initial = useMemo(() => ({
    heroTitle: data?.heroTitle || '',
    heroSubtitle: data?.heroSubtitle || '',
    aboutTitle: data?.aboutTitle || '',
    aboutText: data?.aboutText || '',
    team: Array.isArray(data?.team) && data.team.length ? data.team : [EMPTY_MEMBER],
    news: Array.isArray(data?.news) && data.news.length ? data.news : [EMPTY_NEWS],
  }), [data]);

  const [form, setForm] = useState(initial);

  React.useEffect(() => {
    setForm(initial);
  }, [initial]);

  const saveMut = useMutation({
    mutationFn: adminApi.updateSiteContent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-content'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    },
  });

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTeam(index, key, value) {
    setForm((prev) => {
      const next = [...prev.team];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, team: next };
    });
  }

  function updateNews(index, key, value) {
    setForm((prev) => {
      const next = [...prev.news];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, news: next };
    });
  }

  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>Contenu du site</h2>
          <div className="sub">Modification du hero, de la section a propos, de l'equipe et des actualites.</div>
        </div>
        <button
          className="btn pri"
          disabled={saveMut.isPending || isLoading}
          onClick={() => saveMut.mutate(form)}
        >
          {saved ? 'Enregistre' : (saveMut.isPending ? 'Sauvegarde...' : 'Sauvegarder')}
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr', maxWidth: 980 }}>
        <div className="card pad compact-form">
          <h3>Hero</h3>
          <label>Titre principal</label>
          <input value={form.heroTitle} onChange={(e) => updateField('heroTitle', e.target.value)} />
          <label>Sous-titre</label>
          <textarea rows={2} value={form.heroSubtitle} onChange={(e) => updateField('heroSubtitle', e.target.value)} />
        </div>

        <div className="card pad compact-form">
          <h3>A propos</h3>
          <label>Titre</label>
          <input value={form.aboutTitle} onChange={(e) => updateField('aboutTitle', e.target.value)} />
          <label>Texte</label>
          <textarea rows={3} value={form.aboutText} onChange={(e) => updateField('aboutText', e.target.value)} />
        </div>

        <div className="card pad compact-form">
          <div className="inline-head">
            <h3>Equipe</h3>
            <button className="btn sm" onClick={() => setForm((p) => ({ ...p, team: [...p.team, { ...EMPTY_MEMBER }] }))}>+ Ajouter</button>
          </div>
          {form.team.map((member, idx) => (
            <div className="inline-grid" key={`team-${idx}`}>
              <input placeholder="Nom" value={member.name} onChange={(e) => updateTeam(idx, 'name', e.target.value)} />
              <input placeholder="Role" value={member.role} onChange={(e) => updateTeam(idx, 'role', e.target.value)} />
              <input placeholder="Bio" value={member.bio} onChange={(e) => updateTeam(idx, 'bio', e.target.value)} />
            </div>
          ))}
        </div>

        <div className="card pad compact-form">
          <div className="inline-head">
            <h3>Actualites</h3>
            <button className="btn sm" onClick={() => setForm((p) => ({ ...p, news: [...p.news, { ...EMPTY_NEWS }] }))}>+ Ajouter</button>
          </div>
          {form.news.map((item, idx) => (
            <div className="inline-grid" key={`news-${idx}`}>
              <input placeholder="Titre" value={item.title} onChange={(e) => updateNews(idx, 'title', e.target.value)} />
              <input placeholder="Resume" value={item.summary} onChange={(e) => updateNews(idx, 'summary', e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
