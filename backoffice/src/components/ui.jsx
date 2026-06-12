import React from 'react';

export function Pill({ tone = 'mut', children }) {
  return <span className={`pill ${tone}`}><i className="d" />{children}</span>;
}

export function Avatar({ tone = 'k', size, children }) {
  return <div className={`av ${tone}`} style={size ? { width: size, height: size } : undefined}>{children}</div>;
}

export function User({ tone, name, sub }) {
  return (
    <div className="usr">
      <Avatar tone={tone}>{name.charAt(0)}</Avatar>
      <div><div className="nm">{name}</div>{sub && <div className="sub">{sub}</div>}</div>
    </div>
  );
}

export function Kpi({ icon, iconTone = 'k', delta, deltaDir, label, value, unit, spark }) {
  return (
    <div className="card kpi">
      <div className="top">
        <div className={`ico ${iconTone}`}>{icon}</div>
        {delta && <span className={`delta ${deltaDir}`}>{deltaDir === 'up' ? '▲' : '▼'} {delta}</span>}
      </div>
      <div className="lbl">{label}</div>
      <div className="val">{value}{unit && <span className="u"> {unit}</span>}</div>
      {spark && (() => {
        const mx = Math.max(...spark, 1);
        return (
          <div className="spark">
            {spark.map((h, i) => (
              <i key={i} className={i === spark.length - 1 ? 'hi' : ''}
                style={{ height: `${Math.max(4, Math.round(h / mx * 100))}%` }} />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export function RowHead({ title, sub, right }) {
  return (
    <div className="row-head">
      <div><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div>
      {right}
    </div>
  );
}

export function Toggle({ on, onClick, onToggle }) {
  const handler = onToggle ? () => onToggle(!on) : onClick;
  return <div className={`toggle ${on ? '' : 'off'}`} onClick={handler} role="switch" aria-checked={on} />;
}

export function Progress({ value, tone }) {
  return <div className="progress"><i className={tone === 'o' ? 'o' : ''} style={{ width: `${value}%` }} /></div>;
}

export function Skeleton({ h = 20, w = '100%' }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: 6 }} />;
}
