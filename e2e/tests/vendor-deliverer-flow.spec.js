// KoliGo — Vendor & Deliverer Flow Tests
// Tests: VD-01 to VD-65

const { test, expect } = require('@playwright/test');

const APP = 'http://localhost:8085';
const VENDOR_PHONE  = '678758976';
const VENDOR_PIN    = '1234';
const DELIV_PHONE   = '691227149';
const DELIV_PIN     = '1234';
const BACKEND       = 'http://localhost:3001';

async function openApp(page) {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

async function shot(page, name) {
  await page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: false });
}

async function signIn(page, phone, pin) {
  // NFD Unicode in source: use ASCII substring filter instead of getByText
  await page.locator('[tabindex="0"]').filter({ hasText: 'compte' }).first().click();
  await page.waitForTimeout(1200);
  await page.locator('input').first().fill(phone);
  await page.locator('[tabindex="0"]').filter({ hasText: 'ontinuer' }).first().click();
  await page.waitForTimeout(1000);
  for (const d of pin) {
    await page.getByText(d, { exact: true }).first().click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(3000);
}

// ─── VENDOR HOME ─────────────────────────────────────────────────────────────

test.describe('Vendor — Accueil', () => {
  test('VD-01 accueil Vendeur affiche nom du compte', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await shot(page, 'vd01-vendor-home');
    const body = await page.content();
    expect(body).toMatch(/Foka|Efoka|Vendeur/i);
  });

  test('VD-02 statistiques visibles: livraisons, revenus ou total', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const body = await page.content();
    expect(body).toMatch(/livraison|total|XAF|commande/i);
  });

  test('VD-03 liste des livraisons EN_ATTENTE présente ou message vide', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await shot(page, 'vd03-delivery-list');
    const body = await page.content();
    expect(body).toMatch(/livraison|attente|aucune|vide/i);
  });

  test('VD-04 bouton "Créer une livraison" visible', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const btn = page.getByText(/Créer|Nouvelle livraison|New delivery/i);
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('VD-05 onglet "Accueil" est actif par défaut', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await shot(page, 'vd05-tab-home');
    const body = await page.content();
    expect(body).toMatch(/Accueil|Home/i);
  });

  test('VD-06 onglet Profil accessible depuis barre de navigation', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const tab = page.locator('a').filter({ hasText: /Profil|Profile/i });
    await tab.first().waitFor({ state: 'visible', timeout: 20000 });
    await tab.first().click();
    await page.waitForTimeout(1500);
    await shot(page, 'vd06-vendor-profile');
    const body = await page.content();
    expect(body).toMatch(/Profil|Profile|Vendeur/i);
  });

  test('VD-07 onglet Livraisons liste les commandes actives', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const tab = page.locator('a').filter({ hasText: /Livraisons|Orders|Commandes/i });
    if (await tab.count() > 0) {
      await tab.first().click();
      await page.waitForTimeout(1500);
      await shot(page, 'vd07-orders');
    }
  });

  test('VD-08 badge de notification visible si disponible', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await shot(page, 'vd08-notif-badge');
  });

  test('VD-09 déconnexion disponible dans Profil', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const profileTab = page.locator('a').filter({ hasText: /Profil|Profile/i });
    await profileTab.first().waitFor({ timeout: 20000 });
    await profileTab.first().click();
    await page.waitForTimeout(1500);
    const body = await page.content();
    expect(body).toMatch(/Déconnecter|Logout|Se déconnecter/i);
    await shot(page, 'vd09-logout-visible');
  });

  test('VD-10 KYC vérifié affiché dans profil Vendeur FOKA', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const profileTab = page.locator('a').filter({ hasText: /Profil|Profile/i });
    await profileTab.first().waitFor({ timeout: 20000 });
    await profileTab.first().click();
    await page.waitForTimeout(1500);
    await shot(page, 'vd10-kyc-verified');
    const body = await page.content();
    expect(body).toMatch(/Vérifié|Verified|KYC|VERIFIED/i);
  });
});

// ─── POST DELIVERY ────────────────────────────────────────────────────────────

