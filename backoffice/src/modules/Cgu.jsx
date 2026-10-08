import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/ui.jsx';
import { adminApi } from '../api.js';

const EMPTY = { num: '', title: '', body: '' };

export default function Cgu() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-cgu'], queryFn: adminApi.cgu, retry: false });
  const [lang, setLang] = useState('fr');
  const [texts, setTexts] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (data) setTexts({ fr: JSON.parse(JSON.stringify(data.fr)), en: JSON.parse(JSON.stringify(data.en)) });
  }, [data]);

  const publish = useMutation({
    mutationFn: (t) => adminApi.publishCgu(t.fr, t.en),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['admin-cgu'] });
      setMsg({ ok: true, text: `Version ${d.version} publiée. Chaque utilisateur devra l'accepter avant sa prochaine publication ou course.` });
    },
    onError: (e) => setMsg({ ok: false, text: e.response?.data?.error || e.message }),
  });

  if (isLoading || !texts) return <section className="content">{error ? <div className="card pad" style={{ color: '#C00' }}>Impossible de charger les CGU.</div> : <Skeleton h={300} />}</section>;

  const articles = texts[lang];
  const setArticles = (fn) => setTexts((t) => ({ ...t, [lang]: fn(t[lang]) }));
  const patch = (i, p) => setArticles((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i, d) => setArticles((a) => {
    const k = i + d;
    if (k < 0 || k >= a.length) return a;
    const c = [...a];
    [c[i], c[k]] = [c[k], c[i]];
    return c;
  });

  const dirty = JSON.stringify(texts) !== JSON.stringify({ fr: data.fr, en: data.en });
  const doPublish = () => {
    if (!dirty) return;
    if (window.confirm(`Publier la version ${data.version + 1} des CGU ?\n\nTous les utilisateurs devront l'accepter à nouveau avant de publier ou de livrer.`)) {
      setMsg(null);
      publish.mutate(texts);
    }
  };

  return (
    <section className="content">
      <div className="row-head">
        <div>
          <h2>CGU</h2>
          <div className="sub">
            Version en vigueur : <b>{data.version}</b> · acceptée par {data.acceptedLatest} / {data.totalUsers} utilisateurs.
            Le texte vit en base : l'application l'affiche telle quelle.
          </div>
        </div>
        <button className="btn pri" disabled={!dirty || publish.isPending} onClick={doPublish}>
          {publish.isPending ? 'Publication…' : `Publier la version ${data.version + 1}`}
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.ok ? '#EAF7EE' : '#FEE', color: msg.ok ? '#178A3C' : '#C00', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{msg.text}</div>
      )}

      <div className="chips" style={{ marginBottom: 14 }}>
        <span className={`chip ${lang === 'fr' ? 'on' : ''}`} onClick={() => setLang('fr')}>Français</span>
        <span className={`chip ${lang === 'en' ? 'on' : ''}`} onClick={() => setLang('en')}>English</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr', maxWidth: 980 }}>
        <div className="card pad" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Jetons remplacés automatiquement par les tarifs en vigueur :{' '}
          {data.tokens.map((t) => <code key={t} style={{ marginRight: 8 }}>{t}</code>)}
          <br />Ne publiez pas le texte sans l'avoir fait relire par un conseil juridique.
        </div>

        {articles.map((a, i) => (
          <div key={i} className="card pad compact-form">
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 10, alignItems: 'end' }}>
              <div><label>N°</label><input value={a.num} onChange={(e) => patch(i, { num: e.target.value })} /></div>
              <div><label>Titre</label><input value={a.title} onChange={(e) => patch(i, { title: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn sm" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="btn sm" disabled={i === articles.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="btn sm" onClick={() => setArticles((x) => x.filter((_, j) => j !== i))}>Supprimer</button>
              </div>
            </div>
            <label>Texte</label>
            <textarea rows={6} value={a.body} onChange={(e) => patch(i, { body: e.target.value })} />
          </div>
        ))}

        <div>
          <button className="btn" onClick={() => setArticles((x) => [...x, { ...EMPTY, num: String(x.length + 1) }])}>+ Ajouter un article</button>
        </div>

        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Historique</h3>
          {data.history.map((h) => (
            <div key={h.version} style={{ fontSize: 13, padding: '4px 0' }}>
              Version {h.version} · publiée le {new Date(`${String(h.publishedAt).replace(' ', 'T')}Z`).toLocaleString('fr-FR')}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
