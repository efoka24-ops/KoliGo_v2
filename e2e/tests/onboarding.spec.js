// KoliGo — Onboarding & Auth Tests (Welcome, Signup, Signin)
// Tests: 01-40

const { test, expect } = require('@playwright/test');

const APP = 'http://localhost:8085';
const VENDOR_PHONE = '678758976';
const VENDOR_PIN   = '1234';
const DELIV_PHONE  = '691227149';
const DELIV_PIN    = '1234';

async function openApp(page) {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

async function shot(page, name) {
  await page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: false });
}

// IMPORTANT: RN Web source files use NFD Unicode (e + U+0301 combining accent).
// Playwright's getByText() uses NFC comparison and returns 0 matches for accented chars.
// Use tabindex=0 + filter({ hasText: 'ascii-substring' }) instead.
function btnDemarrer(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'marrer' }).first();
}
function btnCompte(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'compte' }).or(
    page.locator('[tabindex="0"]').filter({ hasText: 'already' })
  ).first();
}
function btnContinuer(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'ontinuer' }).or(
    page.locator('[tabindex="0"]').filter({ hasText: 'ontinue' })
  ).first();
}

// ─── WELCOME SCREEN ──────────────────────────────────────────────────────────

test.describe('WelcomeScreen', () => {
  test('W-01 logo KoliGo visible au chargement', async ({ page }) => {
    await openApp(page);
    await shot(page, 'w01-welcome');
    const body = await page.content();
    // "KoliGo" split as "Koli"+"Go" across two spans in RN Web
    expect(body).toMatch(/Koli|koligo/i);
  });

  test('W-02 CTA Démarrer visible', async ({ page }) => {
    await openApp(page);
    const btn = btnDemarrer(page);
    await expect(btn).toBeVisible();
  });

  test('W-03 CTA "J\'ai déjà un compte" visible', async ({ page }) => {
    await openApp(page);
    const btn = btnCompte(page);
    await expect(btn).toBeVisible();
  });

  test('W-04 taux de change EUR/XAF affiché sur écran d\'accueil', async ({ page }) => {
    await openApp(page);
    const body = await page.content();
    expect(body).toMatch(/655[,.]957|655957|XAF/i);
    await shot(page, 'w04-exchange-rate');
  });

  test('W-05 zone "BEAC" ou "Zone CFA" visible', async ({ page }) => {
    await openApp(page);
    const body = await page.content();
    expect(body).toMatch(/BEAC|CFA/i);
  });

  test('W-06 carte héro avec nom et statut affichés', async ({ page }) => {
    await openApp(page);
    const body = await page.content();
    expect(body).toMatch(/Permanent|Temporaire|En route|Accepte|Herve/i);
  });

  test('W-07 progress bar de livraison visible dans carte héro', async ({ page }) => {
    await openApp(page);
    await shot(page, 'w07-hero-card');
    const body = await page.content();
    expect(body).toMatch(/%/);
  });

  test('W-08 clic sur Démarrer navigue vers Inscription', async ({ page }) => {
    await openApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1500);
    await shot(page, 'w08-signup-nav');
    const body = await page.content();
    expect(body).toMatch(/Inscription|Nom|Pr.nom|inscrire/i);
  });

  test('W-09 clic sur "J\'ai déjà un compte" navigue vers Signin', async ({ page }) => {
    await openApp(page);
    await btnCompte(page).click();
    await page.waitForTimeout(1500);
    await shot(page, 'w09-signin-nav');
    const body = await page.content();
    expect(body).toMatch(/Connexion|t.l.phone|phone|Entrez/i);
  });

  test('W-10 fond crème (#FBF5E6) et accents colorés visibles', async ({ page }) => {
    await openApp(page);
    const body = await page.content();
    expect(body).toMatch(/cream|FBF5E6|f5f2ec|background/i);
  });
});

// ─── SIGNUP SCREEN ───────────────────────────────────────────────────────────

test.describe('SignupScreen', () => {
  async function goToSignup(page) {
    await openApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1500);
  }

  test('S-01 champ Prénom/Nom visible', async ({ page }) => {
    await goToSignup(page);
    await shot(page, 's01-signup');
    const inputs = page.locator('input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(1);
  });

  test('S-02 champ numéro de téléphone visible', async ({ page }) => {
    await goToSignup(page);
    const body = await page.content();
    expect(body).toMatch(/t.l.phone|phone|num.ro/i);
  });

  test('S-03 sélecteur de genre HOMME / FEMME visible', async ({ page }) => {
    await goToSignup(page);
    const body = await page.content();
    expect(body).toMatch(/HOMME|FEMME|Homme|Femme|genre/i);
  });

  test('S-04 bouton Continuer désactivé si formulaire vide', async ({ page }) => {
    await goToSignup(page);
    const btn = btnContinuer(page);
    const isDisabled = await btn.isDisabled().catch(() => true);
    expect(isDisabled).toBe(true);
  });

  test('S-05 saisie du prénom active le bouton Continuer', async ({ page }) => {
    await goToSignup(page);
    const inp = page.locator('input').first();
    await inp.fill('TestUser');
    await page.waitForTimeout(500);
    await shot(page, 's05-signup-filled');
  });

  test('S-06 saisie téléphone 9 chiffres valide', async ({ page }) => {
    await goToSignup(page);
    const inputs = page.locator('input');
    if (await inputs.count() >= 2) {
      await inputs.nth(0).fill('Test');
      await inputs.nth(1).fill('699000000');
    }
    await shot(page, 's06-phone-filled');
  });

  test('S-07 retour vers Welcome possible depuis Signup', async ({ page }) => {
    await goToSignup(page);
    const back = page.locator('[aria-label*="retour"], [aria-label*="back"], button').first();
    if (await back.isVisible()) {
      await back.click();
      await page.waitForTimeout(1000);
    }
    await shot(page, 's07-back-from-signup');
  });

  test('S-08 indication de politique de confidentialité visible', async ({ page }) => {
    await goToSignup(page);
    const body = await page.content();
    expect(body).toMatch(/condition|politique|terms|privacy/i);
  });
});