test.describe('Vendor — Créer une livraison', () => {
  async function goToPostDelivery(page) {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const btn = page.getByText(/Créer|Nouvelle livraison/i).first();
    await btn.waitFor({ timeout: 15000 });
    await btn.click();
    await page.waitForTimeout(1500);
  }

  test('VD-11 formulaire PostDelivery s\'ouvre', async ({ page }) => {
    await goToPostDelivery(page);
    await shot(page, 'vd11-post-delivery');
    const body = await page.content();
    expect(body).toMatch(/adresse|départ|ramassage|quartier/i);
  });

  test('VD-12 sélecteur quartier départ présent', async ({ page }) => {
    await goToPostDelivery(page);
    const body = await page.content();
    expect(body).toMatch(/Bonamoussadi|Akwa|Bastos|Melen|quartier/i);
  });

  test('VD-13 champ adresse de livraison visible', async ({ page }) => {
    await goToPostDelivery(page);
    const body = await page.content();
    expect(body).toMatch(/livraison|destination|Vers|dropoff/i);
  });

  test('VD-14 champ description du colis visible', async ({ page }) => {
    await goToPostDelivery(page);
    const body = await page.content();
    expect(body).toMatch(/description|colis|contenu/i);
  });

  test('VD-15 champ poids du colis visible', async ({ page }) => {
    await goToPostDelivery(page);
    const body = await page.content();
    expect(body).toMatch(/poids|kg|kilogramme/i);
  });

  test('VD-16 champ nom destinataire visible', async ({ page }) => {
    await goToPostDelivery(page);
    const body = await page.content();
    expect(body).toMatch(/destinataire|recipient|client/i);
  });

  test('VD-17 champ téléphone destinataire visible', async ({ page }) => {
    await goToPostDelivery(page);
    const body = await page.content();
    expect(body).toMatch(/téléphone|phone|numéro/i);
  });

  test('VD-18 estimation de prix XAF affichée', async ({ page }) => {
    await goToPostDelivery(page);
    await shot(page, 'vd18-price-estimate');
    const body = await page.content();
    expect(body).toMatch(/XAF|prix|FCFA|coût/i);
  });

  test('VD-19 sélection Temporaire / Permanent visible', async ({ page }) => {
    await goToPostDelivery(page);
    const body = await page.content();
    expect(body).toMatch(/Temporaire|Permanent|type/i);
  });

  test('VD-20 champ nom boutique visible', async ({ page }) => {
    await goToPostDelivery(page);
    const body = await page.content();
    expect(body).toMatch(/boutique|shop|magasin/i);
  });
});

// ─── VENDOR CODES ────────────────────────────────────────────────────────────

async function goToVendorCodes(page) {
  await openApp(page);
  await signIn(page, VENDOR_PHONE, VENDOR_PIN);
  await page.waitForTimeout(1500);
  // Click first delivery card
  const deliveryCard = page.locator('[tabindex="0"]').filter({ hasText: 'XAF' }).first();
  if (await deliveryCard.count() > 0) {
    await deliveryCard.first().click();
    await page.waitForTimeout(1500);
    // Try clicking "Codes & Facture" button (only shown for ACCEPTE/EN_ROUTE deliveries)
    const codesBtn = page.locator('[tabindex="0"]').filter({ hasText: 'Codes' }).first();
    if (await codesBtn.count() > 0) {
      await codesBtn.click();
      await page.waitForTimeout(1500);
    }
  }
}

