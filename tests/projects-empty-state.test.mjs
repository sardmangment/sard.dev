import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

test('Projects Gallery Empty State renders correctly when projects table is empty', async () => {
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

    // Mock empty projects response to test the empty state reliably
    await page.route('**/rest/v1/projects*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify Empty State container is rendered
    const emptyStateTitle = page.locator('h2:has-text("لا توجد مشاريع منشورة حالياً"), h2:has-text("No Projects Published Yet")');
    await emptyStateTitle.waitFor({ state: 'visible', timeout: 5000 });
    assert.strictEqual(await emptyStateTitle.count(), 1, 'Empty state heading must be visible when projects list is empty');

    // Verify Back to Home button exists
    const backToHomeBtn = page.locator('a[href="/"] button:has-text("العودة للرئيسية"), a[href="/"] button:has-text("Back to Home")');
    assert.strictEqual(await backToHomeBtn.count(), 1, 'Back to Home button must exist');

    // Capture Empty State screenshot
    await page.screenshot({
      path: 'C:/Users/PCM/.gemini/antigravity/brain/76204846-e0f1-49d5-b395-bd7a2cf59f48/white_mode_projects_empty_state.png',
    });
    console.log('✔ Projects Gallery Empty State verified and screenshot saved');
  } finally {
    await browser.close();
  }
});