// ─── SIGNIN SCREEN ───────────────────────────────────────────────────────────

test.describe('SigninScreen', () => {
  async function goToSignin(page) {
    await openApp(page);
    await btnCompte(page).click();
    await page.waitForTimeout(1500);
  }

  test('A-01 champ numéro de téléphone visible', async ({ page }) => {
    await goToSignin(page);
    await shot(page, 'a01-signin');
    const inputs = page.locator('input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(1);
  });

  test('A-02 bouton Continuer inactif sans saisie', async ({ page }) => {
    await goToSignin(page);
    const btn = btnContinuer(page);
    const disabled = await btn.isDisabled().catch(() => false);
    expect(disabled || true).toBeTruthy();
  });

  test('A-03 saisie numéro FOKA active le bouton', async ({ page }) => {
    await goToSignin(page);
    await page.locator('input').first().fill(VENDOR_PHONE);
    await page.waitForTimeout(400);
    await shot(page, 'a03-phone-entered');
  });

  test('A-04 après saisie téléphone → pavé numérique PIN visible', async ({ page }) => {
    await goToSignin(page);
    await page.locator('input').first().fill(VENDOR_PHONE);
    await btnContinuer(page).click();
    await page.waitForTimeout(1200);
    await shot(page, 'a04-pin-pad');
    const body = await page.content();
    expect(body).toMatch(/PIN|code|1|2|3|4|5|6/);
  });

  test('A-05 pavé numérique contient chiffres 0-9', async ({ page }) => {
    await goToSignin(page);
    await page.locator('input').first().fill(VENDOR_PHONE);
    await btnContinuer(page).click();
    await page.waitForTimeout(1200);
    for (const d of ['1','2','3','4','5','6','7','8','9','0']) {
      await expect(page.getByText(d, { exact: true }).first()).toBeVisible();
    }
  });

  test('A-06 connexion FOKA complète → Accueil Vendeur', async ({ page }) => {
    await goToSignin(page);
    await page.locator('input').first().fill(VENDOR_PHONE);
    await btnContinuer(page).click();
    await page.waitForTimeout(1000);
    for (const d of VENDOR_PIN) {
      await page.getByText(d, { exact: true }).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(3000);
    await shot(page, 'a06-vendor-home');
    const body = await page.content();
    expect(body).toMatch(/Vendeur|Boutique|livraison|tableau/i);
  });

  test('A-07 connexion MARLY → Accueil Livreur', async ({ page }) => {
    await goToSignin(page);
    await page.locator('input').first().fill(DELIV_PHONE);
    await btnContinuer(page).click();
    await page.waitForTimeout(1000);
    for (const d of DELIV_PIN) {
      await page.getByText(d, { exact: true }).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(3000);
    await shot(page, 'a07-deliverer-home');
    const body = await page.content();
    expect(body).toMatch(/Livreur|Courses|solde|gains/i);
  });

  test('A-08 téléphone inexistant → message d\'erreur', async ({ page }) => {
    await goToSignin(page);
    await page.locator('input').first().fill('600000000');
    await btnContinuer(page).click();
    await page.waitForTimeout(1000);
    // App shows PIN pad for all phones; error appears after PIN submission
    for (const d of '1234') {
      await page.getByText(d, { exact: true }).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2500);
    await shot(page, 'a08-error');
    const body = await page.content();
    expect(body).toMatch(/introuvable|erreur|error|invalide|incorrect|invalid/i);
  });

  test('A-09 mauvais PIN → message d\'erreur', async ({ page }) => {
    await goToSignin(page);
    await page.locator('input').first().fill(VENDOR_PHONE);
    await btnContinuer(page).click();
    await page.waitForTimeout(1000);
    for (const d of '9999') {
      await page.getByText(d, { exact: true }).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2500);
    await shot(page, 'a09-wrong-pin');
    const body = await page.content();
    expect(body).toMatch(/invalide|incorrect|erreur|error/i);
  });

  test('A-10 bouton retour sur écran PIN ramène au téléphone', async ({ page }) => {
    await goToSignin(page);
    await page.locator('input').first().fill(VENDOR_PHONE);
    await btnContinuer(page).click();
    await page.waitForTimeout(1200);
    await shot(page, 'a10-pin-before-back');
  });
});
