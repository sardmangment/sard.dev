// DEV-199: /team (owners, department heads, staff) managed from /admin → Team, and the "About Sard" menu.
// API: only current members, never contact columns; new members are active current members; photos go to
// site-media/team. UI: admin tab, navbar dropdown (desktop) and drawer group (375px), AR/EN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import contentHandler from '../api/admin/content.js';
import uploadHandler from '../api/admin/upload.js';
import { sha256Hex } from '../api/_lib/adminSession.js';
import { CONTENT_TYPES, validateRecord } from '../src/config/adminContentSchema.js';
import { SITE_NAV } from '../src/config/navigation.js';
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
    calls.push({ url, method: opts.method || 'GET', body: typeof opts.body === 'string' ? JSON.parse(opts.body) : null });
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

test('team API: current members only, no contact columns, new members active, photo folder', async () => {
  const { select } = CONTENT_TYPES.team;
  assert.ok(!/email|phone|linkedin|bio|join_date|consent/.test(select), 'private columns are never loaded');

  await withSupabase((url, opts) => (['POST', 'PATCH', 'DELETE'].includes(opts.method) ? ok([{ id: ID }], opts.method === 'POST' ? 201 : 200) : ok([])), async (calls) => {
    assert.equal((await contentHandler(req('/api/admin/content?type=team'))).status, 200);
    assert.ok(calls[0].url.includes('/rest/v1/team_members?select=') && calls[0].url.includes('&member_type=eq.current&'), 'list limited to current members');

    const created = await contentHandler(req('/api/admin/content?type=team', { method: 'POST', body: { name_ar: 'أ', name_en: 'A', role_ar: 'مدير', role_en: 'Head', tier: 'manager', email: 'x@y.z', is_published: false } }));
    assert.equal(created.status, 201);
    const insert = calls.find((c) => c.method === 'POST');
    assert.deepEqual([insert.body.is_active, insert.body.member_type, insert.body.tier], [true, 'current', 'manager']);
    assert.equal(insert.body.email, undefined, 'unknown fields dropped');
    assert.ok(insert.url.includes(`select=${select}`), 'insert returns only safe columns');

    await contentHandler(req('/api/admin/content?type=team', { method: 'PATCH', body: { id: ID, is_published: true } }));
    const patch = calls.find((c) => c.method === 'PATCH');
    assert.ok(patch.url.includes(`id=eq.${ID}&member_type=eq.current&select=`), 'update limited to current members');
    assert.equal(patch.body.is_active, undefined, 'hiding/publishing does not touch is_active (verification)');

    await contentHandler(req(`/api/admin/content?type=team&id=${ID}`, { method: 'DELETE' }));
    assert.ok(calls.find((c) => c.method === 'DELETE').url.includes(`id=eq.${ID}&member_type=eq.current`), 'delete limited to current members');
  });

  assert.ok(validateRecord('team', { name_ar: 'أ', name_en: 'A', role_ar: 'م', role_en: 'R', tier: 'boss' }).errors.includes('tier'));
  assert.ok(validateRecord('team', { name_ar: 'أ', name_en: 'A' }).errors.includes('role_en'));

  await withSupabase(() => ok({}), async (calls) => {
    const form = new FormData();
    form.append('folder', 'team');
    form.append('file', new File([PNG], 'p.png', { type: 'image/png' }));
    assert.equal((await uploadHandler(req('/api/admin/upload', { method: 'POST', body: form }))).status, 201);
    assert.ok(calls[0].url.includes('/storage/v1/object/site-media/team/'));
  });
});

test('navigation: "About Sard" groups About, Team and FAQ; Contact stays top-level; 6 desktop items', () => {
  const group = SITE_NAV.find((s) => s.children);
  assert.deepEqual(group.children.map((c) => c.to), ['/about', '/team', '/faq']);
  assert.deepEqual(SITE_NAV.filter((s) => !s.drawerOnly).map((s) => s.to || s.id), ['/', 'about-group', '/projects', '/careers', '/collaborations', '/contact']);
});

async function launch() {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  return chromium.launch(opts);
}

async function newPage(browser, viewport, lang) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  return { page, errors };
}

