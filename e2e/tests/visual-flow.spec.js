const { test, expect } = require('@playwright/test');

// Helper to wait for page and app to be ready
async function gotoApp(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

// NFD-safe helpers (RN Web uses NFD Unicode, Playwright uses NFC for getByText)
function btnDemarrer(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'marrer' }).first();
}
function btnCompte(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'compte' }).first();
}
function btnContinuer(page) {
  return page.locator('[tabindex="0"]').filter({ hasText: 'ontinuer' }).first();
}

test.describe('KoliGo — Visual Flow (All Screens)', () => {

  test('01 — Welcome (Landing)', async ({ page }) => {
    await gotoApp(page);
    await page.screenshot({ path: 'screenshots/01-welcome.png', fullPage: false });
  });

  test('02 — Navigate to Signup', async ({ page }) => {
    await gotoApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/02-signup.png', fullPage: false });
  });

  test('03 — Signup → Continue to OTP', async ({ page }) => {
    await gotoApp(page);
    await btnDemarrer(page).click();
    await page.waitForTimeout(1000);
    const phoneInput = page.locator('input').first();
    if (await phoneInput.count() > 0) {
      await phoneInput.fill('+237691234567');
      const continueBtn = btnContinuer(page);
      if (await continueBtn.count() > 0) {
        await continueBtn.click();
        await page.waitForTimeout(1500);
      }
    }
    await page.screenshot({ path: 'screenshots/03-otp.png', fullPage: false });
  });

  test('04 — Go back to Welcome via Back/Skip', async ({ page }) => {
    await gotoApp(page);
    const backBtn = page.locator('[tabindex="0"]').filter({ hasText: /Retour|Back/i }).first();
    if (await backBtn.count() > 0) {
      await backBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: 'screenshots/04-back-to-welcome.png', fullPage: false });
  });

  test('05 — Click "J\'ai déjà un compte" → SignIn', async ({ page }) => {
    await gotoApp(page);
    await btnCompte(page).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/05-signin.png', fullPage: false });
  });

  test('06 — SignIn (Numpad Input)', async ({ page }) => {
    await gotoApp(page);
    await btnCompte(page).click();
    await page.waitForTimeout(1000);
    const numpadBtn = page.getByText('1', { exact: true }).first();
    if (await numpadBtn.count() > 0) {
      await numpadBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'screenshots/06-signin-numpad.png', fullPage: false });
  });

});

test.describe('KoliGo — Component Showcase', () => {

  test('50 — Full Page (scrollable view)', async ({ page }) => {
    await gotoApp(page);
    // Try to scroll down on Welcome if there's a scrollable area
    await page.evaluate(() => window.scrollBy(0, 100));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/50-scrolled-view.png', fullPage: false });
  });

});
