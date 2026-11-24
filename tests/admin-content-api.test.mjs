// DEV-194: /api/admin/content and /api/admin/upload — session + CSRF required, validation,
// create / update / hide / reorder / delete through the service role, image checks, no DB error leakage.
import test from 'node:test';
import assert from 'node:assert/strict';
import contentHandler from '../api/admin/content.js';
import uploadHandler, { sniffImage } from '../api/admin/upload.js';
import { sha256Hex } from '../api/_lib/adminSession.js';
import { validateRecord } from '../src/config/adminContentSchema.js';

const CSRF = 'csrf-token-for-tests';
const COOKIE = '__Host-sard_admin=mocktoken12345678901234567890123456789012;';
const ID = '11111111-2222-4333-8444-555555555555';
const ID2 = '66666666-7777-4888-9999-aaaaaaaaaaaa';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.SUPABASE_URL = 'https://mock.supabase.co';

// Stubs fetch: admin_sessions → valid session; everything else → `respond(url, opts)`.
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
    calls.push({ url, method: opts.method || 'GET', body: opts.body, headers: opts.headers });
    return respond(url, opts);
  };
  try { await fn(calls); } finally { globalThis.fetch = orig; }
}

function req(path, { method = 'GET', body, csrf = CSRF, origin = 'https://sard.dev', cookie = COOKIE } = {}) {
  const headers = { origin };
  if (cookie) headers.cookie = cookie;
  if (csrf && method !== 'GET') headers['x-csrf-token'] = csrf;
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return new Request(`https://sard.dev${path}`, { method, headers, body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined });
}

const ok = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('admin content: rejects foreign origin, missing session and missing / wrong CSRF', async () => {
  assert.equal((await contentHandler(req('/api/admin/content?type=projects', { origin: 'https://evil.com' }))).status, 403);
  assert.equal((await contentHandler(req('/api/admin/content?type=projects', { cookie: null }))).status, 401);
  await withSupabase(() => ok([]), async (calls) => {
    const noCsrf = await contentHandler(req('/api/admin/content?type=projects', { method: 'POST', body: { title_ar: 'أ', title_en: 'A' }, csrf: null }));
    assert.equal(noCsrf.status, 403);
    const badCsrf = await contentHandler(req('/api/admin/content?type=projects', { method: 'POST', body: { title_ar: 'أ', title_en: 'A' }, csrf: 'wrong' }));
    assert.equal(badCsrf.status, 403);
    assert.equal(calls.length, 0, 'no content request without a valid CSRF token');
  });
  const upload = await uploadHandler(req('/api/admin/upload', { method: 'POST', body: new FormData(), cookie: null }));
  assert.equal(upload.status, 401);
});

test('admin content: unknown type is rejected', async () => {
  await withSupabase(() => ok([]), async () => {
    const res = await contentHandler(req('/api/admin/content?type=admin_sessions'));
    assert.equal(res.status, 400);
  });
});

test('admin content: GET lists all rows in display order with the service role', async () => {
  await withSupabase(() => ok([{ id: ID, title_en: 'A', is_published: false }]), async (calls) => {
    const res = await contentHandler(req('/api/admin/content?type=projects'));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.length, 1);
    assert.ok(calls[0].url.startsWith('https://mock.supabase.co/rest/v1/projects?'));
    assert.ok(calls[0].url.includes('order=display_order.asc'));
    assert.equal(calls[0].headers.Authorization, 'Bearer test-service-key');
  });
});

test('admin content: POST validates fields and adds the row at the end', async () => {
  await withSupabase((url, opts) => {
    if (url.includes('order=display_order.desc')) return ok([{ display_order: 4 }]);
    return ok([{ id: ID, ...JSON.parse(opts.body) }], 201);
  }, async (calls) => {
    const bad = await contentHandler(req('/api/admin/content?type=projects', { method: 'POST', body: { title_ar: '', title_en: 'X', status: 'unknown', project_link: 'javascript:alert(1)' } }));
    assert.equal(bad.status, 400);
    const badBody = await bad.json();
    assert.deepEqual(badBody.fields.sort(), ['project_link', 'status', 'title_ar']);
    assert.equal(calls.length, 0, 'nothing written when invalid');

    const res = await contentHandler(req('/api/admin/content?type=projects', { method: 'POST', body: { title_ar: 'مشروع', title_en: 'Project', status: 'launched', project_date: '2026-11-01', image_url: '/projects/x.png', is_published: true, display_order: 999, id: 'x' } }));
    assert.equal(res.status, 201);
    const insert = calls.find((c) => c.method === 'POST');
    const sent = JSON.parse(insert.body);
    assert.equal(sent.display_order, 5, 'appended after the current last row');
    assert.equal(sent.id, undefined, 'client cannot choose the id');
    assert.equal(sent.title_en, 'Project');
    assert.equal(sent.description_ar, undefined);
  });
});

