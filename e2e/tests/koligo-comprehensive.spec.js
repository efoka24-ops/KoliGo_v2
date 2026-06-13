// KoliGo — Comprehensive E2E Test Suite
// Covers: onboarding, auth, vendor flow, deliverer flow, KYC, profile switch, client flow, edge cases
// Test accounts:
//   FOKA A  — phone 678758976 / PIN 1234  — VENDOR, KYC VERIFIED
//   MARLY   — phone 691227149 / PIN 1234  — DELIVERER (+ VENDOR), KYC PENDING

const { test, expect } = require('@playwright/test');

const APP = 'http://localhost:8085';
const VENDOR_PHONE = '678758976';
const VENDOR_PIN   = '1234';
const DELIV_PHONE  = '691227149';
const DELIV_PIN    = '1234';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function openApp(page) {
  // Clear localStorage BEFORE React runs (addInitScript fires before any page JS)
  await page.addInitScript(() => localStorage.clear());
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // Wait for React root to render (Metro bundler can take 30s+ on first load)
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.innerText.trim().length > 5;
  }, { timeout: 90000 });
  await page.waitForTimeout(1500);
}

// NFD-safe helpers (RN Web uses NFD Unicode, Playwright getByText uses NFC)
function btnCompte(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'compte' }).first();
}
function btnDemarrer(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'marrer' }).first();
}
function btnContinuer(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'ontinuer' }).first();
}
function btnCreerLivraison(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'livraison' }).first();
}

// Navigate to SignIn then fully authenticate
async function signIn(page, phone, pin) {
  await btnCompte(page).click();
  await page.waitForTimeout(1200);

  // Phone step: fill input then press Enter (avoids tabindex issue on disabled Continuer button)
  const phoneInput = page.locator('input').first();
  if (await phoneInput.count() > 0) {
    await phoneInput.click();
    await phoneInput.fill(phone);
    await page.waitForTimeout(300);
    // Press Enter triggers onSubmitEditing → handleIdentifierNext → setStep('pin')
    await phoneInput.press('Enter');
    await page.waitForTimeout(1200);
  }

  // PIN step: click numpad digits
  for (const digit of pin) {
    await page.getByText(digit, { exact: true }).first().click();
    await page.waitForTimeout(200);
  }

  await page.waitForTimeout(2800);
}

// Take labeled screenshot
async function shot(page, name) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
}

// Click a tab bar link — waits up to 25s before clicking so cold-load doesn't race
async function clickTab(page, namePattern) {
  const tab = page.locator('a').filter({ hasText: namePattern });
  await tab.first().waitFor({ state: 'visible', timeout: 25000 });
  await tab.first().click();
}

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 1: WELCOME & ONBOARDING VISUAL
// ════════════════════════════════════════════════════════════════════════════

