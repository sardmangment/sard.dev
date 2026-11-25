// CC-13, CC-22…CC-24, CC-51, CC-53: new content pages render in AR/EN at 375px and desktop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const TEAM_ROWS = [
  { id: 't1', tier: 'owner', name_ar: 'مالك', name_en: 'Owner One', role_ar: 'المؤسس', role_en: 'Founder', photo_url: null },
  { id: 't2', tier: 'manager', name_ar: 'مدير', name_en: 'Head One', role_ar: 'مدير التسويق', role_en: 'Head of Marketing', photo_url: null },
  { id: 't3', tier: 'staff', name_ar: 'عضو', name_en: 'Member One', role_ar: 'مطور', role_en: 'Developer', photo_url: null },
];

async function mockSupabase(page) {
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('rpc/get_public_team')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TEAM_ROWS) });
    }
    if (url.includes('rpc/get_member_badge')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 't1', name_ar: 'عضو', name_en: 'Member One', role_ar: 'مطور', role_en: 'Developer', photo_url: null, is_affiliated: true, verified_at: '2026-11-17T00:00:00Z' }]),
      });
    }
    if (url.includes('rpc/get_published_partners')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

const PAGES = [
  { path: '/about', h1: { en: 'About Sard', ar: 'عن سرد' } },
  { path: '/faq', h1: { en: 'Frequently Asked Questions', ar: 'الأسئلة الشائعة' } },
  { path: '/contact', h1: { en: 'Contact Sard', ar: 'تواصل مع سرد' } },
  { path: '/privacy', h1: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' } },
  { path: '/terms', h1: { en: 'Terms of Service', ar: 'شروط الخدمة' } },
  { path: '/team', h1: { en: 'The Sard Team', ar: 'فريق سرد' } },
];

test('Content pages: AR/EN, desktop and 375px, no horizontal overflow, policy checks', async () => {
  const chromium = await getChromium();
  const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) launchOptions.executablePath = chromePath;
  const browser = await chromium.launch(launchOptions);

  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['en', 'ar']) {
        for (const p of PAGES) {
          const page = await browser.newPage({ viewport });
          const errors = [];
          page.on('pageerror', (e) => errors.push(e.message));
          await page.addInitScript((l) => {
            try { window.localStorage.setItem('i18nextLng', l); } catch { /* ignore */ }
          }, lang);
          await mockSupabase(page);
          await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
          const h1 = page.locator('h1').first();
          await h1.waitFor({ state: 'visible', timeout: 8000 });
          assert.equal((await h1.textContent()).trim(), p.h1[lang], `${p.path} ${lang} h1`);

          const dir = await page.evaluate(() => document.documentElement.dir);
          assert.equal(dir, lang === 'ar' ? 'rtl' : 'ltr', `${p.path} ${lang} dir`);

          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          assert.ok(overflow <= 1, `${p.path} ${lang} @${viewport.width}px has horizontal overflow of ${overflow}px`);
          assert.deepEqual(errors, [], `${p.path} ${lang} page errors`);

          if (p.path === '/about') {
            assert.equal(await page.locator('[data-testid="about-values"] > li').count(), 6, 'six values');
          }
          if (p.path === '/faq') {
            assert.equal(await page.locator('[data-faq]').count(), 8, '8 FAQs while FAQ-007 is gated');
            const btn = page.locator('[data-faq] button').first();
            await btn.click();
            assert.equal(await btn.getAttribute('aria-expanded'), 'true');
            const ld = await page.locator('script[type="application/ld+json"]').last().textContent();
            assert.equal(JSON.parse(ld).mainEntity.length, 8);
          }
          if (p.path === '/contact') {
            const wa = await page.locator('[data-testid="whatsapp-link"]').getAttribute('href');
            assert.ok(wa.startsWith('https://wa.me/201509027729?text='), 'WhatsApp link');
            assert.ok(decodeURIComponent(wa.split('text=')[1]).startsWith(lang === 'ar' ? 'مرحباً سرد' : 'Hello Sard'), 'prefilled text per language');
            assert.ok((await page.locator('a[href="mailto:support@sard.info"]').count()) >= 1);
            assert.ok((await page.locator('a[href="tel:+201509027729"]').count()) >= 1);
          }
          if (p.path === '/privacy' || p.path === '/terms') {
            const robots = await page.locator('meta[name="robots"]').getAttribute('content');
            assert.ok(robots.includes('noindex'), 'legal notice is noindex');
          }
          if (p.path === '/team') {
            const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.content).join(' '));
            assert.ok(!robots.includes('noindex'), 'team page is indexable (DEV-199)');
            await page.locator('[data-testid="team-card"]').first().waitFor({ timeout: 8000 });
            const headings = await page.locator('main h2').allTextContents();
            assert.deepEqual(headings.map((h) => h.trim()), lang === 'ar' ? ['الشركاء المؤسسون', 'رؤساء الأقسام', 'فريق العمل'] : ['Founding Partners', 'Heads of Departments', 'Our Team'], 'three sections in order');
            assert.equal(await page.locator('[data-testid="team-card"]').count(), 3);
            const mainLinks = await page.locator('main a[href^="mailto:"], main a[href^="tel:"], main a[href*="linkedin"]').count();
            assert.equal(mainLinks, 0, 'no personal contact links on the team page');
          }
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
});

test('Member badge: approved fields only + disclaimer; Friday closed on calendar', async () => {
  const chromium = await getChromium();
  const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) launchOptions.executablePath = chromePath;
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.addInitScript(() => { try { window.localStorage.setItem('i18nextLng', 'en'); } catch { /* ignore */ } });
    await mockSupabase(page);
    await page.goto(`${BASE_URL}/member/t1`, { waitUntil: 'domcontentloaded' });
    const badge = page.locator('[data-testid="member-badge"]');
    await badge.waitFor({ state: 'visible', timeout: 8000 });
    const text = await badge.textContent();
    assert.ok(text.includes('Member One') && text.includes('Developer'));
    assert.ok(text.includes('Verified by Sard') && text.includes('Active member of Sard'));
    assert.ok(text.includes('does not authorize the holder'), 'C-G02 disclaimer');
    assert.ok(!/Join|Projects|Bio/i.test(text), 'no join date / projects / bio');

    await page.goto(`${BASE_URL}/calendar`, { waitUntil: 'domcontentloaded' });
    await page.locator('button[data-closed="true"]').first().waitFor({ state: 'attached', timeout: 8000 });
    assert.ok(await page.locator('button[data-closed="true"]').first().isDisabled(), 'Friday button disabled');
    assert.ok((await page.locator('[data-testid="booking-notice"] a[href="/privacy"]').count()) === 1, 'booking notice links /privacy');
  } finally {
    await browser.close();
  }
});
