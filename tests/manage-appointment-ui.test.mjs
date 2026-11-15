import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

test('UI Regression: Manage Appointment and Admin workflows (Arabic/English, Desktop/Mobile)', async () => {
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    // Intercept Supabase RPC calls from page
    await page.route('**/rest/v1/rpc/get_appointment_by_token', async (route) => {
      try {
        const postData = route.request().postDataJSON();
        if (postData && postData.p_id === '11111111-2222-3333-4444-555555555555') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
              id: '11111111-2222-3333-4444-555555555555',
              date: '2026-11-25',
              time_slot: '02:00 PM',
              service_type: 'AI Strategic Advisory',
              status: 'confirmed',
            }]),
          });
        }
      } catch {}

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/rpc/cancel_appointment_by_token', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'true',
      });
    });

    // Auto-accept confirmation dialogs
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // ------------------------------------------------------------------------
    // 1. Invalid / Expired Token - Desktop (1280px)
    // ------------------------------------------------------------------------
    await page.goto(`${BASE_URL}/calendar/manage/00000000-0000-0000-0000-000000000000#t=invalidtoken123`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1000);

    // Verify neutral "Link Invalid or Expired" badge in English or Arabic
    const alertHeading = page.locator('h1');
    await alertHeading.waitFor({ state: 'visible', timeout: 5000 });
    const headingText = await alertHeading.textContent();
    assert.ok(
      headingText.includes('Link Invalid or Expired') || headingText.includes('الرابط غير صالح أو منتهي الصلاحية'),
      `Unexpected heading for invalid token: "${headingText}"`
    );

    // Verify Return to Calendar button exists and links to /calendar
    const backBtn = page.locator('a[href="/calendar"]').first();
    assert.ok(await backBtn.isVisible(), 'Back to Calendar link must be visible on invalid token state');

    // ------------------------------------------------------------------------
    // 2. Mobile Responsive Viewport (375px) - No Horizontal Overflow
    // ------------------------------------------------------------------------
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    assert.strictEqual(hasHorizontalOverflow, false, 'Manage Appointment page must not have horizontal scrollbar on mobile 375px');

    // ------------------------------------------------------------------------
    // 3. Mock Active Appointment Display & Verified Cancellation
    // ------------------------------------------------------------------------
    await page.goto(`${BASE_URL}/calendar/manage/11111111-2222-3333-4444-555555555555#t=a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1000);

    // Verify appointment details rendered
    const dateText = page.locator('text=2026-11-25').first();
    await dateText.waitFor({ state: 'visible', timeout: 10000 });
    assert.ok(await dateText.isVisible(), 'Appointment date 2026-11-25 must be displayed');

    const slotText = await page.locator('text=02:00 PM').first();
    assert.ok(await slotText.isVisible(), 'Appointment slot 02:00 PM must be displayed');

    const serviceText = await page.locator('text=AI Strategic Advisory').first();
    assert.ok(await serviceText.isVisible(), 'Appointment service must be displayed');

    // Verify shareable link copy input
    const copyInput = page.locator('input[readonly]').first();
    assert.ok(await copyInput.isVisible(), 'Private manage link input must be visible');
    const inputValue = await copyInput.inputValue();
    assert.ok(inputValue.includes('#t='), 'Private manage link must contain token in URL hash fragment');

    // Click Cancel Appointment button
    const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("إلغاء الموعد")').first();
    assert.ok(await cancelBtn.isVisible(), 'Cancel button must be visible for confirmed appointment');
    await cancelBtn.click();
    await page.waitForTimeout(1000);

    // Verify cancellation state reached
    const cancelledBadge = page.locator(':has-text("This booking has been cancelled"), :has-text("This appointment is cancelled"), :has-text("تم إلغاء هذا الحجز"), :has-text("تم إلغاء هذا الموعد")').first();
    await cancelledBadge.waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await cancelledBadge.isVisible(), 'Cancelled confirmation banner must be displayed after cancellation');

    // ------------------------------------------------------------------------
    // 4. Admin Page Viewport & Theme Verification
    // ------------------------------------------------------------------------
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // Password input and Login button must be visible
    const passInput = page.locator('input[type="password"]');
    assert.ok(await passInput.isVisible(), 'Admin password input must be visible on /admin');

    const loginBtn = page.locator('button[type="submit"]');
    assert.ok(await loginBtn.isVisible(), 'Admin submit login button must be visible on /admin');

    // Verify 375px mobile responsiveness
    const adminOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    assert.strictEqual(adminOverflow, false, 'Admin page must not overflow horizontally on 375px mobile');

    console.log('✅ UI Regression: All Manage Appointment & Admin flows verified successfully in Playwright');
    await page.close();
  } finally {
    await browser.close();
  }
});
