/**
 * E2E Test — Full delivery flow (6 steps)
 * Vendor creates → Deliverer accepts → Collect code → EN_ROUTE → Client confirms
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8085';
const API  = 'http://localhost:3001';

// Real test accounts (from memory)
const VENDOR    = { phone: '678758976', pin: '1234', name: 'Efoka Stephane' };
const DELIVERER = { phone: '691227149', pin: '1234', name: 'Foka Emmanuel' };

// API helper — properly merges headers so Content-Type is not overridden
async function apiCall(path, options = {}) {
  const { headers: extraHeaders, ...restOptions } = options;
  const res = await fetch(`${API}${path}`, {
    ...restOptions,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function signin(phone, pin) {
  const res = await apiCall('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ phone, pin }),
  });
  if (!res.accessToken) throw new Error(`Signin failed: ${JSON.stringify(res)}`);
  return res;
}

let pass = 0;
let fail = 0;
const results = [];

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    results.push({ label, ok: true });
    pass++;
  } else {
    console.log(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    results.push({ label, ok: false, detail });
    fail++;
  }
}

async function clickNumpad(page, digit) {
  const btn = page.locator(`[role="button"]:has-text("${digit}"), button:has-text("${digit}")`).first();
  const fb  = page.locator(`text="${digit}"`).first();
  const tgt = (await btn.isVisible({ timeout: 1000 }).catch(() => false)) ? btn : fb;
  await tgt.click({ force: false }).catch(() => {});
  await page.waitForTimeout(420);
}

async function signInViaUI(page, phone, pin) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4500);

  // Click sign-in link on welcome screen (text contains "compte" in French)
  const alreadyHave = page.getByText(/compte/i).first();
  if (await alreadyHave.isVisible({ timeout: 3000 }).catch(() => false)) {
    await alreadyHave.click();
    await page.waitForTimeout(900);
  } else {
    // Try direct Connexion button
    const connBtn = page.getByText(/connexion|sign.?in/i).first();
    if (await connBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await connBtn.click();
      await page.waitForTimeout(900);
    }
  }

  // Handle "Changer de compte" if already logged in
  const changeAccount = page.getByText(/Changer de compte/i).first();
  if (await changeAccount.isVisible({ timeout: 2000 }).catch(() => false)) {
    await changeAccount.click();
    await page.waitForTimeout(700);
  }

  // Enter phone number
  const phoneInput = page.getByPlaceholder(/6XX|phone/i).first();
  if (await phoneInput.isVisible({ timeout: 4000 }).catch(() => false)) {
    await phoneInput.fill(phone);
    await page.getByText('Continuer').first().click();
    await page.waitForTimeout(1500);
  }

  // Enter PIN via numpad
  for (const digit of pin.split('')) {
    await clickNumpad(page, digit);
  }
  await page.waitForTimeout(3500);
}

(async () => {
  console.log('\n========================================');
  console.log('  KoliGo — Full Delivery Flow E2E Test');
  console.log('========================================\n');

  let vendorToken, delivererToken;
  let deliveryId, collectCode, deliverCode;

  // ─── STEP 0: Signin via API to get tokens ─────────────────────────────────
  console.log('STEP 0 — Authentication');
  try {
    const vRaw = await signin(VENDOR.phone, VENDOR.pin);
    // Ensure vendor is in VENDOR role
    if (vRaw.user?.activeRole !== 'VENDOR') {
      const sw = await apiCall('/auth/switch-role', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vRaw.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'VENDOR' }),
      });
      vendorToken = sw.accessToken;
    } else {
      vendorToken = vRaw.accessToken;
    }
    check('Vendor signin (VENDOR role)', !!vendorToken);

    const dData = await signin(DELIVERER.phone, DELIVERER.pin);
    delivererToken = dData.accessToken;
    check('Deliverer signin', !!delivererToken);
    check('Deliverer KYC verified', dData.user?.kycStatus === 'VERIFIED', `kycStatus=${dData.user?.kycStatus}`);
  } catch (e) {
    check('Auth setup', false, e.message);
    console.log('\n❌ Auth failed — cannot continue\n');
    process.exit(1);
  }

  // ─── STEP 1: Vendor creates delivery ──────────────────────────────────────
  console.log('\nSTEP 1 — Vendor creates delivery');
  try {
    const created = await apiCall('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vendorToken}` },
      body: JSON.stringify({
        pickupAddress:  'Akwa',
        dropoffAddress: 'Bonapriso',
        weightKg:       2,
        delivererType:  'TEMPORAIRE',
        distanceKm:     2.4,
        shopName:       'Test Boutique E2E',
        recipientName:  'Marie Test',
        recipientPhone: '655000001',
      }),
    });
    deliveryId   = created.id;
    collectCode  = created.collectCode;
    deliverCode  = created.deliverCode;

    check('Delivery created', !!deliveryId, `id=${deliveryId} err=${created.error||''}`);
    if (!deliveryId) { console.log('\n❌ Cannot continue without delivery\n'); process.exit(1); }
    check('Status EN_ATTENTE', created.status === 'EN_ATTENTE', `status=${created.status}`);
    check('Collect code generated', !!collectCode, `code=${collectCode}`);
    check('Deliver code generated', !!deliverCode, `code=${deliverCode}`);
    check('Price calculated', created.priceXAF > 0, `price=${created.priceXAF}`);
  } catch (e) {
    check('Create delivery', false, e.message);
    console.log('\n❌ Cannot continue without delivery\n');
    process.exit(1);
  }

  // ─── STEP 2: Delivery appears in available list ────────────────────────────
  console.log('\nSTEP 2 — Delivery visible in available list');
  try {
    const available = await apiCall('/deliveries/available', {
      headers: { Authorization: `Bearer ${delivererToken}` },
    });
    const found = Array.isArray(available)
      ? available.find(d => d.id === deliveryId)
      : null;
    check('Delivery in available list', !!found, `found=${!!found}, total=${available?.length}`);
    check('Available status correct', !found || found.status === 'EN_ATTENTE');
  } catch (e) {
    check('Available list fetch', false, e.message);
  }

  // ─── STEP 3: Deliverer accepts ─────────────────────────────────────────────
  console.log('\nSTEP 3 — Deliverer accepts delivery');
  try {
    const accepted = await apiCall(`/deliveries/${deliveryId}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${delivererToken}` },
    });
    check('Accept response received', !!accepted);
    check('Status ACCEPTE', accepted.status === 'ACCEPTE', `status=${accepted.status}`);

    // Verify via GET
    const delivery = await apiCall(`/deliveries/${deliveryId}`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    check('Deliverer assigned', !!delivery.delivererId, `delivererId=${delivery.delivererId}`);
  } catch (e) {
    check('Accept delivery', false, e.message);
  }

  // ─── STEP 4: Collect code validation → EN_ROUTE ───────────────────────────
  console.log('\nSTEP 4 — Collect code validation');
  try {
    const collected = await apiCall(`/deliveries/${deliveryId}/confirm-collect`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${delivererToken}` },
      body: JSON.stringify({ collectCode }),
    });
    check('Collect confirmed', !!collected);
    check('Status EN_ROUTE', collected.status === 'EN_ROUTE', `status=${collected.status}`);
  } catch (e) {
    check('Confirm collect', false, e.message);
  }

  // ─── STEP 5: Trust invoice available ──────────────────────────────────────
  console.log('\nSTEP 5 — Trust invoice (vendor)');
  try {
    const trust = await apiCall(`/deliveries/${deliveryId}/trust-invoice`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    check('Trust invoice returned', !!trust);
    check('Deliverer info present', !!trust.deliverer?.name, `name=${trust.deliverer?.name}`);
    check('KYC status present', !!trust.deliverer?.kycStatus, `kycStatus=${trust.deliverer?.kycStatus}`);
    check('Recipient info present', trust.recipientName !== undefined);
  } catch (e) {
    check('Trust invoice', false, e.message);
  }

  // ─── STEP 6: Client confirms delivery ─────────────────────────────────────
  console.log('\nSTEP 6 — Client confirms reception');
  try {
    const confirmed = await apiCall(`/deliveries/${deliveryId}/client-confirm`, {
      method: 'POST',
      body: JSON.stringify({ code: deliverCode, paymentNumber: '655000001' }),
    });
    check('Client confirm responded', !!confirmed, JSON.stringify(confirmed));
    check('No error in response', !confirmed.error, confirmed.error);

    // Verify final status
    const final = await apiCall(`/deliveries/${deliveryId}`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    check('Status LIVRE', final.status === 'LIVRE', `status=${final.status}`);
  } catch (e) {
    check('Client confirm', false, e.message);
  }

  // ─── STEP 7: UI Navigation smoke tests ────────────────────────────────────
  console.log('\nSTEP 7 — UI navigation (deliverer flow)');
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  try {
    // Clear any stored session so we start fresh
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
    await signInViaUI(page, DELIVERER.phone, DELIVERER.pin);
    await page.waitForTimeout(2000);

    const title = await page.title();
    check('Deliverer app loads', !title.includes('error'), `title=${title}`);

    // Check at least one main tab visible (Courses/Offers or Accueil/Home)
    const coursesTab  = page.getByText(/^(Courses|Offers)$/i).last();
    const accueilTab  = page.getByText(/^(Accueil|Home)$/i).last();
    const coursesVis  = await coursesTab.isVisible({ timeout: 5000 }).catch(() => false);
    const accueilVis  = await accueilTab.isVisible({ timeout: 3000 }).catch(() => false);
    check('Deliverer tab bar visible', coursesVis || accueilVis, `courses=${coursesVis} accueil=${accueilVis}`);

    // Check Profil tab
    const profileTab = page.getByText(/^(Profil|Profile)$/i).last();
    const profileVis = await profileTab.isVisible({ timeout: 3000 }).catch(() => false);
    check('Profil tab visible', profileVis);

    // Navigate to profile if visible and check KYC
    if (profileVis) {
      await profileTab.click();
      await page.waitForTimeout(2000);
      const kycVerified = await page.getByText(/v.rifi.e?|verified/i).first().isVisible({ timeout: 3000 }).catch(() => false);
      check('KYC verified shown in profile', kycVerified);
    }
  } catch (e) {
    check('UI smoke test', false, e.message);
  } finally {
    await browser.close();
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log('========================================');
  results.forEach(r => {
    if (!r.ok) console.log(`  ✗ ${r.label}${r.detail ? ': ' + r.detail : ''}`);
  });

  if (fail > 0) {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
})();
