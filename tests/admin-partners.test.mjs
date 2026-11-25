// DEV-190: the home-page partners ribbon is managed from /admin → Partners.
// API: contract columns never reach the admin browser, is_active is always set, logos go to site-media/partners.
// UI: the Partners tab adds a partner (starts hidden) with an uploaded logo; the ribbon shows only what the
// RPC returns and disappears when no partner is published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import contentHandler from '../api/admin/content.js';
import uploadHandler from '../api/admin/upload.js';
import { sha256Hex } from '../api/_lib/adminSession.js';
import { CONTENT_TYPES, validateRecord } from '../src/config/adminContentSchema.js';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const CSRF = 'csrf-token-for-tests';
const COOKIE = '__Host-sard_admin=mocktoken12345678901234567890123456789012;';
const ID = '11111111-2222-4333-8444-555555555555';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.SUPABASE_URL = 'https://mock.supabase.co';

async function withSupabase(respond, fn) {
  const csrfHash = await sha256Hex(CSRF);
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    url = String(url);
    if (url.includes('admin_sessions')) {
      if ((opts.method || 'GET') === 'PATCH') return new Response('', { status: 204 });
      return new Response(JSON.stringify([{ id: 's1', csrf_hash: csrfHash, expires_at: new Date(Date.now() + 3.6e6).toISOString(), last_seen_at: new Date().toISOString(), revoked_at: null }]), { status: 200 });
    }
    calls.push({ url, method: opts.method || 'GET', body: opts.body ? (typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body) : null });
    return respond(url, opts);
  };
  try { await fn(calls); } finally { globalThis.fetch = orig; }
}

function req(path, { method = 'GET', body } = {}) {
  const headers = { origin: 'https://sard.dev', cookie: COOKIE };
  if (method !== 'GET') headers['x-csrf-token'] = CSRF;
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return new Request(`https://sard.dev${path}`, { method, headers, body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined });
}
const ok = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('partners API: list without contract columns, create/update always active, logo upload folder', async () => {
  const select = CONTENT_TYPES.partners.select;
  assert.ok(!/contract|description_/.test(select), 'contract and internal description columns are not loaded');

  await withSupabase((url, opts) => (opts.method === 'POST' || opts.method === 'PATCH' ? ok([{ id: ID }], opts.method === 'POST' ? 201 : 200) : ok([])), async (calls) => {
    const list = await contentHandler(req('/api/admin/content?type=partners'));
    assert.equal(list.status, 200);
    assert.ok(calls[0].url.startsWith(`https://mock.supabase.co/rest/v1/partnerships?select=${select}&`));

    const created = await contentHandler(req('/api/admin/content?type=partners', { method: 'POST', body: { partner_name_ar: 'سباين', partner_name_en: 'Spine Designs', contract_details_en: 'secret', is_active: false } }));
    assert.equal(created.status, 201);
    const insert = calls.find((c) => c.method === 'POST').body;
    assert.equal(insert.is_active, true, 'admin partners are always active');
    assert.equal(insert.contract_details_en, undefined, 'unknown fields dropped');

    const hide = await contentHandler(req('/api/admin/content?type=partners', { method: 'PATCH', body: { id: ID, is_published: true } }));
    assert.equal(hide.status, 200);
    const patch = calls.find((c) => c.method === 'PATCH');
    assert.ok(patch.url.includes(`/rest/v1/partnerships?id=eq.${ID}&select=${select}`), 'update returns only safe columns');
    assert.deepEqual([patch.body.is_published, patch.body.is_active], [true, true]);
  });

  assert.ok(validateRecord('partners', { partner_name_ar: 'أ' }).errors.includes('partner_name_en'));
  assert.ok(validateRecord('partners', { partner_logo_url: 'javascript:alert(1)' }, { partial: true }).errors.includes('partner_logo_url'));

  await withSupabase(() => ok({}), async (calls) => {
    const form = new FormData();
    form.append('folder', 'partners');
    form.append('file', new File([PNG], 'logo.png', { type: 'image/png' }));
    const res = await uploadHandler(req('/api/admin/upload', { method: 'POST', body: form }));
    assert.equal(res.status, 201);
    assert.match((await res.json()).url, /\/site-media\/partners\/[0-9a-f-]{36}\.png$/);
    assert.ok(calls[0].url.includes('/storage/v1/object/site-media/partners/'));
  });
});

