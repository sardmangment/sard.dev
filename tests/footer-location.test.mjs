// tests/footer-location.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('HF-15 / C-A10-A11: Footer shows the approved address "Alexandria, Egypt" (DEV-100)', () => {
  const footerPath = path.resolve(__dirname, '../src/components/layout/Footer.tsx');
  const footerContent = fs.readFileSync(footerPath, 'utf8');
  const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/en/translation.json'), 'utf8'));
  const ar = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/ar/translation.json'), 'utf8'));

  assert.ok(footerContent.includes("t('footer.address')"), 'Footer must render footer.address');
  assert.strictEqual(en.footer.address, 'Alexandria, Egypt');
  assert.strictEqual(ar.footer.address, 'الإسكندرية، مصر');
  assert.ok(!footerContent.includes('Cairo'), 'Footer must not contain "Cairo"');
  assert.ok(!footerContent.includes('القاهرة'), 'Footer must not contain "القاهرة"');
  assert.ok(footerContent.includes("to: '/team'"), 'Footer links the Team page (DEV-199)');
  assert.ok(!/twitter\.com|x\.com/.test(footerContent), 'Footer must not link to X/Twitter (C-A17)');
  assert.ok(footerContent.includes('to="/privacy"') && footerContent.includes('to="/terms"'), 'Footer must link the legal notices');
});
