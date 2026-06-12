import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { IconSearch, IconBell } from './icons.jsx';

export default function Topbar({ title }) {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="topbar">
      <div>
        <div className="crumb">KoliGo · Douala</div>
        <h1 className="page-t">{title}</h1>
      </div>
      <div style={{ flex: 1 }} />
      <label className="search">
        <IconSearch width={16} height={16} />
        <input placeholder={t('search')} />
      </label>
      <div className="lang-seg">
        <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
      </div>
      <button className="tb-btn" aria-label="Notifications">
        <IconBell width={18} height={18} />
        <span className="ndot" />
      </button>
    </header>
  );
}
