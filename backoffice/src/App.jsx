import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useI18n } from './i18n/I18nContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import DeliveryDrawer from './components/DeliveryDrawer.jsx';
import Login from './modules/Login.jsx';

import Dashboard  from './modules/Dashboard.jsx';
import Deliveries from './modules/Deliveries.jsx';
import Users      from './modules/Users.jsx';
import Finance    from './modules/Finance.jsx';
import Support    from './modules/Support.jsx';
import Zones      from './modules/Zones.jsx';
import Analytics  from './modules/Analytics.jsx';
import Settings   from './modules/Settings.jsx';
import Packages   from './modules/Packages.jsx';
import Wallets    from './modules/Wallets.jsx';
import Security   from './modules/Security.jsx';
import Reset      from './modules/Reset.jsx';

const TITLES = {
  '/dashboard':  'dashboard',  '/deliveries': 'deliveries', '/users':     'users',
  '/finance':    'finance',    '/support':    'support',    '/zones':     'zones',
  '/analytics':  'analytics',  '/settings':   'settings',
  '/packages':   'Colis',      '/wallets':    'Portefeuilles',
  '/security':   'Sécurité & KYC', '/reset':  'Archivage',
};

export default function App() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [drawer,   setDrawer]  = useState(null);
  const [token,    setToken]   = useState(() => localStorage.getItem('kg_admin_token'));
  const [adminUser,setAdminUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kg_admin_user') || 'null'); } catch { return null; }
  });

  if (!token) {
    return (
      <Login onLogin={(tok, user) => {
        localStorage.setItem('kg_admin_token', tok);
        if (user) localStorage.setItem('kg_admin_user', JSON.stringify(user));
        setToken(tok);
        setAdminUser(user);
      }} />
    );
  }

  const titleKey = TITLES[pathname];
  const title = titleKey ? (t(titleKey) || titleKey) : 'Dashboard';

  return (
    <div className="shell">
      <Sidebar
        user={adminUser}
        onLogout={() => {
          localStorage.removeItem('kg_admin_token');
          localStorage.removeItem('kg_admin_user');
          setToken(null);
          setAdminUser(null);
        }}
      />
      <div className="main">
        <Topbar title={title} />
        <Routes>
          <Route path="/"            element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"   element={<Dashboard />} />
          <Route path="/packages"    element={<Packages />} />
          <Route path="/deliveries"  element={<Deliveries onOpen={setDrawer} />} />
          <Route path="/users"       element={<Users />} />
          <Route path="/finance"     element={<Finance />} />
          <Route path="/support"     element={<Support />} />
          <Route path="/wallets"     element={<Wallets />} />
          <Route path="/security"    element={<Security />} />
          <Route path="/zones"       element={<Zones />} />
          <Route path="/analytics"   element={<Analytics />} />
          <Route path="/settings"    element={<Settings />} />
          <Route path="/reset"       element={<Reset />} />
          <Route path="*"            element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      <DeliveryDrawer delivery={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
