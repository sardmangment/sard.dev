// DEV-212: AI assistant API key set from /admin.
// API: admin session + CSRF, the key is never returned, it is tested with Google before saving,
// /api/chat prefers the saved key and falls back to the Cloudflare secret. UI: AR/EN, desktop and 375px.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import keyHandler from '../api/admin/assistant-key.js';
import chatHandler from '../api/chat.js';
import { getAssistantKey, clearAssistantKeyCache } from '../api/_lib/assistantKey.js';
import { sha256Hex } from '../api/_lib/adminSession.js';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const CSRF = 'csrf-token-for-tests';
const COOKIE = '__Host-sard_admin=mocktoken12345678901234567890123456789012;';
const GOOD = 'AIzaSyTESTtestTESTtestTESTtestTEST1234';
const ENV_KEY = 'AIzaSyENVenvENVenvENVenvENVenvENVenv0000';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.SUPABASE_URL = 'https://mock.supabase.co';

// Fake Supabase (sessions, rate limit, app_settings) + Google.
async function withBackend({ stored = null, googleOk = true, dbDown = false } = {}, fn) {
  const csrfHash = await sha256Hex(CSRF);
  const state = { stored, calls: [] };
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    url = String(url);
    const method = opts.method || 'GET';
    const headers = opts.headers || {};
    if (url.includes('admin_sessions')) {
      if (method === 'PATCH') return new Response('', { status: 204 });
      return new Response(JSON.stringify([{ id: 's1', csrf_hash: csrfHash, expires_at: new Date(Date.now() + 3.6e6).toISOString(), last_seen_at: new Date().toISOString(), revoked_at: null }]), { status: 200 });
    }
    if (url.includes('hit_rate_limit')) return new Response('true', { status: 200 });
    state.calls.push({ url, method, body: typeof opts.body === 'string' ? JSON.parse(opts.body) : null, headers });
    if (url.includes('/rest/v1/app_settings')) {
      if (dbDown) return new Response('{}', { status: 500 });
      if (method === 'GET') return new Response(JSON.stringify(state.stored ? [{ value: state.stored, updated_at: '2026-11-26T10:00:00Z' }] : []), { status: 200 });
      if (method === 'POST') { state.stored = JSON.parse(opts.body).value; return new Response('', { status: 201 }); }
      if (method === 'DELETE') { state.stored = null; return new Response(null, { status: 204 }); }
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/v1beta/models?')) return new Response('{}', { status: googleOk ? 200 : 400 });
    if (url.includes(':generateContent')) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }), { status: 200 });
    }
    return new Response('not mocked', { status: 599 });
  };
  clearAssistantKeyCache();
  try { await fn(state); } finally { globalThis.fetch = orig; clearAssistantKeyCache(); }
}

function req(method = 'GET', body, { csrf = CSRF, cookie = COOKIE } = {}) {
  const headers = { origin: 'https://sard.dev' };
  if (cookie) headers.cookie = cookie;
  if (csrf && method !== 'GET') headers['x-csrf-token'] = csrf;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://sard.dev/api/admin/assistant-key', { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}

test('assistant key API: admin only, CSRF on writes, never returns the key', async () => {
  assert.equal((await keyHandler(req('GET', undefined, { cookie: null }))).status, 401);
  await withBackend({ stored: GOOD }, async (state) => {
    assert.equal((await keyHandler(req('POST', { key: GOOD }, { csrf: null }))).status, 403, 'no CSRF');
    assert.equal((await keyHandler(req('DELETE', undefined, { csrf: 'wrong' }))).status, 403, 'bad CSRF');
    const res = await keyHandler(req('GET'));
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes(GOOD.slice(0, -4)), 'key not returned');
    const data = JSON.parse(text);
    assert.deepEqual([data.source, data.last4], ['admin', GOOD.slice(-4)]);
    assert.equal(state.stored, GOOD, 'nothing changed');
  });
});