async function launch() {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  return chromium.launch(opts);
}

test('Admin Partners tab adds a hidden partner with a logo (AR/EN, desktop and 375px)', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);
        let rows = [{ id: ID, partner_name_ar: 'شريك قديم', partner_name_en: 'Old Partner', partner_logo_url: null, is_published: false, display_order: 0 }];
        const writes = [];
        const uploads = [];
        await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await page.route('**/api/admin/session', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, csrfToken: CSRF }) }));
        await page.route('**/api/admin/appointments**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
        await page.route('**/api/admin/upload', (r) => {
          uploads.push(r.request().postDataBuffer()?.toString('latin1') || '');
          return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ url: `${BASE_URL}/logo.png` }) });
        });
        await page.route('**/api/admin/content**', async (route) => {
          const rq = route.request();
          assert.equal(new URL(rq.url()).searchParams.get('type'), 'partners');
          if (rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: rows }) });
          const body = JSON.parse(rq.postData());
          writes.push({ method: rq.method(), body, csrf: rq.headers()['x-csrf-token'] });
          if (rq.method() === 'POST') rows = [...rows, { id: 'new-1', ...body }];
          return route.fulfill({ status: 201, contentType: 'application/json', body: '{"data":{}}' });
        });

        await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="admin-tab-partners"]').click();
        const mgr = page.locator('[data-testid="manager-partners"]');
        await mgr.locator('[data-testid="content-row"]').first().waitFor({ timeout: 8000 });
        assert.ok((await mgr.textContent()).includes(lang === 'ar' ? 'شريك قديم' : 'Old Partner'));
        assert.equal(await mgr.locator('[data-testid="row-visibility"]').first().textContent(), lang === 'ar' ? 'مخفي' : 'Hidden');

        await mgr.getByRole('button', { name: lang === 'ar' ? 'إضافة شريك' : 'Add partner' }).click();
        const editor = page.locator('[data-testid="content-editor"]');
        await editor.waitFor();
        assert.equal(await editor.locator('#f-is_published').isChecked(), false, 'new partners start hidden');
        assert.equal(await editor.locator('[id^="f-contract"]').count(), 0, 'no contract fields in the form');
        await editor.locator('#f-partner_name_ar').fill('سباين ديزاينز');
        await editor.locator('#f-partner_name_en').fill('Spine Designs');
        await editor.locator('[data-testid="upload-partner_logo_url"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(PNG) });
        await page.waitForFunction(() => document.querySelector('[data-testid="content-editor"] img'));
        assert.ok(uploads[0].includes('partners'), 'upload goes to the partners folder');
        await editor.locator('button[type="submit"]').click();
        await editor.waitFor({ state: 'detached' });
        const post = writes.find((w) => w.method === 'POST');
        assert.equal(post.body.partner_name_en, 'Spine Designs');
        assert.equal(post.body.partner_logo_url, `${BASE_URL}/logo.png`);
        assert.equal(post.csrf, CSRF);
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="manager-partners"] [data-testid="content-row"]').length === 2);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/admin partners ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('Home ribbon follows the published partners: empty → hidden, published → shown', async () => {
  const browser = await launch();
  try {
    for (const partners of [[], [{ id: ID, partner_name_ar: 'سباين ديزاينز', partner_name_en: 'Spine Designs', partner_logo_url: null, display_order: 1 }]]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.addInitScript(() => { try { localStorage.setItem('i18nextLng', 'en'); } catch { /* ignore */ } });
      await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('get_published_partners') ? JSON.stringify(partners) : '[]' }));
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const section = page.locator('section#partners');
      if (partners.length === 0) assert.equal(await section.count(), 0, 'no ribbon when nothing is published');
      else assert.ok((await section.textContent()).includes('Spine Designs'), 'published partner shown');
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
