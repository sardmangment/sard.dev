// DEV-192: /careers lists published jobs and training in AR/EN, desktop and 375px,
// filters by kind, applies via the opening's link or the in-site form, and shows an empty state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const OPENINGS = [
  { id: 'o1', kind: 'job', title_ar: 'مطور واجهات أمامية', title_en: 'Frontend Developer', description_ar: 'وصف', description_en: 'Build web interfaces.', location_ar: 'الإسكندرية', location_en: 'Alexandria', work_mode: 'hybrid', apply_url: null, closes_at: null, display_order: 1 },
  { id: 'o2', kind: 'training', title_ar: 'تدريب تحليل البيانات', title_en: 'Data Analysis Training', description_ar: 'وصف', description_en: 'Three-month programme.', location_ar: null, location_en: null, work_mode: 'remote', apply_url: 'https://forms.example.com/apply', closes_at: '2026-12-31', display_order: 2 },
];

async function launch() {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  return chromium.launch(opts);
}

async function openCareers(browser, { lang, viewport, rows }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);
  await page.route('**/rest/v1/**', (route) => {
    const body = route.request().url().includes('/job_openings') ? JSON.stringify(rows) : '[]';
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  page.applications = [];
  await page.route('**/api/careers/apply', async (route) => {
    page.applications.push(route.request().postDataBuffer()?.toString('latin1') || '');
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto(`${BASE_URL}/careers`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 8000 });
  return { page, errors };
}

test('Careers page: openings, filters and apply links (AR/EN, desktop and 375px)', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const { page, errors } = await openCareers(browser, { lang, viewport, rows: OPENINGS });
        assert.equal((await page.locator('h1').first().textContent()).trim(), lang === 'ar' ? 'التوظيف' : 'Careers');
        await page.locator('[data-testid="opening"]').first().waitFor({ timeout: 8000 });
        assert.equal(await page.locator('[data-testid="opening"]').count(), 2, 'both openings render');

        // Filter: training only
        await page.getByRole('tab', { name: lang === 'ar' ? /تدريب/ : /Training/ }).click();
        assert.equal(await page.locator('[data-testid="opening"]').count(), 1, 'training filter shows one');
        assert.equal(await page.locator('[data-testid="opening"]').first().getAttribute('data-kind'), 'training');
        const external = page.locator('[data-testid="opening"] a').first();
        assert.equal(await external.getAttribute('href'), 'https://forms.example.com/apply');
        assert.equal(await external.getAttribute('target'), '_blank');

        // Filter: jobs only → apply through the in-site form
        await page.getByRole('tab', { name: lang === 'ar' ? /وظائف/ : /Jobs/ }).click();
        await page.locator('[data-testid="opening"] button').first().click();
        const dialog = page.locator('[data-testid="apply-dialog"]');
        await dialog.waitFor({ timeout: 5000 });
        assert.ok((await dialog.textContent()).includes(lang === 'ar' ? 'مطور واجهات أمامية' : 'Frontend Developer'), 'dialog names the opening');

        // Empty submit → client-side errors, nothing sent
        await dialog.locator('button[type="submit"]').click();
        assert.ok(await dialog.locator('[role="alert"]').count() >= 4, 'required-field errors shown');
        assert.equal(page.applications.length, 0, 'nothing sent with errors');

        // DEV-206 stepper: details → CV → consent & send, follows what is filled in
        const steps = () => dialog.locator('[data-testid="stepper"] li').evaluateAll((els) => els.map((e) => e.dataset.status));
        const stepIs = (n) => page.waitForFunction((i) => document.querySelector(`[data-testid="apply-dialog"] [data-testid="stepper"] li:nth-child(${i})`)?.dataset.status === 'current', n);
        assert.deepEqual(await steps(), ['current', 'upcoming', 'upcoming']);

        // Valid submit → posted to /api/careers/apply with the opening id and the PDF
        await dialog.locator('#full_name').fill('Sara Ali');
        await dialog.locator('#email').fill('sara@example.com');
        await dialog.locator('#phone').fill('+20 100 000 0000');
        await stepIs(2);
        await dialog.locator('#cv').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
        await stepIs(3);
        assert.deepEqual(await steps(), ['complete', 'complete', 'current']);
        await dialog.locator('input[name="consent"]').check();
        await dialog.locator('button[type="submit"]').click();
        await page.locator('[data-testid="apply-success"]').waitFor({ timeout: 5000 });
        assert.deepEqual(await steps(), ['complete', 'complete', 'complete'], 'all steps done after sending');
        assert.equal(page.applications.length, 1, 'one application sent');
        assert.ok(page.applications[0].includes('o1') && page.applications[0].includes('%PDF-'), 'opening id and CV posted');
        await page.keyboard.press('Escape');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/careers ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, [], `/careers ${lang} page errors`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('Careers page: empty state opens a general application when nothing is published', async () => {
  const browser = await launch();
  try {
    for (const lang of ['ar', 'en']) {
      const { page } = await openCareers(browser, { lang, viewport: { width: 1280, height: 900 }, rows: [] });
      await page.locator('[data-testid="careers-empty"]').waitFor({ timeout: 8000 });
      await page.locator('[data-testid="careers-empty"] button').click();
      const dialog = page.locator('[data-testid="apply-dialog"]');
      await dialog.waitFor({ timeout: 5000 });
      assert.ok((await dialog.textContent()).includes(lang === 'ar' ? 'طلب توظيف عام' : 'General application'), 'empty state opens a general application');
      assert.equal(await page.getByRole('tab').count(), 0, 'no filters when empty');
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('Careers is linked from the navbar and footer, and listed in the sitemap', async () => {
  const fs = await import('node:fs');
  assert.ok(fs.readFileSync('src/config/navigation.js', 'utf8').includes("to: '/careers'"), 'navbar links /careers');
  assert.ok(fs.readFileSync('src/components/layout/Footer.tsx', 'utf8').includes("to: '/careers'"), 'footer links /careers');
  assert.ok(fs.readFileSync('public/sitemap.xml', 'utf8').includes('https://sard.dev/careers'), 'sitemap lists /careers');
});