test('assistant key API: rejects bad or non-working keys, saves a working one, removes it', async () => {
  await withBackend({ googleOk: false }, async (state) => {
    assert.equal((await keyHandler(req('POST', { key: 'short' }))).status, 400);
    assert.equal((await keyHandler(req('POST', { key: 'AIza has spaces and is long enough!!' }))).status, 400);
    const rejected = await keyHandler(req('POST', { key: GOOD }));
    assert.equal(rejected.status, 422);
    assert.equal(state.stored, null, 'a key Google rejects is not saved');
  });
  await withBackend({}, async (state) => {
    const ok = await keyHandler(req('POST', { key: `  ${GOOD}  ` }));
    assert.equal(ok.status, 200);
    const data = await ok.json();
    assert.equal(data.last4, GOOD.slice(-4));
    assert.ok(!JSON.stringify(data).includes(GOOD), 'response has no key');
    assert.equal(state.stored, GOOD, 'trimmed key saved');
    const test = state.calls.find((c) => c.url.includes('generativelanguage'));
    assert.equal(test.headers['x-goog-api-key'], GOOD, 'tested with Google in a header, not the URL');
    const upsert = state.calls.find((c) => c.method === 'POST' && c.url.includes('app_settings'));
    assert.ok(upsert.url.includes('on_conflict=key') && upsert.headers.Prefer.includes('merge-duplicates'));
    assert.equal(upsert.body.key, 'gemini_api_key');

    const del = await keyHandler(req('DELETE'));
    assert.equal(del.status, 200);
    assert.equal(state.stored, null);
  });
});

test('chat uses the admin key first, then the Cloudflare secret, also when the database is down', async () => {
  process.env.GEMINI_API_KEY = ENV_KEY;
  try {
    await withBackend({ stored: GOOD }, async () => {
      assert.deepEqual(await getAssistantKey(), { key: GOOD, source: 'admin' });
    });
    await withBackend({}, async () => {
      assert.deepEqual(await getAssistantKey(), { key: ENV_KEY, source: 'env' });
    });
    await withBackend({ dbDown: true }, async () => {
      assert.deepEqual(await getAssistantKey(), { key: ENV_KEY, source: 'env' });
    });
    await withBackend({ stored: GOOD }, async (state) => {
      const res = await chatHandler(new Request('https://sard.dev/api/chat', {
        method: 'POST',
        headers: { origin: 'https://sard.dev', 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] }),
      }));
      assert.equal(res.status, 200);
      const gen = state.calls.find((c) => c.url.includes(':generateContent'));
      assert.equal(gen.headers['x-goog-api-key'], GOOD, 'chat sends the admin key to Google');
    });
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});

test('Admin Assistant tab: status, save (tested), remove with confirmation (AR/EN, desktop and 375px)', async () => {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  const browser = await chromium.launch(opts);
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);
        let status = { source: 'env', last4: null, updatedAt: null, envConfigured: true };
        const writes = [];
        await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await page.route('**/api/admin/session', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, csrfToken: CSRF }) }));
        await page.route('**/api/admin/appointments**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
        await page.route('**/api/admin/assistant-key', async (route) => {
          const rq = route.request();
          if (rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(status) });
          const body = rq.postData() ? JSON.parse(rq.postData()) : null;
          writes.push({ method: rq.method(), body, csrf: rq.headers()['x-csrf-token'] });
          if (rq.method() === 'POST') {
            if (body.key !== GOOD) return route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"key_rejected"}' });
            status = { source: 'admin', last4: GOOD.slice(-4), updatedAt: '2026-11-26T10:00:00Z', envConfigured: true };
          } else {
            status = { source: 'env', last4: null, updatedAt: null, envConfigured: true };
          }
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(status) });
        });

        await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="admin-tab-assistant"]').click();
        const mgr = page.locator('[data-testid="manager-assistant"]');
        await mgr.locator('[data-source="env"]').waitFor({ timeout: 8000 });
        assert.equal(await mgr.locator('#assistant-key').getAttribute('type'), 'password', 'key hidden while typing');

        // Rejected by Google → error, still the Cloudflare key
        await mgr.locator('#assistant-key').fill('AIzaSyWRONGwrongWRONGwrongWRONGwrong');
        await mgr.locator('[data-testid="assistant-key-save"]').click();
        await mgr.locator('[data-testid="assistant-key-message"][role="alert"]').waitFor();
        assert.equal(await mgr.locator('[data-source="env"]').count(), 1);

        // Working key → saved, only the last 4 shown, input cleared
        await mgr.locator('#assistant-key').fill(GOOD);
        await mgr.locator('[data-testid="assistant-key-save"]').click();
        await mgr.locator('[data-source="admin"]').waitFor();
        assert.ok((await mgr.textContent()).includes(GOOD.slice(-4)));
        assert.ok(!(await page.content()).includes(GOOD.slice(0, 20)), 'full key not in the page');
        assert.equal(await mgr.locator('#assistant-key').inputValue(), '');
        assert.ok(writes.every((w) => w.csrf === CSRF), 'writes carry the CSRF token');

        // Remove with confirmation
        await mgr.locator('[data-testid="assistant-key-remove"]').click();
        await page.locator('[data-testid="assistant-key-remove-confirm-confirm"]').click();
        await mgr.locator('[data-source="env"]').waitFor();
        assert.equal(writes.at(-1).method, 'DELETE');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/admin assistant ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
