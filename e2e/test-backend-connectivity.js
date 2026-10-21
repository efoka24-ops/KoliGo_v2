const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const resp = await page.evaluate(async () => {
    try {
      const r = await fetch('http://localhost:3001/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '678758976', pin: '1234' })
      });
      return { status: r.status, ok: r.ok };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Chromium→localhost:3001:', JSON.stringify(resp));
  await browser.close();
})();
