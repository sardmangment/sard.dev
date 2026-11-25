// Times ("12:00 PM") and dates keep left-to-right order on the Arabic booking page and the
// manage-booking page (no "PM 12:00").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

test('Booking page (AR): slot buttons, selected slot and day keep LTR order', async () => {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  const browser = await chromium.launch(opts);
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(() => { try { localStorage.setItem('i18nextLng', 'ar'); } catch { /* ignore */ } });
      await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${BASE_URL}/calendar`, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');

      const day = new Date(Date.now() + 2 * 864e5);
      if (day.getUTCDay() === 5) day.setUTCDate(day.getUTCDate() + 1);
      await page.locator('input[type="date"]').fill(day.toISOString().slice(0, 10));
      const slot = page.locator('button', { hasText: /\d{1,2}:\d{2}/ }).first();
      await slot.waitFor({ timeout: 8000 });
      assert.equal(await slot.locator('bdi').getAttribute('dir'), 'ltr', 'slot button time is LTR');
      await slot.click();

      const recap = page.locator('[data-testid="selected-slot"]');
      const parts = await recap.locator('bdi').evaluateAll((els) => els.map((e) => [e.dir, e.textContent]));
      assert.equal(parts.length, 2, 'date and time isolated');
      assert.ok(parts.every(([dir]) => dir === 'ltr'));
      assert.match(parts[1][1], /^\d{1,2}:\d{2} (AM|PM)$/);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `/calendar ar @${viewport.width}px overflows by ${overflow}px`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
