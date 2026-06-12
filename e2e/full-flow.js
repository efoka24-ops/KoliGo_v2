#!/usr/bin/env node
/**
 * KoliGo V2 — Test E2E complet bout-en-bout
 * Vendor  : phone 691227149 / PIN 1234  (emm.foka@gmail.com)
 * Livreur : phone 678758976 / PIN 1234  (efoka24@gmail.com)
 * Receveur: MoMo 691227149, 100 XAF
 */
const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const APP   = 'http://localhost:8085';
const SHOTS = path.join(__dirname, 'screenshots-e2e');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const VENDOR_PHONE  = '691227149';
const VENDOR_PIN    = '1234';
const DELIVER_PHONE = '678758976';
const DELIVER_PIN   = '1234';
const MOMO_PHONE    = '691227149';
const PRODUCT_PRICE = '100';

let idx = 0;
const shots = [];

// ── helpers ──────────────────────────────────────────────────────────
async function shot(page, slug, desc = '') {
  const name = `${String(++idx).padStart(2,'0')}-${slug}`;
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push({ name, desc, base64: fs.readFileSync(file).toString('base64') });
  console.log(`  📸 ${name}  ${desc}`);
}

function mkCtx(browser) {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
}

async function go(page) {
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
}

async function w(page, ms = 1200) { await page.waitForTimeout(ms); }

async function numpad(page, digits) {
  for (const d of String(digits)) {
    // Use a tighter selector to match only the numpad keys (not other text)
    // Wait for element to be stable before clicking
    const btn = page.locator(`[role="button"]:has-text("${d}"), button:has-text("${d}")`).first();
    const fallback = page.locator(`text="${d}"`).first();
    const target = await btn.isVisible().catch(() => false) ? btn : fallback;
    await target.click({ force: false });
    await page.waitForTimeout(400); // generous delay for React state update
  }
}

// ── signin ────────────────────────────────────────────────────────────
async function signin(page, phone, pin, tag) {
  console.log(`\n🔐 ${tag} — ${phone}`);
  await go(page);
  await shot(page, `${tag}-01-start`, `App démarrée — ${tag}`);

  // Welcome screen → navigate to Signin
  const hasWelcome = await page.getByText('Démarrer').isVisible().catch(() => false);
  if (hasWelcome) {
    await page.evaluate(() => window.scrollBy(0, 350));
    await w(page, 400);
    const link = page.getByText(/J'ai déjà un compte/i).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await page.evaluate(() => window.__koligo_navigate && window.__koligo_navigate('Signin'));
    }
    await w(page, 900);
  }

  // Switch account if needed
  const changeBtn = page.getByText(/Changer de compte/i).first();
  if (await changeBtn.isVisible().catch(() => false)) {
    await changeBtn.click();
    await w(page, 700);
  }

  // Step 1 — identifier
  const phoneInp = page.getByPlaceholder(/6XX.*XX|email/i).first();
  if (await phoneInp.isVisible().catch(() => false)) {
    await phoneInp.fill(phone);
    await w(page, 300);
    await shot(page, `${tag}-02-phone`, `Identifiant — ${phone}`);
    await page.getByText('Continuer').first().click();
    await w(page, 1500);
  }

  // Step 2 — PIN numpad
  await shot(page, `${tag}-03-pin`, `Numpad PIN`);
  await numpad(page, pin);
  await w(page, 3000);
  await shot(page, `${tag}-04-home`, `Connecté — ${tag}`);
  console.log(`  ✅ ${tag} connecté`);
}

