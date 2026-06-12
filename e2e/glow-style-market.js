#!/usr/bin/env node
/**
 * KoliGo V2 — Parcours visuel : Marly Yaya / Glow Style Market
 *
 * Connexion:  698892174 / 1234  (EMMANUEL MARLY — vendeur)
 * Boutique:   Glow Style Market
 * Colis:      Ordinateur portable — 450 000 FCFA
 * Départ:     Douala, Bépanda  (région Littoral)
 * Arrivée:    Garoua, Administratif  (région Nord — "Plateau" n'existe pas, Administratif = centre-ville)
 */
'use strict';
const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const APP   = 'http://localhost:8085';
const SHOTS = path.join(__dirname, 'screenshots-glow');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const VENDOR_PHONE = '698892174';
const VENDOR_PIN   = '1234';

let idx = 0;
const log = (msg) => console.log(msg);

async function shot(page, slug, desc = '') {
  const name = `${String(++idx).padStart(2,'0')}-${slug}`;
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  log(`  📸 [${name}] ${desc}`);
  return file;
}

async function w(page, ms = 900) { await page.waitForTimeout(ms); }

async function numpad(page, digits) {
  for (const d of String(digits)) {
    const btn = page.locator(`[role="button"]:has-text("${d}"), button:has-text("${d}")`).first();
    const fb  = page.locator(`text="${d}"`).first();
    const tgt = (await btn.isVisible().catch(() => false)) ? btn : fb;
    await tgt.click({ force: false }).catch(() => {});
    await page.waitForTimeout(350);
  }
}

// ── Ouvre un ListPicker identifié par son label et choisit une valeur ───────
async function pickItem(page, labelSubstring, itemText, maxWait = 8000) {
  log(`    → Picker "${labelSubstring}" → "${itemText}"`);

  // Trouver le bouton [role="button"] le plus proche du label
  const labelLocator = page.locator(`text="${labelSubstring}"`).first();
  await labelLocator.waitFor({ state: 'visible', timeout: maxWait }).catch(() => {});

  // Le bouton picker est le sibling suivant (container View → bouton)
  // On cherche via JavaScript DOM pour plus de robustesse
  await page.evaluate(({ label }) => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (el.textContent === label && el.children.length === 0) {
        // Remonter au parent et trouver le [role="button"] sibling
        let parent = el.parentElement;
        for (let i = 0; i < 4 && parent; i++) {
          const btn = parent.querySelector('[role="button"], [tabindex="0"]:not(input)');
          if (btn && btn !== el.parentElement) { btn.click(); return true; }
          parent = parent.parentElement;
        }
      }
    }
    return false;
  }, { label: labelSubstring }).catch(() => {});

  await w(page, 600);

  // Si la modal ne s'est pas ouverte via JS, essayer via Playwright click
  const isModalOpen = await page.getByText(itemText).isVisible().catch(() => false);
  if (!isModalOpen) {
    // Chercher un bouton avec le texte "—" ou la valeur actuelle à côté du label
    const parent = page.locator(`text="${labelSubstring}"`).locator('..').locator('[role="button"]').first();
    if (await parent.isVisible().catch(() => false)) {
      await parent.click();
      await w(page, 600);
    }
  }

  // Cliquer sur l'item dans la liste modale
  const itemLoc = page.getByText(itemText, { exact: true }).last();
  if (await itemLoc.isVisible().catch(() => false)) {
    await itemLoc.click();
    await w(page, 400);
    log(`    ✅ "${itemText}" sélectionné`);
  } else {
    // Scroll vers le bas dans la modal et réessayer
    await page.evaluate(({ item }) => {
      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all) {
        if (el.textContent.trim() === item && el.tagName !== 'SCRIPT') {
          el.click();
          return true;
        }
      }
    }, { item: itemText }).catch(() => {});
    log(`    ⚠️  item "${itemText}" introuvable visuellement, click JS`);
  }
  await w(page, 300);
}

// ── Sélection cascadée Région → Ville → Quartier ────────────────────────────
async function selectLocation(page, labelPrefix, region, city, neighborhood) {
  await pickItem(page, `${labelPrefix} — Région`, region);
  await w(page, 500);
  await pickItem(page, `${labelPrefix} — Ville`, city);
  await w(page, 500);
  await pickItem(page, `${labelPrefix} — Quartier`, neighborhood);
}

