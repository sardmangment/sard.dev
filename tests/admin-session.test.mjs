import test from 'node:test';
import assert from 'node:assert';
import {
  sha256Hex,
  generateRandomToken,
  constantTimeCompare,
  parseCookies,
  serializeCookie,
  COOKIE_NAME,
  isOriginAllowed,
  validateAdminSession,
  rotateSessionCsrf,
  revokeAdminSession
} from '../api/_lib/adminSession.js';
import sessionHandler from '../api/admin/session.js';

test('HF-01: sha256Hex generates consistent 64-char lowercase hex digest', async () => {
  const hash1 = await sha256Hex('test-string-123');
  const hash2 = await sha256Hex('test-string-123');
  const hash3 = await sha256Hex('different-string');

  assert.strictEqual(hash1.length, 64);
  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, hash3);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test('HF-01: generateRandomToken generates cryptographically random hex tokens', () => {
  const t1 = generateRandomToken(32);
  const t2 = generateRandomToken(32);

  assert.strictEqual(t1.length, 64);
  assert.strictEqual(t2.length, 64);
  assert.notStrictEqual(t1, t2);
  assert.match(t1, /^[0-9a-f]{64}$/);
});

test('HF-01: constantTimeCompare verifies string equality securely', async () => {
  assert.strictEqual(await constantTimeCompare('correct-passcode', 'correct-passcode'), true);
  assert.strictEqual(await constantTimeCompare('correct-passcode', 'wrong-passcode'), false);
  assert.strictEqual(await constantTimeCompare('correct-passcode', 'correct-passcode-extra'), false);
  assert.strictEqual(await constantTimeCompare(null, 'pass'), false);
  assert.strictEqual(await constantTimeCompare('pass', undefined), false);
});

test('HF-01: parseCookies parses multiple cookies accurately', () => {
  const header = '__Host-sard_admin=abc123xyz; other_cookie=val; third=1';
  const parsed = parseCookies(header);

  assert.strictEqual(parsed['__Host-sard_admin'], 'abc123xyz');
  assert.strictEqual(parsed['other_cookie'], 'val');
  assert.strictEqual(parsed['third'], '1');
  assert.strictEqual(parsed['nonexistent'], undefined);
});

test('HF-01: serializeCookie outputs __Host- cookie with all required security flags', () => {
  const cookieStr = serializeCookie(COOKIE_NAME, 'sampletoken123', 28800);

  assert.ok(cookieStr.startsWith('__Host-sard_admin=sampletoken123;'));
  assert.ok(cookieStr.includes('Path=/;'));
  assert.ok(cookieStr.includes('Max-Age=28800;'));
  assert.ok(cookieStr.includes('HttpOnly;'));
  assert.ok(cookieStr.includes('Secure;'));
  assert.ok(cookieStr.includes('SameSite=Strict'));
  // __Host- cookies must not specify a Domain attribute
  assert.ok(!cookieStr.includes('Domain='));
});

test('HF-01: isOriginAllowed restricts to approved domains', () => {
  assert.strictEqual(isOriginAllowed('https://sard.dev'), true);
  assert.strictEqual(isOriginAllowed('https://www.sard.dev'), true);
  assert.strictEqual(isOriginAllowed('https://malicious.com'), false);
  assert.strictEqual(isOriginAllowed(''), false);
  assert.strictEqual(isOriginAllowed(null), false);
});

test('HF-01: POST /api/admin/session rejects unauthorized origin with 403', async () => {
  const req = new Request('http://localhost/api/admin/session', {
    method: 'POST',
    headers: { origin: 'https://evil.example.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'any' }),
  });
  const res = await sessionHandler(req);
  assert.strictEqual(res.status, 403);
});

test('HF-01: POST /api/admin/session returns 503 when ADMIN_PASSCODE is unconfigured or under 16 chars', async () => {
  const origPass = process.env.ADMIN_PASSCODE;
  process.env.ADMIN_PASSCODE = 'short'; // < 16 chars

  try {
    const req = new Request('http://localhost/api/admin/session', {
      method: 'POST',
      headers: { origin: 'https://sard.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'short' }),
    });
    const res = await sessionHandler(req);
    assert.strictEqual(res.status, 503);
    const data = await res.json();
    assert.ok(data.error.includes('ADMIN_PASSCODE'));
  } finally {
    process.env.ADMIN_PASSCODE = origPass || 'test-valid-admin-passcode-1234';
  }
});

test('HF-01: POST /api/admin/session rejects wrong passcode with 401', async () => {
  process.env.ADMIN_PASSCODE = 'strong-passcode-for-admin-tests-16char';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  // Mock rate limiter calls: rate_limits select returns array, hit_rate_limit returns boolean
  globalThis.fetch = async (url) => {
    if (url.includes('rate_limits')) return new Response('[]', { status: 200 });
    if (url.includes('hit_rate_limit')) return new Response('true', { status: 200 });
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/admin/session', {
      method: 'POST',
      headers: { origin: 'https://sard.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'incorrect-passcode-value' }),
    });
    const res = await sessionHandler(req);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid credentials');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-01: POST /api/admin/session logs in, sets __Host- cookie and returns csrfToken on valid passcode', async () => {
  process.env.ADMIN_PASSCODE = 'strong-passcode-for-admin-tests-16char';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  let sessionInserted = false;

  globalThis.fetch = async (url, opts) => {
    if (url.includes('rate_limits')) {
      return new Response('[]', { status: 200 });
    }
    if (url.includes('hit_rate_limit')) {
      return new Response('true', { status: 200 });
    }
    if (url.includes('admin_sessions') && opts?.method === 'POST') {
      sessionInserted = true;
      return new Response(JSON.stringify([{ id: 'sess-uuid-1' }]), { status: 201 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/admin/session', {
      method: 'POST',
      headers: { origin: 'https://sard.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'strong-passcode-for-admin-tests-16char' }),
    });
    const res = await sessionHandler(req);
    assert.strictEqual(res.status, 200);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie.includes('__Host-sard_admin='));
    assert.ok(setCookie.includes('HttpOnly'));
    assert.ok(setCookie.includes('Secure'));
    assert.ok(setCookie.includes('SameSite=Strict'));
    assert.ok(setCookie.includes('Path=/'));

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(typeof body.csrfToken, 'string');
    assert.strictEqual(body.csrfToken.length, 64);
    assert.strictEqual(body.passcode, undefined, 'Must NEVER return passcode in response body');
    assert.ok(sessionInserted, 'Session record must be stored in database');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-01: GET /api/admin/session without cookie returns 401', async () => {
  const req = new Request('http://localhost/api/admin/session', {
    method: 'GET',
    headers: { origin: 'https://sard.dev' },
  });
  const res = await sessionHandler(req);
  assert.strictEqual(res.status, 401);
});

test('HF-01: DELETE /api/admin/session (logout) clears cookie with Max-Age=0', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  let sessionRevoked = false;

  globalThis.fetch = async (url, opts) => {
    if (url.includes('admin_sessions') && opts?.method === 'PATCH') {
      sessionRevoked = true;
      return new Response('{}', { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/admin/session', {
      method: 'DELETE',
      headers: {
        origin: 'https://sard.dev',
        cookie: '__Host-sard_admin=dummytoken12345678901234567890123456789012;',
      },
    });
    const res = await sessionHandler(req);
    assert.strictEqual(res.status, 200);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie.includes('Max-Age=0'));
    assert.ok(sessionRevoked, 'Session record must be marked revoked in database');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-01: validateAdminSession rejects sessions exceeding 8-hour absolute expiry', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{
    id: 'sess-expired-abs',
    token_hash: 'hash',
    expires_at: new Date(Date.now() - 1000).toISOString(), // expired 1s ago
    last_seen_at: new Date().toISOString(),
    revoked_at: null,
  }]), { status: 200 });

  try {
    const req = new Request('http://localhost/', {
      headers: { cookie: '__Host-sard_admin=mocktoken123;' },
    });
    const session = await validateAdminSession(req);
    assert.strictEqual(session, null, 'Must reject session whose absolute expires_at has passed');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-01: validateAdminSession rejects sessions exceeding 30-minute idle timeout', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{
    id: 'sess-expired-idle',
    token_hash: 'hash',
    expires_at: new Date(Date.now() + 3600000).toISOString(), // still valid absolutely
    last_seen_at: new Date(Date.now() - (31 * 60 * 1000)).toISOString(), // idle for 31 mins
    revoked_at: null,
  }]), { status: 200 });

  try {
    const req = new Request('http://localhost/', {
      headers: { cookie: '__Host-sard_admin=mocktoken123;' },
    });
    const session = await validateAdminSession(req);
    assert.strictEqual(session, null, 'Must reject session that has been idle for > 30 minutes');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-01: validateAdminSession rejects revoked sessions', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{
    id: 'sess-revoked',
    token_hash: 'hash',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    last_seen_at: new Date().toISOString(),
    revoked_at: new Date(Date.now() - 5000).toISOString(), // revoked 5s ago
  }]), { status: 200 });

  try {
    const req = new Request('http://localhost/', {
      headers: { cookie: '__Host-sard_admin=mocktoken123;' },
    });
    const session = await validateAdminSession(req);
    assert.strictEqual(session, null, 'Must reject session that has been explicitly revoked');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-01: validateAdminSession accepts active session and slides last_seen_at', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  let patchCalled = false;

  globalThis.fetch = async (url, opts) => {
    if (opts?.method === 'PATCH') {
      patchCalled = true;
      return new Response('{}', { status: 200 });
    }
    return new Response(JSON.stringify([{
      id: 'sess-active',
      token_hash: 'hash',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    }]), { status: 200 });
  };

  try {
    const req = new Request('http://localhost/', {
      headers: { cookie: '__Host-sard_admin=mocktoken123;' },
    });
    const session = await validateAdminSession(req);
    assert.ok(session);
    assert.strictEqual(session.id, 'sess-active');
    assert.ok(patchCalled, 'Must trigger asynchronous PATCH to slide last_seen_at');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-10: validateAdminSession awaits last_seen_at touch and logs session_touch_failed on error without dropping session', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  const origWarn = console.warn;
  let warnLogged = false;

  console.warn = (msg) => {
    if (msg === 'session_touch_failed') warnLogged = true;
    origWarn(msg);
  };

  globalThis.fetch = async (url, opts) => {
    if (opts?.method === 'PATCH') {
      // Simulate failed PATCH
      return new Response('{}', { status: 500 });
    }
    return new Response(JSON.stringify([{
      id: 'sess-touch-test',
      token_hash: 'hash',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    }]), { status: 200 });
  };

  try {
    const req = new Request('http://localhost/', {
      headers: { cookie: '__Host-sard_admin=mocktoken123;' },
    });
    const session = await validateAdminSession(req);
    assert.ok(session, 'Must return session even if sliding touch PATCH failed');
    assert.strictEqual(session.id, 'sess-touch-test');
    assert.ok(warnLogged, 'Must log session_touch_failed on touch failure');
  } finally {
    globalThis.fetch = origFetch;
    console.warn = origWarn;
  }
});

