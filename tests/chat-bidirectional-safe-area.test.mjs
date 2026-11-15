import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

test('Chat bidirectional alignment and iOS safe area styling', async () => {
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
    // iPhone 14 Pro mobile viewport (393 x 852)
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.goto(`${BASE_URL}/ai`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify input exists with dir="auto"
    const input = page.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 5000 });
    const inputDir = await input.getAttribute('dir');
    assert.strictEqual(inputDir, 'auto', 'Chat input must have dir="auto" for natural typing');

    // Verify bottom container has safe-area styling
    const bottomBar = page.locator('div.sticky.bottom-0');
    await bottomBar.waitFor({ state: 'visible', timeout: 5000 });
    const bottomBarClass = await bottomBar.getAttribute('class');
    assert.ok(
      bottomBarClass.includes('env(safe-area-inset-bottom)'),
      'Bottom bar must include env(safe-area-inset-bottom)'
    );

    // Type an English message into the Arabic interface to test language independence
    await input.fill('How can Sard AI help automate our operations?');

    // Check viewport fit in meta tag
    const metaViewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    assert.ok(metaViewport.includes('viewport-fit=cover'), 'Viewport meta must include viewport-fit=cover');

    console.log('✔ Chat bidirectional alignment and iOS safe area verified with Playwright');
  } finally {
    await browser.close();
  }
});
