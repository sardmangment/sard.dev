// tests/footer-location.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('HF-15: Footer component specifies Alexandria only (DEV-100)', () => {
  const footerPath = path.resolve(__dirname, '../src/components/layout/Footer.tsx');
  const footerContent = fs.readFileSync(footerPath, 'utf8');

  assert.ok(
    footerContent.includes("t('الإسكندرية', 'Alexandria')"),
    'Footer must contain t(\'الإسكندرية\', \'Alexandria\')'
  );
  assert.ok(
    !footerContent.includes('Cairo'),
    'Footer must not contain "Cairo"'
  );
  assert.ok(
    !footerContent.includes('القاهرة'),
    'Footer must not contain "القاهرة"'
  );
});
