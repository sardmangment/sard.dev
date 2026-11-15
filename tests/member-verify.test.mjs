import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INVALID_MEMBER_ID = '00000000-0000-0000-0000-000000000000';

test('Member Verification code audit: Decision D-19 compliance & safe column projections', () => {
  const pagePath = resolve(__dirname, '../src/pages/MemberVerifyPage.tsx');
  const code = readFileSync(pagePath, 'utf-8');

  // 1. Must NOT contain mailto:, tel:, or wa.me
  assert.ok(!code.includes('mailto:'), 'MemberVerifyPage must NOT contain mailto: links (Decision D-19)');
  assert.ok(!code.includes('tel:'), 'MemberVerifyPage must NOT contain tel: links (Decision D-19)');
  assert.ok(!code.includes('wa.me'), 'MemberVerifyPage must NOT contain WhatsApp links (Decision D-19)');

  // 2. Must NOT query sensitive columns from team_members
  assert.ok(!code.includes('.select(\'*\')'), 'Must NOT call select(\'*\') on team_members');
  assert.ok(!code.includes('email'), 'Must NOT request email column in query or interface');
  assert.ok(!code.includes('phone'), 'Must NOT request phone column in query or interface');
  assert.ok(!code.includes('linkedin'), 'Must NOT request linkedin column in query or interface');

  // 3. Must specify safe column projection
  assert.ok(
    code.includes('id, name_ar, name_en, role_ar, role_en, photo_url, bio_ar, bio_en, is_admin, is_active, join_date'),
    'Must explicitly project safe columns only'
  );

  // 4. Must handle missing team_member_projects gracefully
  assert.ok(
    code.includes('team_member_projects'),
    'Must handle team_member_projects query safely'
  );
});

test('Member Verification live browser test: Invalid ID renders graceful not-found state', async () => {
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE_URL}/member/${INVALID_MEMBER_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify Not Found heading
    const heading = page.locator('h1');
    await heading.waitFor({ state: 'visible', timeout: 5000 });
    const headingText = await heading.textContent();
    assert.ok(
      headingText.includes('العضو غير موجود') || headingText.includes('Member not found'),
      `Expected not-found heading for invalid ID, got: ${headingText}`
    );

    // Verify Back to Home link exists
    const backBtn = page.locator('a[href="/"]');
    assert.ok((await backBtn.count()) >= 1, 'Back to Home link must exist in not-found state');

    // Verify 0 mailto: and 0 tel: links in DOM
    const mailtoLinks = await page.locator('a[href^="mailto:"]').count();
    const telLinks = await page.locator('a[href^="tel:"]').count();
    assert.strictEqual(mailtoLinks, 0, 'DOM must contain 0 mailto links');
    assert.strictEqual(telLinks, 0, 'DOM must contain 0 tel links');
  } finally {
    await browser.close();
  }
});