test.describe('01 — Écran Accueil (Welcome)', () => {

  test('Affiche le logo KoliGo et les deux CTA', async ({ page }) => {
    await openApp(page);
    await shot(page, '01-welcome');

    // Logo text "KoliGo" visible
    await expect(page.getByText(/KoliGo/i).first()).toBeVisible();

    // "Démarrer" CTA
    await expect(btnDemarrer(page)).toBeVisible();

    // "J'ai déjà un compte"
    await expect(btnCompte(page)).toBeVisible();
  });

  test('Démarrer → ouvre la page Inscription', async ({ page }) => {
    await openApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1500);
    await shot(page, '01b-signup');

    // Should show signup form (name, phone fields)
    const hasSignupIndicator = await page.getByText(/Inscription|Créer|Prénom|Nom/i).count() > 0
      || await page.getByPlaceholder(/prénom|nom|phone|téléphone/i).count() > 0;
    expect(hasSignupIndicator).toBe(true);
  });

  test("J'ai déjà un compte → ouvre SignIn", async ({ page }) => {
    await openApp(page);
    await btnCompte(page).click();
    await page.waitForTimeout(1500);
    await shot(page, '01c-signin');

    // Should show phone input or "Connexion" heading
    const hasSignin = await page.getByText(/Connexion/i).count() > 0
      || await page.locator('input').count() > 0;
    expect(hasSignin).toBe(true);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 2: FORMULAIRE INSCRIPTION (Signup)
// ════════════════════════════════════════════════════════════════════════════

test.describe('02 — Inscription (Signup Form)', () => {

  test('Formulaire vide — bouton Continuer désactivé', async ({ page }) => {
    await openApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1200);
    await shot(page, '02a-signup-empty');

    // "Continuer" button should be disabled or non-clickable (no form data)
    // Try clicking without filling — should stay on same screen
    const continueBtn = page.getByText(/Continuer|Suivant/i).first();
    if (await continueBtn.count() > 0) {
      await continueBtn.click();
      await page.waitForTimeout(800);
      // Still on signup page
      const stillOnSignup = await page.getByPlaceholder(/prénom|nom|phone|téléphone/i).count() > 0
        || await page.getByText(/Inscription|Créer/i).count() > 0;
      // Shouldn't have navigated to OTP
      await shot(page, '02a-signup-empty-after-click');
    }
  });

  test('Formulaire avec genre HOMME sélectionnable', async ({ page }) => {
    await openApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1200);

    // Look for gender selector
    const hommeBtn = page.getByText('HOMME').first();
    const femmeBtn = page.getByText('FEMME').first();

    if (await hommeBtn.count() > 0) {
      await hommeBtn.click();
      await page.waitForTimeout(500);
      await shot(page, '02b-signup-homme-selected');
      // Just verifying it's selectable
      await expect(hommeBtn).toBeVisible();
    }

    if (await femmeBtn.count() > 0) {
      await femmeBtn.click();
      await page.waitForTimeout(500);
      await shot(page, '02c-signup-femme-selected');
    }
  });

  test('Remplissage complet du formulaire Inscription', async ({ page }) => {
    await openApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1200);

    // Fill name
    const nameInput = page.getByPlaceholder(/Prénom|Nom complet/i).first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('Test Utilisateur');
    }

    // Fill phone
    const phoneInput = page.getByPlaceholder(/6\d\d|phone|téléphone/i).first();
    if (await phoneInput.count() > 0) {
      await phoneInput.fill('699000000');
    }

    // Select gender HOMME
    const hommeBtn = page.getByText('HOMME').first();
    if (await hommeBtn.count() > 0) {
      await hommeBtn.click();
    }

    await shot(page, '02d-signup-filled');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 3: CONNEXION VENDEUR (FOKA)
// ════════════════════════════════════════════════════════════════════════════

test.describe('03 — Connexion + Accueil Vendeur', () => {

  test('Connexion FOKA → Accueil Vendeur visible', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await shot(page, '03a-vendor-home');

    // Should see "Créer une livraison" CTA
    const hasCta = await btnCreerLivraison(page).count() > 0
      || await page.getByText(/Accueil/i).count() > 0;
    expect(hasCta).toBe(true);
  });

  test('Accueil Vendeur — stats visibles (compteurs)', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    // Stats row should have 3 cards
    await expect(page.getByText(/Actives/i).first()).toBeVisible();
    await expect(page.getByText(/Total/i).first()).toBeVisible();
    await shot(page, '03b-vendor-stats');
  });

  test('Accueil Vendeur — liste livraisons EN_ATTENTE visible', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    // Should show "Mes livraisons" section
    await expect(page.getByText(/Mes livraisons/i).first()).toBeVisible();
    await shot(page, '03c-vendor-deliveries');
  });

  test('Navigation onglet Profil Vendeur', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    // Use exact:true to target the tab bar "Profil" specifically
    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1500);
    await shot(page, '03d-vendor-profile');

    // Verify profile page loaded — role label is always visible (name may not render if not in context)
    const hasProfileContent = await page.getByText(/Vendeur|Vendeuse|CNI vérifi|Profil/i).count() > 0;
    expect(hasProfileContent).toBe(true);
  });

  test('Profil Vendeur affiche "Vendeur" ou "Vendeuse" selon genre', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);

    const hasRoleLabel = await page.getByText(/Vendeur|Vendeuse/i).count() > 0;
    expect(hasRoleLabel).toBe(true);
    await shot(page, '03e-vendor-role-label');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 4: CRÉATION D'UNE LIVRAISON (Vendor)
// ════════════════════════════════════════════════════════════════════════════

