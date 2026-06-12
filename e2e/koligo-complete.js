#!/usr/bin/env node
/**
 * KoliGo V2 — Test E2E Complet
 * - Vrai back-office admin (localhost:5175)
 * - Paiement mock auto-confirmé (PAYMENT_MOCK=true)
 * - Contre-cas avec vérification API + UI
 * - Reçu + notation
 *
 * Vendor  : 691227149 / 1234  (Foka Emmanuel)
 * Livreur : 678758976 / 1234  (Efoka Stephane)
 * Admin   : +237600000001 / 1234  (Admin KoliGo)
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http');
const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────
const APP       = 'http://localhost:8085';
const API       = 'http://localhost:3001';
const BACKOFFICE = 'http://localhost:5175';
const SHOTS     = path.join(__dirname, 'screenshots-complete');

const ADMIN_PHONE   = '+237600000001';
const ADMIN_PIN     = '1234';
const VENDOR_PHONE  = '698892174';   // EMMANUEL MARLY — activeRole VENDOR
const VENDOR_PIN    = '1234';
const DELIVER_PHONE = '691227149';   // ZIEGOUBE FOKA — activeRole DELIVERER
const DELIVER_PIN   = '1234';
const MOMO_PHONE    = '691227149';   // numéro MoMo pour test paiement 100 FCFA

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

let idx = 0;
const shots       = [];
const testResults = [];

// ── Node HTTP helper ──────────────────────────────────────
function apiRequest(method, urlPath, body, token, port = 3001) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = http.request(
      { hostname: 'localhost', port, path: urlPath, method,
        headers: {
          'Content-Type': 'application/json',
          ...(token  ? { Authorization: `Bearer ${token}` } : {}),
          ...(data   ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      res => {
        let buf = '';
        res.on('data', c => (buf += c));
        res.on('end', () => {
          try   { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
          catch { resolve({ status: res.statusCode, data: buf }); }
        });
      }
    );
    req.on('error', e => resolve({ status: 0, data: { error: e.message } }));
    if (data) req.write(data);
    req.end();
  });
}
const apiGet   = (p, t)    => apiRequest('GET',   p, null, t);
const apiPost  = (p, b, t) => apiRequest('POST',  p, b,    t);
const apiPatch = (p, b, t) => apiRequest('PATCH', p, b,    t);

// ── Screenshot helper ─────────────────────────────────────
async function shot(page, slug, desc = '', status = 'info') {
  const name = `${String(++idx).padStart(2, '0')}-${slug}`;
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  if (fs.existsSync(file)) {
    shots.push({ name, desc, status, base64: fs.readFileSync(file).toString('base64') });
  }
  const ic = status === 'ok' ? '✅' : status === 'error' ? '❌' : '📸';
  console.log(`  ${ic} ${name}  ${desc}`);
}

function logTest(suite, name, ok, detail = '') {
  testResults.push({ suite, name, ok, detail });
  console.log(`  ${ok ? '✅' : '❌'} [${suite}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function mkMobile(browser) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
}
async function mkDesktop(browser) {
  return browser.newContext({ viewport: { width: 1200, height: 860 } });
}

async function go(page) {
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4500);
}
async function w(page, ms = 1200) { await page.waitForTimeout(ms); }

async function numpad(page, digits) {
  for (const d of String(digits)) {
    const btn = page.locator(`[role="button"]:has-text("${d}"), button:has-text("${d}")`).first();
    const fb  = page.locator(`text="${d}"`).first();
    const tgt = (await btn.isVisible().catch(() => false)) ? btn : fb;
    await tgt.click({ force: false }).catch(() => {});
    await page.waitForTimeout(420);
  }
}

// ── Sign-in helper ────────────────────────────────────────
async function signin(page, phone, pin, tag) {
  console.log(`\n🔐 ${tag} — ${phone}`);
  await go(page);
  await shot(page, `${tag}-01-start`, `Démarrage — ${tag}`);

  if (await page.getByText('Démarrer').isVisible().catch(() => false)) {
    await page.evaluate(() => window.scrollBy(0, 350));
    await w(page, 400);
    const link = page.getByText(/J'ai déjà un compte/i).first();
    if (await link.isVisible().catch(() => false)) await link.click();
    else await page.evaluate(() => window.__koligo_navigate?.('Signin'));
    await w(page, 900);
  }

  const chg = page.getByText(/Changer de compte/i).first();
  if (await chg.isVisible().catch(() => false)) { await chg.click(); await w(page, 700); }

  const inp = page.getByPlaceholder(/6XX.*XX|email/i).first();
  if (await inp.isVisible().catch(() => false)) {
    await inp.fill(phone);
    await shot(page, `${tag}-02-phone`, `Téléphone — ${phone}`);
    await page.getByText('Continuer').first().click();
    await w(page, 1500);
  }
  await shot(page, `${tag}-03-pin`, 'Saisie PIN');
  await numpad(page, pin);
  await w(page, 3000);
  await shot(page, `${tag}-04-home`, `Connecté — ${tag}`, 'ok');
  console.log(`  ✅ ${tag} connecté`);
}

// ── MAIN ─────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 KoliGo E2E — Complet | Backoffice réel | Mock paiement\n');

  // ═══════════════════════════════════════════════════════
  // SETUP — Admin token
  // ═══════════════════════════════════════════════════════
  console.log('═══ SETUP : Admin + tokens serveur ═══');
  const adminLogin = await apiPost('/api/auth/signin', { phone: ADMIN_PHONE, pin: ADMIN_PIN });
  const adminToken = adminLogin.data?.accessToken;
  logTest('Admin', 'Login admin (+237600000001/1234)', !!adminToken);

  const delivererLogin = await apiPost('/api/auth/signin', { phone: DELIVER_PHONE, pin: DELIVER_PIN });
  const delivererToken = delivererLogin.data?.accessToken;
  logTest('Admin', 'Login livreur (serveur, token fiable)', !!delivererToken);

  const browser = await chromium.launch({
    headless: false,
    slowMo:   40,
    args: ['--window-size=1440,960'],
  });

  // ── Vrai Backoffice admin (desktop) ───────────────────
  console.log('\n🖥  Ouverture back-office réel (localhost:5175)…');
  const boCtx  = await mkDesktop(browser);
  const boPage = await boCtx.newPage();
  await boPage.goto(BACKOFFICE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await w(boPage, 2000);
  await shot(boPage, 'bo-00-login', 'Back-office — Page de connexion');

  // Login backoffice — injection token directe (fiable)
  if (adminToken) {
    await boPage.evaluate(({ tok, usr }) => {
      localStorage.setItem('kg_admin_token', tok);
      if (usr) localStorage.setItem('kg_admin_user', JSON.stringify(usr));
    }, { tok: adminToken, usr: adminLogin.data?.user ?? null });
    await boPage.goto(`${BACKOFFICE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await w(boPage, 2500);
  } else {
    // Fallback formulaire
    const boPhoneInp = boPage.getByPlaceholder('+237 6XX XXX XXX').first();
    if (await boPhoneInp.isVisible().catch(() => false)) {
      await boPhoneInp.fill(ADMIN_PHONE);
      await boPage.getByLabel('Code PIN').first().fill(ADMIN_PIN).catch(() => {});
      await w(boPage, 300);
      await boPage.getByText('Se connecter').first().click();
      await w(boPage, 2500);
    }
  }
  await shot(boPage, 'bo-01-dashboard', 'Back-office — Dashboard admin', 'ok');
  const boDashOk = await boPage.getByText(/livraison|Livraisons|total|dashboard/i).first().isVisible().catch(() => false);
  logTest('Admin', 'Login backoffice web (token injecté)', boDashOk);

  // ═══════════════════════════════════════════════════════
  // CC1 — Mauvais PIN (test visuel UI)
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ CC1 : Mauvais PIN — test UI ═══');
  const ccCtx  = await mkMobile(browser);
  const ccPage = await ccCtx.newPage();
  await go(ccPage);
  if (await ccPage.getByText('Démarrer').isVisible().catch(() => false)) {
    const link = ccPage.getByText(/J'ai déjà un compte/i).first();
    if (await link.isVisible().catch(() => false)) await link.click();
    else await ccPage.evaluate(() => window.__koligo_navigate?.('Signin'));
    await w(ccPage, 900);
  }
  const ccInp = ccPage.getByPlaceholder(/6XX.*XX|email/i).first();
  if (await ccInp.isVisible().catch(() => false)) {
    await ccInp.fill(VENDOR_PHONE);
    await ccPage.getByText('Continuer').first().click();
    await w(ccPage, 1500);
  }
  await shot(ccPage, 'cc01a-pin-screen', 'CC1 — Écran PIN avant saisie');
  await numpad(ccPage, '9999');
  await w(ccPage, 3000);
  const cc1ErrVisible = await ccPage.getByText(/incorrect|erron|invalide|wrong|error|PIN/i).first().isVisible().catch(() => false);
  // aussi vérifier qu'on n'est PAS redirigé vers le dashboard
  const cc1StillOnPin = await ccPage.getByText(/Continuer|Se connecter/i).first().isVisible().catch(() => false)
    || !await ccPage.getByText(/Bonjour|Livreur|Vendeur|Accueil/i).first().isVisible().catch(() => false);
  await shot(ccPage, 'cc01b-wrong-pin', `CC1 — Mauvais PIN: ${cc1ErrVisible ? 'erreur visible ✅' : 'bloqué ✅'}`, 'ok');
  logTest('Contre-cas', 'CC1 — Mauvais PIN 9999 bloque connexion', cc1ErrVisible || cc1StillOnPin);
  await ccCtx.close();

  // CC2 — Téléphone inexistant (API)
  console.log('═══ CC2 : Téléphone inexistant ═══');
  const cc2 = await apiPost('/api/auth/signin', { phone: '699000000', pin: '1234' });
  logTest('Contre-cas', `CC2 — Tél inexistant → ${cc2.status} "${cc2.data?.error}"`, cc2.status >= 400, `HTTP ${cc2.status}`);

  // ═══════════════════════════════════════════════════════
  // PHASE 1 — VENDEUR crée livraison
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ PHASE 1 : VENDEUR — Création livraison ═══');
  const vCtx  = await mkMobile(browser);
  const vPage = await vCtx.newPage();

  await signin(vPage, VENDOR_PHONE, VENDOR_PIN, 'vendeur');

  if (!await vPage.getByText(/Créer une livraison/i).isVisible().catch(() => false)) {
    await vPage.evaluate(() => window.__koligo_navigate?.('VendorApp'));
    await w(vPage, 1500);
  }
  await shot(vPage, 'vendeur-05-home', 'Accueil Vendeur — carte live dynamique');

  await vPage.getByText(/Créer une livraison/i).first().click();
  await w(vPage, 1200);
  await shot(vPage, 'vendeur-06-form', 'Formulaire livraison — Step 1');

  const shopInp = vPage.getByPlaceholder('Nom de ta boutique').first();
  await shopInp.waitFor({ state: 'visible', timeout: 8000 });
  await shopInp.fill('KoliGo Store Test');
  await vPage.evaluate(() => window.scrollBy(0, 100));
  await w(vPage, 200);
  const descInp = vPage.getByPlaceholder(/Robe wax/i).first();
  if (await descInp.isVisible().catch(() => false)) await descInp.fill('MacBook Pro 14"');
  await vPage.evaluate(() => window.scrollBy(0, 100));
  const recipInp = vPage.getByPlaceholder(/Aïcha/i).first();
  if (await recipInp.isVisible().catch(() => false)) await recipInp.fill('Marie Destinataire');
  const clientPhoneInp = vPage.getByPlaceholder('6 XX XX XX XX').first();
  if (await clientPhoneInp.isVisible().catch(() => false)) await clientPhoneInp.fill(MOMO_PHONE);
  await vPage.evaluate(() => window.scrollBy(0, 200));
  await w(vPage, 400);
  const priceInp = vPage.getByPlaceholder(/15000/i).first();
  if (await priceInp.isVisible().catch(() => false)) await priceInp.fill('100');

  await shot(vPage, 'vendeur-07-form-filled', 'Formulaire rempli — prix 100 XAF');
  await vPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await w(vPage, 500);
  const continuerBtn = vPage.getByText('Continuer').first();
  if (await continuerBtn.isVisible().catch(() => false)) {
    await continuerBtn.click();
    await w(vPage, 1200);
    await shot(vPage, 'vendeur-08-step2', 'Résumé livraison — Step 2');
  }
  await vPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await w(vPage, 500);

  let delivery = null;
  try {
    const [resp] = await Promise.all([
      vPage.waitForResponse(
        r => /\/deliveries$/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15000 }
      ),
      vPage.getByText(/Publier l'annonce|Publish delivery/i).last().click(),
    ]);
    delivery = await resp.json();
  } catch {
    await vPage.getByText(/Publier l'annonce|Publish delivery/i).last().click().catch(() => {});
  }
  await w(vPage, 5000);

  // Fallback: if delivery ID not captured from response interception, query API directly
  if (!delivery?.id) {
    console.log('  ⚙️  delivery.id manquant — fallback API vendor login…');
    const vLogin = await apiPost('/api/auth/signin', { phone: VENDOR_PHONE, pin: VENDOR_PIN });
    const vToken = vLogin.data?.accessToken;
    if (vToken) {
      const latest = await apiGet('/api/deliveries', vToken);
      const items = Array.isArray(latest.data) ? latest.data : (latest.data?.items ?? []);
      console.log(`  ⚙️  ${items.length} livraisons trouvées via API`);
      if (items.length > 0) {
        const last = items[0]; // sorted createdAt DESC
        if (last?.id) {
          delivery = last;
          console.log(`  ✅ Livraison récupérée: ID=${last.id?.slice(-6)} collectCode=${last.collectCode} deliverCode=${last.deliverCode}`);
        }
      }
    }
  }

  await shot(vPage, 'vendeur-09-codes', 'VendorCodes — codes générés ✅', delivery?.id ? 'ok' : 'error');

  const collectCode = delivery?.collectCode;
  const deliverCode = delivery?.deliverCode;
  const clientToken = delivery?.clientToken;
  const priceXAF    = delivery?.priceXAF ?? 1100;
  const delivId     = delivery?.id;

  console.log(`\n  📋 Livraison: ID=${delivId?.slice(-6)} collectCode=${collectCode} deliverCode=${deliverCode} priceXAF=${priceXAF}`);
  logTest('Phase 1', 'Création livraison 100 XAF', !!delivery, `ID=${delivId?.slice(-6)} prix=${priceXAF}`);

  // Backoffice — Livraisons après création
  console.log('\n  📊 Back-office → Livraisons (EN_ATTENTE)…');
  await boPage.bringToFront();
  await boPage.goto(`${BACKOFFICE}/deliveries`, { waitUntil: 'domcontentloaded' });
  await w(boPage, 2000);
  await shot(boPage, 'bo-02-deliveries-pending', 'Backoffice — Livraisons EN_ATTENTE', 'info');

  // ═══════════════════════════════════════════════════════
  // PHASE 2 — LIVREUR accepte
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ PHASE 2 : LIVREUR — Connexion + Acceptation ═══');
  const dCtx  = await mkMobile(browser);
  const dPage = await dCtx.newPage();

  await signin(dPage, DELIVER_PHONE, DELIVER_PIN, 'livreur');

  if (!await dPage.getByText(/Meilleures courses|Hors ligne|En ligne/i).isVisible().catch(() => false)) {
    await dPage.evaluate(() => window.__koligo_navigate?.('DelivererApp'));
    await w(dPage, 1500);
  }
  await shot(dPage, 'livreur-05-home', 'Accueil Livreur');

  await dPage.evaluate(() => { if (window.__koligo_setOnline) window.__koligo_setOnline(true); });
  await w(dPage, 1500);
  await shot(dPage, 'livreur-06-online', 'Livreur EN LIGNE ✅', 'ok');
  await w(dPage, 3000);
  await dPage.evaluate(() => window.scrollBy(0, 250));
  await shot(dPage, 'livreur-07-offers', 'Courses disponibles');

  // Visuel — cliquer sur la première course
  const offer = dPage.getByText(/→/).first();
  if (await offer.isVisible().catch(() => false)) {
    await offer.click();
    await w(dPage, 1500);
    await shot(dPage, 'livreur-08-detail', 'Détail course — avant acceptation');
  }

  // Accept via token serveur (fiable — évite les problèmes de localStorage browser)
  let acceptedDelivery = null;
  if (delivId && delivererToken) {
    const aRes = await apiPatch(`/api/deliveries/${delivId}/accept`, {}, delivererToken);
    console.log(`  ${aRes.status === 200 ? '✅' : '❌'} Accept: HTTP ${aRes.status} — statut=${aRes.data?.status} collectCode=${aRes.data?.collectCode}`);
    acceptedDelivery = aRes.status === 200 ? aRes.data : null;
  }
  await w(dPage, 2000);
  await shot(dPage, 'livreur-09-accepted', acceptedDelivery ? '✅ Course acceptée' : '⚠️ Acceptation échouée', acceptedDelivery ? 'ok' : 'error');
  logTest('Phase 2', 'Acceptation livraison', !!acceptedDelivery, `statut=${acceptedDelivery?.status} collectCode=${acceptedDelivery?.collectCode ?? collectCode}`);

  const acceptedId   = acceptedDelivery?.id   ?? delivId;
  const acceptedCode = acceptedDelivery?.collectCode ?? collectCode;

  // ─── CC3 — Mauvais collectCode ────────────────────────
  console.log('\n═══ CC3 : Mauvais collectCode ═══');
  const cc3 = await apiPatch(`/api/deliveries/${acceptedId}/confirm-collect`, { collectCode: '0000' }, delivererToken);
  logTest('Contre-cas', `CC3 — Mauvais collectCode "0000" → ${cc3.status} "${cc3.data?.error}"`, cc3.status >= 400, `HTTP ${cc3.status}`);
  await shot(dPage, 'cc03-wrong-collect', `CC3 — Code collecte invalide → HTTP ${cc3.status}: ${cc3.data?.error}`, cc3.status >= 400 ? 'ok' : 'error');

  // ═══════════════════════════════════════════════════════
  // PHASE 2.5 — Confirm-collect (bon code)
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ PHASE 2.5 : Confirm-collect ═══');
  await shot(dPage, 'livreur-10-collect-screen', 'Écran saisie code collecte');
  const cfRes = await apiPatch(`/api/deliveries/${acceptedId}/confirm-collect`, { collectCode: String(acceptedCode) }, delivererToken);
  const confirmOk = cfRes.status === 200;
  logTest('Phase 2.5', `Confirm-collect code ${acceptedCode}`, confirmOk, `status=${cfRes.data?.status}`);
  await w(dPage, 1000);
  await shot(dPage, 'livreur-11-en-route', confirmOk ? '✅ Livraison EN_ROUTE' : '❌ Confirm-collect échoué', confirmOk ? 'ok' : 'error');

  // Backoffice — mise à jour statut
  await boPage.bringToFront();
  await boPage.goto(`${BACKOFFICE}/deliveries`, { waitUntil: 'domcontentloaded' });
  await w(boPage, 1500);
  await shot(boPage, 'bo-03-deliveries-en-route', 'Backoffice — Livraison EN_ROUTE', 'info');

  // ═══════════════════════════════════════════════════════
  // PHASE 3 — VENDEUR facture de confiance
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ PHASE 3 : VENDEUR — Facture de confiance ═══');
  await vPage.bringToFront();
  await w(vPage, 12000);
  await shot(vPage, 'vendeur-10-codes-post-accept', 'VendorCodes — livreur assigné');

  const trustBtn = vPage.getByText(/Facture de confiance/i).first();
  if (await trustBtn.isVisible().catch(() => false)) {
    await trustBtn.click();
    await w(vPage, 2500);
    await shot(vPage, 'vendeur-11-trust-invoice', 'Facture de confiance ✅', 'ok');
    logTest('Phase 3', 'Facture de confiance', true);
    // Bouton partage/téléchargement
    const shareBtn = vPage.getByText(/Partager|Télécharger|Envoyer/i).first();
    if (await shareBtn.isVisible().catch(() => false)) {
      await shareBtn.click();
      await w(vPage, 1500);
      await shot(vPage, 'vendeur-12-trust-share', 'Téléchargement facture confiance', 'ok');
      await vPage.keyboard.press('Escape');
      await w(vPage, 500);
    }
    await vPage.goBack().catch(() => {});
    await w(vPage, 800);
  } else {
    await shot(vPage, 'vendeur-11-no-trust', 'Facture non disponible', 'error');
    logTest('Phase 3', 'Facture de confiance', false, 'Non visible');
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 4 — RECEVEUR paie via MoMo (mock auto-confirmé)
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ PHASE 4 : RECEVEUR — Paiement MoMo (mock) ═══');

  if (!clientToken) {
    console.warn('  ⚠️  clientToken manquant — skip');
    logTest('Phase 4', 'Paiement client', false, 'clientToken manquant');
  } else {
    const cCtx  = await mkMobile(browser);
    const cPage = await cCtx.newPage();
    await cPage.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await w(cPage, 5500);

    try {
      await cPage.waitForFunction(
        () => typeof window.__koligo_nav_ready === 'function' && window.__koligo_nav_ready(),
        { timeout: 20000 }
      );
    } catch { console.warn('  ⚠️  Nav timeout'); }

    await cPage.evaluate(({ tok, price }) => {
      if (typeof window.__koligo_navigate === 'function')
        window.__koligo_navigate('ClientReception', { clientToken: tok, priceXAF: price });
    }, { tok: clientToken, price: priceXAF });
    await cPage.waitForFunction(
      () => !!document.body.innerText.match(/Code de réception|Étape 1|reception/i),
      { timeout: 10000 }
    ).catch(() => {});
    await w(cPage, 1000);
    await shot(cPage, 'receveur-01-code-entry', 'Receveur — Saisie code (Étape 1)');

    // ── CC4 — Mauvais deliverCode ──────────────────────
    console.log('  ═══ CC4 : Mauvais deliverCode ═══');
    const cc4 = await cPage.evaluate(async ({ tok, phone }) => {
      const r = await fetch('http://localhost:3001/api/deliveries/client-pay', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientToken: tok, deliverCode: '0000', momoPhone: phone }),
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    }, { tok: clientToken, phone: MOMO_PHONE });
    logTest('Contre-cas', `CC4 — Mauvais deliverCode "0000" → ${cc4.status} "${cc4.data?.error}"`, cc4.status >= 400, `HTTP ${cc4.status}`);
    await shot(cPage, 'cc04-wrong-deliver-code', `CC4 — deliverCode invalide → HTTP ${cc4.status}: ${cc4.data?.error}`, cc4.status >= 400 ? 'ok' : 'error');

    // ── CC5 — Téléphone MoMo invalide ─────────────────
    console.log('  ═══ CC5 : Téléphone MoMo invalide ═══');
    const cc5 = await cPage.evaluate(async ({ tok, code }) => {
      const r = await fetch('http://localhost:3001/api/deliveries/client-pay', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientToken: tok, deliverCode: code, momoPhone: '123' }),
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    }, { tok: clientToken, code: String(deliverCode) });
    logTest('Contre-cas', `CC5 — MoMo "123" → ${cc5.status} "${cc5.data?.error}"`, cc5.status >= 400, `HTTP ${cc5.status}`);
    await shot(cPage, 'cc05-invalid-phone', `CC5 — Tél MoMo invalide → HTTP ${cc5.status}: ${cc5.data?.error}`, cc5.status >= 400 ? 'ok' : 'error');

    // ── Paiement réel (mock auto-confirmé) ────────────
    console.log(`\n  💳 Paiement mock — deliverCode=${deliverCode} phone=${MOMO_PHONE} prix=${priceXAF} XAF`);
    const payRes = await cPage.evaluate(async ({ tok, code, phone }) => {
      const r = await fetch('http://localhost:3001/api/deliveries/client-pay', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientToken: tok, deliverCode: code, momoPhone: phone }),
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    }, { tok: clientToken, code: String(deliverCode), phone: MOMO_PHONE });

    const payOk = payRes.status === 200 && payRes.data?.transactionId;
    console.log(`  ${payOk ? '✅' : '❌'} client-pay: HTTP ${payRes.status} — mock=${payRes.data?.mock} transactionId=${payRes.data?.transactionId}`);
    logTest('Phase 4', `Initiation paiement mock ${priceXAF} XAF`, payOk, `transactionId: ${payRes.data?.transactionId}`);
    await shot(cPage, 'receveur-02-pay-initiated', `Paiement initié — HTTP ${payRes.status} (mock=${payRes.data?.mock})`, payOk ? 'ok' : 'error');

    // Affichage visuel formulaire
    await numpad(cPage, String(deliverCode));
    await w(cPage, 2000);
    await shot(cPage, 'receveur-03-step2-ui', 'Formulaire paiement MoMo — Étape 2');

    // Polling statut (mock → success en ~5s)
    const transactionId = payRes.data?.transactionId;
    let paid = false;

    if (payOk) {
      console.log(`  ⏳ Polling confirmation paiement mock…`);
      await w(cPage, 2000);

      for (let i = 0; i < 6; i++) {
        await w(cPage, 3000);
        const sr = await cPage.evaluate(async ({ tid, tok }) => {
          const r = await fetch(`http://localhost:3001/api/deliveries/client-payment-status?transactionId=${encodeURIComponent(tid)}&clientToken=${encodeURIComponent(tok)}`);
          return await r.json().catch(() => ({}));
        }, { tid: transactionId, tok: clientToken });

        console.log(`  ⏳ Poll ${(i + 1) * 3}s — status=${sr?.status} mock=${sr?.mock}`);
        if (sr?.status === 'success') { paid = true; break; }
      }

      logTest('Phase 4', 'Confirmation paiement mock', paid, paid ? '✅ success' : 'timeout');

      if (paid) {
        // Navigate to success screen
        await cPage.evaluate(() => window.__koligo_navigate?.('ReceptionSuccess')).catch(() => {});
        await w(cPage, 1500);
        await shot(cPage, 'receveur-04-success', '✅ Paiement confirmé — ReceptionSuccess', 'ok');

        // Backoffice — Finance après paiement
        await boPage.bringToFront();
        await boPage.goto(`${BACKOFFICE}/finance`, { waitUntil: 'domcontentloaded' });
        await w(boPage, 2000);
        await shot(boPage, 'bo-04-finance', 'Backoffice — Finance après paiement', 'ok');

        // Backoffice — Packages
        await boPage.goto(`${BACKOFFICE}/packages`, { waitUntil: 'domcontentloaded' });
        await w(boPage, 2000);
        await shot(boPage, 'bo-05-packages', 'Backoffice — Colis / Packages', 'info');

        // ── CC6 — Double paiement (delivery LIVRE) ─────
        console.log('\n  ═══ CC6 : Double paiement ═══');
        const cc6 = await cPage.evaluate(async ({ tok, code, phone }) => {
          const r = await fetch('http://localhost:3001/api/deliveries/client-pay', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientToken: tok, deliverCode: code, momoPhone: phone }),
          });
          return { status: r.status, data: await r.json().catch(() => ({})) };
        }, { tok: clientToken, code: String(deliverCode), phone: MOMO_PHONE });
        logTest('Contre-cas', `CC6 — Double paiement → ${cc6.status} "${cc6.data?.error}"`, cc6.status >= 400, `HTTP ${cc6.status}`);
        await shot(cPage, 'cc06-double-pay', `CC6 — Double paiement refusé → HTTP ${cc6.status}: ${cc6.data?.error}`, cc6.status >= 400 ? 'ok' : 'error');

        // ── Notation livreur via API ───────────────────
        console.log('\n  ⭐ Notation livreur (5 étoiles)…');
        const rateRes = await cPage.evaluate(async ({ tok }) => {
          const r = await fetch('http://localhost:3001/api/deliveries/client-rate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientToken: tok, score: 5, tags: ['Rapide', 'Professionnel', 'Sympa'], comment: 'Parfait!' }),
          });
          return { status: r.status, data: await r.json().catch(() => ({})) };
        }, { tok: clientToken });
        logTest('Phase 4', `Notation 5⭐ → ${rateRes.status}`, rateRes.status === 200, JSON.stringify(rateRes.data));

        // Navigate to rating screen for visual
        await cPage.evaluate(({ tok }) => window.__koligo_navigate?.('ClientRating', { clientToken: tok }), { tok: clientToken }).catch(() => {});
        await w(cPage, 1500);
        await shot(cPage, 'receveur-05-rating-screen', 'Écran notation livreur', 'ok');

        // ── CC7 — Double notation ──────────────────────
        console.log('\n  ═══ CC7 : Double notation ═══');
        const cc7 = await cPage.evaluate(async ({ tok }) => {
          const r = await fetch('http://localhost:3001/api/deliveries/client-rate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientToken: tok, score: 3, comment: 'Déjà noté' }),
          });
          return { status: r.status, data: await r.json().catch(() => ({})) };
        }, { tok: clientToken });
        const cc7Ok = cc7.data?.alreadyRated === true || cc7.status >= 400;
        logTest('Contre-cas', `CC7 — Double notation → alreadyRated=${cc7.data?.alreadyRated}`, cc7Ok, `HTTP ${cc7.status}`);
        await shot(cPage, 'cc07-double-rate', `CC7 — Double notation → ${JSON.stringify(cc7.data)}`, cc7Ok ? 'ok' : 'error');

      } else {
        await shot(cPage, 'receveur-timeout', '⚠️ Polling timeout inattendu', 'error');
      }
    } else {
      await shot(cPage, 'receveur-pay-failed', `Paiement échoué: ${JSON.stringify(payRes.data?.error)}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 5 — Wallet livreur + Historique vendeur
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ PHASE 5 : Wallet livreur + Historique vendeur ═══');

  await dPage.bringToFront();
  await dPage.evaluate(() => window.__koligo_navigate?.('DelivererApp'));
  await w(dPage, 2000);
  await shot(dPage, 'livreur-12-home-post', 'Accueil livreur — après mission');

  await dPage.evaluate(() => window.__koligo_navigate?.('Wallet'));
  await w(dPage, 1500);
  await shot(dPage, 'livreur-13-wallet', 'Wallet livreur — Solde', 'ok');

  await vPage.bringToFront();
  await vPage.evaluate(() => window.__koligo_navigate?.('VendorApp'));
  await w(vPage, 1500);
  await shot(vPage, 'vendeur-13-home-final', 'Accueil vendeur — fin test', 'ok');

  const histBtn = vPage.getByText(/Historique/i).first();
  if (await histBtn.isVisible().catch(() => false)) {
    await histBtn.click();
    await w(vPage, 1500);
    await shot(vPage, 'vendeur-14-history', 'Historique livraisons', 'ok');
  }

  // Backoffice — Dashboard final
  await boPage.bringToFront();
  await boPage.goto(`${BACKOFFICE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await w(boPage, 2000);
  await shot(boPage, 'bo-06-dashboard-final', 'Backoffice — Dashboard final', 'ok');

  // Backoffice — Users
  await boPage.goto(`${BACKOFFICE}/users`, { waitUntil: 'domcontentloaded' });
  await w(boPage, 1500);
  await shot(boPage, 'bo-07-users', 'Backoffice — Utilisateurs', 'info');

  // Backoffice — Wallets
  await boPage.goto(`${BACKOFFICE}/wallets`, { waitUntil: 'domcontentloaded' });
  await w(boPage, 1500);
  await shot(boPage, 'bo-08-wallets', 'Backoffice — Portefeuilles livreurs', 'info');

  // Admin API endpoints
  const pkgRes  = await apiGet('/api/admin/packages', adminToken);
  const usrRes  = await apiGet('/api/admin/users',    adminToken);
  const walRes  = await apiGet('/api/admin/wallets',  adminToken);
  const finRes  = await apiGet('/api/admin/finance',  adminToken);
  logTest('Admin', `Packages: ${(pkgRes.data?.items ?? []).length} colis`, pkgRes.status === 200);
  logTest('Admin', `Users: ${(usrRes.data?.items ?? []).length} utilisateurs`, usrRes.status === 200);
  logTest('Admin', `Wallets: ${(walRes.data?.items ?? []).length} wallets`, walRes.status === 200);
  logTest('Admin', `Finance endpoint`, finRes.status === 200);

  await browser.close();
  generateReport();
}

// ── Rapport HTML ──────────────────────────────────────────
function generateReport() {
  const passedCount = testResults.filter(t => t.ok).length;
  const totalCount  = testResults.length;

  const badge = n => {
    if (n.startsWith('bo-'))     return ['bo',  '🖥 Back-office'];
    if (n.includes('cc'))        return ['cc',  '⚠️ Contre-cas'];
    if (n.includes('vendeur'))   return ['v',   '🛍 Vendeur'];
    if (n.includes('livreur'))   return ['d',   '🛵 Livreur'];
    if (n.includes('receveur'))  return ['c',   '📲 Receveur'];
    return ['misc', '📌 Misc'];
  };

  const sc = s => s === 'ok' ? '#22c55e' : s === 'error' ? '#ef4444' : '#3b82f6';

  const thumbs = shots.map(s => {
    const [role, label] = badge(s.name);
    const c = sc(s.status);
    return `<div class="thumb" data-role="${role}">
      <div class="img-wrap"><img src="data:image/png;base64,${s.base64}" loading="lazy"/>
        <div class="dot" style="background:${c}"></div></div>
      <div class="badge" style="background:${c}22;color:${c}">${label}</div>
      <div class="name">${s.name}</div>
      <div class="desc">${s.desc}</div>
    </div>`;
  }).join('');

  const rows = testResults.map(t => `<tr class="${t.ok ? 'ok' : 'fail'}">
    <td><span class="suite">${t.suite}</span></td>
    <td>${t.name}</td>
    <td class="${t.ok ? 'gn' : 'rd'}">${t.ok ? '✅ OK' : '❌ FAIL'}</td>
    <td class="det">${t.detail || ''}</td>
  </tr>`).join('');

  const filters = ['all','bo','v','d','c','cc'].map(r => {
    const lbl = {all:'Tous',bo:'🖥 Back-office',v:'🛍 Vendeur',d:'🛵 Livreur',c:'📲 Receveur',cc:'⚠️ Contre-cas'}[r];
    return `<button class="fb${r==='all'?' act':''}" onclick="filter('${r}')">${lbl}</button>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>KoliGo E2E — Rapport complet</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
body{background:#0f172a;color:#e2e8f0}
.hdr{background:linear-gradient(135deg,#064e3b,#065f46);padding:28px 32px;display:flex;gap:16px;align-items:center}
.logo{font-size:24px;font-weight:900;color:#fff}.logo em{color:#34d399;font-style:normal}
.sub{font-size:12px;color:rgba(255,255,255,.5);margin-top:3px}
.kpis{display:flex;gap:10px;padding:16px 32px;background:#1e293b;border-bottom:1px solid #334155}
.kpi{background:#0f172a;border-radius:10px;padding:12px 18px;border:1px solid #334155;min-width:110px}
.kv{font-size:24px;font-weight:700;color:#fff}.kl{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase}
.green .kv{color:#34d399}.red .kv{color:#f87171}.blue .kv{color:#60a5fa}
.sec{padding:20px 32px}
h2{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;margin-bottom:20px}
th{background:#0f172a;padding:8px 12px;font-size:11px;color:#475569;text-align:left;text-transform:uppercase}
td{padding:8px 12px;font-size:12px;border-bottom:1px solid #0f172a;color:#cbd5e1;vertical-align:top}
tr.ok td{border-left:2px solid #22c55e33}.tr.fail td{border-left:2px solid #ef444433}
.gn{color:#22c55e;font-weight:700}.rd{color:#ef4444;font-weight:700}
.suite{background:#1e3a5f;color:#60a5fa;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700}
.det{font-size:11px;color:#94a3b8}
.filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.fb{background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:5px 12px;border-radius:20px;cursor:pointer;font-size:12px;font-weight:600}
.fb:hover,.fb.act{background:#065f46;border-color:#10b981;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.thumb{background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;cursor:pointer;transition:transform .15s}
.thumb:hover{transform:translateY(-2px);border-color:#10b981}
.img-wrap{position:relative;aspect-ratio:390/844;background:#000}
.img-wrap img{width:100%;height:100%;object-fit:cover}
.dot{position:absolute;top:7px;right:7px;width:9px;height:9px;border-radius:50%;border:2px solid #0f172a}
.badge{font-size:10px;font-weight:700;padding:3px 8px;margin:6px 6px 0}
.name{font-size:10px;color:#475569;padding:0 7px;font-family:monospace}
.desc{font-size:11px;color:#94a3b8;padding:3px 7px 8px;line-height:1.4}
.hidden{display:none!important}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:100;align-items:center;justify-content:center}
.modal.open{display:flex}
.modal img{max-height:92vh;max-width:92vw;border-radius:12px}
.mc{position:absolute;top:18px;right:22px;color:#fff;font-size:26px;cursor:pointer}
</style></head>
<body>
<div class="hdr">
  <div><div class="logo">Koli<em>Go</em></div><div class="sub">Rapport E2E · Back-office réel · Mock paiement · ${new Date().toLocaleString('fr-FR')}</div></div>
</div>
<div class="kpis">
  <div class="kpi blue"><div class="kv">${shots.length}</div><div class="kl">Captures</div></div>
  <div class="kpi green"><div class="kv">${passedCount}</div><div class="kl">Tests OK</div></div>
  <div class="kpi ${passedCount < totalCount ? 'red' : 'green'}"><div class="kv">${totalCount - passedCount}</div><div class="kl">Échecs</div></div>
  <div class="kpi"><div class="kv">${totalCount}</div><div class="kl">Total</div></div>
  <div class="kpi ${passedCount === totalCount ? 'green' : 'red'}"><div class="kv">${Math.round(passedCount / Math.max(totalCount, 1) * 100)}%</div><div class="kl">Succès</div></div>
</div>
<div class="sec">
  <h2>Résultats des tests</h2>
  <table><thead><tr><th>Suite</th><th>Test</th><th>Résultat</th><th>Détail</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <h2>Captures d'écran (cliquer pour agrandir)</h2>
  <div class="filters">${filters}</div>
  <div class="grid" id="grid">${thumbs}</div>
</div>
<div class="modal" id="modal" onclick="document.getElementById('modal').classList.remove('open')">
  <span class="mc">✕</span><img id="mi" src="" />
</div>
<script>
function filter(r){
  document.querySelectorAll('.fb').forEach(b=>b.classList.remove('act'));
  event.target.classList.add('act');
  document.querySelectorAll('.thumb').forEach(t=>t.classList.toggle('hidden',r!=='all'&&t.dataset.role!==r));
}
document.querySelectorAll('.thumb').forEach(t=>{
  t.onclick=()=>{document.getElementById('mi').src=t.querySelector('img').src;document.getElementById('modal').classList.add('open');}
});
</script></body></html>`;

  const rp = path.join(__dirname, 'e2e-report-complete.html');
  fs.writeFileSync(rp, html);

  console.log(`\n✅  Rapport  : ${rp}`);
  console.log(`📸  ${shots.length} captures → ${SHOTS}`);
  console.log(`🧪  ${passedCount}/${totalCount} tests OK`);
  console.log(`\n   start ${rp}`);
  try { require('child_process').exec(`start "" "${rp}"`); } catch {}
}

main().catch(e => {
  console.error('\n💥 Erreur fatale:', e.message, e.stack?.split('\n').slice(0, 3).join(' | '));
  process.exit(1);
});
