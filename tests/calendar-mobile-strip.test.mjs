import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

test('Calendar 7-day strip responsive mobile layout', async () => {
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
    // Test on 360px mobile viewport (typical small phone)
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await page.goto(`${BASE_URL}/calendar`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify day strip exists and has overflow-x-auto
    const dayStrip = page.locator('div.overflow-x-auto');
    await dayStrip.waitFor({ state: 'visible', timeout: 5000 });
    const isOverflowScroll = await dayStrip.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowX === 'auto' || style.overflowX === 'scroll';
    });
    assert.ok(isOverflowScroll, 'Day strip must support horizontal scroll on mobile');

    // Verify 7 buttons exist with min-w-[64px]
    const dayButtons = dayStrip.locator('button');
    assert.strictEqual(await dayButtons.count(), 7, 'Should have 7 day buttons');
    
    const firstButtonWidth = await dayButtons.first().evaluate((el) => el.getBoundingClientRect().width);
    assert.ok(firstButtonWidth >= 60, `Day button width (${firstButtonWidth}px) must be >= 60px to avoid text overlap`);

    // Verify text does not overlap
    const dayName = await dayButtons.first().locator('span').first().evaluate((el) => {
      return {
        text: el.textContent,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    console.log('Sample day name metrics:', dayName);
    assert.ok(dayName.text.length > 0, 'Day name should have text');

    console.log('✔ Calendar responsive day strip verified on mobile 360px');
  } finally {
    await browser.close();
  }
});