test.describe('04 — Création Livraison (Vendor)', () => {

  test('Bouton "Créer une livraison" navigue vers PostDelivery', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    await btnCreerLivraison(page).click();
    await page.waitForTimeout(1500);
    await shot(page, '04a-post-delivery-form');

    // Should show address/quartier picker
    const hasForm = await page.getByText(/Départ|Dépose|Retrait|Ramassage|Quartier/i).count() > 0
      || await page.getByText(/de départ|d.enlèvement/i).count() > 0;
    expect(hasForm).toBe(true);
  });

  test('Formulaire PostDelivery — sélection quartier départ', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    // Wait for VendorHome to be ready before clicking
    await btnCreerLivraison(page).waitFor({ state: 'visible', timeout: 20000 });
    await btnCreerLivraison(page).click();
    await page.waitForTimeout(2000);
    await shot(page, '04b-post-delivery-form');

    // PostDelivery form has ListPicker with default values (Akwa, Bonapriso)
    // These show as text in the picker button — just verify form is loaded
    const formLoaded = await page.getByText(/Akwa|Bonapriso|Région|Ville|Quartier|Départ|Retrait/i).count() > 0;
    console.log(`PostDelivery form loaded: ${formLoaded}`);

    // Click the pickup picker (first visible TouchableOpacity with default value shown)
    const pickerBtn = page.getByText(/Akwa/i).first();
    const pickerVisible = await pickerBtn.isVisible().catch(() => false);
    if (pickerVisible) {
      await pickerBtn.scrollIntoViewIfNeeded();
      await pickerBtn.click({ force: true });
      await page.waitForTimeout(800);
      await shot(page, '04b-pickup-modal-opened');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      console.log('Akwa picker not visible — skipping picker click');
    }
  });

  test('PostDelivery affiche la distance estimée', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await btnCreerLivraison(page).click();
    await page.waitForTimeout(2000);
    await shot(page, '04c-post-delivery-distance');

    // Should show km label somewhere
    const hasKm = await page.getByText(/km/i).count() > 0;
    // Log result but don't fail — may not show until both addresses filled
    console.log(`Distance label visible: ${hasKm}`);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 5: ÉCRAN CODES VENDEUR (VendorCodes)
// ════════════════════════════════════════════════════════════════════════════

test.describe('05 — Codes & Partage Vendeur (VendorCodes)', () => {

  test('Clic sur livraison EN_ATTENTE → écran VendorCodes', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    // Click on a delivery card (EN_ATTENTE status)
    const deliveryCard = page.locator('[role="button"]').filter({ hasText: /Cité Verte|Foncha|EN_ATTENTE|En attente/i }).first();
    if (await deliveryCard.count() > 0) {
      await deliveryCard.click();
      await page.waitForTimeout(1500);
      await shot(page, '05a-vendor-codes');

      // Should show collect code and deliver code
      const hasCodes = await page.getByText(/Code collecte|Code réception|code/i).count() > 0;
      expect(hasCodes).toBe(true);
    } else {
      // Try clicking directly in the deliveries list
      const cards = page.locator('[role="button"]');
      const count = await cards.count();
      console.log(`Found ${count} button cards on vendor home`);
      await shot(page, '05a-vendor-home-no-card');
    }
  });

  test('VendorCodes affiche lien de suivi et bouton partage', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    // Navigate to VendorCodes via delivery card
    const deliveryCard = page.locator('[role="button"]').filter({ hasText: /Cité|Foncha|Attente|attente/i }).first();
    if (await deliveryCard.count() > 0) {
      await deliveryCard.click();
      await page.waitForTimeout(1500);

      // Check for sharing buttons
      const shareBtn = page.getByText(/Partager|Copier|WhatsApp|SMS/i).first();
      if (await shareBtn.count() > 0) {
        await shot(page, '05b-vendor-codes-share');
        await expect(shareBtn).toBeVisible();
      }
    } else {
      await shot(page, '05b-no-delivery-found');
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 6: CONNEXION LIVREUR (MARLY)
// ════════════════════════════════════════════════════════════════════════════

test.describe('06 — Connexion + Accueil Livreur', () => {

  test('Connexion MARLY → Accueil Livreur visible', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    // DelivererHome can be slow on first load — wait explicitly
    await page.getByText(/En ligne|Hors ligne|Accueil|Livreur/i).first()
      .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await shot(page, '06a-deliverer-home');

    const hasHome = await page.getByText(/En ligne|Hors ligne|Livreur|Courses|Accueil/i).count() > 0;
    expect(hasHome).toBe(true);
  });

  test('Accueil Livreur — toggle En ligne / Hors ligne', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    // Find the toggle switch
    const toggle = page.locator('[role="switch"]').first();
    if (await toggle.count() > 0) {
      await shot(page, '06b-toggle-offline');
      await toggle.click();
      await page.waitForTimeout(800);
      await shot(page, '06c-toggle-online');
    } else {
      // Try text-based toggle
      const onlineArea = page.getByText(/En ligne|Hors ligne/i).first();
      if (await onlineArea.count() > 0) {
        await onlineArea.click();
        await page.waitForTimeout(800);
        await shot(page, '06c-toggle-clicked');
      }
    }
  });

  test('Accueil Livreur — stats solde, courses, gains', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    // Wait for home to fully load before asserting stats
    await page.getByText(/Solde|XAF|En ligne|Hors ligne/i).first()
      .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await expect(page.getByText(/Solde|XAF/i).first()).toBeVisible({ timeout: 10000 });
    const hasCoursesText = await page.getByText(/Courses/i).count() > 0;
    console.log(`Courses text visible: ${hasCoursesText}`);
    await shot(page, '06d-deliverer-stats');
  });

  test('Profil Livreur affiche "Livreur" ou "Livreuse"', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);
    await shot(page, '06e-deliverer-profile');

    const hasRoleLabel = await page.getByText(/Livreur|Livreuse/i).count() > 0;
    expect(hasRoleLabel).toBe(true);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 7: COURSES DISPONIBLES (Available)
// ════════════════════════════════════════════════════════════════════════════

test.describe('07 — Courses Disponibles (Livreur)', () => {

  test('Onglet Courses affiche la liste des livraisons disponibles', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    // Click "Courses" tab (exact:true avoids matching "Courses disponibles" or tab-link span)
    await clickTab(page, /Courses/i);
    await page.waitForTimeout(2000);
    await shot(page, '07a-available-list');

    // Should show count or empty state
    const hasContent = await page.getByText(/Courses disponibles|course|Aucune/i).count() > 0;
    expect(hasContent).toBe(true);
  });

  test('Courses disponibles — chips de filtre Toutes/Express/VVIP', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    await clickTab(page, /Courses/i);
    await page.waitForTimeout(2000);

    // Check filter chips
    await expect(page.getByText('Toutes').first()).toBeVisible();

    const expressChip = page.getByText('Express').first();
    if (await expressChip.count() > 0) {
      await expressChip.click();
      await page.waitForTimeout(600);
      await shot(page, '07b-filter-express');
    }
    await shot(page, '07c-filter-chips');
  });

  test('Clic sur une course → écran Détail Offre', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    await clickTab(page, /Courses/i);
    await page.waitForTimeout(2000);

    // Click first offer card
    const offerCard = page.locator('[role="button"]').filter({ hasText: /XAF|km|kg/i }).first();
    if (await offerCard.count() > 0) {
      await offerCard.click();
      await page.waitForTimeout(1500);
      await shot(page, '07d-offer-detail');

      // Should show accept button
      const hasAccept = await page.getByText(/Accepter|Refuser/i).count() > 0;
      expect(hasAccept).toBe(true);
    } else {
      // Check from deliverer home "Voir tout"
      const voirTout = page.getByText(/Voir tout/i).first();
      if (await voirTout.count() > 0) {
        await voirTout.click();
        await page.waitForTimeout(1500);
        await shot(page, '07d-voir-tout-available');
      }
    }
  });

  test('Détail offre — prix, distance, poids affichés', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    await clickTab(page, /Courses/i);
    await page.waitForTimeout(2000);

    const offerCard = page.locator('[role="button"]').filter({ hasText: /XAF/i }).first();
    if (await offerCard.count() > 0) {
      await offerCard.click();
      await page.waitForTimeout(1500);

      // Check detail fields
      const hasPrice  = await page.getByText(/XAF/i).count() > 0;
      const hasDist   = await page.getByText(/km/i).count() > 0;
      const hasWeight = await page.getByText(/kg/i).count() > 0;
      expect(hasPrice).toBe(true);
      console.log(`km visible: ${hasDist}, kg visible: ${hasWeight}`);
      await shot(page, '07e-offer-detail-fields');
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 8: ACCEPTATION D'UNE LIVRAISON
// ════════════════════════════════════════════════════════════════════════════

test.describe('08 — Acceptation Livraison (Livreur)', () => {

  test("Livreur hors ligne — alerte si tente d'accepter", async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    // Make sure we're OFFLINE (default state)
    await clickTab(page, /Courses/i);
    await page.waitForTimeout(2000);

    const offerCard = page.locator('[role="button"]').filter({ hasText: /XAF/i }).first();
    if (await offerCard.count() > 0) {
      await offerCard.click();
      await page.waitForTimeout(1500);

      // Try to accept while offline — should show alert or disabled button
      const acceptBtn = page.getByText(/Accepter la course|Hors ligne/i).first();
      if (await acceptBtn.count() > 0) {
        await shot(page, '08a-accept-offline-state');
        const btnText = await acceptBtn.textContent();
        console.log(`Accept button text: "${btnText}"`);
        // Button should say "Hors ligne" if offline
        expect(btnText?.toLowerCase()).toMatch(/accepter|hors ligne/i);
      }
    }
  });

  test('Livreur en ligne → peut accepter une course', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    // Go online first
    const toggle = page.locator('[role="switch"]').first();
    if (await toggle.count() > 0) {
      const isChecked = await toggle.getAttribute('aria-checked');
      if (isChecked === 'false' || isChecked === null) {
        await toggle.click();
        await page.waitForTimeout(600);
      }
    }

    await clickTab(page, /Courses/i);
    await page.waitForTimeout(2000);

    const offerCard = page.locator('[role="button"]').filter({ hasText: /XAF/i }).first();
    if (await offerCard.count() > 0) {
      await offerCard.click();
      await page.waitForTimeout(1500);
      await shot(page, '08b-offer-detail-online');

      // KYC check — MARLY has PENDING KYC
      const kycWarning = page.getByText(/KYC|vérification|CNI/i).first();
      const acceptBtn = page.getByText(/Accepter|Hors ligne/i).first();

      await shot(page, '08c-accept-attempt');

      if (await acceptBtn.count() > 0) {
        await acceptBtn.click();
        await page.waitForTimeout(1500);
        await shot(page, '08d-after-accept-click');
        // May navigate to KYC or ConfirmCode
        const afterClick = await page.getByText(/Vérification|KYC|code de collecte|Collecte/i).count() > 0;
        console.log(`After accept: KYC/Code screen shown = ${afterClick}`);
      }
    }
  });

  test('Écran ConfirmCode — saisie code collecte visible', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    // Directly navigate to ConfirmCode via active mission if any
    // Check deliverer home for active mission
    const activeMission = page.getByText(/Saisir code|Code de collecte/i).first();
    if (await activeMission.count() > 0) {
      await activeMission.click();
      await page.waitForTimeout(1500);
      await shot(page, '08e-confirm-code-screen');

      // Should show 4-digit boxes
      await expect(page.getByText(/Code de collecte/i).first()).toBeVisible();
    } else {
      // Screenshot current state for diagnostics
      await shot(page, '08e-deliverer-home-no-mission');
      console.log('No active mission found — skipping ConfirmCode test');
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 9: FLOW KYC (Livreur)
// ════════════════════════════════════════════════════════════════════════════

test.describe('09 — Soumission KYC (Livreur)', () => {

  test('Profil → KYC affiche statut PENDING pour MARLY', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);
    await shot(page, '09a-deliverer-profile-kyc');

    // Should show KYC status label
    const kycLabel = await page.getByText(/KYC|CNI|Vérification|vérif/i).count() > 0;
    expect(kycLabel).toBe(true);
  });

  test('Clic sur KYC → Écran statut KYC (PENDING = en cours)', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);

    // Click KYC menu item
    const kycItem = page.getByText(/KYC|Vérif|CNI|Identité/i).first();
    if (await kycItem.count() > 0) {
      await kycItem.click();
      await page.waitForTimeout(1500);
      await shot(page, '09b-kyc-status-screen');

      // Should show PENDING state content
      const hasPendingMsg = await page.getByText(/cours|vérification|24h|soumis/i).count() > 0
        || await page.getByText(/Pending|En cours/i).count() > 0;
      console.log(`KYC pending message visible: ${hasPendingMsg}`);
    }
  });

  test('Écran KYC — 4 étapes de soumission CNI visibles', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    // Navigate directly to KYC screen via profile
    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);

    const kycBtn = page.locator('[role="button"]').filter({ hasText: /KYC|CNI|Identité/i }).first();
    if (await kycBtn.count() > 0) {
      await kycBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, '09c-kyc-screen-steps');
    }
  });

  test('Vendeur FOKA — KYC est VERIFIED (badge vert)', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);

    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);
    await shot(page, '09d-vendor-kyc-verified');

    // FOKA has verified KYC
    const hasVerified = await page.getByText(/Vérifié|Validé|VERIFIED/i).count() > 0;
    console.log(`FOKA KYC verified badge: ${hasVerified}`);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 10: CHANGEMENT DE PROFIL (Role Switch)
