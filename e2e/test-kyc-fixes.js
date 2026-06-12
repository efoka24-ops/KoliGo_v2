#!/usr/bin/env node
/**
 * KoliGo V2 — Test parcours KYC (correctifs)
 *
 * Parcours 1 : Livreur NONE    → toast "Soumettez votre CNI" + redirect KYC
 * Parcours 2 : Livreur PENDING → toast "Vérification en cours"
 * Parcours 3 : POST /api/user/kyc → status PENDING (endpoint corrigé)
 * Parcours 4 : Profil affiche kycStatus correct (focus listener)
 * Parcours 5 : Livreur VERIFIED → accepte sans blocage
 *
 * Compte livreur : ZIEGOUBE FOKA  (691227149 / 1234)
 * Admin          : +237600000001  / 1234
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const APP   = 'http://localhost:8085';
const API   = 'http://localhost:3001';
const SHOTS = path.join(__dirname, 'screenshots-kyc-fixes');

const ADMIN_PHONE   = '+237600000001';
const ADMIN_PIN     = '1234';
const DELIVER_PHONE = '691227149';
const DELIVER_PIN   = '1234';
const VENDOR_PHONE  = '698892174';
const VENDOR_PIN    = '1234';

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

let idx = 0;
const shots       = [];
const testResults = [];

// ── HTTP helpers ──────────────────────────────────────────
function apiRequest(method, urlPath, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = http.request(
      { hostname: 'localhost', port: 3001, path: urlPath, method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data  ? { 'Content-Length': Buffer.byteLength(data) } : {}),
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

// ── Screenshot ────────────────────────────────────────────
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
async function w(page, ms = 1200) { await page.waitForTimeout(ms); }

// ── Numpad PIN ─────────────────────────────────────────────
async function numpad(page, digits) {
  for (const d of String(digits)) {
    const btn = page.locator(`[role="button"]:has-text("${d}"), button:has-text("${d}")`).first();
    const fb  = page.locator(`text="${d}"`).first();
    const tgt = (await btn.isVisible().catch(() => false)) ? btn : fb;
    await tgt.click({ force: false }).catch(() => {});
    await page.waitForTimeout(420);
  }
}

// ── UI Signin ─────────────────────────────────────────────
async function signin(page, phone, pin, tag) {
  console.log(`\n  🔐 UI signin — ${tag} (${phone})`);
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await w(page, 4500);

  // Click "J'ai déjà un compte" sur le welcome screen
  const link = page.getByText(/J'ai déjà un compte/i).first();
  if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
    await link.click();
    await w(page, 900);
  }

  // Changer de compte si déjà connecté
  const chg = page.getByText(/Changer de compte/i).first();
  if (await chg.isVisible({ timeout: 2000 }).catch(() => false)) {
    await chg.click();
    await w(page, 700);
  }

  // Saisir le téléphone
  const inp = page.getByPlaceholder(/6XX.*XX|téléphone|phone/i).first();
  if (await inp.isVisible({ timeout: 4000 }).catch(() => false)) {
    await inp.fill(phone);
    await page.getByText('Continuer').first().click();
    await w(page, 1500);
  }

  // Saisir le PIN
  await numpad(page, pin);
  await w(page, 3500);
}

// ── Admin: set kycStatus ──────────────────────────────────
async function setKycStatus(adminToken, userId, status) {
  const r = await apiPatch(`/api/admin/users/${userId}/kyc`, { status }, adminToken);
  return r.status === 200;
}

// ── Ensure a delivery exists ─────────────────────────────
async function ensureDelivery(vendorToken) {
  // Create a fresh delivery that will be in PENDING status
  const r = await apiPost('/api/deliveries', {
    from: 'Bépanda', to: 'Bonapriso', weight: 1, type: 'moto',
    recipientName: 'Test KYC Guard', recipientPhone: '670000001',
    parcelDesc: 'Colis test KYC', priceXAF: 2000,
  }, vendorToken);
  return r.data?.id;
}

// ── Navigate to deliverer available/courses tab ───────────
async function goToAvailableTab(page) {
  // The bottom tab bar is the LAST occurrence of "Courses" text (first = stat card)
  // Try various approaches to click the bottom tab
  const allCoursesBtns = page.getByText(/^Courses$/i);
  const count = await allCoursesBtns.count().catch(() => 0);
  if (count > 0) {
    // Click the LAST one (bottom nav bar)
    await allCoursesBtns.last().click();
    await w(page, 1500);
    return true;
  }
  // Fallback: aria-label
  const byAria = page.locator('[aria-label*="course" i], [aria-label*="disponible" i]').first();
  if (await byAria.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byAria.click();
    await w(page, 1500);
    return true;
  }
  return false;
}

// ── Navigate to profile tab ───────────────────────────────
async function goToProfileTab(page) {
  const tabs = [
    page.getByText(/^Profil$/i).first(),
    page.locator('[aria-label*="profil" i]').first(),
    page.locator('[data-tab="profile"]').first(),
  ];
  for (const t of tabs) {
    if (await t.isVisible({ timeout: 2000 }).catch(() => false)) {
      await t.click();
      await w(page, 2000);
      return true;
    }
  }
  // Fallback: look in tab bar at bottom of screen
  const allBtns = page.locator('[role="button"], button, [role="tab"]');
  const count = await allBtns.count();
  for (let i = 0; i < count; i++) {
    const txt = await allBtns.nth(i).textContent().catch(() => '');
    if (/profil/i.test(txt)) {
      await allBtns.nth(i).click();
      await w(page, 2000);
      return true;
    }
  }
  return false;
}

// ── MAIN ─────────────────────────────────────────────────
(async () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     KoliGo — Test Correctifs KYC                 ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── 0. Setup serveur ─────────────────────────────────
  console.log('━━ 0. Authentification serveur ━━');
  const adminLogin     = await apiPost('/api/auth/signin', { phone: ADMIN_PHONE,   pin: ADMIN_PIN });
  const adminToken     = adminLogin.data?.accessToken;
  const vendorLoginRes = await apiPost('/api/auth/signin', { phone: VENDOR_PHONE,  pin: VENDOR_PIN });
  const vendorToken    = vendorLoginRes.data?.accessToken;
  const deliverLogin   = await apiPost('/api/auth/signin', { phone: DELIVER_PHONE, pin: DELIVER_PIN });
  const delivererToken = deliverLogin.data?.accessToken;
  const delivererId    = deliverLogin.data?.user?.id;

  logTest('Setup', 'Admin token',     !!adminToken,     adminToken     ? 'OK' : adminLogin.data?.error);
  logTest('Setup', 'Vendor token',    !!vendorToken,    vendorToken    ? 'OK' : vendorLoginRes.data?.error);
  logTest('Setup', 'Livreur token',   !!delivererToken, delivererToken ? 'OK' : deliverLogin.data?.error);
  logTest('Setup', 'Livreur ID',      !!delivererId,    delivererId    ?? 'manquant');

  const kycBefore = (await apiGet('/api/user/profile', delivererToken)).data?.kycStatus ?? 'NONE';
  console.log(`  ℹ️  kycStatus actuel ZIEGOUBE FOKA : ${kycBefore}`);

  // ── 1. Test API : POST /api/user/kyc ─────────────────
  console.log('\n━━ 1. Test API — Soumission KYC (endpoint corrigé) ━━');

  // Reset → NONE
  await setKycStatus(adminToken, delivererId, 'NONE');
  const profileReset = await apiGet('/api/user/profile', delivererToken);
  logTest('API KYC', 'Reset kycStatus → NONE', profileReset.data?.kycStatus === 'NONE');

  // Soumettre KYC via API /api/user/kyc (était /api/auth/kyc → 404)
  const fakeImg = 'data:image/jpeg;base64,' + Buffer.from('FAKE_IMAGE_KOLIGO_TEST').toString('base64');
  const kycRes  = await apiPost('/api/user/kyc',
    { cniNumber: 'CM123456789TEST', cniRecto: fakeImg, cniVerso: fakeImg, selfie: fakeImg },
    delivererToken
  );
  logTest('API KYC', 'POST /api/user/kyc → 200',       kycRes.status === 200, `status=${kycRes.status}`);
  logTest('API KYC', 'Réponse contient status=PENDING', kycRes.data?.status === 'PENDING', JSON.stringify(kycRes.data));

  // Vérifier que le profil reflète PENDING
  const profileAfterApi = await apiGet('/api/user/profile', delivererToken);
  logTest('API KYC', 'kycStatus backend = PENDING après soumission', profileAfterApi.data?.kycStatus === 'PENDING');

  // Vérifier que le signin renvoie kycStatus (correctif backend)
  const signinWithKyc = await apiPost('/api/auth/signin', { phone: DELIVER_PHONE, pin: DELIVER_PIN });
  logTest('API KYC', 'signin renvoie kycStatus dans user', 'kycStatus' in (signinWithKyc.data?.user ?? {}),
    `kycStatus=${signinWithKyc.data?.user?.kycStatus}`);

  // S'assurer que la livraison de test est disponible
  console.log('\n  📦 Préparation livraison de test...');
  await setKycStatus(adminToken, delivererId, 'NONE');  // reset avant UI tests
  const delivId = await ensureDelivery(vendorToken);
  logTest('Setup', 'Livraison créée pour UI tests', !!delivId, delivId ?? 'échec création');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });

  // ── 2. Test UI : livreur kycStatus=NONE ──────────────
  console.log('\n━━ 2. Test UI — Livreur NONE → garde KYC (au lieu du spinner) ━━');

  const ctx2 = await mkMobile(browser);
  const pg2  = await ctx2.newPage();
  let passed_none = false;
  let passed_kyc_screen = false;

  try {
    await signin(pg2, DELIVER_PHONE, DELIVER_PIN, 'livreur-NONE');
    await shot(pg2, 'livreur-none-home', 'Accueil livreur (kycStatus NONE)');

    // Les cartes disponibles apparaissent sur l'Accueil ("Meilleures courses")
    // ET dans l'onglet "Courses" — on essaie les deux
    await shot(pg2, 'livreur-none-accueil', 'Accueil — cartes disponibles visibles');

    // Les cartes disponibles ont le label "TEMPORAIRE" (pas la carte MISSION EN COURS)
    // Cibler ces cartes spécifiquement
    const deliveryCard = pg2.getByText('TEMPORAIRE').first();
    let cardVisible    = await deliveryCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (!cardVisible) {
      // Fallback: aller dans l'onglet Courses (dernier "Courses" = tab bar)
      await goToAvailableTab(pg2);
      await w(pg2, 1500);
      await shot(pg2, 'livreur-none-courses', 'Onglet Courses');
      cardVisible = await deliveryCard.isVisible({ timeout: 3000 }).catch(() => false);
    }

    logTest('UI KYC NONE', 'Carte livraison disponible visible', cardVisible);

    if (cardVisible) {
      await deliveryCard.click();
      await w(pg2, 2500);
      await shot(pg2, 'livreur-none-detail', 'Détail livraison (livreur NONE)');

      // Chercher le bouton "Accepter la course" (React Native rend en div, pas button)
      const acceptBtn = pg2.getByText(/accepter la course/i).first();
      const acceptVis = await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false);
      logTest('UI KYC NONE', 'Bouton Accepter visible dans détail', acceptVis);

      if (acceptVis) {
        await acceptBtn.click();
        await w(pg2, 3000);
        await shot(pg2, 'livreur-none-after-accept', 'Après clic Accepter (NONE)', 'info');

        const bodyTxt = await pg2.textContent('body').catch(() => '');
        // Vérifier toast KYC OU navigation vers écran KYC
        const hasKycMsg    = /CNI|Soumettez|vérif.*identit|identit.*vérif/i.test(bodyTxt);
        const hasKycScreen = /CNI|numéro.*CNI|verso|recto|selfie|vérification.*identit/i.test(bodyTxt);
        passed_none       = hasKycMsg || hasKycScreen;
        passed_kyc_screen = hasKycScreen;

        logTest('UI KYC NONE', 'Message KYC affiché (guard actif)', passed_none,
          passed_none ? 'message KYC détecté ✓' : 'aucun message KYC trouvé ✗');
        if (passed_kyc_screen) {
          logTest('UI KYC NONE', 'Navigation vers écran KYC', true, 'écran KYC visible ✓');
        }
      }
    } else {
      await shot(pg2, 'livreur-none-nodispos', 'Aucune carte trouvée');
      logTest('UI KYC NONE', 'Carte livraison disponible visible', false, 'aucune carte');
    }
  } catch (err) {
    console.log(`  ⚠️  Erreur: ${err.message}`);
  } finally {
    await ctx2.close();
  }

  // ── 3. Test UI : livreur kycStatus=PENDING ───────────
  console.log('\n━━ 3. Test UI — Livreur PENDING → "Vérification en cours" ━━');

  // Passer le livreur à PENDING
  await setKycStatus(adminToken, delivererId, 'PENDING');

  const ctx3 = await mkMobile(browser);
  const pg3  = await ctx3.newPage();
  let passed_pending = false;

  try {
    await signin(pg3, DELIVER_PHONE, DELIVER_PIN, 'livreur-PENDING');
    await shot(pg3, 'livreur-pending-home', 'Accueil livreur (kycStatus PENDING)');

    await shot(pg3, 'livreur-pending-accueil', 'Accueil livreur PENDING');

    let delivCard = pg3.getByText('TEMPORAIRE').first();
    if (!(await delivCard.isVisible({ timeout: 3000 }).catch(() => false))) {
      await goToAvailableTab(pg3);
      await w(pg3, 1500);
      await shot(pg3, 'livreur-pending-dispo', 'Onglet Courses (PENDING)');
    }

    if (await delivCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await delivCard.click();
      await w(pg3, 2500);
      await shot(pg3, 'livreur-pending-detail', 'Détail livraison (PENDING)');

      const acceptBtn3 = pg3.getByText(/accepter la course/i).first();
      if (await acceptBtn3.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptBtn3.click();
        await w(pg3, 3000);
        await shot(pg3, 'livreur-pending-after-accept', 'Après clic Accepter (PENDING)', 'info');

        const bodyTxt3    = await pg3.textContent('body').catch(() => '');
        const hasPendMsg  = /cours|24h|attente/i.test(bodyTxt3);
        const noKycForm   = !/recto|verso|selfie|numéro.*CNI/i.test(bodyTxt3);
        passed_pending    = hasPendMsg && noKycForm;

        logTest('UI KYC PENDING', 'Toast "en cours" affiché', hasPendMsg,
          hasPendMsg ? 'message PENDING détecté ✓' : 'message non trouvé ✗');
        logTest('UI KYC PENDING', 'Pas de redirection vers formulaire KYC', noKycForm,
          noKycForm ? 'pas redirigé ✓' : 'redirigé (mauvais comportement) ✗');
      }
    } else {
      logTest('UI KYC PENDING', 'Carte livraison visible', false, 'aucune carte');
    }
  } catch (err) {
    console.log(`  ⚠️  Erreur: ${err.message}`);
  } finally {
    await ctx3.close();
  }

  // ── 4. Test UI : profil affiche kycStatus ────────────
  console.log('\n━━ 4. Test UI — Profil affiche kycStatus correct ━━');

  // PENDING déjà positionné ci-dessus
  const ctx4 = await mkMobile(browser);
  const pg4  = await ctx4.newPage();

  try {
    await signin(pg4, DELIVER_PHONE, DELIVER_PIN, 'livreur-profil');
    await shot(pg4, 'profil-home', 'Accueil livreur avant profil');

    const profileFound = await goToProfileTab(pg4);
    await shot(pg4, 'profil-kyc-pending', 'Profil — kycStatus PENDING');
    logTest('UI Profil', 'Onglet profil accessible', profileFound);

    const bodyPending = await pg4.textContent('body').catch(() => '');
    const showsPending = /attente|pending|cours/i.test(bodyPending);
    logTest('UI Profil', 'Profil affiche "En attente" (PENDING)', showsPending,
      showsPending ? 'texte PENDING visible ✓' : 'non trouvé — vérifier le label kycLabel ✗');

    // Admin valide → VERIFIED
    if (adminToken && delivererId) {
      await setKycStatus(adminToken, delivererId, 'VERIFIED');
      console.log('  🔑 Admin a validé le KYC → VERIFIED');

      // Focus listener : naviguer vers Accueil puis retour Profil
      const accueilBtn = pg4.getByText(/^Accueil$/i).first();
      if (await accueilBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await accueilBtn.click();
        await w(pg4, 1000);
      } else {
        // Fallback: aller dans Courses
        await goToAvailableTab(pg4);
        await w(pg4, 1000);
      }
      await goToProfileTab(pg4);
      await w(pg4, 3000);  // laisser le temps à l'API de répondre
      await shot(pg4, 'profil-kyc-verified', 'Profil après validation admin (VERIFIED)', 'ok');

      const bodyVerified = await pg4.textContent('body').catch(() => '');
      // Chercher "Vérifiée" ou "✓" ou "verified" dans le profil KYC
      const showsVerified = /v.rifi.e?|verified|✓/i.test(bodyVerified);
      logTest('UI Profil', 'Profil se met à jour → Vérifiée ✓ (focus listener)', showsVerified,
        showsVerified ? 'VERIFIED visible ✓' : 'pas mis à jour ✗ — vérifier addListener(focus)');
    }
  } catch (err) {
    console.log(`  ⚠️  Erreur: ${err.message}`);
  } finally {
    await ctx4.close();
  }

  // ── 5. Test UI : livreur VERIFIED passe le guard ─────
  console.log('\n━━ 5. Test UI — Livreur VERIFIED accepte sans blocage ━━');
  // kycStatus est déjà VERIFIED depuis l'étape 4

  const ctx5 = await mkMobile(browser);
  const pg5  = await ctx5.newPage();

  try {
    // Créer une nouvelle livraison fraîche
    const newDelId = await ensureDelivery(vendorToken);
    if (!newDelId) throw new Error('Impossible de créer une livraison');

    await signin(pg5, DELIVER_PHONE, DELIVER_PIN, 'livreur-VERIFIED');
    await shot(pg5, 'livreur-verified-accueil', 'Accueil livreur VERIFIED');

    // Cartes sur l'accueil d'abord
    let delivCard5 = pg5.getByText('TEMPORAIRE').first();
    if (!(await delivCard5.isVisible({ timeout: 3000 }).catch(() => false))) {
      await goToAvailableTab(pg5);
      await w(pg5, 1500);
      await shot(pg5, 'livreur-verified-courses', 'Onglet Courses VERIFIED');
    }

    if (await delivCard5.isVisible({ timeout: 3000 }).catch(() => false)) {
      await delivCard5.click();
      await w(pg5, 2500);
      await shot(pg5, 'livreur-verified-detail', 'Détail livraison (VERIFIED)');

      const acceptBtn5 = pg5.getByText(/accepter la course/i).first();
      if (await acceptBtn5.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptBtn5.click();
        await w(pg5, 3500);
        await shot(pg5, 'livreur-verified-accepted', 'Course acceptée (VERIFIED)', 'ok');

        const bodyVer = await pg5.textContent('body').catch(() => '');
        const notBlocked = !/Soumettez.*CNI/i.test(bodyVer);
        const wasAccepted = /code.*collect|collecte|collect.*code/i.test(bodyVer);
        logTest('UI KYC VERIFIED', 'Guard KYC ne bloque PAS un livreur VERIFIED', notBlocked,
          notBlocked ? 'non bloqué ✓' : 'bloqué à tort ✗');
        logTest('UI KYC VERIFIED', 'Course acceptée (code collecte affiché)', wasAccepted,
          wasAccepted ? 'acceptée ✓' : 'navigation inconnue');
      } else {
        logTest('UI KYC VERIFIED', 'Bouton Accepter visible', false, 'bouton non trouvé');
      }
    } else {
      logTest('UI KYC VERIFIED', 'Carte livraison disponible', false, 'aucune carte visible');
    }
  } catch (err) {
    console.log(`  ⚠️  Erreur: ${err.message}`);
  } finally {
    await ctx5.close();
  }

  // ── Restore ───────────────────────────────────────────
  if (adminToken && delivererId) {
    const restore = kycBefore === 'VERIFIED' ? 'VERIFIED' : 'NONE';
    await setKycStatus(adminToken, delivererId, restore);
    console.log(`\n  🔄  kycStatus ZIEGOUBE FOKA restauré → ${restore}`);
  }

  await browser.close();

  // ── Rapport ───────────────────────────────────────────
  const total  = testResults.length;
  const passed = testResults.filter(r => r.ok).length;
  const failed = testResults.filter(r => !r.ok).length;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Résultats : ${passed}/${total} OK  (${failed} échoué${failed > 1 ? 's' : ''})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  testResults.filter(r => !r.ok).forEach(r => {
    console.log(`  ❌ [${r.suite}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  });

  // HTML report
  const htmlShots = shots.map(s => `
    <div class="shot ${s.status}">
      <img src="data:image/png;base64,${s.base64}" alt="${s.name}" />
      <div class="caption"><b>${s.name}</b><br/><span>${s.desc}</span></div>
    </div>`).join('');

  const htmlTests = testResults.map(r => `
    <tr class="${r.ok ? 'ok' : 'fail'}">
      <td>${r.suite}</td><td>${r.name}</td>
      <td>${r.ok ? '✅' : '❌'}</td><td>${r.detail || ''}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/>
<title>KoliGo — Test KYC Correctifs</title>
<style>
  body{font-family:system-ui;background:#0e1117;color:#e6edf3;margin:0;padding:24px}
  h1{font-size:1.6rem;margin-bottom:4px} .sub{color:#8b949e;margin-bottom:32px;font-size:.9rem}
  .sum{display:flex;gap:16px;margin-bottom:32px}
  .pill{padding:10px 20px;border-radius:20px;font-weight:700;font-size:1.2rem}
  .pill.ok{background:#1a4731;color:#3fb950} .pill.fail{background:#4d1a1a;color:#f85149}
  table{width:100%;border-collapse:collapse;margin-bottom:32px}
  th{background:#161b22;padding:10px 14px;text-align:left;font-size:.8rem;color:#8b949e;text-transform:uppercase}
  td{padding:9px 14px;border-bottom:1px solid #21262d;font-size:.88rem}
  tr.ok td:nth-child(3){color:#3fb950} tr.fail td:nth-child(3){color:#f85149}
  tr.fail{background:rgba(248,81,73,.05)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
  .shot{background:#161b22;border-radius:12px;overflow:hidden;border:1px solid #30363d}
  .shot.ok{border-color:#1f6535} .shot.error{border-color:#8b1a1a}
  .shot img{width:100%;display:block} .caption{padding:10px 12px;font-size:.82rem}
  .caption b{color:#58a6ff} .caption span{color:#8b949e}
</style></head><body>
<h1>🔐 KoliGo — Test Correctifs KYC</h1>
<div class="sub">${new Date().toLocaleString('fr-FR')} · ${shots.length} captures · ${total} tests</div>
<div class="sum">
  <div class="pill ok">${passed} OK</div>
  <div class="pill fail">${failed} Échec${failed > 1 ? 's' : ''}</div>
</div>
<h2>Résultats</h2>
<table><thead><tr><th>Suite</th><th>Test</th><th>Statut</th><th>Détail</th></tr></thead>
<tbody>${htmlTests}</tbody></table>
<h2>Captures</h2>
<div class="grid">${htmlShots}</div>
</body></html>`;

  const reportPath = path.join(__dirname, 'rapport-kyc-fixes.html');
  fs.writeFileSync(reportPath, html);
  console.log(`  📄 Rapport HTML : ${reportPath}`);
  console.log(`  📁 Screenshots  : ${SHOTS}`);
})();