test('HF-10: rotateSessionCsrf failure causes GET /api/admin/session to return 503', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (opts?.method === 'PATCH') {
      // CSRF rotation PATCH fails with 500
      return new Response('{}', { status: 500 });
    }
    // Session lookup succeeds
    return new Response(JSON.stringify([{
      id: 'sess-csrf-fail',
      token_hash: 'hash',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    }]), { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/admin/session', {
      method: 'GET',
      headers: { cookie: '__Host-sard_admin=mocktoken123;' },
    });
    const res = await sessionHandler(req);
    assert.strictEqual(res.status, 503, 'Must return 503 when CSRF rotation store operation fails');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-10: revokeAdminSession failure causes DELETE /api/admin/session to return 503 and still clear cookie', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (opts?.method === 'PATCH') {
      // Revocation PATCH fails
      return new Response('{}', { status: 500 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('http://localhost/api/admin/session', {
      method: 'DELETE',
      headers: {
        origin: 'https://sard.dev',
        cookie: '__Host-sard_admin=mocktoken123;',
      },
    });
    const res = await sessionHandler(req);
    assert.strictEqual(res.status, 503, 'Must return 503 when session revocation fails');
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Must still set Set-Cookie to clear the browser cookie');
    assert.ok(setCookie.includes('Max-Age=0'), 'Must expire cookie with Max-Age=0');
  } finally {
    globalThis.fetch = origFetch;
  }
});
