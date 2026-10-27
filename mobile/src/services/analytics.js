import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { deriveEvents, endpointOf } from './apiEvents';

/**
 * Suivi d'usage : remonte au serveur ce que fait l'utilisateur (écrans vus, actions, erreurs) pour mesurer son expérience.
 *
 *  - Les évènements sont mis en file, gardés sur l'appareil en cas de coupure, puis envoyés par lots (toutes les 20 s, à 20
 *    évènements, ou quand l'application passe en arrière-plan). Rien ne bloque l'écran : tout est silencieux.
 *  - Une session = une période d'activité ; elle se renouvelle après 30 minutes d'inactivité.
 *  - Aucune donnée personnelle : pas de numéro, de code, de PIN, d'e-mail ni de nom. Le serveur filtre aussi.
 *  - L'utilisateur peut tout désactiver dans les paramètres ; plus rien n'est alors collecté ni envoyé.
 *  - Les noms d'évènements sont ceux du plan de marquage (backend-php/app/database/tracking_plan.json).
 */

const KEY_DEVICE = 'kg_analytics_device';
const KEY_QUEUE = 'kg_analytics_queue';
const KEY_OFF = 'kg_analytics_off';
const SESSION_GAP_MS = 30 * 60 * 1000;
const FLUSH_EVERY_MS = 20000;
const FLUSH_AT = 20;
const MAX_QUEUE = 500;
const BATCH = 50;
// En développement on affiche les évènements dans la console sans rien envoyer (sauf demande explicite).
const SEND = typeof __DEV__ === 'undefined' || !__DEV__ || !!process.env.EXPO_PUBLIC_ANALYTICS_DEV;

const PII_KEYS = ['phone', 'tel', 'pin', 'code', 'otp', 'password', 'pass', 'email', 'mail', 'name', 'nom', 'token', 'cni', 'number', 'numero', 'address', 'adresse', 'photo', 'selfie'];

let started = false;
let enabled = true;
let deviceId = null;
let queue = [];
let sessionId = null;
let sessionStart = 0;
let lastActivity = 0;
let lastT = 0; // dernière heure donnée à un évènement : deux évènements n'ont jamais la même milliseconde
let currentScreen = null;
let role = null;
let lang = 'fr';
let flushing = false;
let persistTimer = null;
const lastApiError = new Map();

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;

function clean(params) {
  if (!params || typeof params !== 'object') return undefined;
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(params)) {
    const key = String(k).toLowerCase();
    if (n >= 10 || PII_KEYS.includes(key) || !/^[a-z][a-z0-9_]{0,29}$/.test(key)) continue;
    if (typeof v === 'boolean' || typeof v === 'number') { out[key] = v; n++; }
    else if (typeof v === 'string') {
      out[key] = v.trim().slice(0, 100).replace(/\d{6,}/g, '#').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '#');
      n++;
    }
  }
  return n ? out : undefined;
}

function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(KEY_QUEUE, JSON.stringify(queue.slice(-MAX_QUEUE))).catch(() => {});
  }, 1000);
}

/** Ouvre une nouvelle session si l'activité précédente date de plus de 30 minutes. */
function touchSession(now) {
  if (!sessionId || now - lastActivity > SESSION_GAP_MS) {
    sessionId = uid();
    sessionStart = now;
    queue.push({ id: uid(), name: 'session_start', screen: currentScreen || undefined, t: now - 1, sid: sessionId, role: role || undefined });
  }
  lastActivity = now;
}

/** Enregistre un évènement du plan de marquage. Ne lève jamais d'erreur. */
export function track(name, params) {
  try {
    if (!enabled) return;
    const t = Math.max(Date.now(), lastT + 1);
    lastT = t;
    touchSession(t);
    const evt = { id: uid(), name, screen: currentScreen || undefined, params: clean(params), t, sid: sessionId, role: role || undefined };
    if (!SEND) {
      // eslint-disable-next-line no-console
      console.log(`[analytics] ${name}`, evt.params || '', currentScreen || '');
      return;
    }
    queue.push(evt);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    persistSoon();
    if (queue.length >= FLUSH_AT) flush();
  } catch { /* le suivi ne doit jamais gêner l'application */ }
}

/** Un écran s'affiche. */
export function screenView(name) {
  if (!name || name === currentScreen) return;
  const previous = currentScreen;
  currentScreen = name;
  track('screen_view', previous ? { previous_screen: previous } : undefined);
}

export function setAnalyticsRole(r) { role = r || null; }
export function setAnalyticsLang(l) { if (l) lang = String(l).slice(0, 2); }
export function isAnalyticsEnabled() { return enabled; }

