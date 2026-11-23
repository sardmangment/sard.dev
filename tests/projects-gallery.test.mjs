import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

test('Projects Gallery (/projects) Playwright live rendering, fallback, and responsive tests', async () => {
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
    // 1. Desktop 1280px test
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify page title and header
    const heading = page.locator('h1');
    await heading.waitFor({ state: 'visible', timeout: 5000 });
    const headingText = await heading.textContent();
    assert.ok(
      headingText.includes('مشاريعنا') || headingText.includes('Our Projects'),
      `Heading must be Our Projects (DEV-188), got: ${headingText}`
    );

    // Verify Navbar is mounted
    const navbar = page.locator('nav');
    assert.strictEqual(await navbar.count(), 1, 'Navbar must be visible');

    // Check project cards
    const cards = page.locator('main .group');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} project cards on /projects`);

    if (cardCount > 0) {
      assert.ok(cardCount >= 2, `Expected at least 2 live projects, found: ${cardCount}`);

      // Verify card 1 has an image
      const card1Img = cards.nth(0).locator('img');
      assert.strictEqual(await card1Img.count(), 1, 'First project card must render image');

      // Verify card 2 renders .img-fallback
      const card2Fallback = cards.nth(1).locator('.img-fallback');
      assert.strictEqual(await card2Fallback.count(), 1, 'Second project card must render fallback placeholder');

      // Verify card details link points to /project/:id
      const detailsLink = cards.nth(0).locator('a[href^="/project/"]');
      assert.ok(await detailsLink.count() >= 1, 'Project card must contain link to /project/:id');
      const href = await detailsLink.first().getAttribute('href');
      assert.ok(href.startsWith('/project/'), `Details link must start with /project/, got: ${href}`);
    } else {
      // Empty state verification if no projects in DB
      const emptyState = page.locator('h2:has-text("لا توجد مشاريع منشورة حالياً"), h2:has-text("No Projects Published Yet")');
      assert.strictEqual(await emptyState.count(), 1, 'Empty state must be visible if 0 projects');
    }

    // Capture desktop screenshot
    await page.screenshot({
      path: 'C:/Users/PCM/.gemini/antigravity/brain/76204846-e0f1-49d5-b395-bd7a2cf59f48/white_mode_projects_desktop.png'
    });
    console.log('✔ Projects Gallery Desktop verified and screenshot saved');

    // 2. Mobile 375px test
    const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await mobilePage.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(2000);

    const mobileHeading = mobilePage.locator('h1');
    assert.ok(await mobileHeading.isVisible(), 'Mobile heading must be visible');

    await mobilePage.screenshot({
      path: 'C:/Users/PCM/.gemini/antigravity/brain/76204846-e0f1-49d5-b395-bd7a2cf59f48/white_mode_projects_mobile.png'
    });
    console.log('✔ Projects Gallery Mobile (375px) verified and screenshot saved');
  } finally {
    await browser.close();
  }
});
