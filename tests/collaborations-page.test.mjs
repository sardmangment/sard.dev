// DEV-193: /collaborations lists published collaborations in AR/EN, desktop and 375px,
// filters by kind, and shows an empty state when nothing is published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const ROWS = [
  { id: 'c1', name_ar: 'جامعة الإسكندرية', name_en: 'Alexandria University', logo_url: null, description_ar: 'تعاون أكاديمي في التدريب العملي.', description_en: 'Academic collaboration on practical training.', kind: 'academic', started_on: '2026-03-01', website_url: 'https://example.edu', display_order: 1 },
  { id: 'c2', name_ar: 'شركة تجريبية', name_en: 'Demo Company', logo_url: null, description_ar: 'تعاون في حلول الأعمال.', description_en: 'Business solutions collaboration.', kind: 'business', started_on: null, website_url: null, display_order: 2 },
];

async function launch() {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  return chromium.launch(opts);
}

async function openPage(browser, { lang, viewport, rows }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);
  await page.route('**/rest/v1/**', (route) => {
    const body = route.request().url().includes('/collaborations') ? JSON.stringify(rows) : '[]';
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await page.goto(`${BASE_URL}/collaborations`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 8000 });
  return { page, errors };
}

test('Collaborations page: cards and filters (AR/EN, desktop and 375px)', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const { page, errors } = await openPage(browser, { lang, viewport, rows: ROWS });
        assert.equal((await page.locator('h1').first().textContent()).trim(), lang === 'ar' ? 'التعاون' : 'Collaborations');
        await page.locator('[data-testid="collaboration"]').first().waitFor({ timeout: 8000 });
        assert.equal(await page.locator('[data-testid="collaboration"]').count(), 2, 'both collaborations render');
        const first = page.locator('[data-testid="collaboration"]').first();
        assert.ok((await first.textContent()).includes(lang === 'ar' ? 'جامعة الإسكندرية' : 'Alexandria University'), 'name in the page language');
        const site = first.locator('a');
        assert.equal(await site.getAttribute('href'), 'https://example.edu');
        assert.equal(await site.getAttribute('target'), '_blank');

        await page.getByRole('tab', { name: lang === 'ar' ? /أكاديمي/ : /Academic/ }).click();
        assert.equal(await page.locator('[data-testid="collaboration"]').count(), 1, 'academic filter shows one');
        assert.equal(await page.locator('[data-testid="collaboration"]').first().getAttribute('data-kind'), 'academic');
        await page.getByRole('tab', { name: lang === 'ar' ? /الكل/ : /All/ }).click();
        assert.equal(await page.locator('[data-testid="collaboration"]').count(), 2, 'all filter shows both');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/collaborations ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, [], `/collaborations ${lang} page errors`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('Collaborations page: empty state links to Contact when nothing is published', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const { page, errors } = await openPage(browser, { lang, viewport, rows: [] });
        const empty = page.locator('[data-testid="collaborations-empty"]');
        await empty.waitFor({ timeout: 8000 });
        assert.equal(await empty.locator('a').getAttribute('href'), '/contact');
        assert.equal(await page.getByRole('tab').count(), 0, 'no filters when empty');
        assert.deepEqual(errors, [], `/collaborations empty ${lang} page errors`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('Collaborations is linked from the navbar and footer, and listed in the sitemap', async () => {
  const fs = await import('node:fs');
  const nav = fs.readFileSync('src/config/navigation.js', 'utf8');
  assert.ok(nav.indexOf("to: '/collaborations'") > nav.indexOf("to: '/careers'"), 'navbar links /collaborations after /careers');
  assert.ok(fs.readFileSync('src/components/layout/Footer.tsx', 'utf8').includes("to: '/collaborations'"), 'footer links /collaborations');
  assert.ok(fs.readFileSync('public/sitemap.xml', 'utf8').includes('https://sard.dev/collaborations'), 'sitemap lists /collaborations');
});