/** Choix de l'utilisateur : désactivé = plus aucune collecte, file vidée. */
export async function setAnalyticsEnabled(value) {
  if (value === enabled) return;
  if (!value) {
    track('consent_update', { enabled: false });
    await flush();
    enabled = false;
    queue = [];
    AsyncStorage.removeItem(KEY_QUEUE).catch(() => {});
    AsyncStorage.setItem(KEY_OFF, '1').catch(() => {});
  } else {
    enabled = true;
    AsyncStorage.removeItem(KEY_OFF).catch(() => {});
    track('consent_update', { enabled: true });
  }
}

/** Envoie jusqu'à 50 évènements. En cas d'échec réseau ils restent en file pour le prochain essai. */
export async function flush() {
  if (!SEND || !enabled || flushing || !queue.length || !deviceId) return;
  flushing = true;
  const batch = queue.slice(0, BATCH);
  try {
    await api.post('/analytics/events', {
      deviceId, appVersion: Application.nativeApplicationVersion || undefined, build: Application.nativeBuildVersion || undefined,
      platform: Platform.OS, lang, events: batch,
    }, { timeout: 8000, __analytics: true });
    const sent = new Set(batch.map((e) => e.id));
    queue = queue.filter((e) => !sent.has(e.id));
    persistSoon();
    flushing = false;
    if (queue.length) setTimeout(flush, 400);
    return;
  } catch (e) {
    const st = e?.response?.status;
    // Refus définitif (données invalides) : on jette le lot pour ne pas bloquer la file. Réseau ou limite de débit : on garde.
    if (st && st >= 400 && st < 500 && st !== 429 && st !== 401) {
      const bad = new Set(batch.map((x) => x.id));
      queue = queue.filter((x) => !bad.has(x.id));
      persistSoon();
    }
  }
  flushing = false;
}

/** Les appels au serveur deviennent des évènements métier (table de correspondance dans apiEvents) et des erreurs mesurées. */
function onApi(config, status, data, err) {
  try {
    if (!config || config.__analytics || config.__tracked || String(config.url || '').includes('/analytics/')) return;
    config.__tracked = true;
    const h = config.headers;
    const override = (h && typeof h.get === 'function' ? h.get('X-HTTP-Method-Override') : h && h['X-HTTP-Method-Override']) || '';
    const verb = String(override || config.method || 'get').toUpperCase();
    let body = config.data;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const endpoint = endpointOf(config.url);
    const evs = deriveEvents(verb, endpoint.path, status, body, data);
    evs.forEach((e) => track(e.name, e.params));
    // Erreurs d'appel : réseau, délai, erreur serveur, ou refus client non couvert par un évènement métier. Un 404 et un 401 sont normaux.
    const failed = status === 0 || status >= 400;
    const mapped = evs.some((e) => e.name.endsWith('_failed') || e.name.endsWith('_error'));
    if (failed && status !== 404 && status !== 401 && (status === 0 || status >= 500 || !mapped)) {
      const key = `${endpoint.norm}|${status}`;
      const now = Date.now();
      if (now - (lastApiError.get(key) || 0) > 60000) {
        lastApiError.set(key, now);
        const kind = err?.code === 'ECONNABORTED' ? 'timeout' : status === 0 ? 'network' : status >= 500 ? 'server' : 'client';
        track('api_error', { endpoint: endpoint.norm, status, kind });
      }
    }
  } catch { /* ignoré */ }
}

/** À appeler une fois au démarrage (App.js). */
export async function initAnalytics() {
  if (started) return;
  started = true;
  try {
    const [dev, off, q] = await Promise.all([AsyncStorage.getItem(KEY_DEVICE), AsyncStorage.getItem(KEY_OFF), AsyncStorage.getItem(KEY_QUEUE)]);
    deviceId = dev;
    if (!deviceId) { deviceId = uid(); AsyncStorage.setItem(KEY_DEVICE, deviceId).catch(() => {}); }
    enabled = off !== '1';
    if (enabled && q) { try { const old = JSON.parse(q); if (Array.isArray(old)) queue = old.concat(queue).slice(-MAX_QUEUE); } catch { /* file corrompue : ignorée */ } }
  } catch { /* stockage indisponible : le suivi tourne en mémoire seulement */ if (!deviceId) deviceId = uid(); }

  api.interceptors.response.use(
    (res) => { onApi(res.config, res.status, res.data); return res; },
    (err) => { onApi(err.config, err.response?.status ?? 0, err.response?.data, err); return Promise.reject(err); },
  );

  let backgroundedAt = 0;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      if (backgroundedAt && Date.now() - backgroundedAt > SESSION_GAP_MS) track('app_open', { cold_start: false });
      backgroundedAt = 0;
    } else if (!backgroundedAt) {
      backgroundedAt = Date.now();
      track('app_background', { session_seconds: Math.round((backgroundedAt - sessionStart) / 1000) });
      flush();
    }
  });
  setInterval(flush, FLUSH_EVERY_MS);

  track('app_open', { cold_start: true });
  flush();
}
