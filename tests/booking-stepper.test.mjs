// DEV-206: the reusable Stepper on the meeting booking page (/calendar).
// Step 1 "pick a day and time" → step 2 "your details" → step 3 "confirmation" (AR/EN, desktop and 375px).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('src/locales/ar/translation.json', 'utf8'));

async function launch() {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  return chromium.launch(opts);
}

const statuses = (page) => page.locator('[data-testid="stepper"] li').evaluateAll((els) => els.map((e) => e.dataset.status));

test('Booking stepper follows the visitor through the booking (AR/EN, desktop and 375px)', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const dict = lang === 'ar' ? ar : en;
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);
        await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await page.goto(`${BASE_URL}/calendar`, { waitUntil: 'domcontentloaded' });

        const stepper = page.locator('[data-testid="stepper"]');
        await stepper.waitFor({ timeout: 8000 });
        assert.equal(await stepper.getAttribute('aria-label'), dict.calendar.steps.label);
        assert.deepEqual((await stepper.locator('li').allTextContents()).map((s) => s.replace(/\s*\(.*\)\s*$/, '').replace(/^\d/, '').trim()),
          [dict.calendar.steps.slot, dict.calendar.steps.details, dict.calendar.steps.confirm]);
        assert.deepEqual(await statuses(page), ['current', 'upcoming', 'upcoming']);
        assert.equal(await stepper.locator('li[aria-current="step"]').count(), 1);
        if (viewport.width < 640) {
          assert.ok((await stepper.textContent()).includes(dict.stepper.stepOf.replace('{{current}}', '1').replace('{{total}}', '3')), 'compact summary on phones');
        }

        // Pick a slot on an open day after today (no past slots, no Friday) → step 2
        const day = new Date(Date.now() + 2 * 864e5);
        if (day.getUTCDay() === 5) day.setUTCDate(day.getUTCDate() + 1);
        await page.locator('input[type="date"]').fill(day.toISOString().slice(0, 10));
        await page.locator('button', { hasText: /^\d{1,2}:\d{2}/ }).first().click();
        await page.waitForFunction(() => document.querySelector('[data-testid="stepper"] li:nth-child(2)')?.dataset.status === 'current');
        assert.deepEqual(await statuses(page), ['complete', 'current', 'upcoming']);

        // Invalid email keeps step 2; a valid one moves to step 3
        await page.locator('form input[type="text"]').first().fill('Sara Ali');
        await page.locator('form input[type="email"]').fill('sara@');
        assert.deepEqual(await statuses(page), ['complete', 'current', 'upcoming']);
        await page.locator('form input[type="email"]').fill('sara@example.com');
        await page.waitForFunction(() => document.querySelector('[data-testid="stepper"] li:nth-child(3)')?.dataset.status === 'current');

        // Done steps are clickable (jump back to the slots panel); upcoming ones are not buttons
        if (viewport.width >= 640) {
          assert.equal(await stepper.locator('li button').count(), 3);
          await stepper.locator('li button').first().click();
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/calendar ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
