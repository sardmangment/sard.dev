import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const VALID_PROJECT_ID = 'a70286de-0294-4c1a-afea-7f74254cfc08';
const INVALID_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

test('Project Details code audit: Partner link points to /partners/:id', () => {
  const pagePath = resolve('src/pages/ProjectDetailsPage.tsx');
  const code = readFileSync(pagePath, 'utf-8');

  // Must link to /partners/:id and NOT to legacy /partnership/:id
  assert.ok(
    code.includes('/partners/${partnership.id}'),
    'Partner badge must link to /partners/:id'
  );
  assert.ok(
    !code.includes('/partnership/${partnership.id}'),
    'Partner badge must NOT link to legacy /partnership/:id'
  );

  // Must handle missing project_images table without crashing
  assert.ok(
    code.includes('Promise.allSettled'),
    'Queries must use Promise.allSettled to handle missing tables gracefully'
  );
});

test('Project Details live browser test with valid ID, not-found state, and screenshots', async () => {
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
    // 1. Valid ID test on Desktop (1280px)
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE_URL}/project/${VALID_PROJECT_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify Project Title rendered
    const title = page.locator('h1');
    await title.waitFor({ state: 'visible', timeout: 5000 });
    const titleText = await title.textContent();
    assert.ok(
      titleText.includes('منظومة حوكمة وأتمتة العمليات') || titleText.includes('Operational Governance'),
      `Project title expected for valid ID, got: ${titleText}`
    );

    // Verify main image rendered
    const mainImg = page.locator('main img');
    assert.ok(await mainImg.count() >= 1, 'Main project image must be rendered');

    // Verify back navigation link exists
    const backLink = page.locator('a[href="/projects"]');
    assert.ok(await backLink.count() >= 1, 'Back to projects link must exist');

    // Capture valid project details screenshot
    await page.screenshot({
      path: 'C:/Users/PCM/.gemini/antigravity/brain/76204846-e0f1-49d5-b395-bd7a2cf59f48/white_mode_project_details_valid.png',
    });
    console.log('✔ Valid Project Details page verified and screenshot saved');

    // 2. Mobile (375px) responsive test
    const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await mobilePage.goto(`${BASE_URL}/project/${VALID_PROJECT_ID}`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(2000);

    const mobileTitle = mobilePage.locator('h1');
    assert.ok(await mobileTitle.isVisible(), 'Mobile project title must be visible');

    await mobilePage.screenshot({
      path: 'C:/Users/PCM/.gemini/antigravity/brain/76204846-e0f1-49d5-b395-bd7a2cf59f48/white_mode_project_details_mobile.png',
    });
    console.log('✔ Mobile Project Details (375px) verified and screenshot saved');

    // 3. Invalid ID test (Not Found state)
    const notFoundPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await notFoundPage.goto(`${BASE_URL}/project/${INVALID_PROJECT_ID}`, { waitUntil: 'domcontentloaded' });
    await notFoundPage.waitForTimeout(2000);

    const notFoundHeading = notFoundPage.locator('h1:has-text("المشروع غير موجود"), h1:has-text("Project not found")');
    await notFoundHeading.waitFor({ state: 'visible', timeout: 5000 });
    assert.strictEqual(await notFoundHeading.count(), 1, 'Not Found heading must be visible for invalid project ID');

    // Verify Return to Projects button in not-found state
    const returnBtn = notFoundPage.locator('a[href="/projects"] button');
    assert.ok(await returnBtn.count() >= 1, 'Return to Projects button must exist in not-found view');

    await notFoundPage.screenshot({
      path: 'C:/Users/PCM/.gemini/antigravity/brain/76204846-e0f1-49d5-b395-bd7a2cf59f48/white_mode_project_details_not_found.png',
    });
    console.log('✔ Invalid Project ID Not-Found state verified and screenshot saved');
  } finally {
    await browser.close();
  }
});
