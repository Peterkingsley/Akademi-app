const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8081'); // Assuming standard expo web port or similar
  await page.screenshot({ path: 'frontend-verification.png' });
  await browser.close();
})();
