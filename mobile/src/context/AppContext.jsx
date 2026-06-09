import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import * as Application from 'expo-application';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../services/api';
import { setCurrentLang } from '../i18n/translations.js';
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
  const [role, setRole] = useState('vendor');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [conversations, setConversations] = useState({});
  const [pricing, setPricing] = useState({ baseRate: 300, perKmRate: 150, minPrice: 1000, weightSurcharge: 100, commissionRate: 15 });
  const [lang, setLangState] = useState(initialLang);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const toastTimer = useRef(null);

  // Fetch pricing config from backend on mount
  useEffect(() => {
    apiFetch('/api/public/pricing').then(d => { if (d) setPricing(d); }).catch(() => {});
  }, []);

  // Restore persisted session + lang + biometric flag on startup
  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('kg_token').catch(() => null),
      SecureStore.getItemAsync('kg_lang').catch(() => null),
      SecureStore.getItemAsync('kg_biometric').catch(() => null),
    ]).then(([storedToken, storedLang, storedBio]) => {
      if (storedLang) {
        setCurrentLang(storedLang);
        setLangState(storedLang);
      }
      if (storedBio === '1') setBiometricEnabled(true);
      if (storedToken) {
        // Verify token is still valid
        apiFetch('/api/users/me', {}, storedToken).then(u => {
          if (u?.id) loginAs({ ...u, role: u.role?.toLowerCase() || 'vendor' }, storedToken);
        }).catch(() => {
          SecureStore.deleteItemAsync('kg_token').catch(() => {});
        });
      }
    }).finally(() => setSessionRestored(true));
  }, []);

  const setLang = (l) => {
    setCurrentLang(l);
    setLangState(l);
    SecureStore.setItemAsync('kg_lang', l).catch(() => {});
  };

  const enableBiometric = (enabled) => {
    setBiometricEnabled(enabled);
    SecureStore.setItemAsync('kg_biometric', enabled ? '1' : '0').catch(() => {});
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
      await apiFetch('/api/auth/device-session', {
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
        SecureStore.setItemAsync('kg_token', jwt).catch(() => {});
      }
    }
    if (account.isTest) {
      setConversations(roleNorm === 'vendor' ? DEMO_CONV_VENDOR : DEMO_CONV_DELIVERER);
    } else {
      setConversations({});
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPendingUser(null);
    setRole('vendor');
    setConversations({});
    SecureStore.deleteItemAsync('kg_token').catch(() => {});
  };

  // Authenticated API shortcut
  const api = useCallback(
    (path, options = {}) => apiFetch(path, options, token),
    [token]
  );

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
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
export { getInitials };