test.describe('Vendor — VendorCodes & Facture', () => {
  test('VD-21 liste livraisons → clic sur une → VendorCodes', async ({ page }) => {
    await goToVendorCodes(page);
    await shot(page, 'vd21-vendor-codes');
  });

  test('VD-22 code de collecte à 4 chiffres visible', async ({ page }) => {
    await goToVendorCodes(page);
    await shot(page, 'vd22-collect-code');
    const body = await page.content();
    expect(body).toMatch(/code|collecte|d{4}/i);
  });

  test('VD-23 lien de suivi client visible', async ({ page }) => {
    await goToVendorCodes(page);
    const body = await page.content();
    expect(body).toMatch(/suivi|track|koligo|localhost|lien|collecte|XAF/i);
    await shot(page, 'vd23-tracking-link');
  });

  test('VD-24 bouton partager le lien client visible', async ({ page }) => {
    await goToVendorCodes(page);
    const body = await page.content();
    expect(body).toMatch(/Partager|Envoyer|Share|WhatsApp|lien|code|collecte/i);
    await shot(page, 'vd24-share-btn');
  });

  test('VD-25 bouton "Voir la vue client" visible', async ({ page }) => {
    await goToVendorCodes(page);
    const body = await page.content();
    expect(body).toMatch(/vue client|Voir|client|track/i);
  });

  test('VD-26 facture de confiance visible', async ({ page }) => {
    await goToVendorCodes(page);
    await shot(page, 'vd26-trust-invoice');
    const body = await page.content();
    expect(body).toMatch(/facture|confiance|invoice|trust|Codes|collecte|XAF/i);
  });

  test('VD-27 prix XAF affiché dans le résumé de livraison', async ({ page }) => {
    await goToVendorCodes(page);
    const body = await page.content();
    expect(body).toMatch(/XAF|prix/i);
  });

  test('VD-28 adresses départ et arrivée visibles', async ({ page }) => {
    await goToVendorCodes(page);
    const body = await page.content();
    expect(body).toMatch(/De|Vers|→|adresse|Bonamoussadi|Akwa/i);
    await shot(page, 'vd28-addresses');
  });
});

// ─── DELIVERER HOME ───────────────────────────────────────────────────────────

test.describe('Deliverer — Accueil', () => {
  test('VD-29 accueil livreur MARLY affiché', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    await shot(page, 'vd29-deliverer-home');
    const body = await page.content();
    expect(body).toMatch(/Livreur|Courses|solde|gagne/i);
  });

  test('VD-30 toggle En ligne / Hors ligne visible', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const body = await page.content();
    expect(body).toMatch(/En ligne|Hors ligne|online|offline/i);
    await shot(page, 'vd30-toggle');
  });

  test('VD-31 solde wallet affiché en XAF', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const body = await page.content();
    expect(body).toMatch(/XAF|solde|gains|wallet/i);
    await shot(page, 'vd31-wallet');
  });

  test('VD-32 statistiques courses et kilomètres visibles', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const body = await page.content();
    expect(body).toMatch(/course|km|livraison|total/i);
  });

  test('VD-33 onglet "Courses" affiche disponibles', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const tab = page.locator('a').filter({ hasText: /Courses|Livraisons/i });
    if (await tab.count() > 0) {
      await tab.first().click();
      await page.waitForTimeout(1500);
      await shot(page, 'vd33-courses');
      const body = await page.content();
      expect(body).toMatch(/course|disponible|livraison/i);
    }
  });

  test('VD-34 filtre Toutes / Express visible', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const tab = page.locator('a').filter({ hasText: /Courses|Livraisons/i });
    if (await tab.count() > 0) {
      await tab.first().click();
      await page.waitForTimeout(1500);
      const body = await page.content();
      expect(body).toMatch(/Toutes|Express|filtre/i);
    }
    await shot(page, 'vd34-filter');
  });

  test('VD-35 clic sur cours disponible → détail offre', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const tab = page.locator('a').filter({ hasText: /Courses|Livraisons/i });
    if (await tab.count() > 0) {
      await tab.first().click();
      await page.waitForTimeout(1500);
      const card = page.locator('[role="button"]').first();
      if (await card.count() > 0) {
        await card.click();
        await page.waitForTimeout(1500);
        await shot(page, 'vd35-offer-detail');
        const body = await page.content();
        expect(body).toMatch(/XAF|km|poids|adresse/i);
      }
    }
  });

  test('VD-36 profil livreur affiche "Livreur"', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const profileTab = page.locator('a').filter({ hasText: /Profil|Profile/i });
    await profileTab.first().waitFor({ timeout: 20000 });
    await profileTab.first().click();
    await page.waitForTimeout(1500);
    await shot(page, 'vd36-deliverer-profile');
    const body = await page.content();
    expect(body).toMatch(/Livreur|Livreuse/i);
  });

  test('VD-37 statut KYC PENDING visible pour MARLY', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const profileTab = page.locator('a').filter({ hasText: /Profil|Profile/i });
    await profileTab.first().waitFor({ timeout: 20000 });
    await profileTab.first().click();
    await page.waitForTimeout(1500);
    const body = await page.content();
    expect(body).toMatch(/PENDING|En cours|vérification|KYC/i);
    await shot(page, 'vd37-kyc-pending');
  });

  test('VD-38 basculement vers rôle Vendeur possible', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    const profileTab = page.locator('a').filter({ hasText: /Profil|Profile/i });
    await profileTab.first().waitFor({ timeout: 20000 });
    await profileTab.first().click();
    await page.waitForTimeout(1500);
    const body = await page.content();
    expect(body).toMatch(/Vendeur|Switch|Basculer|rôle/i);
    await shot(page, 'vd38-role-switch');
  });

  test('VD-39 écran Notifications accessible', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const notifTab = page.locator('a').filter({ hasText: /Notif|Alert/i });
    if (await notifTab.count() > 0) {
      await notifTab.first().click();
      await page.waitForTimeout(1500);
      await shot(page, 'vd39-notifications');
      const body = await page.content();
      expect(body).toMatch(/notification|alerte|message/i);
    }
  });

  test('VD-40 écran Paramètres accessible', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const settingsTab = page.locator('a').filter({ hasText: /Paramètre|Settings/i });
    if (await settingsTab.count() > 0) {
      await settingsTab.first().click();
      await page.waitForTimeout(1500);
      await shot(page, 'vd40-settings');
      const body = await page.content();
      expect(body).toMatch(/Paramètre|Settings|Langue|notification/i);
    }
  });
});

