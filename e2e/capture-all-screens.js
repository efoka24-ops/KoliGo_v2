#!/usr/bin/env node
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots-small');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Screenshot helper that also saves as base64 for HTML
async function captureScreen(page, name, description = '') {
  console.log(`\n📸 Capturing: ${name}...`);

  const pngPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: pngPath, maxHeight: 1500 }); // Limit height

  const data = fs.readFileSync(pngPath);
  const base64 = data.toString('base64');

  console.log(`✓ ${name} captured (${(data.length / 1024).toFixed(1)}KB)`);

  return { name, base64, description, file: `${name}.png` };
}

// Wait for page to be ready
async function gotoApp(page) {
  await page.goto('http://localhost:8085', { waitUntil: 'commit', timeout: 60000 });
  await page.waitForTimeout(3000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const screenshots = [];

  try {
    // 1. Welcome
    await gotoApp(page);
    screenshots.push(await captureScreen(page, '01-welcome', 'Landing: Ton colis, livré go-go'));

    // 2. Signup (click "Démarrer")
    const startBtn = page.getByText('Démarrer');
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(1500);
      screenshots.push(await captureScreen(page, '02-signup', 'Écran d\'inscription'));
    }

    // 3. Back to Welcome
    await gotoApp(page);
    await page.waitForTimeout(500);
    screenshots.push(await captureScreen(page, '03-welcome-fresh', 'Welcome rechargée'));

    // 4. Try SignIn - scroll down first to see the link
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(800);
    const signinLink = page.getByText(/J'ai déjà un compte/i);
    if (await signinLink.count() > 0 && await signinLink.isVisible()) {
      await signinLink.click();
      await page.waitForTimeout(1500);
      screenshots.push(await captureScreen(page, '04-signin', 'Écran PIN pour connexion'));
    }

    // 5. Try numpad
    const numBtn = page.getByRole('button').filter({ hasText: /^1$/ });
    if (await numBtn.count() > 0 && await numBtn.isVisible()) {
      await numBtn.click();
      await page.waitForTimeout(500);
      screenshots.push(await captureScreen(page, '05-signin-numpad', 'Numpad en action'));
    }

  } catch (err) {
    console.error('Error during navigation:', err.message);
  } finally {
    await browser.close();
  }

  // Generate HTML report with base64 images
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KoliGo V2 — Visual Flow (Live Capture)</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      background: linear-gradient(135deg, #F4F5F1, #E7F2EA);
    }
    h1 {
      color: #0E2A1C;
      text-align: center;
      margin-bottom: 10px;
    }
    .header {
      text-align: center;
      background: white;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .status {
      display: inline-block;
      background: #E7F2EA;
      padding: 12px 24px;
      border-radius: 24px;
      color: #0E2A1C;
      font-weight: 600;
    }
    .screens-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 24px;
    }
    .screen-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .screen-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    .screen-image {
      width: 100%;
      height: auto;
      display: block;
      background: #f5f5f5;
    }
    .screen-info {
      padding: 16px;
    }
    .screen-title {
      font-size: 16px;
      font-weight: 700;
      color: #0E2A1C;
      margin-bottom: 8px;
    }
    .screen-desc {
      font-size: 14px;
      color: #666;
      line-height: 1.5;
    }
    footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚚 KoliGo V2 — Capture Visuelle Complète</h1>
    <div class="status">✅ ${screenshots.length} écrans capturés en direct</div>
  </div>

  <div class="screens-grid">
    ${screenshots.map(s => `
    <div class="screen-card">
      <img src="data:image/png;base64,${s.base64}" alt="${s.name}" class="screen-image">
      <div class="screen-info">
        <div class="screen-title">${s.name}</div>
        <div class="screen-desc">${s.description}</div>
      </div>
    </div>
    `).join('')}
  </div>

  <footer>
    Navigateur: Chromium Mobile (iPhone 14 Pro, 390×844) | ${new Date().toLocaleString('fr-FR')}
  </footer>
</body>
</html>`;

  const reportPath = path.join(__dirname, 'visual-report.html');
  fs.writeFileSync(reportPath, html);

  console.log(`\n✅ Rapport généré: ${reportPath}`);
  console.log(`📸 Screenshots capturés: ${screenshots.length}`);
  console.log(`\nPour voir les images:`);
  console.log(`  open ${reportPath}        (macOS)`);
  console.log(`  xdg-open ${reportPath}    (Linux)`);
  console.log(`  start ${reportPath}       (Windows)`);
}

main().catch(console.error);