// ── Connexion vendeur ────────────────────────────────────────────────────────
async function signin(page) {
  log('\n🔐 Connexion — Marly Yaya (698892174)');
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await w(page, 4500);
  await shot(page, 'start', 'Écran de démarrage');

  // Naviguer vers la connexion si on est sur l'onboarding
  if (await page.getByText('Démarrer').isVisible().catch(() => false)) {
    await page.evaluate(() => window.scrollBy(0, 350));
    await w(page, 300);
    const link = page.getByText(/J'ai déjà un compte/i).first();
    if (await link.isVisible().catch(() => false)) await link.click();
    else await page.evaluate(() => window.__koligo_navigate?.('Signin'));
    await w(page, 900);
  }

  const chg = page.getByText(/Changer de compte/i).first();
  if (await chg.isVisible().catch(() => false)) { await chg.click(); await w(page, 700); }

  const inp = page.getByPlaceholder(/6XX.*XX|email/i).first();
  if (await inp.isVisible().catch(() => false)) {
    await inp.fill(VENDOR_PHONE);
    await shot(page, 'phone', `Saisie numéro — ${VENDOR_PHONE}`);
    await page.getByText('Continuer').first().click();
    await w(page, 1500);
  }

  await shot(page, 'pin-screen', 'Écran PIN — Marly Yaya');
  await numpad(page, VENDOR_PIN);
  await w(page, 3000);
  await shot(page, 'home-vendor', 'Accueil Vendeur — Glow Style Market 🏪', 'ok');
  log('  ✅ Connecté en tant que Marly Yaya');
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  log('\n🚀 KoliGo — Parcours Glow Style Market | Marly Yaya\n');
  log('   698892174 → Douala Bépanda → Garoua Administratif (Plateau)');
  log('   Colis : Ordinateur 450 000 FCFA\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo:   35,
    args: ['--window-size=430,932', '--window-position=50,30'],
  });
  const ctx  = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();

  // ── 1. Connexion ──────────────────────────────────────────────────────────
  await signin(page);

  // ── 2. Ouvrir le formulaire de livraison ──────────────────────────────────
  log('\n📦 Ouverture formulaire de livraison…');

  const creerBtn = page.getByText(/Créer une livraison/i).first();
  if (await creerBtn.isVisible().catch(() => false)) {
    await creerBtn.click();
  } else {
    await page.evaluate(() => window.__koligo_navigate?.('PostDelivery'));
  }
  await w(page, 1500);
  await shot(page, 'form-step1', 'Formulaire livraison — Étape 1');

  // ── 3. Boutique ───────────────────────────────────────────────────────────
  log('\n🏪 Saisie boutique : "Glow Style Market"');
  const shopInput = page.getByPlaceholder(/Nom de ta boutique/i).first();
  await shopInput.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await shopInput.clear();
  await shopInput.fill('Glow Style Market');
  await w(page, 400);
  await shot(page, 'shop-name', 'Boutique : Glow Style Market');

  // ── 4. Quartier de départ : Douala, Bépanda ───────────────────────────────
  log('\n📍 Départ : Littoral → Douala → Bépanda');
  await page.evaluate(() => window.scrollBy(0, 120));
  await w(page, 400);
  await selectLocation(page, 'Quartier de départ (retrait)', 'Littoral', 'Douala', 'Bépanda');
  await shot(page, 'from-bepanda', 'Départ : Douala, Bépanda ✅');

  // ── 5. Type de colis : Électronique ──────────────────────────────────────
  log('\n📦 Type : Électronique');
  await page.evaluate(() => window.scrollBy(0, 200));
  await w(page, 400);
  const elecBtn = page.getByText('Électronique').first();
  if (await elecBtn.isVisible().catch(() => false)) {
    await elecBtn.click();
    await w(page, 300);
  }
  await shot(page, 'type-electronique', 'Type colis : Électronique ✅');

  // ── 6. Description du colis ───────────────────────────────────────────────
  log('\n📝 Description : Ordinateur portable HP 14"');
  const descInput = page.getByPlaceholder(/Robe wax|ex:/i).first();
  if (await descInput.isVisible().catch(() => false)) {
    await descInput.fill('Ordinateur portable HP 14" · 1 pièce');
  } else {
    // Chercher via label
    const descLabel = page.getByText(/Description du colis/i).first();
    if (await descLabel.isVisible().catch(() => false)) {
      const descField = page.locator('input, [contenteditable]').nth(1);
      await descField.fill('Ordinateur portable HP 14" · 1 pièce').catch(() => {});
    }
  }
  await shot(page, 'desc-ordinateur', 'Description : Ordinateur portable ✅');

  // ── 7. Poids : Gros (7 kg) ───────────────────────────────────────────────
  log('\n⚖️  Poids : Gros (7 kg)');
  await page.evaluate(() => window.scrollBy(0, 150));
  await w(page, 300);
  const grosBtn = page.getByText('Gros').first();
  if (await grosBtn.isVisible().catch(() => false)) {
    await grosBtn.click();
    await w(page, 300);
    log('  ✅ Poids "Gros" 7 kg sélectionné');
  }
  await shot(page, 'weight-gros', 'Poids : Gros (7 kg) ✅');

  // ── 8. Urgence : Express ─────────────────────────────────────────────────
  log('\n⚡ Urgence : Express');
  await page.evaluate(() => window.scrollBy(0, 200));
  await w(page, 300);
  const expressBtn = page.getByText('Express').first();
  if (await expressBtn.isVisible().catch(() => false)) {
    await expressBtn.click();
    await w(page, 300);
    log('  ✅ Urgence Express sélectionnée');
  }
  await shot(page, 'speed-express', 'Urgence : Express ✅');

  // ── 9. Destination : Garoua, Administratif ───────────────────────────────
  log('\n📍 Destination : Nord → Garoua → Administratif (Plateau)');
  await page.evaluate(() => window.scrollBy(0, 200));
  await w(page, 400);
  await selectLocation(page, 'Quartier de livraison', 'Nord', 'Garoua', 'Administratif');
  await shot(page, 'to-garoua', 'Destination : Garoua, Administratif ✅');

  // ── 10. Destinataire ─────────────────────────────────────────────────────
  log('\n👤 Destinataire : Amadou Garoua / 691227149');
  await page.evaluate(() => window.scrollBy(0, 200));
  await w(page, 300);
  const recipInput = page.getByPlaceholder(/Aïcha|ex:/i).first();
  if (await recipInput.isVisible().catch(() => false)) {
    await recipInput.fill('Amadou Garoua');
  }
  const phoneInput = page.getByPlaceholder('6 XX XX XX XX').first();
  if (await phoneInput.isVisible().catch(() => false)) {
    await phoneInput.fill('691227149');
  }
  await shot(page, 'recipient', 'Destinataire : Amadou Garoua ✅');

  // ── 11. Valeur marchandise : 450 000 FCFA ────────────────────────────────
  log('\n💰 Valeur marchandise : 450 000 FCFA');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await w(page, 500);
  const priceInput = page.getByPlaceholder(/15000|ex:/i).first();
  if (await priceInput.isVisible().catch(() => false)) {
    await priceInput.fill('450000');
    await w(page, 300);
  }
  await shot(page, 'price-450000', 'Prix marchandise : 450 000 FCFA ✅');

  // ── 12. Récapitulatif prix avant Continuer ───────────────────────────────
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await w(page, 600);
  await shot(page, 'price-summary', 'Récapitulatif frais + prix total client');

  // ── 13. Clic Continuer → Étape 2 ─────────────────────────────────────────
  log('\n▶️  Continuer → Étape 2');
  const continuerBtn = page.getByText('Continuer').first();
  if (await continuerBtn.isVisible().catch(() => false)) {
    await continuerBtn.click();
    await w(page, 1200);
    await shot(page, 'step2-recap', 'Récapitulatif livraison — Étape 2');
    log('  ✅ Étape 2 ouverte');
  } else {
    log('  ⚠️  Bouton "Continuer" non visible — scroll et retry');
    await page.evaluate(() => window.scrollBy(0, 300));
    await w(page, 600);
    const btn2 = page.getByText('Continuer').first();
    if (await btn2.isVisible().catch(() => false)) { await btn2.click(); await w(page, 1200); }
    await shot(page, 'step2-recap', 'Récapitulatif livraison — Étape 2');
  }

  // ── 14. Détails récapitulatifs step 2 ────────────────────────────────────
  await page.evaluate(() => window.scrollBy(0, 200));
  await w(page, 400);
  await shot(page, 'step2-details', 'Détails : boutique, colis, distance, total client');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await w(page, 400);
  await shot(page, 'step2-bottom', 'Code sécurisé + bouton Publier');

  // ── 15. Publier l'annonce ─────────────────────────────────────────────────
  log('\n🚀 Publication livraison…');
  let delivery = null;
  try {
    const [resp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/deliveries') && r.request().method() === 'POST',
        { timeout: 12000 }
      ),
      page.getByText(/Publier l'annonce|Publish delivery/i).last().click(),
    ]);
    delivery = await resp.json().catch(() => null);
  } catch {
    await page.getByText(/Publier l'annonce|Publish delivery/i).last().click().catch(() => {});
  }
  await w(page, 5000);
  await shot(page, 'vendor-codes', delivery?.id ? '✅ Livraison publiée — codes générés' : '⚠️ Codes générés (vérifier)');

  if (delivery?.id) {
    log(`\n  ✅ Livraison créée avec succès !`);
    log(`     ID         : ${delivery.id}`);
    log(`     Boutique   : Glow Style Market`);
    log(`     Trajet     : Douala Bépanda → Garoua Administratif`);
    log(`     Colis      : Ordinateur portable 450 000 FCFA`);
    log(`     Prix livr. : ${delivery.priceXAF?.toLocaleString('fr-FR')} XAF`);
    log(`     Total clt  : ${(delivery.priceXAF + 450000)?.toLocaleString('fr-FR')} XAF`);
    log(`     Code A 🟠  : ${delivery.collectCode} (pour le livreur)`);
    log(`     Code B 🟢  : ${delivery.deliverCode} (pour le client)`);
  } else {
    // Fallback : récupérer via API
    const http = require('http');
    const loginData = await new Promise(r => {
      const body = JSON.stringify({ phone: VENDOR_PHONE, pin: VENDOR_PIN });
      const req = http.request({ hostname: 'localhost', port: 3001, path: '/api/auth/signin', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        res => { let b = ''; res.on('data', c => b += c); res.on('end', () => r(JSON.parse(b))); });
      req.write(body); req.end();
    });
    const tk = loginData.accessToken;
    if (tk) {
      const listData = await new Promise(r => {
        const req = http.request({ hostname: 'localhost', port: 3001, path: '/api/deliveries', method: 'GET',
          headers: { Authorization: `Bearer ${tk}` } },
          res => { let b = ''; res.on('data', c => b += c); res.on('end', () => r(JSON.parse(b))); });
        req.end();
      });
      const latest = Array.isArray(listData) ? listData[0] : null;
      if (latest) {
        delivery = latest;
        log(`  ✅ Livraison récupérée via API`);
        log(`     ID : ${latest.id} | collectCode : ${latest.collectCode} | deliverCode : ${latest.deliverCode}`);
      }
    }
  }

  // ── 16. Codes de sécurité ─────────────────────────────────────────────────
  await page.evaluate(() => window.scrollBy(0, 300));
  await w(page, 600);
  await shot(page, 'codes-final', `Code A: ${delivery?.collectCode ?? '???'} | Code B: ${delivery?.deliverCode ?? '???'}`);

  // ── 17. Facture de confiance (optionnel) ──────────────────────────────────
  const trustBtn = page.getByText(/Facture de confiance/i).first();
  if (await trustBtn.isVisible().catch(() => false)) {
    await trustBtn.click();
    await w(page, 2000);
    await shot(page, 'trust-invoice', 'Facture de confiance générée ✅');
    await page.goBack().catch(() => {});
    await w(page, 800);
  }

  // ── 18. Retour accueil vendeur ────────────────────────────────────────────
  await page.evaluate(() => window.__koligo_navigate?.('VendorHome'));
  await w(page, 2000);
  await shot(page, 'home-final', 'Accueil Vendeur — livraison en cours');

  // ── Générer rapport HTML ───────────────────────────────────────────────────
  generateReport(delivery);
  await browser.close();
}

function generateReport(delivery) {
  const shots = fs.readdirSync(SHOTS)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => {
      const base64 = fs.readFileSync(path.join(SHOTS, f)).toString('base64');
      const name   = f.replace('.png', '');
      return { name, base64 };
    });

  const thumbs = shots.map(s => `
    <div class="thumb">
      <div class="img-wrap"><img src="data:image/png;base64,${s.base64}" loading="lazy" onclick="zoom(this)" /></div>
      <div class="name">${s.name}</div>
    </div>`).join('');

  const info = delivery ? `
    <div class="info-box">
      <div class="info-row"><span>Boutique</span><strong>Glow Style Market</strong></div>
      <div class="info-row"><span>ID Livraison</span><strong>${delivery.id}</strong></div>
      <div class="info-row"><span>Trajet</span><strong>Douala Bépanda → Garoua Administratif</strong></div>
      <div class="info-row"><span>Colis</span><strong>Ordinateur portable · 450 000 FCFA</strong></div>
      <div class="info-row"><span>Frais livraison</span><strong>${(delivery.priceXAF ?? 0).toLocaleString('fr-FR')} XAF</strong></div>
      <div class="info-row"><span>Total client</span><strong>${((delivery.priceXAF ?? 0) + 450000).toLocaleString('fr-FR')} XAF</strong></div>
      <div class="info-row"><span>Code A 🟠</span><strong class="code">${delivery.collectCode ?? '—'}</strong></div>
      <div class="info-row"><span>Code B 🟢</span><strong class="code">${delivery.deliverCode ?? '—'}</strong></div>
    </div>` : '<div class="info-box" style="color:#f87171">Livraison non capturée</div>';

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Glow Style Market — Parcours Marly Yaya</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
body{background:#0f172a;color:#e2e8f0;min-height:100vh}
.hdr{background:linear-gradient(135deg,#0d7a3e,#065f46);padding:28px 32px}
.title{font-size:22px;font-weight:900;color:#fff}
.title em{color:#86efac;font-style:normal}
.sub{font-size:12px;color:rgba(255,255,255,0.55);margin-top:4px}
.content{padding:24px 32px;max-width:1400px;margin:auto}
.info-box{background:#1e293b;border-radius:16px;padding:20px 24px;border:1px solid #334155;margin-bottom:28px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #0f172a}
.info-row:last-child{border-bottom:none}
.info-row span{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.info-row strong{font-size:14px;color:#e2e8f0}
.code{font-family:monospace;font-size:22px;color:#34d399;letter-spacing:3px}
h2{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.thumb{background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;cursor:pointer}
.thumb:hover{border-color:#34d399;transform:translateY(-2px);transition:all .15s}
.img-wrap{aspect-ratio:390/844;background:#000;overflow:hidden}
.img-wrap img{width:100%;height:100%;object-fit:cover;cursor:zoom-in}
.name{font-size:10px;color:#475569;padding:6px 8px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100;align-items:center;justify-content:center;cursor:zoom-out}
.modal.open{display:flex}
.modal img{max-height:95vh;max-width:95vw;border-radius:8px}
</style></head><body>
<div class="hdr">
  <div class="title">Koli<em>Go</em> — Glow Style Market</div>
  <div class="sub">Marly Yaya · 698892174 · Douala Bépanda → Garoua Administratif · ${new Date().toLocaleString('fr-FR')}</div>
</div>
<div class="content">
  ${info}
  <h2>${shots.length} captures d'écran — cliquer pour agrandir</h2>
  <div class="grid">${thumbs}</div>
</div>
<div class="modal" id="modal" onclick="this.classList.remove('open')">
  <img id="mi" src="" />
</div>
<script>
function zoom(img){ document.getElementById('mi').src=img.src; document.getElementById('modal').classList.add('open'); }
</script>
</body></html>`;

  const rp = path.join(__dirname, 'rapport-glow-style-market.html');
  fs.writeFileSync(rp, html);
  log(`\n✅  Rapport : ${rp}`);
  log(`📸  ${shots.length} captures → ${SHOTS}`);
  try { require('child_process').exec(`start "" "${rp}"`); } catch {}
}

main().catch(e => {
  console.error('\n💥 Erreur :', e.message);
  process.exit(1);
});