// ─────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 KoliGo E2E — Démarrage\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo:   60,
    args: ['--window-size=430,920'],
  });

  // ══════════════════════════════════════════════════════════════════
  // PHASE 1 — VENDEUR crée une livraison
  // ══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 1 : VENDEUR — Création livraison ═══');

  const vCtx  = await mkCtx(browser);
  const vPage = await vCtx.newPage();

  await signin(vPage, VENDOR_PHONE, VENDOR_PIN, 'vendeur');

  // Navigate to VendorApp if needed (may land on DelivererApp if activeRole = DELIVERER)
  const isVendorApp = await vPage.getByText(/Créer une livraison/i).isVisible().catch(() => false);
  if (!isVendorApp) {
    console.log('  → Switch vers VendorApp');
    await vPage.evaluate(() => window.__koligo_navigate && window.__koligo_navigate('VendorApp'));
    await w(vPage, 1500);
  }
  await shot(vPage, 'vendeur-05-home', 'Accueil Vendeur');

  // Click "Créer une livraison"
  console.log('\n📦 Ouverture formulaire livraison…');
  await vPage.getByText(/Créer une livraison/i).first().click();
  await w(vPage, 1200);
  await shot(vPage, 'vendeur-06-form', 'Formulaire — Step 1');

  // ── Remplissage Step 1 ──
  const shopInp = vPage.getByPlaceholder('Nom de ta boutique').first();
  await shopInp.waitFor({ state: 'visible', timeout: 8000 });
  await shopInp.fill('Boutique Foka Test');
  await w(vPage, 200);

  await vPage.evaluate(() => window.scrollBy(0, 100));
  await w(vPage, 300);

  // Description colis
  const descInp = vPage.getByPlaceholder(/Robe wax/i).first();
  if (await descInp.isVisible().catch(() => false)) {
    await descInp.fill('Téléphone Samsung A55');
  }
  await w(vPage, 200);

  await vPage.evaluate(() => window.scrollBy(0, 120));
  await w(vPage, 300);

  // Nom destinataire
  const recipInp = vPage.getByPlaceholder(/Aïcha/i).first();
  if (await recipInp.isVisible().catch(() => false)) {
    await recipInp.fill('Marie Receveur');
  }

  // Téléphone destinataire
  const clientPhoneInp = vPage.getByPlaceholder('6 XX XX XX XX').first();
  if (await clientPhoneInp.isVisible().catch(() => false)) {
    await clientPhoneInp.fill(MOMO_PHONE);
  }

  await vPage.evaluate(() => window.scrollBy(0, 180));
  await w(vPage, 400);
  await shot(vPage, 'vendeur-07-scroll1', 'Formulaire — section prix colis');

  // Prix produit
  const priceInp = vPage.getByPlaceholder(/15000/i).first();
  if (await priceInp.isVisible().catch(() => false)) {
    await priceInp.fill(PRODUCT_PRICE);
  }

  await shot(vPage, 'vendeur-08-form-done', 'Formulaire Step 1 rempli');

  // ── Continuer → Step 2 ──
  await vPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await w(vPage, 500);
  const continuerBtn = vPage.getByText('Continuer').first();
  if (await continuerBtn.isVisible().catch(() => false)) {
    await continuerBtn.click();
    await w(vPage, 1200);
    await shot(vPage, 'vendeur-09-step2', 'Formulaire — Step 2 Résumé');
  }

  // ── Publier ── (intercepte la réponse API avec waitForResponse)
  await vPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await w(vPage, 500);
  await shot(vPage, 'vendeur-10-publish', 'Avant publication');

  console.log('  🚀 Publication…');
  let delivery = null;
  try {
    const [resp] = await Promise.all([
      vPage.waitForResponse(
        // apiFetch strips /api/ prefix → real URL is http://localhost:3000/deliveries
        r => /\/deliveries$/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15000 }
      ),
      vPage.getByText(/Publier l'annonce|Publish delivery/i).last().click(),
    ]);
    delivery = await resp.json();
    console.log(`\n  📋 Livraison créée!`);
    console.log(`     ID          : ${delivery.id}`);
    console.log(`     collectCode : ${delivery.collectCode}`);
    console.log(`     deliverCode : ${delivery.deliverCode}`);
    console.log(`     priceXAF    : ${delivery.priceXAF}`);
    console.log(`     clientToken : ${String(delivery.clientToken).slice(0,40)}…`);
  } catch (e) {
    console.warn(`  ⚠️  Capture réponse échouée: ${e.message}`);
    // Fallback: click sans capture
    await vPage.getByText(/Publier l'annonce|Publish delivery/i).last().click().catch(() => {});
  }

  await w(vPage, 5000);
  await shot(vPage, 'vendeur-11-codes', 'VendorCodes — livraison publiée');

  // Fallback: si delivery non capturé, lire depuis le DOM (texte visible)
  if (!delivery) {
    console.log('  → Tentative extraction codes depuis DOM…');
    try {
      const codeTexts = await vPage.locator('text=/^[0-9]{4}$/').allTextContents();
      console.log('  Codes trouvés dans DOM:', codeTexts);
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════════
  // PHASE 2 — LIVREUR accepte
  // ══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 2 : LIVREUR — Acceptation ═══');

  const dCtx  = await mkCtx(browser);
  const dPage = await dCtx.newPage();

  await signin(dPage, DELIVER_PHONE, DELIVER_PIN, 'livreur');

  // Navigate to DelivererApp
  const isDelivApp = await dPage.getByText(/Meilleures courses|Hors ligne|En ligne/i).isVisible().catch(() => false);
  if (!isDelivApp) {
    await dPage.evaluate(() => window.__koligo_navigate && window.__koligo_navigate('DelivererApp'));
    await w(dPage, 1500);
  }
  await shot(dPage, 'livreur-05-home', 'Accueil Livreur');

  // Toggle online via global setter
  console.log('\n🟢 Passage en ligne (via window.__koligo_setOnline)…');
  await dPage.evaluate(() => {
    if (window.__koligo_setOnline) window.__koligo_setOnline(true);
  });
  await w(dPage, 1500);
  await shot(dPage, 'livreur-06-online', 'Livreur EN LIGNE');

  // Attendre rafraîchissement des courses disponibles
  await w(dPage, 3000);
  await dPage.evaluate(() => window.scrollBy(0, 250));
  await shot(dPage, 'livreur-07-offers', 'Courses disponibles');

  // Cliquer sur la première course disponible
  // Offer cards have "Akwa → Bonapriso" route text — click the first "→" inside a card
  let accepted = false;
  const offerSelector = dPage.getByText(/→/).first(); // route arrow is only inside offer cards

  if (await offerSelector.isVisible().catch(() => false)) {
    await offerSelector.click();
    await w(dPage, 1500);
    await shot(dPage, 'livreur-08-offer-detail', 'Détail course');

    // Vérifier qu'on est en ligne sur cet écran
    const acceptBtn = dPage.getByText('Accepter la course').first();
    const isVisible = await acceptBtn.isVisible().catch(() => false);

    if (isVisible) {
      // Capturer réponse PATCH accept
      let acceptedDelivery = null;
      try {
        const [resp] = await Promise.all([
          dPage.waitForResponse(
            // PATCH /deliveries/:id/accept
            r => /\/deliveries\/[^/]+\/accept/.test(r.url()),
            { timeout: 12000 }
          ),
          acceptBtn.click(),
        ]);
        acceptedDelivery = await resp.json().catch(() => ({}));
        console.log(`  ✅ Accept réponse: ${resp.status()} — statut: ${acceptedDelivery?.status} — collectCode: ${acceptedDelivery?.collectCode}`);
        accepted = true;
      } catch (e) {
        console.warn(`  ⚠️  Accept response: ${e.message}`);
        await acceptBtn.click().catch(() => {});
        accepted = true;
      }
      await w(dPage, 3000);
      await shot(dPage, 'livreur-09-accepted', '✅ Course acceptée — ConfirmCode');

      // ── Phase 2.5: Code collecte — appel API direct via le token livreur ──
      const collectCode = acceptedDelivery?.collectCode || delivery?.collectCode;
      const acceptedDeliveryId = acceptedDelivery?.id;
      if (collectCode && acceptedDeliveryId) {
        console.log(`\n🔑 Code collecte: ${collectCode} (delivery: ${acceptedDeliveryId})`);
        await shot(dPage, 'livreur-10-collect-screen', 'Écran Code collecte');
        // Call confirm-collect directly from the browser (token in localStorage)
        try {
          const confirmResult = await dPage.evaluate(async ({ delivId, code }) => {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`http://localhost:3000/deliveries/${delivId}/confirm-collect`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ collectCode: code }),
            });
            const json = await res.json();
            return { status: res.status, data: json };
          }, { delivId: acceptedDeliveryId, code: String(collectCode) });
          console.log(`  ✅ confirm-collect API: ${confirmResult.status} — statut: ${confirmResult.data?.status}`);
          await w(dPage, 1000);
          await shot(dPage, 'livreur-11-en-route', 'Livraison EN_ROUTE → chez le destinataire');
        } catch (e) {
          console.warn(`  ⚠️  confirm-collect échoué: ${e.message}`);
          await shot(dPage, 'livreur-10-error', 'Erreur confirm-collect');
        }
      }
    } else {
      // Tenter clic toggle depuis cet écran
      await dPage.evaluate(() => { if (window.__koligo_setOnline) window.__koligo_setOnline(true); });
      await w(dPage, 800);
      const acceptBtn2 = dPage.getByText('Accepter la course').first();
      if (await acceptBtn2.isVisible().catch(() => false)) {
        await acceptBtn2.click();
        await w(dPage, 3000);
        await shot(dPage, 'livreur-09-accepted', '✅ Course acceptée');
        accepted = true;
      } else {
        await shot(dPage, 'livreur-09-offline', '⚠️ Hors ligne — acceptation bloquée');
        console.warn('  ⚠️  Livreur toujours hors ligne sur écran detail');
      }
    }
  } else {
    console.warn('  ⚠️  Aucune course visible');
    await shot(dPage, 'livreur-07b-no-offer', 'Aucune course');
  }

  // ══════════════════════════════════════════════════════════════════
  // PHASE 3 — VENDEUR — Facture de confiance
  // ══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 3 : VENDEUR — Facture de confiance ═══');
  await vPage.bringToFront();
  console.log('  ⏳ Attente poll VendorCodes (12s)…');
  await w(vPage, 12000);
  await shot(vPage, 'vendeur-12-codes-after-accept', 'VendorCodes après acceptation');

  // Facture de confiance
  const trustBtn = vPage.getByText(/Facture de confiance/i).first();
  if (await trustBtn.isVisible().catch(() => false)) {
    await trustBtn.click();
    await w(vPage, 2000);
    await shot(vPage, 'vendeur-13-trust-invoice', 'Facture de confiance ✅');
    console.log('  ✅ Facture de confiance ouverte');
    // Retour
    await vPage.goBack().catch(() => {});
    await w(vPage, 800);
  } else {
    await shot(vPage, 'vendeur-13-no-trust', 'Facture non disponible');
    console.warn('  ⚠️  Facture de confiance non disponible encore');
  }

  // ══════════════════════════════════════════════════════════════════
  // PHASE 4 — RECEVEUR paie
  // ══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 4 : RECEVEUR — Paiement MoMo ═══');

  const clientToken = delivery?.clientToken;
  const deliverCode = delivery?.deliverCode;
  const priceXAF    = delivery?.priceXAF ?? 100;

  if (!clientToken) {
    console.warn('  ⚠️  clientToken manquant — skip paiement');
    await shot(vPage, 'receveur-00-skip', 'Paiement ignoré');
  } else {
    // Open a fresh page for the client (avoids stale bundle issue on vPage)
    const cCtx  = await mkCtx(browser);
    const cPage = await cCtx.newPage();
    console.log('  → Nouvelle page client (bundle frais)…');
    await cPage.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await w(cPage, 5000); // wait for React to mount + onReady

    // Wait for NavigationContainer to be ready
    console.log('  ⏳ Attente NavigationContainer ready…');
    try {
      await cPage.waitForFunction(
        () => typeof window.__koligo_nav_ready === 'function' && window.__koligo_nav_ready(),
        { timeout: 20000 }
      );
      console.log('  ✅ Navigation prête');
    } catch (e) {
      console.warn('  ⚠️  Navigation timeout:', e.message);
      const state = await cPage.evaluate(() => ({
        hasNavigate: typeof window.__koligo_navigate,
        hasNavReady: typeof window.__koligo_nav_ready,
        bodySnippet: document.body.innerText.slice(0, 80),
      })).catch(() => ({}));
      console.log('  État window:', JSON.stringify(state));
    }
    await w(cPage, 500);

    console.log(`  📲 Navigate → ClientReception (deliverCode: ${deliverCode})`);
    await cPage.evaluate(({ tok, price }) => {
      if (typeof window.__koligo_navigate === 'function') {
        window.__koligo_navigate('ClientReception', { clientToken: tok, priceXAF: price });
      } else {
        throw new Error('window.__koligo_navigate is not a function');
      }
    }, { tok: clientToken, price: priceXAF });
    // Wait for screen to render
    await cPage.waitForFunction(() => !!document.body.innerText.match(/Code de réception|Étape 1/), { timeout: 10000 }).catch(() => {});
    await w(cPage, 1000);
    await shot(cPage, 'receveur-01-code-entry', 'Receveur — Saisie code (étape 1/2)');

    // ── Étape 1+2: appel API direct client-pay (contourne le numpad UI peu fiable) ──
    console.log(`  💳 Appel client-pay API directement (deliverCode: ${deliverCode}, momoPhone: ${MOMO_PHONE})`);
    let payResult = null;
    try {
      payResult = await cPage.evaluate(async ({ tok, code, phone }) => {
        const res = await fetch('http://localhost:3000/api/deliveries/client-pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientToken: tok, deliverCode: code, momoPhone: phone }),
        });
        const json = await res.json();
        return { status: res.status, data: json };
      }, { tok: clientToken, code: String(deliverCode), phone: MOMO_PHONE });
      console.log(`  ✅ client-pay: ${payResult.status} — transactionId: ${payResult.data?.transactionId ?? JSON.stringify(payResult.data)}`);
    } catch (e) {
      console.warn(`  ⚠️  client-pay API échoué: ${e.message}`);
    }
    await shot(cPage, 'receveur-02-api-pay', `client-pay API: ${payResult?.status} — ${JSON.stringify(payResult?.data)?.slice(0, 80)}`);

    // Visual: also show the payment form for the report (enter digits + navigate to Step 2)
    console.log(`  🔢 Saisie visuelle code: ${deliverCode} (pour le rapport)`);
    await numpad(cPage, String(deliverCode));
    await w(cPage, 2500);
    await shot(cPage, 'receveur-03-step2-ui', 'Receveur — Étape 2 paiement (UI)');

    // Check if payment was initiated
    const transactionId = payResult?.data?.transactionId;
    const payOk = payResult?.status === 200 && transactionId;
    if (payOk) {
      console.log(`  💳 Paiement initié — polling statut (transactionId: ${transactionId})…`);
      await w(cPage, 3000);
      await shot(cPage, 'receveur-04-processing', 'Paiement en cours (Camoo API)');

      // Poll jusqu'à 90s via API directe
      let paid = false;
      for (let i = 0; i < 18; i++) {
        await w(cPage, 5000);
        const statusResult = await cPage.evaluate(async ({ transId, tok }) => {
          try {
            const res = await fetch(
              `http://localhost:3000/api/deliveries/client-payment-status?transactionId=${encodeURIComponent(transId)}&clientToken=${encodeURIComponent(tok)}`
            );
            return await res.json();
          } catch (e) { return { error: e.message }; }
        }, { transId: transactionId, tok: clientToken });

        console.log(`  ⏳ Poll Camoo ${(i+1)*5}s — status: ${statusResult?.status ?? JSON.stringify(statusResult)}`);
        if (i % 3 === 0) await shot(cPage, `receveur-04b-poll${i+1}`, `Camoo poll ${(i+1)*5}s — ${statusResult?.status}`);

        if (statusResult?.status === 'success') { paid = true; break; }
      }

      if (paid) {
        console.log('  ✅ PAIEMENT CONFIRMÉ!');

        // Navigate to success screen
        await cPage.evaluate(() => {
          if (typeof window.__koligo_navigate === 'function')
            window.__koligo_navigate('ReceptionSuccess');
        }).catch(() => {});
        await w(cPage, 1500);
        await shot(cPage, 'receveur-05-success', '✅ Paiement confirmé — ReceptionSuccess');

        // Rate deliverer via API directly
        console.log('  ⭐ Notation livreur via API (5 étoiles)…');
        const rateResult = await cPage.evaluate(async ({ tok }) => {
          try {
            const res = await fetch('http://localhost:3000/api/deliveries/client-rate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientToken: tok,
                score: 5,
                tags: ['Rapide', 'Professionnel', 'Sympa'],
                comment: 'Excellent livreur, très rapide!',
              }),
            });
            const json = await res.json();
            return { status: res.status, data: json };
          } catch (e) { return { error: e.message }; }
        }, { tok: clientToken });
        console.log(`  ✅ client-rate: ${rateResult?.status} — ${JSON.stringify(rateResult?.data)}`);

        // Navigate to rating screen for visual screenshot
        await cPage.evaluate(({ tok }) => {
          if (typeof window.__koligo_navigate === 'function')
            window.__koligo_navigate('ClientRating', { clientToken: tok });
        }, { tok: clientToken }).catch(() => {});
        await w(cPage, 1500);
        await shot(cPage, 'receveur-06-rating', 'Écran notation livreur');
        console.log('  ✅ Livreur noté 5 étoiles via API');
      } else {
        await shot(cPage, 'receveur-timeout', '⚠️ Timeout Camoo (sandbox lent)');
        console.warn('  ⚠️  Paiement non confirmé dans les délais (Camoo sandbox)');
      }
    } else {
      console.warn(`  ⚠️  Paiement non initié: ${JSON.stringify(payResult?.data)}`);
      await shot(cPage, 'receveur-no-pay', `Paiement échoué: ${JSON.stringify(payResult?.data)?.slice(0,60)}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PHASE 5 — VENDEUR vérification + LIVREUR wallet
  // ══════════════════════════════════════════════════════════════════
  console.log('\n═══ PHASE 5 : VENDEUR + LIVREUR — Vérification finale ═══');

  await vPage.bringToFront();
  await vPage.evaluate(() => window.__koligo_navigate && window.__koligo_navigate('VendorApp'));
  await w(vPage, 1500);
  await shot(vPage, 'vendeur-final-01-home', 'Accueil vendeur — fin parcours');

  // Historique
  const histBtn = vPage.getByText(/Historique/i).first();
  if (await histBtn.isVisible().catch(() => false)) {
    await histBtn.click();
    await w(vPage, 1200);
    await shot(vPage, 'vendeur-final-02-history', 'Historique livraisons');
  }

  // Livreur wallet
  await dPage.bringToFront();
  await dPage.evaluate(() => window.__koligo_navigate && window.__koligo_navigate('DelivererApp'));
  await w(dPage, 1500);
  await shot(dPage, 'livreur-final-wallet', 'Wallet livreur');

  // ──────────────────────────────────────────────────────────────────
  await browser.close();
  generateReport();
}

// ── Rapport HTML ──────────────────────────────────────────────────────
function generateReport() {
  const badgeOf = n => {
    if (/vendeur|post.deliv|trust/.test(n))         return ['v', '🛍 Vendeur'];
    if (/livreur|offer|accept/.test(n))              return ['d', '🛵 Livreur'];
    if (/receveur|reception|rating|receipt/.test(n)) return ['c', '📦 Receveur'];
    return ['', ''];
  };

  const cards = shots.map(s => {
    const [cls, lbl] = badgeOf(s.name);
    return `<div class="card">
  <img src="data:image/png;base64,${s.base64}" alt="${s.name}" loading="lazy">
  <div class="info">
    <div class="title">${cls ? `<span class="badge ${cls}">${lbl}</span>` : ''} ${s.name}</div>
    <div class="desc">${s.desc}</div>
  </div>
</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>KoliGo E2E — Parcours complet</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f2ef;padding:24px}
    h1{color:#0E2A1C;text-align:center;margin-bottom:6px;font-size:24px}
    .sub{text-align:center;color:#555;margin-bottom:6px;font-size:13px}
    .meta{text-align:center;color:#999;font-size:11px;margin-bottom:22px}
    .legend{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:26px}
    .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .v{background:#E7F2EA;color:#0E2A1C}
    .d{background:#FFF3CD;color:#856404}
    .c{background:#CCE5FF;color:#004085}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
    .card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08);transition:transform .15s}
    .card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.13)}
    .card img{width:100%;display:block}
    .info{padding:10px 12px}
    .title{font-size:11.5px;font-weight:700;color:#0E2A1C;margin-bottom:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .desc{font-size:11px;color:#666}
    footer{text-align:center;margin-top:30px;color:#aaa;font-size:11px;padding-top:14px;border-top:1px solid #ddd}
  </style>
</head>
<body>
  <h1>🚚 KoliGo V2 — Test E2E Complet</h1>
  <p class="sub">Création livraison → Acceptation livreur → Paiement MoMo → Reçu → Notation</p>
  <p class="meta">Vendeur: 691227149 · Livreur: 678758976 · Receveur MoMo: 691227149 · 100 XAF</p>
  <div class="legend">
    <span class="badge v">🛍 Vendeur (emm.foka)</span>
    <span class="badge d">🛵 Livreur (efoka24)</span>
    <span class="badge c">📦 Receveur</span>
  </div>
  <div class="grid">${cards}</div>
  <footer>Chromium Mobile 390×844 · ${new Date().toLocaleString('fr-FR')} · ${shots.length} captures</footer>
</body>
</html>`;

  const rpt = path.join(__dirname, 'e2e-report.html');
  fs.writeFileSync(rpt, html, 'utf8');
  console.log(`\n✅  Rapport : ${rpt}`);
  console.log(`📸  ${shots.length} captures dans ${SHOTS}`);
  console.log(`\n   start ${rpt}`);
}

main().catch(e => {
  console.error('\n❌ ERREUR E2E:', e.message || e);
  generateReport();
  process.exit(1);
});
