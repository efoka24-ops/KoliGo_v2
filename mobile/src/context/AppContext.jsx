import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import * as Application from 'expo-application';
import * as Location from 'expo-location';
import { storage as SecureStore } from '../utils/storage';
import { registerForPush, showLocal } from '../services/push';
import { apiFetch, setAuthFailureHandler } from '../services/api';
import { setCurrentLang } from '../i18n/translations.js';
import { useI18n } from '../i18n';
import { getInitials } from '../utils/helpers';

const AppContext = createContext(null);

// ── Demo conversations ───────────────────────────────────────────────────────
const _DEMO_MSGS = [
  { id: 1, from: 'them', text: 'Bonjour ! Je viens prendre le colis, je suis à 3 minutes.', time: '14:18' },
  { id: 2, from: 'me',   text: 'Ok parfait, je suis devant la boutique 🙏', time: '14:19' },
  { id: 3, from: 'them', text: 'Je porte un casque rouge.', time: '14:20' },
  { id: 4, from: 'me',   text: 'Vu, je te repère.', time: '14:21' },
  { id: 5, from: 'them', text: 'Je suis là 👋', time: '14:32' },
];

const DEMO_CONV_VENDOR = {
  c_herve: {
    id: 'c_herve', contactId: 'herve_nk', contactName: 'Hervé Nkouamba',
    contactInitials: 'HN', contactRole: 'deliverer',
    messages: _DEMO_MSGS,
    lastMessage: 'Je suis là 👋', lastTime: '14:32', unread: 0,
  },
  c_aicha: {
    id: 'c_aicha', contactId: 'aicha_mb', contactName: 'Aïcha Mballa',
    contactInitials: 'AM', contactRole: 'client',
    messages: [{ id: 1, from: 'them', text: 'Bonjour, mon colis est arrivé ?', time: '10:45' }],
    lastMessage: 'Bonjour, mon colis est arrivé ?', lastTime: '10:45', unread: 1,
  },
};

const DEMO_CONV_DELIVERER = {
  c_marie: {
    id: 'c_marie', contactId: 'marie_ng', contactName: 'Marie Ngono',
    contactInitials: 'MN', contactRole: 'vendor',
    messages: _DEMO_MSGS.map(m => ({ ...m, from: m.from === 'me' ? 'them' : 'me' })),
    lastMessage: 'Je suis là 👋', lastTime: '14:32', unread: 0,
  },
  c_alphonse: {
    id: 'c_alphonse', contactId: 'alphonse_mb', contactName: 'Alphonse Mboa',
    contactInitials: 'AM', contactRole: 'client',
    messages: [
      { id: 1, from: 'them', text: 'Bonjour, je suis disponible pour recevoir le colis.', time: '09:15' },
      { id: 2, from: 'me',   text: "Ok, j'arrive dans 10 min !", time: '09:17' },
    ],
    lastMessage: "Ok, j'arrive dans 10 min !", lastTime: '09:17', unread: 0,
  },
};


