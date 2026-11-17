import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOriginAllowed } from '../api/_lib/adminSession.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');

test('rate-limit RPCs revoke EXECUTE from anon and authenticated, not only PUBLIC', () => {
  for (const file of ['20261115_rate_limits.sql', '20261117_rate_limits_revoke_anon.sql']) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const fn of ['hit_rate_limit(text, int, int)', 'cleanup_expired_rate_limits()']) {
      assert.ok(
        sql.includes(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`),
        `${file} must revoke ${fn} from anon and authenticated`
      );
    }
  }
});

test('origin allow-list accepts only this Pages project, not every *.pages.dev or *.vercel.app site', () => {
  assert.strictEqual(isOriginAllowed('https://sard-unified.pages.dev'), true);
  assert.strictEqual(isOriginAllowed('https://abc123.sard-unified.pages.dev'), true);
  assert.strictEqual(isOriginAllowed('https://attacker.pages.dev'), false);
  assert.strictEqual(isOriginAllowed('https://evil-sard-unified.pages.dev'), false);
  assert.strictEqual(isOriginAllowed('https://anything.vercel.app'), false);
  assert.strictEqual(isOriginAllowed('http://sard-unified.pages.dev'), false);
});