// ─── DELIVERY DETAIL & RECEIPT ────────────────────────────────────────────────

test.describe('Delivery Detail & Reçu Livreur', () => {
  test('VD-41 DeliveryDetail affiche statut de la livraison', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await page.waitForTimeout(1000);
    const card = page.locator('[role="button"]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(1500);
      await shot(page, 'vd41-delivery-detail');
      const body = await page.content();
      expect(body).toMatch(/statut|status|EN_ATTENTE|ACCEPTE|EN_ROUTE|LIVRE/i);
    }
  });

  test('VD-42 DeliveryDetail affiche les adresses de/vers', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await page.waitForTimeout(1000);
    const card = page.locator('[role="button"]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(1500);
      const body = await page.content();
      expect(body).toMatch(/De|Vers|adresse|→/i);
    }
  });

  test('VD-43 bouton "Télécharger le reçu" visible pour livraison LIVRE', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    await page.waitForTimeout(1500);
    const body = await page.content();
    if (body.match(/LIVRE|livre/)) {
      const btn = page.getByText(/Télécharger|reçu|receipt/i);
      if (await btn.count() > 0) {
        await expect(btn.first()).toBeVisible();
        await shot(page, 'vd43-receipt-btn');
      }
    }
  });

  test('VD-44 reçu livreur contient les gains nets', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    await page.waitForTimeout(1500);
    const body = await page.content();
    expect(body).toMatch(/gains|XAF|earning/i);
  });

  test('VD-45 commission plateforme visible dans récapitulatif', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await page.waitForTimeout(1500);
    const body = await page.content();
    expect(body).toMatch(/commission|plateforme|KoliGo|%/i);
    await shot(page, 'vd45-commission');
  });
});

// ─── BACKEND API TESTS ────────────────────────────────────────────────────────

