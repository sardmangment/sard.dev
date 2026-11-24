// DEV-194: /api/admin/applications — admin only, filters, status changes, 60-second signed CV links
// from the private bucket, and delete removes the CV too. No personal data or DB errors leak.
import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { CV_LINK_SECONDS } from '../api/admin/applications.js';
import { sha256Hex } from '../api/_lib/adminSession.js';

const CSRF = 'csrf-token-for-tests';
const COOKIE = '__Host-sard_admin=mocktoken12345678901234567890123456789012;';
const ID = '11111111-2222-4333-8444-555555555555';
const OPENING = '66666666-7777-4888-9999-aaaaaaaaaaaa';
const CV = '2026/11/0e3c8d1a-1b2c-4d5e-8f90-123456789abc.pdf';

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
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    return respond(url, opts);
  };
  try { await fn(calls); } finally { globalThis.fetch = orig; }
}

function req(path, { method = 'GET', body, csrf = CSRF, origin = 'https://sard.dev', cookie = COOKIE } = {}) {
  const headers = { origin };
  if (cookie) headers.cookie = cookie;
  if (csrf && method !== 'GET') headers['x-csrf-token'] = csrf;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(`https://sard.dev${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}
const ok = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('applications: no session → 401, foreign origin → 403, CV link needs CSRF', async () => {
  assert.equal((await handler(req('/api/admin/applications', { cookie: null }))).status, 401);
  assert.equal((await handler(req('/api/admin/applications', { origin: 'https://evil.com' }))).status, 403);
  await withSupabase(() => ok([]), async (calls) => {
    const res = await handler(req('/api/admin/applications', { method: 'POST', body: { action: 'cv', id: ID }, csrf: null }));
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  });
});

test('applications: GET lists newest first with filters and without internal fields', async () => {
  await withSupabase(() => ok([{ id: ID, full_name: 'Sara' }]), async (calls) => {
    const res = await handler(req(`/api/admin/applications?opening=${OPENING}&status=shortlisted`));
    assert.equal(res.status, 200);
    const u = decodeURIComponent(calls[0].url);
    assert.ok(u.startsWith('https://mock.supabase.co/rest/v1/job_applications?'));
    assert.ok(u.includes(`opening_id=eq.${OPENING}`) && u.includes('status=eq.shortlisted') && u.includes('order=created_at.desc'));
    for (const hidden of ['ip_hash', 'user_agent', 'cv_path']) assert.ok(!u.includes(hidden), `${hidden} not selected`);

    await handler(req('/api/admin/applications?opening=general'));
    assert.ok(calls[1].url.includes('opening_id=is.null'), 'general applications filter');

    assert.equal((await handler(req('/api/admin/applications?status=deleted'))).status, 400);
    assert.equal((await handler(req('/api/admin/applications?opening=1;drop'))).status, 400);
    assert.equal(calls.length, 2, 'invalid filters never reach the database');
  });
});

test('applications: PATCH accepts only the known statuses', async () => {
  await withSupabase((url, opts) => ok([{ id: ID, ...JSON.parse(opts.body) }]), async (calls) => {
    assert.equal((await handler(req('/api/admin/applications', { method: 'PATCH', body: { id: ID, status: 'approved' } }))).status, 400);
    const res = await handler(req('/api/admin/applications', { method: 'PATCH', body: { id: ID, status: 'reviewing', full_name: 'changed' } }));
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(calls[0].body), { status: 'reviewing' }, 'only the status is written');
  });
});

test('applications: CV link is a 60-second signed URL from the private bucket', async () => {
  await withSupabase((url) => {
    if (url.includes('/rest/v1/job_applications')) return ok([{ cv_path: CV }]);
    if (url.includes('/storage/v1/object/sign/job-applications/')) return ok({ signedURL: `/object/sign/job-applications/${CV}?token=abc` });
    return ok({}, 404);
  }, async (calls) => {
    const res = await handler(req('/api/admin/applications', { method: 'POST', body: { action: 'cv', id: ID } }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.url, `https://mock.supabase.co/storage/v1/object/sign/job-applications/${CV}?token=abc`);
    assert.ok(!body.url.includes('/object/public/'), 'never a public link');
    const sign = calls.find((c) => c.url.includes('/sign/'));
    assert.equal(JSON.parse(sign.body).expiresIn, CV_LINK_SECONDS);
    assert.equal(CV_LINK_SECONDS, 60);
  });

  // A tampered path in the row is never signed.
  await withSupabase(() => ok([{ cv_path: '../site-media/x.png' }]), async (calls) => {
    const res = await handler(req('/api/admin/applications', { method: 'POST', body: { action: 'cv', id: ID } }));
    assert.equal(res.status, 404);
    assert.ok(!calls.some((c) => c.url.includes('/sign/')));
  });
});

test('applications: DELETE removes the application and its CV; errors stay generic', async () => {
  await withSupabase((url, opts) => {
    if (url.includes('/rest/v1/') && opts.method === 'DELETE') return ok([{ id: ID, cv_path: CV }]);
    return ok({});
  }, async (calls) => {
    const res = await handler(req(`/api/admin/applications?id=${ID}`, { method: 'DELETE' }));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).cvDeleted, true);
    assert.ok(calls.some((c) => c.method === 'DELETE' && c.url === `https://mock.supabase.co/storage/v1/object/job-applications/${CV}`));
  });
  await withSupabase(() => new Response('permission denied for secret_table', { status: 500 }), async () => {
    const res = await handler(req('/api/admin/applications'));
    assert.equal(res.status, 502);
    assert.ok(!(await res.text()).includes('secret_table'));
  });
});