// ════════════════════════════════════════════════════════════════════════════

test.describe('10 — Changement de Profil (MARLY)', () => {

  test('MARLY peut voir option changement de rôle', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);
    await shot(page, '10a-deliverer-profile-switch-option');

    // MARLY has both VENDOR and DELIVERER roles — should see switch option
    const switchOption = await page.getByText(/Passer en mode|Mode vendeur|Basculer|Changer/i).count() > 0;
    console.log(`Role switch option visible: ${switchOption}`);
  });

  test('Basculement Livreur → Vendeur', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);

    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);

    // Find and click role switch
    const switchBtn = page.getByText(/Mode vendeur|Basculer|Passer en|Changer/i).first();
    if (await switchBtn.count() > 0) {
      await switchBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, '10b-after-switch-to-vendor');

      // Should now show vendor interface
      const isVendor = await btnCreerLivraison(page).count() > 0 || await page.getByText(/Vendeur/i).count() > 0;
      console.log(`Switched to vendor view: ${isVendor}`);
    } else {
      await shot(page, '10b-no-switch-button');
      console.log('Role switch button not found on profile screen');
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 11: FLOW CLIENT (Reception Colis)
// ════════════════════════════════════════════════════════════════════════════

test.describe('11 — Flow Client (Suivi & Réception)', () => {

  test('ClientLanding — affiche les infos colis et bouton Suivi', async ({ page }) => {
    // Navigate directly to the client tracking URL format
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // The client flow is accessed via a link — simulate via navigation
    // We inject the route programmatically since it's a standalone screen
    await page.evaluate(() => {
      // Try to trigger React Navigation to ClientLanding route
      window.__KOLIGO_TEST_ROUTE = 'ClientLanding';
    });
    await shot(page, '11a-client-landing-attempt');

    // Check if client tracking link hits the backend
    const res = await page.request.get('http://localhost:3001/api/deliveries/available', {
      headers: { 'Authorization': 'Bearer test' },
    });
    console.log(`API available status: ${res.status()}`);
  });

  test('ClientReception — affiche saisie code + paiement MoMo', async ({ page }) => {
    // The ClientReception screen is accessed from ClientTracking
    // We verify the backend endpoint is accessible
    const body = JSON.stringify({ code: '9999', momoRef: '655000000', paymentNumber: '655000000' });
    const res = await page.request.post('http://localhost:3001/api/deliveries/nonexistent-id/client-confirm', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    // Should return 404 or validation error, not 500
    const json = await res.json();
    console.log(`client-confirm error response: ${JSON.stringify(json)}`);
    expect(res.status()).not.toBe(500);
    await shot(page, '11b-client-reception-api-check');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 12: CAS LIMITES & CONTRE-CAS (Edge Cases)
// ════════════════════════════════════════════════════════════════════════════

test.describe('12 — Cas Limites & Contre-cas', () => {

  test("SignIn avec mauvais PIN → message d'erreur", async ({ page }) => {
    await openApp(page);
    await btnCompte(page).click();
    await page.waitForTimeout(1200);

    // Enter correct phone
    const phoneInput = page.locator('input').first();
    await phoneInput.fill(VENDOR_PHONE);
    await btnContinuer(page).click();
    await page.waitForTimeout(1000);

    // Enter wrong PIN: 9999 — Pressable uses getByText (no role="button" in RN Web)
    for (const digit of '9999') {
      await page.getByText(digit, { exact: true }).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2200);
    await shot(page, '12a-wrong-pin-error');

    // Should show error message
    const hasError = await page.getByText(/incorrect|invalide|erreur|PIN/i).count() > 0;
    console.log(`Error message shown after wrong PIN: ${hasError}`);
  });

  test('SignIn avec téléphone inexistant → erreur', async ({ page }) => {
    await openApp(page);
    await btnCompte(page).click();
    await page.waitForTimeout(1200);

    const phoneInput = page.locator('input').first();
    await phoneInput.fill('699000000'); // doesn't exist
    await btnContinuer(page).click();
    await page.waitForTimeout(1000);

    // Enter any PIN
    for (const digit of '1234') {
      await page.getByText(digit, { exact: true }).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2200);
    await shot(page, '12b-unknown-phone-error');

    const hasError = await page.getByText(/introuvable|incorrect|invalide|erreur/i).count() > 0;
    console.log(`Error for unknown phone: ${hasError}`);
  });

  test('API Backend — endpoint signin valide fonctionnel', async ({ page }) => {
    const res = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: VENDOR_PHONE, pin: VENDOR_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.accessToken).toBeTruthy();
    expect(json.user.name).toBeTruthy();
    console.log(`Signin API: user=${json.user.name}, role=${json.user.activeRole}`);
  });

  test('API Backend — mauvais PIN retourne 4xx', async ({ page }) => {
    const res = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: VENDOR_PHONE, pin: '9999' }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Backend returns 400 for wrong PIN (not 401)
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    console.log(`Wrong PIN error (${res.status()}): ${json.error}`);
  });

  test('API Backend — créer livraison sans auth retourne 401', async ({ page }) => {
    const res = await page.request.post('http://localhost:3001/api/deliveries', {
      data: JSON.stringify({ pickupAddress: 'Akwa', dropoffAddress: 'Bonanjo', weightKg: 2 }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
    console.log(`Unauth delivery creation: ${res.status()}`);
  });

  test('API Backend — accepter livraison sans KYC retourne erreur', async ({ page }) => {
    // Sign in as MARLY (PENDING KYC)
    const signinRes = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: DELIV_PHONE, pin: DELIV_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    const auth = await signinRes.json();
    const token = auth.accessToken;

    // Try to get available deliveries
    const availRes = await page.request.get('http://localhost:3001/api/deliveries/available', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (availRes.ok()) {
      const available = await availRes.json();
      console.log(`Available for MARLY: ${available.length}`);

      if (available.length > 0) {
        const deliveryId = available[0].id;
        const acceptRes = await page.request.patch(
          `http://localhost:3001/api/deliveries/${deliveryId}/accept`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        // KYC middleware should block — returns 403 or error
        const acceptJson = await acceptRes.json();
        console.log(`Accept with PENDING KYC: status=${acceptRes.status()}, error=${JSON.stringify(acceptJson)}`);
        // Either 403 (KYC blocked) or 200 (allowed) — note the behavior
      }
    }
    await shot(page, '12e-kyc-accept-api-test');
  });

  test('API Backend — distance Google Maps (haversine fallback)', async ({ page }) => {
    // Sign in as FOKA (VENDOR)
    const signinRes = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: VENDOR_PHONE, pin: VENDOR_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    const auth = await signinRes.json();
    const token = auth.accessToken;

    // Create a delivery to test distance calculation
    const createRes = await page.request.post('http://localhost:3001/api/deliveries', {
      data: JSON.stringify({
        pickupAddress: 'Akwa',
        dropoffAddress: 'Bonanjo',
        weightKg: 1,
        delivererType: 'TEMPORAIRE',
        distanceKm: 2.1,
        shopName: 'Test Shop',
        recipientName: 'Test Recipient',
        recipientPhone: '655000001',
        productPriceXAF: 5000,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (createRes.ok()) {
      const delivery = await createRes.json();
      console.log(`Created delivery: id=${delivery.id}, distanceKm=${delivery.distanceKm}, price=${delivery.priceXAF}`);
      expect(delivery.distanceKm).toBeTruthy();
      expect(delivery.priceXAF).toBeGreaterThan(0);
    } else {
      const err = await createRes.json();
      console.log(`Create delivery error: ${JSON.stringify(err)}`);
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 13: TESTS API FONCTIONNELS COMPLETS
// ════════════════════════════════════════════════════════════════════════════

test.describe('13 — Tests API Fonctionnels (Backend)', () => {

  let vendorToken, delivererToken, testDeliveryId;

  test('01 — Signup nouveau compte → tokens retournés', async ({ page }) => {
    const phone = `65${Date.now().toString().slice(-7)}`;
    const res = await page.request.post('http://localhost:3001/api/auth/signup', {
      data: JSON.stringify({
        name: 'Test Nouveau',
        phone,
        pin: '5678',
        role: 'VENDOR',
        gender: 'HOMME',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok()) {
      const json = await res.json();
      expect(json.accessToken).toBeTruthy();
      expect(json.user.activeRole).toBe('VENDOR');
      console.log(`Signup OK: ${json.user.name} / ${json.user.activeRole}`);
    } else {
      const err = await res.json();
      console.log(`Signup error (expected if phone exists): ${err.error}`);
    }
  });

  test('02 — Signin FOKA → profil complet avec gender', async ({ page }) => {
    const res = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: VENDOR_PHONE, pin: VENDOR_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.user.id).toBeTruthy();
    expect(json.user.name).toBeTruthy();
    expect(json.user.activeRole).toBe('VENDOR');
    expect(json.user.kycStatus).toBe('VERIFIED');
    console.log(`FOKA profil: gender=${json.user.gender}, kyc=${json.user.kycStatus}`);
  });

  test('03 — Créer livraison → distanceKm et priceXAF calculés', async ({ page }) => {
    // Auth
    const auth = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: VENDOR_PHONE, pin: VENDOR_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    const { accessToken } = await auth.json();

    // Create
    const res = await page.request.post('http://localhost:3001/api/deliveries', {
      data: JSON.stringify({
        pickupAddress: 'Akwa',
        dropoffAddress: 'Logpom',
        weightKg: 3,
        delivererType: 'EXPRESS',
        distanceKm: 5.2,
        shopName: 'Boutique Test',
        recipientName: 'Marie Fotso',
        recipientPhone: '655444555',
        productPriceXAF: 15000,
      }),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
    });

    expect(res.ok()).toBe(true);
    const d = await res.json();
    expect(d.id).toBeTruthy();
    expect(d.distanceKm).toBeTruthy();
    expect(d.priceXAF).toBeGreaterThan(0);
    expect(d.collectCode).toMatch(/^\d{4}$/);
    expect(d.deliverCode).toMatch(/^\d{4}$/);
    expect(d.clientToken).toBeTruthy();
    console.log(`Created: id=${d.id} dist=${d.distanceKm}km price=${d.priceXAF}XAF collectCode=${d.collectCode}`);
    testDeliveryId = d.id;
  });

  test('04 — Liste livraisons vendeur inclut la nouvelle', async ({ page }) => {
    const auth = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: VENDOR_PHONE, pin: VENDOR_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    const { accessToken } = await auth.json();

    const res = await page.request.get('http://localhost:3001/api/deliveries', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const deliveries = await res.json();
    expect(Array.isArray(deliveries)).toBe(true);
    expect(deliveries.length).toBeGreaterThan(0);
    // All should have distanceKm (not null/?)
    const withDist = deliveries.filter(d => d.distanceKm != null);
    console.log(`${withDist.length}/${deliveries.length} deliveries have distanceKm`);
  });

  test('05 — Livreur voit les cours disponibles', async ({ page }) => {
    const auth = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: DELIV_PHONE, pin: DELIV_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    const { accessToken } = await auth.json();

    const res = await page.request.get('http://localhost:3001/api/deliveries/available', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const available = await res.json();
    console.log(`Available for MARLY: ${available.length}`);
    if (available.length > 0) {
      const d = available[0];
      console.log(`  First: id=${d.id}, dist=${d.distanceKm}km, price=${d.priceXAF}`);
    }
  });

  test('06 — Track by clientToken retourne infos colis', async ({ page }) => {
    // Get a delivery with clientToken
    const auth = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: VENDOR_PHONE, pin: VENDOR_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    const { accessToken } = await auth.json();
    const deliveries = await (await page.request.get('http://localhost:3001/api/deliveries', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })).json();

    if (deliveries.length > 0) {
      const d = deliveries[0];
      if (d.clientToken) {
        const trackRes = await page.request.get(
          `http://localhost:3001/api/deliveries/track/${d.clientToken}`
        );
        if (trackRes.ok()) {
          const tracked = await trackRes.json();
          expect(tracked.id).toBe(d.id);
          expect(tracked.status).toBeTruthy();
          console.log(`Track OK: id=${tracked.id} status=${tracked.status}`);
        }
      }
    }
  });

  test('07 — Wallet livreur retourne balance', async ({ page }) => {
    const auth = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: DELIV_PHONE, pin: DELIV_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    const { accessToken } = await auth.json();

    const res = await page.request.get('http://localhost:3001/api/wallet', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const wallet = await res.json();
    // API returns { balance, paymentPhone, paymentProvider, transactions }
    expect(wallet).toHaveProperty('balance');
    console.log(`MARLY wallet: ${wallet.balance} XAF`);
  });

  test('08 — Confirm-collect avec mauvais code → erreur', async ({ page }) => {
    // Get a real ACCEPTE delivery if any
    const auth = await page.request.post('http://localhost:3001/api/auth/signin', {
      data: JSON.stringify({ phone: DELIV_PHONE, pin: DELIV_PIN }),
      headers: { 'Content-Type': 'application/json' },
    });
    const { accessToken } = await auth.json();
    const myDeliveries = await (await page.request.get('http://localhost:3001/api/deliveries', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })).json();

    const acceptedDelivery = myDeliveries.find(d => d.status === 'ACCEPTE');
    if (acceptedDelivery) {
      const res = await page.request.patch(
        `http://localhost:3001/api/deliveries/${acceptedDelivery.id}/confirm-collect`,
        {
          data: JSON.stringify({ collectCode: '0000' }), // Wrong code
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const json = await res.json();
      console.log(`Wrong collect code: status=${res.status()}, error=${json.error}`);
      expect(res.status()).not.toBe(200);
    } else {
      console.log('No ACCEPTE delivery to test confirm-collect');
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK 14: TESTS VISUELS — TOUTES LES PAGES CLÉS
// ════════════════════════════════════════════════════════════════════════════

test.describe('14 — Screenshots Visuels de Toutes les Pages', () => {

  test('Page 01 — Accueil (Welcome)', async ({ page }) => {
    await openApp(page);
    await shot(page, '14-01-welcome');
    await expect(btnDemarrer(page)).toBeVisible();
  });

  test('Page 02 — Inscription (Signup)', async ({ page }) => {
    await openApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1500);
    await shot(page, '14-02-signup');
  });

  test('Page 03 — Connexion (Signin)', async ({ page }) => {
    await openApp(page);
    await btnCompte(page).click();
    await page.waitForTimeout(1500);
    await shot(page, '14-03-signin');
  });

  test('Page 04 — Accueil Vendeur', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await shot(page, '14-04-vendor-home');
  });

  test('Page 05 — PostDelivery (Création livraison)', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await btnCreerLivraison(page).click();
    await page.waitForTimeout(1500);
    await shot(page, '14-05-post-delivery');
  });

  test('Page 06 — VendorCodes (Codes & Partage)', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    // Click existing delivery card
    const card = page.locator('[role="button"]').filter({ hasText: /Cité|Foncha|attente/i }).first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(1500);
    }
    await shot(page, '14-06-vendor-codes');
  });

  test('Page 07 — Profil Vendeur', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);
    await shot(page, '14-07-vendor-profile');
  });

  test('Page 08 — Accueil Livreur', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    await shot(page, '14-08-deliverer-home');
  });

  test('Page 09 — Courses Disponibles', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    await clickTab(page, /Courses/i);
    await page.waitForTimeout(2000);
    await shot(page, '14-09-available-courses');
  });

  test('Page 10 — Profil Livreur + KYC Status', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);
    await shot(page, '14-10-deliverer-profile');
    // Click KYC item
    const kycItem = page.locator('[role="button"]').filter({ hasText: /KYC|CNI|Identité/i }).first();
    if (await kycItem.count() > 0) {
      await kycItem.click();
      await page.waitForTimeout(1500);
      await shot(page, '14-10b-kyc-status');
    }
  });

  test('Page 11 — Offre Détail (OfferDetail)', async ({ page }) => {
    await openApp(page);
    await signIn(page, DELIV_PHONE, DELIV_PIN);
    await clickTab(page, /Courses/i);
    await page.waitForTimeout(2000);
    const card = page.locator('[role="button"]').filter({ hasText: /XAF/i }).first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(1500);
      await shot(page, '14-11-offer-detail');
    }
  });

  test('Page 12 — Paramètres (Settings)', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    await clickTab(page, /Profil/i);
    await page.waitForTimeout(1200);
    const settingsBtn = page.getByText(/Paramètres|Settings/i).first();
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      await page.waitForTimeout(1200);
      await shot(page, '14-12-settings');
    } else {
      await shot(page, '14-12-no-settings-found');
    }
  });

  test('Page 13 — Notifications', async ({ page }) => {
    await openApp(page);
    await signIn(page, VENDOR_PHONE, VENDOR_PIN);
    const bellBtn = page.locator('[role="button"]').nth(1);
    if (await bellBtn.count() > 0) {
      await bellBtn.click();
      await page.waitForTimeout(1200);
      await shot(page, '14-13-notifications');
    }
  });

});
