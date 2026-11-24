// DEV-192 / DEV-194: /privacy explains how job applications are handled (AR/EN, desktop and 375px),
// /terms does not, the application form links straight to that section, and the text stays true to the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';
import { CV_LINK_SECONDS } from '../api/admin/applications.js';

const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('src/locales/ar/translation.json', 'utf8'));

test('Recruitment privacy text matches what the system does', () => {
  assert.equal(CV_LINK_SECONDS, 60, 'text says the CV link expires after one minute');
  assert.ok(en.legal.recruitment.s3.body.includes('one minute') && ar.legal.recruitment.s3.body.includes('دقيقة واحدة'));
  const apply = fs.readFileSync('api/careers/apply.js', 'utf8');
  assert.ok(apply.includes('ip_hash: await sha256Hex(ip)'), 'only a hash of the IP is stored, as the text says');
  assert.ok(fs.readFileSync('api/admin/applications.js', 'utf8').includes('job-applications'), 'CV deleted with the application');
  assert.ok(fs.readFileSync('src/components/ApplyDialog.jsx', 'utf8').includes('to="/privacy#recruitment"'), 'consent links the section');
  assert.equal(en.legal.underReviewTitle, 'Under Legal Review', 'interim notice kept');
});

test('/privacy shows the recruitment section; /terms does not (AR/EN, desktop and 375px)', async () => {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  const browser = await chromium.launch(opts);
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);
        await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

        await page.goto(`${BASE_URL}/privacy#recruitment`, { waitUntil: 'domcontentloaded' });
        const section = page.locator('[data-testid="privacy-recruitment"]');
        await section.waitFor({ timeout: 8000 });
        const dict = lang === 'ar' ? ar : en;
        assert.equal((await section.locator('h2').textContent()).trim(), dict.legal.recruitment.title);
        assert.equal(await section.locator('h3').count(), 5);
        assert.equal(await section.locator('a[href="mailto:support@sard.info"]').count(), 1);
        assert.ok(await page.getByRole('heading', { name: dict.legal.underReviewTitle, exact: true }).isVisible(), 'interim notice still shown');
        const top = await section.evaluate((el) => el.getBoundingClientRect().top);
        assert.ok(top < viewport.height, '#recruitment scrolls into view');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/privacy ${lang} @${viewport.width}px overflows by ${overflow}px`);

        await page.goto(`${BASE_URL}/terms`, { waitUntil: 'domcontentloaded' });
        await page.locator('h1').first().waitFor();
        assert.equal(await page.locator('[data-testid="privacy-recruitment"]').count(), 0, 'not on /terms');
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
