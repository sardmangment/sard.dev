// DEV-192: /api/careers/apply — origin, validation, PDF checks, rate limit, honeypot, storage + insert.
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/careers/apply.js';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key-for-tests';
const OPENING_ID = '11111111-2222-4333-8444-555555555555';
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]); // "%PDF-1.4\n"

let calls = [];
let rateAllowed = true;
let insertOk = true;
let opening = { title_ar: 'مطور', title_en: 'Developer', is_published: true, closes_at: null };

globalThis.fetch = async (url, options = {}) => {
  const u = String(url);
  calls.push({ url: u, method: options.method || 'GET', headers: options.headers || {}, body: options.body });
  if (u.includes('hit_rate_limit')) return new Response(JSON.stringify(rateAllowed), { status: 200 });
  if (u.includes('/rest/v1/job_openings')) return new Response(JSON.stringify(opening ? [opening] : []), { status: 200 });
  if (u.includes('/storage/v1/object/')) return new Response('{}', { status: 200 });
  if (u.includes('/rest/v1/job_applications')) return new Response('', { status: insertOk ? 201 : 500 });
  return new Response('not mocked', { status: 500 });
};

function form(overrides = {}, { cv = new File([PDF], 'cv.pdf', { type: 'application/pdf' }) } = {}) {
  const fd = new FormData();
  const fields = { full_name: 'Sara Ali', email: 'sara@example.com', phone: '+20 100 000 0000', city: 'Alexandria', consent: 'yes', ...overrides };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.set(k, v);
  if (cv) fd.set('cv', cv);
  return fd;
}

function req(fd, { origin = 'https://sard.dev', method = 'POST' } = {}) {
  const headers = { 'cf-connecting-ip': '203.0.113.7' };
  if (origin) headers.origin = origin;
  return new Request('https://sard.dev/api/careers/apply', { method, headers, body: method === 'POST' ? fd : undefined });
}

test.beforeEach(() => { calls = []; rateAllowed = true; insertOk = true; opening = { title_ar: 'مطور', title_en: 'Developer', is_published: true, closes_at: null }; });

test('rejects missing and foreign origins, and non-POST methods', async () => {
  assert.equal((await handler(req(form(), { origin: null }))).status, 403);
  assert.equal((await handler(req(form(), { origin: 'https://sard.dev.evil.com' }))).status, 403);
  assert.equal((await handler(req(null, { method: 'GET' }))).status, 405);
});

test('valid general application uploads the PDF to the private bucket and inserts a row', async () => {
  const res = await handler(req(form()));
  assert.equal(res.status, 201);
  const up = calls.find((c) => c.url.includes('/storage/v1/object/job-applications/'));
  assert.ok(up, 'CV uploaded to job-applications bucket');
  assert.equal(up.method, 'POST');
  assert.equal(up.headers['Content-Type'], 'application/pdf');
  assert.match(up.url, /job-applications\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
  const ins = calls.find((c) => c.url.includes('/rest/v1/job_applications'));
  const row = JSON.parse(ins.body);
  assert.equal(row.full_name, 'Sara Ali');
  assert.equal(row.email, 'sara@example.com');
  assert.equal(row.opening_id, null);
  assert.ok(row.cv_path.endsWith('.pdf'));
  assert.ok(row.consent_at);
  assert.ok(row.ip_hash && !row.ip_hash.includes('203.0.113.7'), 'IP is hashed, never stored raw');
});

test('application for a published opening stores the opening title', async () => {
  const res = await handler(req(form({ opening_id: OPENING_ID })));
  assert.equal(res.status, 201);
  const row = JSON.parse(calls.find((c) => c.url.includes('/rest/v1/job_applications')).body);
  assert.equal(row.opening_id, OPENING_ID);
  assert.equal(row.opening_title, 'Developer');
});

test('closed, unpublished or unknown openings are rejected', async () => {
  opening = { ...opening, closes_at: '2020-01-01' };
  assert.equal((await (await handler(req(form({ opening_id: OPENING_ID })))).json()).error, 'opening_unavailable');
  opening = { ...opening, closes_at: null, is_published: false };
  assert.equal((await handler(req(form({ opening_id: OPENING_ID })))).status, 400);
  opening = null;
  assert.equal((await handler(req(form({ opening_id: OPENING_ID })))).status, 400);
  assert.ok(!calls.some((c) => c.url.includes('/storage/')), 'nothing uploaded');
});

test('invalid fields and missing consent return 400 with the field list', async () => {
  const res = await handler(req(form({ email: 'not-an-email', phone: 'abc', consent: undefined })));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'invalid_input');
  assert.deepEqual(body.fields.sort(), ['consent', 'email', 'phone']);
});

test('CV must be a real PDF of at most 5 MB', async () => {
  const fake = new File([new TextEncoder().encode('MZ not a pdf')], 'cv.pdf', { type: 'application/pdf' });
  assert.equal((await (await handler(req(form({}, { cv: fake })))).json()).error, 'cv_type');
  const big = new File([PDF, new Uint8Array(5 * 1024 * 1024)], 'cv.pdf', { type: 'application/pdf' });
  assert.equal((await (await handler(req(form({}, { cv: big })))).json()).error, 'cv_too_large');
  assert.equal((await (await handler(req(form({}, { cv: null })))).json()).error, 'cv_missing');
});

test('rate limit returns 429; limiter outage fails closed with 503', async () => {
  rateAllowed = false;
  assert.equal((await handler(req(form()))).status, 429);
  rateAllowed = true;
  const saved = globalThis.fetch;
  globalThis.fetch = async (u, o) => (String(u).includes('hit_rate_limit') ? new Response('', { status: 500 }) : saved(u, o));
  assert.equal((await handler(req(form()))).status, 503);
  globalThis.fetch = saved;
});

test('honeypot submissions pretend success and store nothing', async () => {
  const res = await handler(req(form({ website: 'http://spam.example' })));
  assert.equal(res.status, 201);
  assert.ok(!calls.some((c) => c.url.includes('/storage/') || c.url.includes('job_applications')));
});

test('if the insert fails the uploaded CV is deleted and 503 is returned', async () => {
  insertOk = false;
  const res = await handler(req(form()));
  assert.equal(res.status, 503);
  assert.ok(calls.some((c) => c.url.includes('/storage/v1/object/job-applications/') && c.method === 'DELETE'), 'orphan CV removed');
});