export function AppProvider({ children, initialLang = 'fr' }) {
  // AppProvider sits inside I18nProvider (see App.tsx), so it can drive it.
  const { setLang: i18nSetLang } = useI18n();
  const [role, setRole] = useState('vendor');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [conversations, setConversations] = useState({});
  const [pricing, setPricing] = useState({ baseRate: 300, perKmRate: 150, minPrice: 1000, weightSurcharge: 100, commissionRate: 15 });
  const [lang, setLangState] = useState(initialLang);
  const [maintenance, setMaintenance] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const biometricRef = useRef(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [online, setOnline] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const pushOkRef = useRef(false);
  const seenNotifRef = useRef(null); // ids déjà connus : au premier chargement on ne notifie pas l'historique
  const toastTimer = useRef(null);

  // Etat de la plateforme (mode maintenance reglable depuis le back-office) : lu au demarrage puis toutes les 60 s.
  const refreshConfig = useCallback(async () => {
    try {
      const c = await apiFetch('/public/config');
      if (c && typeof c.maintenance === 'boolean') setMaintenance(c.maintenance);
    } catch { /* hors ligne : on garde l'etat connu */ }
  }, []);
  useEffect(() => {
    refreshConfig();
    const id = setInterval(refreshConfig, 60000);
    return () => clearInterval(id);
  }, [refreshConfig]);

  // Fetch pricing config from backend on mount
  useEffect(() => {
    apiFetch('/public/pricing').then(d => { if (d) setPricing(d); }).catch(() => {});
  }, []);

  // Restore persisted session + lang + biometric flag on startup
  useEffect(() => {
    Promise.all([
      SecureStore.getItem('access_token').catch(() => null),
      SecureStore.getItem('kg_lang').catch(() => null),
      SecureStore.getItem('kg_biometric').catch(() => null),
    ]).then(([storedToken, storedLang, storedBio]) => {
      if (storedLang) {
        setCurrentLang(storedLang);
        setLangState(storedLang);
      }
      if (storedBio === '1') { setBiometricEnabled(true); biometricRef.current = true; }
      if (storedToken) {
        // Verify token is still valid
        apiFetch('/user/profile', {}, storedToken).then(u => {
          if (u?.id) loginAs({ ...u, role: u.activeRole?.toLowerCase() || 'vendor' }, storedToken);
        }).catch(() => {
          SecureStore.deleteItem('access_token').catch(() => {});
        });
      }
    }).finally(() => setSessionRestored(true));
  }, []);

  const setLang = (l) => {
    setCurrentLang(l);
    setLangState(l);
    SecureStore.setItem('kg_lang', l).catch(() => {});
    // The screens using useI18n().t keep their own language state. Without
    // this the UI ends up half translated: whichever provider was not updated
    // stays on the previous language.
    i18nSetLang(l);
  };

  const enableBiometric = (enabled) => {
    setBiometricEnabled(enabled);
    biometricRef.current = enabled;
    SecureStore.setItem('kg_biometric', enabled ? '1' : '0').catch(() => {});
  };

  const showToast = (message, kind = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const collectDeviceSession = async (jwtToken) => {
    if (!jwtToken) return;
    try {
      let deviceId = null, deviceModel = null, deviceBrand = null, osVersion = null, ipAddress = null, lat = null, lng = null, appVersion = null;
      if (Platform.OS !== 'web') {
        const [ip, perm] = await Promise.all([
          Network.getIpAddressAsync().catch(() => null),
          Location.getForegroundPermissionsAsync().catch(() => ({ status: 'denied' })),
        ]);
        ipAddress = ip;
        if (perm.status === 'granted') {
          const loc = await Location.getLastKnownPositionAsync().catch(() => null);
          if (loc) { lat = loc.coords.latitude; lng = loc.coords.longitude; }
        }
        deviceId = Platform.OS === 'android'
          ? (Application.getAndroidId?.() ?? null)
          : (Application.applicationId ?? null);
        deviceModel = Device.modelName;
        deviceBrand = Device.brand;
        osVersion = `${Device.osName} ${Device.osVersion}`;
        appVersion = Application.nativeApplicationVersion;
      } else {
        // Web browser fingerprint
        deviceId = typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 40) : 'web';
        deviceBrand = 'Browser';
        deviceModel = typeof navigator !== 'undefined' ? (navigator.platform ?? 'Web') : 'Web';
        osVersion = typeof navigator !== 'undefined' ? (navigator.userAgent?.match(/(Windows NT|Mac OS X|Linux|Android|iOS)[^\s;)]*/)?.[0] ?? 'Web') : 'Web';
        appVersion = 'web';
        // Try geolocation in browser
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          await new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
              (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
              () => resolve(),
              { timeout: 3000 }
            );
          });
        }
      }
      await apiFetch('/auth/device-session', {
        method: 'POST',
        body: JSON.stringify({ deviceId, deviceModel, deviceBrand, osVersion, ipAddress, lat, lng, appVersion }),
      }, jwtToken);
    } catch {}
  };

  const loginAs = (account, jwt = null) => {
    const roleNorm = (account.role || 'vendor').toLowerCase();
    const avatar = account.avatar || getInitials(account.name);
    setUser({ ...account, avatar, role: roleNorm });
    setRole(roleNorm);
    if (jwt) {
      setToken(jwt);
      if (!account.isTest) {
        collectDeviceSession(jwt);
        SecureStore.setItem('access_token', jwt).catch(() => {});
      }
    }
    if (account.isTest) {
      setConversations(roleNorm === 'vendor' ? DEMO_CONV_VENDOR : DEMO_CONV_DELIVERER);
    } else {
      setConversations({});
    }
  };

  // keepBiometric : déconnexion volontaire avec empreinte/Face ID activé → on garde le jeton de renouvellement
  // et le numéro, pour que la biométrie puisse rouvrir la session. Un échec d'authentification efface tout.
  const logout = useCallback((opts) => {
    setUser(null);
    setToken(null);
    setPendingUser(null);
    setRole('vendor');
    setConversations({});
    SecureStore.deleteItem('access_token').catch(() => {});
    const keep = !(opts && opts.authFailure === true) && (biometricRef.current || (opts && opts.keepBiometric === true));
    if (!keep) {
      SecureStore.deleteItem('refresh_token').catch(() => {});
      SecureStore.deleteItem('user_phone').catch(() => {});
    }
  }, []);

  // Register logout as the handler for token-refresh failures in the axios interceptor
  useEffect(() => {
    setAuthFailureHandler(() => logout({ authFailure: true }));
  }, [logout]);

  // Authenticated API shortcut
  const api = useCallback(
    (path, options = {}) => apiFetch(path, options, token),
    [token]
  );

  // Centre de notifications : relève toutes les 20 s (application ouverte) ; le push FCM prend le relais application fermée.
  const refreshNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiFetch('/notifications?limit=40', {}, token);
      if (!r) return;
      setNotifications(r.items || []);
      setUnreadCount(r.unread || 0);
      const known = seenNotifRef.current;
      const fresh = (r.items || []).filter((n) => !n.read && known && !known.has(n.id));
      if (!pushOkRef.current) fresh.slice(0, 3).forEach((n) => showLocal(n.title, n.body, n.data));
      seenNotifRef.current = new Set((r.items || []).map((n) => n.id));
    } catch { /* hors ligne */ }
  }, [token]);

  const markNotificationsRead = useCallback(async (ids) => {
    if (!token) return;
    setNotifications((prev) => prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnreadCount((c) => (ids ? Math.max(0, c - ids.length) : 0));
    try { await apiFetch('/notifications/read', { method: 'POST', body: JSON.stringify(ids ? { ids } : {}) }, token); } catch { /* sera resynchronisé */ }
  }, [token]);

  useEffect(() => {
    if (!token || user?.isTest) { setNotifications([]); setUnreadCount(0); seenNotifRef.current = null; return undefined; }
    registerForPush((p, o) => apiFetch(p, o, token)).then((ok) => { pushOkRef.current = ok; });
    refreshNotifications();
    const id = setInterval(refreshNotifications, 20000);
    return () => clearInterval(id);
  }, [token, user?.isTest, refreshNotifications]);

  // Add a message (from: 'me' | 'them') to an existing conversation
  const _addMsg = (convId, from, text) => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setConversations(prev => {
      const conv = prev[convId];
      if (!conv) return prev;
      const newMsg = { id: conv.messages.length + 1, from, text, time };
      return {
        ...prev,
        [convId]: { ...conv, messages: [...conv.messages, newMsg], lastMessage: text, lastTime: time },
      };
    });
  };

  const sendMessage = (convId, text) => _addMsg(convId, 'me', text);
  const receiveMessage = (convId, text) => _addMsg(convId, 'them', text);

  const markRead = (convId) => {
    setConversations(prev => {
      const conv = prev[convId];
      if (!conv) return prev;
      return { ...prev, [convId]: { ...conv, unread: 0 } };
    });
  };

  // Returns existing convId or creates a new conversation; returns the convId
  const startConversation = (contact) => {
    const existingId = Object.keys(conversations).find(k => conversations[k].contactId === contact.id);
    if (existingId) return existingId;
    const convId = `conv_${Date.now()}`;
    setConversations(prev => ({
      ...prev,
      [convId]: {
        id: convId, contactId: contact.id, contactName: contact.name,
        contactInitials: contact.initials, contactRole: contact.role,
        messages: [], lastMessage: null, lastTime: null, unread: 0,
      },
    }));
    return convId;
  };

  // Expose setOnline for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__koligo_setOnline = (val) => setOnline(val);
    }
  }, []);

  return (
    <AppContext.Provider value={{
      role, setRole,
      user, setUser,
      token, setToken,
      loginAs, logout,
      toast, showToast,
      pendingUser, setPendingUser,
      conversations, sendMessage, receiveMessage, markRead, startConversation,
      api,
      pricing,
      lang, setLang,
      biometricEnabled, enableBiometric,
      sessionRestored,
      online, setOnline,
      maintenance, refreshConfig,
      notifications, unreadCount, refreshNotifications, markNotificationsRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
export { getInitials };