test('"About Sard" menu: dropdown on desktop, group in the 375px drawer (AR/EN)', async () => {
  const browser = await launch();
  try {
    for (const lang of ['ar', 'en']) {
      const labels = lang === 'ar' ? ['من نحن', 'فريق سرد', 'الأسئلة الشائعة'] : ['About', 'Sard Team', 'FAQ'];

      const { page, errors } = await newPage(browser, { width: 1280, height: 800 }, lang);
      await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
      const btn = page.locator('[data-testid="nav-group-about-group"]');
      await btn.waitFor({ timeout: 8000 });
      assert.equal(await btn.getAttribute('aria-expanded'), 'false');
      await btn.click();
      const items = page.locator('#nav-menu-about-group [role="menuitem"]');
      assert.deepEqual((await items.allTextContents()).map((s) => s.trim()), labels);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#nav-menu-about-group').count(), 0, 'Escape closes');
      await btn.click();
      await page.mouse.click(5, 700);
      assert.equal(await page.locator('#nav-menu-about-group').count(), 0, 'outside click closes');
      await btn.click();
      await items.nth(1).click();
      await page.waitForURL('**/team');
      assert.equal(await page.locator('#nav-menu-about-group').count(), 0, 'closes after navigating');
      await page.waitForFunction(() => document.querySelector('[data-testid="nav-group-about-group"]')?.className.includes('text-brand-orange'), null, { timeout: 5000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `navbar ${lang} overflows by ${overflow}px`);
      assert.deepEqual(errors, []);
      await page.close();

      const m = await newPage(browser, { width: 375, height: 812 }, lang);
      await m.page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      await m.page.locator('button[aria-label="' + (lang === 'ar' ? 'فتح قائمة التنقل' : 'Open navigation menu') + '"]').click();
      const group = m.page.locator('[data-testid="drawer-group-about-group"]');
      await group.waitFor();
      assert.equal(await group.getAttribute('aria-expanded'), 'false');
      await group.click();
      const links = m.page.locator('#drawer-about-group a');
      assert.deepEqual((await links.allTextContents()).map((s) => s.trim()), labels);
      await links.nth(1).click();
      await m.page.waitForURL('**/team');
      assert.deepEqual(m.errors, []);
      await m.page.close();
    }
  } finally {
    await browser.close();
  }
});

test('Admin Team tab: add a department head (AR/EN, desktop and 375px)', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const { page, errors } = await newPage(browser, viewport, lang);
        let rows = [{ id: ID, name_ar: 'خالد', name_en: 'Khaled', role_ar: 'المدير العام', role_en: 'General Manager', tier: 'owner', photo_url: null, is_published: true, display_order: 1 }];
        const writes = [];
        await page.route('**/api/admin/session', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, csrfToken: CSRF }) }));
        await page.route('**/api/admin/appointments**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
        await page.route('**/api/admin/upload', (r) => r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ url: `${BASE_URL}/p.png` }) }));
        await page.route('**/api/admin/content**', async (route) => {
          const rq = route.request();
          if (rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: rows }) });
          const body = JSON.parse(rq.postData());
          writes.push({ url: rq.url(), method: rq.method(), body });
          if (rq.method() === 'POST') rows = [...rows, { id: 'new-1', ...body }];
          return route.fulfill({ status: 201, contentType: 'application/json', body: '{"data":{}}' });
        });

        await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="admin-tab-team"]').click();
        const mgr = page.locator('[data-testid="manager-team"]');
        await mgr.locator('[data-testid="content-row"]').first().waitFor({ timeout: 8000 });
        const text = await mgr.textContent();
        assert.ok(text.includes(lang === 'ar' ? 'المدير العام' : 'General Manager'), 'job title shown under the name');
        assert.ok(text.includes(lang === 'ar' ? 'شريك مؤسس' : 'Founding partner'), 'section badge shown');

        await mgr.getByRole('button', { name: lang === 'ar' ? 'إضافة عضو' : 'Add member' }).click();
        const editor = page.locator('[data-testid="content-editor"]');
        await editor.waitFor();
        assert.equal(await editor.locator('#f-is_published').isChecked(), false, 'new members start hidden');
        assert.equal(await editor.locator('#f-tier').inputValue(), 'staff');
        await editor.locator('#f-name_ar').fill('سارة');
        await editor.locator('#f-name_en').fill('Sara');
        await editor.locator('#f-role_ar').fill('مديرة التسويق');
        await editor.locator('#f-role_en').fill('Head of Marketing');
        await editor.locator('#f-tier').selectOption('manager');
        await editor.locator('[data-testid="upload-photo_url"]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(PNG) });
        await page.waitForFunction(() => document.querySelector('[data-testid="content-editor"] img'));
        await editor.locator('button[type="submit"]').click();
        await editor.waitFor({ state: 'detached' });
        const post = writes.find((w) => w.method === 'POST');
        assert.ok(post.url.includes('type=team'));
        assert.deepEqual([post.body.tier, post.body.role_en, post.body.photo_url], ['manager', 'Head of Marketing', `${BASE_URL}/p.png`]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/admin team ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