test('admin content: PATCH updates fields, hides a row, and reorders', async () => {
  await withSupabase((url, opts) => ok([{ id: ID, ...JSON.parse(opts.body || '{}') }]), async (calls) => {
    const hide = await contentHandler(req('/api/admin/content?type=collaborations', { method: 'PATCH', body: { id: ID, is_published: false } }));
    assert.equal(hide.status, 200);
    assert.ok(calls[0].url.endsWith(`/rest/v1/collaborations?id=eq.${ID}`));
    const sent = JSON.parse(calls[0].body);
    assert.equal(sent.is_published, false);
    assert.ok(sent.updated_at, 'updated_at set by the server');
    assert.equal(Object.keys(sent).length, 2, 'only the changed field + updated_at');

    const badId = await contentHandler(req('/api/admin/content?type=collaborations', { method: 'PATCH', body: { id: '1 or 1=1', is_published: false } }));
    assert.equal(badId.status, 400);

    calls.length = 0;
    const order = await contentHandler(req('/api/admin/content?type=openings', { method: 'PATCH', body: { order: [ID2, ID] } }));
    assert.equal(order.status, 200);
    assert.deepEqual(calls.map((c) => [c.url.split('?')[1], JSON.parse(c.body).display_order]), [[`id=eq.${ID2}`, 1], [`id=eq.${ID}`, 2]]);
    assert.ok(calls[0].url.includes('/rest/v1/job_openings?'));

    const dup = await contentHandler(req('/api/admin/content?type=openings', { method: 'PATCH', body: { order: [ID, ID] } }));
    assert.equal(dup.status, 400);
  });
});

test('admin content: DELETE removes the row and its uploaded image; DB errors are not leaked', async () => {
  const media = 'https://mock.supabase.co/storage/v1/object/public/site-media/projects/abc.png';
  await withSupabase((url, opts) => {
    if (url.includes('/storage/')) return new Response('{}', { status: 200 });
    if (opts.method === 'DELETE') return ok([{ id: ID, image_url: media }]);
    return ok([]);
  }, async (calls) => {
    const res = await contentHandler(req(`/api/admin/content?type=projects&id=${ID}`, { method: 'DELETE' }));
    assert.equal(res.status, 200);
    assert.ok(calls.some((c) => c.method === 'DELETE' && c.url === 'https://mock.supabase.co/storage/v1/object/site-media/projects/abc.png'));
  });
  await withSupabase(() => new Response('relation "projects" violates secret_detail', { status: 500 }), async () => {
    const res = await contentHandler(req('/api/admin/content?type=projects'));
    assert.equal(res.status, 502);
    assert.ok(!(await res.text()).includes('secret_detail'));
  });
});

test('admin upload: accepts real PNG/JPEG/WebP only, 2 MB max, into site-media', async () => {
  assert.equal(sniffImage(PNG).ext, 'png');
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])).ext, 'jpg');
  assert.equal(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>')), null);

  await withSupabase(() => ok({ Key: 'x' }), async (calls) => {
    const fake = new FormData();
    fake.append('folder', 'projects');
    fake.append('file', new File(['<svg/>'], 'logo.png', { type: 'image/png' }));
    assert.equal((await uploadHandler(req('/api/admin/upload', { method: 'POST', body: fake }))).status, 415, 'type checked by content, not name');

    const badFolder = new FormData();
    badFolder.append('folder', '../job-applications');
    badFolder.append('file', new File([PNG], 'a.png', { type: 'image/png' }));
    assert.equal((await uploadHandler(req('/api/admin/upload', { method: 'POST', body: badFolder }))).status, 400);

    const big = new FormData();
    big.append('folder', 'projects');
    big.append('file', new File([PNG, new Uint8Array(2 * 1024 * 1024)], 'big.png', { type: 'image/png' }));
    assert.equal((await uploadHandler(req('/api/admin/upload', { method: 'POST', body: big }))).status, 413);
    assert.equal(calls.length, 0, 'nothing stored for rejected files');

    const good = new FormData();
    good.append('folder', 'collaborations');
    good.append('file', new File([PNG], 'logo.png', { type: 'image/png' }));
    const res = await uploadHandler(req('/api/admin/upload', { method: 'POST', body: good }));
    assert.equal(res.status, 201);
    const { url } = await res.json();
    assert.match(url, /^https:\/\/mock\.supabase\.co\/storage\/v1\/object\/public\/site-media\/collaborations\/[0-9a-f-]{36}\.png$/);
    assert.ok(calls[0].url.startsWith('https://mock.supabase.co/storage/v1/object/site-media/collaborations/'));
    assert.equal(calls[0].headers['Content-Type'], 'image/png');
  });
});

test('content schema: partial updates, required fields and safe links', () => {
  assert.deepEqual(validateRecord('openings', { kind: 'job', title_ar: 'أ', title_en: 'A' }).data.kind, 'job');
  assert.ok(validateRecord('openings', { title_ar: 'أ' }).errors.includes('title_en'));
  assert.ok(validateRecord('collaborations', { website_url: 'javascript:alert(1)' }, { partial: true }).errors.includes('website_url'));
  assert.ok(validateRecord('projects', { image_url: '/../secret' }, { partial: true }).errors.includes('image_url'));
  assert.deepEqual(validateRecord('projects', { project_date: '' }, { partial: true }).data, { project_date: null });
  assert.ok(validateRecord('projects', {}, { partial: true }).errors.includes('body'));
  assert.ok(validateRecord('projects', { is_published: 'yes' }, { partial: true }).errors.includes('is_published'));
});
