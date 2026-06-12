import React from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import {
  IconDashboard, IconBox, IconUsers, IconFinance,
  IconSupport, IconZones, IconAnalytics, IconSettings, IconLogout,
} from './icons.jsx';

// Simple inline icons for new sections (SVG paths)
const IconPackage   = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const IconWallet    = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/></svg>;
const IconShield    = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconReset     = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>;

const ICONS = {
  dashboard: IconDashboard, deliveries: IconBox,   users: IconUsers,    finance:   IconFinance,
  support:   IconSupport,   zones:      IconZones,  analytics: IconAnalytics, settings: IconSettings,
  packages:  IconPackage,   wallets:    IconWallet,  security: IconShield,    reset:    IconReset,
};

function Item({ to, id, label, badge }) {
  const { t } = useI18n();
  const Icon = ICONS[id] ?? IconBox;
  const text = label ?? t(id);
  return (
    <NavLink to={to} className={({ isActive }) => `nav-i ${isActive ? 'on' : ''}`}>
      <Icon className="ico" width={16} height={16} />
      <span>{text}</span>
      {badge && <span className="badge">{badge}</span>}
    </NavLink>
  );
}

export default function Sidebar({ onLogout, user }) {
  const { t } = useI18n();
  const displayName = user?.name ?? 'Admin';
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <img src="/koligo-logo-1024.svg" alt="KoliGo" />
        <div>
          <span className="nm">Koli<em>Go</em></span>
          <span className="tag">{t('console')}</span>
        </div>
      </div>

      <div className="sb-sec">Vue d'ensemble</div>
      <Item to="/dashboard"  id="dashboard" />
      <Item to="/packages"   id="packages"  label="Colis" />
      <Item to="/deliveries" id="deliveries" />
      <Item to="/users"      id="users" />
      <Item to="/finance"    id="finance" />

      <div className="sb-sec">Opérations</div>
      <Item to="/support"    id="support"  />
      <Item to="/wallets"    id="wallets"  label="Portefeuilles" />
      <Item to="/security"   id="security" label="Sécurité & KYC" />
      <Item to="/zones"      id="zones"    label="Zones & Tarifs" />
      <Item to="/analytics"  id="analytics" />
      <Item to="/settings"   id="settings" />
      <Item to="/reset"      id="reset"    label="Archivage / Reset" />

      <div className="sb-foot" onClick={onLogout} title={t('logout')}>
        <div className="av">{displayName.charAt(0)}</div>
        <div>
          <div className="nm">{displayName}</div>
          <div className="rl">{t('superAdmin')}</div>
        </div>
        <IconLogout width={15} height={15} style={{ marginLeft:'auto', opacity:.5 }} />
      </div>
    </aside>
  );
}
