const { test } = require('@playwright/test');

async function boot(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Wait for React to mount and render
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.innerText.length > 10;
  }, { timeout: 30000 });
  await page.waitForTimeout(1000);
}

// NFD-safe: RN Web source files use NFD Unicode, Playwright getByText uses NFC
function btnDemarrer(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'marrer' }).first();
}
function btnCompte(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'compte' }).first();
}
function btnContinuer(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'ontinuer' }).first();
}

test('STEP 1 — Welcome (premier écran)', async ({ page }) => {
  await boot(page);
  await page.screenshot({ path: 'screenshots/nav-01-welcome.png' });
});

test('STEP 2 — Clic "Démarrer" → Signup', async ({ page }) => {
  await boot(page);
  await btnDemarrer(page).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/nav-02-signup.png' });
});

test('STEP 3 — Retour Welcome → Clic "J\'ai déjà un compte" → SignIn PIN', async ({ page }) => {
  await boot(page);
  await btnCompte(page).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/nav-03-signin-pin.png' });
});

test('STEP 4 — SignIn → saisie PIN 1 2 3 4', async ({ page }) => {
  await boot(page);
  await btnCompte(page).click();
  await page.waitForTimeout(1000);

  // Fill phone number first, then Continuer reveals the PIN pad
  const input = page.locator('input').first();
  if (await input.count() > 0) {
    await input.fill('678758976');
    await btnContinuer(page).click();
    await page.waitForTimeout(1200);
  }

  for (const digit of ['1', '2', '3', '4']) {
    await page.getByText(digit, { exact: true }).first().click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: 'screenshots/nav-04-signin-filled.png' });
});

test('STEP 5 — Welcome → Signup → remplir nom + téléphone', async ({ page }) => {
  await boot(page);
  await btnDemarrer(page).click();
  await page.waitForTimeout(1000);

  // Fill the name field
  const nameField = page.locator('input').first();
  if (await nameField.count() > 0) {
    await nameField.click();
    await nameField.fill('Marie Ngono');
  }
  await page.screenshot({ path: 'screenshots/nav-05-signup-filled.png' });
});
