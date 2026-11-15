import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const TEST_PAGES = [
  { path: '/', name: 'home', expectedDesktopLinks: ['/projects', '/calendar'] },
  { path: '/projects', name: 'projects', expectedDesktopLinks: ['/', '/calendar'] },
  { path: '/calendar', name: 'calendar', expectedDesktopLinks: ['/', '/ai'] },
  { path: '/ai', name: 'ai', expectedDesktopLinks: ['/', '/calendar'] },
];

test('HF-14: SiteNavbar standard across public pages (Desktop & Mobile, AR & EN)', async () => {
  const chromium = await getChromium();
  const chromePath = getChromeExecutablePath();
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }

  const browser = await chromium.launch(launchOptions);

  try {
    // Mock Supabase RPC & endpoints for isolation
    const setupMocks = async (page) => {
      await page.route('**/rest/v1/**', async (route) => {
        const url = route.request().url();
        if (url.includes('get_booked_slots_for_date')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        if (url.includes('projects')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { id: '1', title_ar: 'مشروع تجريبي', title_en: 'Demo Project', display_order: 1 }
            ]),
          });
        }
        if (url.includes('partners') || url.includes('contracts')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { id: '1', name_ar: 'شريك تجريبي', name_en: 'Demo Partner', is_active: true }
            ]),
          });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
    };

    // 1. Desktop Test (1280x800) across pages
    for (const p of TEST_PAGES) {
      for (const lang of ['ar', 'en']) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.addInitScript((l) => {
          try {
            window.localStorage.setItem('i18nextLng', l);
          } catch {}
        }, lang);
        await setupMocks(page);

        await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);

        // Header check: exactly one header rendered, top is 0..16px
        const header = page.locator('header').first();
        await header.waitFor({ state: 'visible', timeout: 5000 });
        const box = await header.boundingBox();
        assert.ok(box, `Header bounding box must exist on ${p.path} [${lang}]`);
        assert.ok(
          box.y >= 0 && box.y <= 16,
          `Header top on ${p.path} [${lang}] must be 0..16px, got ${box.y}px`
        );

        // Desktop links visible
        for (const linkHref of p.expectedDesktopLinks) {
          const desktopLink = header.locator(`a[href="${linkHref}"]`).first();
          assert.ok(
            await desktopLink.isVisible(),
            `Desktop link to "${linkHref}" must be visible on ${p.path} [${lang}]`
          );
        }

        // Hamburger must NOT be visible on desktop
        const hamburger = header.locator('button[aria-label="فتح قائمة التنقل"], button[aria-label="Open navigation menu"]');
        assert.strictEqual(
          await hamburger.isVisible(),
          false,
          `Hamburger menu must not be visible on 1280px desktop for ${p.path}`
        );

        // Screenshot
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `hf14-${p.name}-1280-${lang}.png`),
        });

        await page.close();
      }
    }

    // 2. Mobile Test (375x667) across pages: drawer direction, accessibility & Escape
    for (const p of TEST_PAGES) {
      for (const lang of ['ar', 'en']) {
        const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
        await page.addInitScript((l) => {
          try {
            window.localStorage.setItem('i18nextLng', l);
          } catch {}
        }, lang);
        await setupMocks(page);

        await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);

        // Header check on mobile
        const header = page.locator('header').first();
        await header.waitFor({ state: 'visible', timeout: 5000 });
        const box = await header.boundingBox();
        assert.ok(box, `Header bounding box must exist on mobile ${p.path} [${lang}]`);
        assert.ok(
          box.y >= 0 && box.y <= 16,
          `Header top on mobile ${p.path} [${lang}] must be 0..16px, got ${box.y}px`
        );

        // Hamburger must be visible on mobile
        const hamburger = header.locator('button[aria-label="فتح قائمة التنقل"], button[aria-label="Open navigation menu"]');
        await hamburger.waitFor({ state: 'visible', timeout: 5000 });
        assert.strictEqual(await hamburger.isVisible(), true, `Hamburger must be visible on mobile for ${p.path}`);

        // Open drawer
        await hamburger.click();
        const drawer = page.locator('aside[role="dialog"]');
        await drawer.waitFor({ state: 'visible', timeout: 3000 });
        assert.strictEqual(await drawer.count(), 1, `Drawer dialog must open on ${p.path}`);

        // Wait for drawer spring animation to settle
        await page.waitForTimeout(400);

        // Check drawer direction: in RTL (ar) right edge is at window.innerWidth; in LTR (en) left edge is 0
        const drawerBox = await drawer.boundingBox();
        assert.ok(drawerBox, `Drawer bounding box must exist on ${p.path} [${lang}]`);
        if (lang === 'ar') {
          // Drawer right edge should be aligned with viewport width (375)
          const rightEdge = Math.round(drawerBox.x + drawerBox.width);
          assert.ok(
            rightEdge >= 370 && rightEdge <= 380,
            `Arabic drawer should open from the right (right edge ~375px), got ${rightEdge}px`
          );
        } else {
          // English drawer left edge should be ~0
          assert.ok(
            drawerBox.x >= -5 && drawerBox.x <= 5,
            `English drawer should open from the left (x ~0px), got ${drawerBox.x}px`
          );
        }

        // Screenshot with open drawer
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `hf14-${p.name}-375-drawer-${lang}.png`),
        });

        // Test Escape key closes drawer
        await page.keyboard.press('Escape');
        await drawer.waitFor({ state: 'hidden', timeout: 3000 });
        assert.strictEqual(await drawer.isVisible(), false, `Escape must close drawer on ${p.path} [${lang}]`);

        await page.close();
      }
    }

    console.log('✅ HF-14: All desktop/mobile navbar checks passed and screenshots saved');
  } finally {
    await browser.close();
  }
});
