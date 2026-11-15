import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

test('Mobile Navigation Drawer: responsive visibility, accessibility, escape key, and scroll lock', async () => {
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
    // 1. Desktop test: Hamburger button must be hidden on >= 640px
    const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await desktopPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForTimeout(1000);

    const desktopHamburger = desktopPage.locator('button[aria-label="فتح قائمة التنقل"], button[aria-label="Open navigation menu"]');
    const isDesktopVisible = await desktopHamburger.isVisible();
    assert.strictEqual(isDesktopVisible, false, 'Hamburger menu button must be hidden on desktop');
    await desktopPage.close();

    // 2. Mobile test: Viewport 375x667 (iPhone SE)
    const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await mobilePage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1000);

    const mobileHamburger = mobilePage.locator('button[aria-label="فتح قائمة التنقل"], button[aria-label="Open navigation menu"]');
    await mobileHamburger.waitFor({ state: 'visible', timeout: 5000 });
    assert.strictEqual(await mobileHamburger.isVisible(), true, 'Hamburger button must be visible on mobile');

    // 3. Open drawer
    await mobileHamburger.click();
    const drawer = mobilePage.locator('aside[role="dialog"]');
    await drawer.waitFor({ state: 'visible', timeout: 3000 });
    assert.strictEqual(await drawer.count(), 1, 'Drawer dialog must be opened');

    // Check background scroll lock
    const bodyOverflowLocked = await mobilePage.evaluate(() => document.body.style.overflow);
    assert.strictEqual(bodyOverflowLocked, 'hidden', 'Body overflow must be hidden while drawer is open');

    // Verify valid navigation links exist
    const calendarLink = drawer.locator('a[href="/calendar"]');
    assert.ok(await calendarLink.count() >= 1, 'Calendar link must exist in drawer');
    const aiLink = drawer.locator('a[href="/ai"]');
    assert.strictEqual(await aiLink.count(), 1, 'AI chat link must exist in drawer');

    // 4. Test keyboard Escape closes drawer
    await mobilePage.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden', timeout: 3000 });
    assert.strictEqual(await drawer.isVisible(), false, 'Escape key must close the drawer');

    // Verify background scroll is restored
    const bodyOverflowRestored = await mobilePage.evaluate(() => document.body.style.overflow);
    assert.strictEqual(bodyOverflowRestored, '', 'Body overflow must be restored after closing drawer');

    console.log('✔ Mobile Navigation Drawer 100% verified with Playwright');
  } finally {
    await browser.close();
  }
});
