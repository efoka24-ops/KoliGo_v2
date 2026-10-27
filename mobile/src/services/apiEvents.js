/**
 * Table de correspondance : appel au serveur -> évènement du plan de marquage.
 * Une seule table couvre tous les écrans : ajouter une règle suffit pour mesurer une nouvelle action, sans toucher aux écrans.
 * Un succès (2xx) émet `ok`, un échec émet `ko` avec le code HTTP. Les noms doivent exister dans tracking_plan.json
 * (vérifié par tools/check-tracking.js).
 */

const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
const channels = (b, d) => ({ sms: d?.sms === true, email: d?.email === true });

// [verbes, chemin, succès, échec, paramètres (corps de la requête, réponse)]
const RULES = [
  [['POST'], /^\/auth\/(otp\/send|send-otp)$/, 'otp_sent', 'otp_send_failed', (b, d) => channels(b, d)],
  [['POST'], /^\/auth\/(otp\/verify|verify-otp)$/, 'otp_verified', 'otp_failed'],
  [['POST'], /^\/auth\/signup$/, 'signup_success', 'signup_failed', (b) => ({ role: b?.role })],
  [['POST'], /^\/auth\/signin$/, 'login_success', 'login_failed'],
  [['POST'], /^\/auth\/forgot-pin$/, 'pin_reset_requested', 'pin_reset_request_failed', (b, d) => channels(b, d)],
  [['POST'], /^\/auth\/reset-pin$/, 'pin_reset_success', 'pin_reset_failed'],
  [['POST'], /^\/(auth|user)\/kyc$/, 'kyc_submitted', 'kyc_submit_failed'],
  [['POST'], /^\/auth\/accept-cgu$/, 'cgu_accepted'],
  [['POST'], /^\/auth\/switch-role$/, 'role_switched', null, (b) => ({ role: b?.role })],
  [['POST'], /^\/user\/change-pin$/, 'pin_changed'],
  [['POST'], /^\/notifications\/read$/, 'notifications_read'],

  [['POST'], /^\/deliveries$/, 'delivery_published', 'delivery_publish_failed', (b) => ({ size: b?.size, deliverer_type: b?.delivererType })],
  [['PATCH', 'PUT', 'POST'], /^\/deliveries\/[^/]+\/cancel$/, 'delivery_cancelled'],
  [['PATCH', 'PUT', 'POST'], /^\/deliveries\/[^/]+\/accept$/, 'delivery_accepted', 'delivery_accept_failed'],
  [['POST'], /^\/deliveries\/[^/]+\/decline$/, 'offer_declined'],
  [['POST'], /^\/deliveries\/[^/]+\/reject$/, 'parcel_rejected', null, (b) => ({ kind: b?.kind })],
  [['POST'], /^\/deliveries\/[^/]+\/pickup$/, 'pickup_confirmed', 'pickup_failed'],
  [['POST'], /^\/deliveries\/[^/]+\/revision$/, 'size_correction_proposed'],
  [['PATCH', 'PUT'], /^\/deliveries\/[^/]+\/revision$/, 'size_correction_answered'],
  [['POST'], /^\/deliveries\/[^/]+\/arrive$/, 'arrival_confirmed'],
  [['POST'], /^\/deliveries\/[^/]+\/charge$/, 'buyer_charge_requested', 'buyer_charge_failed'],
  [['POST'], /^\/incidents\/[^/]+\/appeal$/, 'incident_appealed'],
  [['POST'], /^\/ratings$/, 'delivery_rated', null, (b) => ({ stars: num(b?.rating ?? b?.stars ?? b?.score) })],

  [['POST'], /^\/ads$/, 'ad_published', 'ad_publish_failed', (b) => ({ type: b?.type, days: num(b?.days) })],
  [['POST'], /^\/ads\/[^/]+\/contact$/, 'ad_contact_click'],
  [['POST'], /^\/ads\/[^/]+\/report$/, 'ad_reported'],
  [['POST'], /^\/ads\/[^/]+\/withdraw$/, 'ad_withdrawn'],
  [['POST'], /^\/ads\/[^/]+\/republish$/, 'ad_republished', null, (b) => ({ type: b?.type, days: num(b?.days) })],

  [['POST'], /^\/wallet\/topup$/, 'topup_requested', 'topup_failed', (b) => ({ amount_xaf: num(b?.amount) })],
  [['POST'], /^\/wallet\/withdraw$/, 'withdraw_requested', 'withdraw_failed', (b) => ({ amount_xaf: num(b?.amount), provider: b?.provider })],
];

/** Chemin sans domaine, sans préfixe /api et sans paramètres ; `norm` remplace les identifiants par :id. */
export function endpointOf(url) {
  const path = String(url || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/^\/api(?=\/)/, '');
  const norm = path.split('/').map((s) => (s.length >= 10 && /\d/.test(s) ? ':id' : s)).join('/');
  return { path, norm };
}

/** @returns {{name: string, params?: object}[]} */
export function deriveEvents(verb, path, status, body, data) {
  const ok = status >= 200 && status < 300;
  for (const [verbs, re, okName, koName, params] of RULES) {
    if (!verbs.includes(verb) || !re.test(path)) continue;
    if (ok) return [{ name: okName, params: params ? params(body, data) : undefined }];
    if (koName && status !== 401) return [{ name: koName, params: { status } }];
    return [];
  }
  return [];
}
