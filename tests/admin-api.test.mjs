import test from 'node:test';
import assert from 'node:assert';
import handler from '../api/admin/appointments.js';

test('HF-01: admin API rejects unauthorized origins with 403', async () => {
  const req = new Request('http://localhost/api/admin/appointments', {
    method: 'GET',
    headers: { origin: 'https://evil.com' },
  });
  const res = await handler(req);
  assert.strictEqual(res.status, 403);
});

test('HF-01: admin API rejects requests without session cookie with 401', async () => {
  const req = new Request('http://localhost/api/admin/appointments', {
    method: 'GET',
    headers: { origin: 'https://sard.dev' },
  });
  const res = await handler(req);
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.error, 'Unauthorized');
});

test('HF-01: admin API rejects PATCH mutation without CSRF token with 403', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  // Stub session validation to return valid session
  globalThis.fetch = async (url) => {
    if (url.includes('admin_sessions')) {
      return new Response(JSON.stringify([{
        id: 'sess-1',
        token_hash: 'hash',
        csrf_hash: 'csrfhash',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      }]), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/admin/appointments', {
      method: 'PATCH',
      headers: {
        origin: 'https://sard.dev',
        cookie: '__Host-sard_admin=mocktoken12345678901234567890123456789012;',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: '123', status: 'cancelled' }),
    });
    const res = await handler(req);
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Forbidden: Missing CSRF token');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-01: admin API returns appointments on valid session cookie', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-xyz';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  let appointmentsQueried = false;

  globalThis.fetch = async (url, opts) => {
    if (url.includes('admin_sessions')) {
      return new Response(JSON.stringify([{
        id: 'sess-1',
        token_hash: 'hash',
        csrf_hash: 'csrfhash',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      }]), { status: 200 });
    }
    if (url.includes('calendar_appointments')) {
      appointmentsQueried = true;
      assert.strictEqual(opts.headers['apikey'], 'test-service-key-xyz');
      assert.strictEqual(opts.headers['Authorization'], 'Bearer test-service-key-xyz');
      return new Response(JSON.stringify([
        { id: '1', date: '2026-11-20', time_slot: '02:00 PM', status: 'confirmed' }
      ]), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/admin/appointments', {
      method: 'GET',
      headers: {
        origin: 'https://sard.dev',
        cookie: '__Host-sard_admin=mocktoken12345678901234567890123456789012;',
      },
    });
    const res = await handler(req);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.data.length, 1);
    assert.ok(appointmentsQueried, 'Must query appointments using service role key');
    // Ensure no CORS headers are sent
    assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), null);
    assert.strictEqual(res.headers.get('Access-Control-Allow-Credentials'), null);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-01: admin API does not leak raw database error text', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-xyz';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (url.includes('admin_sessions')) {
      return new Response(JSON.stringify([{
        id: 'sess-1',
        token_hash: 'hash',
        csrf_hash: 'csrfhash',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      }]), { status: 200 });
    }
    if (url.includes('calendar_appointments')) {
      // Return sensitive database error text
      return new Response(JSON.stringify({
        message: 'Internal Postgres error: relation "calendar_appointments" does not exist at character 15',
        code: '42P01',
      }), { status: 500 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/admin/appointments', {
      method: 'GET',
      headers: {
        origin: 'https://sard.dev',
        cookie: '__Host-sard_admin=mocktoken12345678901234567890123456789012;',
      },
    });
    const res = await handler(req);
    assert.strictEqual(res.status, 502);

    const body = await res.json();
    // Must NOT leak database internals
    assert.strictEqual(body.error, 'Failed to retrieve appointments');
    assert.ok(!JSON.stringify(body).includes('relation "calendar_appointments" does not exist'));
  } finally {
    globalThis.fetch = origFetch;
  }
});
