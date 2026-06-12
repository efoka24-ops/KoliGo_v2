const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('[CONSOLE ERROR] ' + msg.text());
  });
  page.on('pageerror', err => errors.push('[PAGE ERROR] ' + err.message));

  await page.goto('http://localhost:8085', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Also dump page title and body snippet
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '(empty)');
  const html = await page.evaluate(() => document.documentElement?.innerHTML?.slice(0, 1000) || '(empty)');

  console.log('TITLE:', title);
  console.log('BODY TEXT:', bodyText);
  console.log('HTML SNIPPET:', html);
  console.log('\nERRORS:');
  errors.forEach(e => console.log(e));
  if (errors.length === 0) console.log('(no errors captured)');

  await browser.close();
})();