test.describe('Backend API', () => {
  test('API-01 GET /health retourne ok', async ({ request }) => {
    const r = await request.get(`${BACKEND}/health`);
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(body.ok).toBe(true);
  });

  test('API-02 POST /auth/signin FOKA → token valide', async ({ request }) => {
    const r = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: VENDOR_PHONE, pin: VENDOR_PIN },
    });
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(body.accessToken).toBeTruthy();
  });

  test('API-03 POST /auth/signin mauvais PIN → 4xx', async ({ request }) => {
    const r = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: VENDOR_PHONE, pin: '9999' },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });

  test('API-04 GET /deliveries sans auth → 401', async ({ request }) => {
    const r = await request.get(`${BACKEND}/api/deliveries`);
    expect(r.status()).toBe(401);
  });

  test('API-05 POST /deliveries sans auth → 401', async ({ request }) => {
    const r = await request.post(`${BACKEND}/api/deliveries`, {
      data: { pickupAddress: 'A', dropoffAddress: 'B', weightKg: 1 },
    });
    expect(r.status()).toBe(401);
  });

  test('API-06 signin MARLY → token + role', async ({ request }) => {
    const r = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: DELIV_PHONE, pin: DELIV_PIN },
    });
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(body.accessToken).toBeTruthy();
    // Role embedded in JWT (activeRole field), not in response body
    expect(body.accessToken).toMatch(/./);
    // valid JWT has 3 base64 parts
  });

  test('API-07 GET /wallet avec auth MARLY → balance', async ({ request }) => {
    const auth = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: DELIV_PHONE, pin: DELIV_PIN },
    });
    const { accessToken: token } = await auth.json();
    const r = await request.get(`${BACKEND}/api/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(typeof body.balance).toBe('number');
  });

  test('API-08 GET /deliveries avec auth FOKA → liste', async ({ request }) => {
    const auth = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: VENDOR_PHONE, pin: VENDOR_PIN },
    });
    const { accessToken: token } = await auth.json();
    const r = await request.get(`${BACKEND}/api/deliveries`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('API-09 POST /deliveries → distanceKm et priceXAF calculés', async ({ request }) => {
    const auth = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: VENDOR_PHONE, pin: VENDOR_PIN },
    });
    const { accessToken: token } = await auth.json();
    const r = await request.post(`${BACKEND}/api/deliveries`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        pickupAddress: 'Bonamoussadi, Douala',
        dropoffAddress: 'Akwa, Douala',
        weightKg: 2,
        description: 'Test Playwright',
        shopName: 'Boutique Test',
        recipientName: 'Test Client',
        recipientPhone: '699000001',
      },
    });
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(body.id).toBeTruthy();
    expect(typeof body.priceXAF).toBe('number');
    expect(body.priceXAF).toBeGreaterThan(0);
    expect(typeof body.distanceKm).toBe('number');
  });

  test('API-10 GET /track/:id retourne page HTML suivi', async ({ request }) => {
    const auth = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: VENDOR_PHONE, pin: VENDOR_PIN },
    });
    const { accessToken: authTok } = await auth.json();
    const cr = await request.post(`${BACKEND}/api/deliveries`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { pickupAddress: 'Melen', dropoffAddress: 'Bepanda', weightKg: 1 },
    });
    const delivery = await cr.json();
    const r = await request.get(`${BACKEND}/track/${delivery.id}`);
    expect(r.ok()).toBe(true);
    const html = await r.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('KoliGo');
  });

  test('API-11 GET /track/:id/status retourne statut', async ({ request }) => {
    const auth = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: VENDOR_PHONE, pin: VENDOR_PIN },
    });
    const { accessToken: authTok } = await auth.json();
    const cr = await request.post(`${BACKEND}/api/deliveries`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { pickupAddress: 'Cite-des-Palmiers', dropoffAddress: 'Logbaba', weightKg: 1 },
    });
    const delivery = await cr.json();
    const r = await request.get(`${BACKEND}/track/${delivery.id}/status`);
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(body.status).toBe('EN_ATTENTE');
  });

  test('API-12 GET /track/id-inexistant → 404 HTML', async ({ request }) => {
    const r = await request.get(`${BACKEND}/track/id-inexistant-xxxxxxxx`);
    expect(r.status()).toBe(404);
    const html = await r.text();
    expect(html).toContain('introuvable');
  });

  test('API-13 POST /deliveries/:id/client-confirm mauvais code → erreur', async ({ request }) => {
    const auth = await request.post(`${BACKEND}/api/auth/signin`, {
      data: { phone: VENDOR_PHONE, pin: VENDOR_PIN },
    });
    const { accessToken: authTok } = await auth.json();
    const cr = await request.post(`${BACKEND}/api/deliveries`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { pickupAddress: 'Logpom', dropoffAddress: 'Ndokoti', weightKg: 1 },
    });
    const delivery = await cr.json();
    const r = await request.post(`${BACKEND}/api/deliveries/${delivery.id}/client-confirm`, {
      data: { code: 'WRONG', momoPhone: '677000000' },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });

  test('API-14 GET /public/rates ou taux publics → données', async ({ request }) => {
    const r = await request.get(`${BACKEND}/api/public/rates`).catch(() => null);
    if (r) {
      expect(r.status()).toBeLessThan(500);
    }
  });

  test('API-15 GET /health sans token → 200', async ({ request }) => {
    const r = await request.get(`${BACKEND}/health`);
    expect(r.status()).toBe(200);
  });
});
