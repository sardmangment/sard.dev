import test from 'node:test';
import assert from 'node:assert';
import {
  checkChatRateLimit,
  hitAdminLoginAttempt,
  recordAdminLoginFailureGlobal
} from '../api/_lib/rateLimit.js';
import chatHandler from '../api/chat.js';
import sessionHandler from '../api/admin/session.js';

test('HF-03: checkChatRateLimit allows request when shared RPC returns true', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  let rpcCalls = 0;

  globalThis.fetch = async (url, opts) => {
    if (url.includes('hit_rate_limit')) {
      rpcCalls++;
      const body = JSON.parse(opts.body);
      assert.ok(body.p_key.startsWith('chat:'), 'Key must have chat prefix');
      // Must not contain raw IP
      assert.ok(!body.p_key.includes('192.168.1.100'), 'Key must NOT contain raw IP (must be hashed)');
      return new Response('true', { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const allowed = await checkChatRateLimit('192.168.1.100');
    assert.strictEqual(allowed, true);
    assert.strictEqual(rpcCalls, 2, 'Checks both minute and day limits');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-03: checkChatRateLimit blocks request when minute limit is exceeded', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (url.includes('hit_rate_limit')) {
      return new Response('false', { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const allowed = await checkChatRateLimit('10.0.0.5');
    assert.strictEqual(allowed, false);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-03: checkChatRateLimit blocks request when daily limit is exceeded', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (url.includes('hit_rate_limit')) {
      const body = JSON.parse(opts.body);
      if (body.p_window_seconds === 60) return new Response('true', { status: 200 });
      if (body.p_window_seconds === 86400) return new Response('false', { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const allowed = await checkChatRateLimit('10.0.0.5');
    assert.strictEqual(allowed, false, 'Must block when daily limit is exceeded');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-03: checkChatRateLimit and chat proxy fail closed with 503 when store is unavailable', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';
  process.env.GEMINI_API_KEY = 'test-gemini-key';

  const origFetch = globalThis.fetch;

  // Simulate network or database outage
  globalThis.fetch = async () => {
    throw new Error('Database connection timeout');
  };

  try {
    // 1. checkChatRateLimit throws to prevent silent unbounded fallback
    await assert.rejects(
      async () => checkChatRateLimit('172.16.0.1'),
      /RPC_ERROR|Database connection timeout/
    );

    // 2. /api/chat endpoint returns controlled 503
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        origin: 'https://sard.dev',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      }),
    });
    const res = await chatHandler(req);
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.ok(body.error.includes('Rate limit service temporarily unavailable'));
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-03: concurrent requests all invoke atomic limiter without race conditions', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  let parallelCalls = 0;

  globalThis.fetch = async (url) => {
    if (url.includes('hit_rate_limit')) {
      parallelCalls++;
      return new Response('true', { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    // Send 10 concurrent rate limit checks for different hashed IPs
    const promises = Array.from({ length: 10 }, (_, i) => checkChatRateLimit(`192.168.1.${i}`));
    const results = await Promise.all(promises);

    assert.strictEqual(results.length, 10);
    assert.ok(results.every((r) => r === true));
    // Each check evaluates minute (1) + day (1) = 2 RPC calls; 10 * 2 = 20 total
    assert.strictEqual(parallelCalls, 20);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-11: hitAdminLoginAttempt enforces 10 attempts per 15 min per IP and fails closed', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';

  const origFetch = globalThis.fetch;
  const store = new Map();

  globalThis.fetch = async (url, opts) => {
    if (url.includes('hit_rate_limit')) {
      const { p_key, p_max } = JSON.parse(opts.body);
      const current = store.get(p_key) || 0;
      if (current >= p_max) {
        return new Response('false', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      store.set(p_key, current + 1);
      return new Response('true', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const ip = '198.51.100.42';

    // 10 attempts from same IP must pass
    for (let i = 0; i < 10; i++) {
      const allowed = await hitAdminLoginAttempt(ip);
      assert.strictEqual(allowed, true, `Attempt ${i + 1} must be allowed`);
    }

    // 11th and 12th attempts must be blocked
    const attempt11 = await hitAdminLoginAttempt(ip);
    assert.strictEqual(attempt11, false, 'Attempt 11 must be blocked (429)');
    const attempt12 = await hitAdminLoginAttempt(ip);
    assert.strictEqual(attempt12, false, 'Attempt 12 must be blocked (429)');

    // Different IP must be unaffected
    const otherIpAllowed = await hitAdminLoginAttempt('198.51.100.99');
    assert.strictEqual(otherIpAllowed, true, 'Different IP must not be blocked');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('HF-11: No global lockout - 60 failed attempts log warning but never block fresh IP', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';
  process.env.ADMIN_PASSCODE = 'super-secret-admin-passcode-16+';

  const origFetch = globalThis.fetch;
  const origWarn = console.warn;
  let warnCalled = false;
  let globalCount = 0;

  console.warn = (...args) => {
    if (args.some((a) => typeof a === 'string' && a.includes('admin_login_global_threshold'))) {
      warnCalled = true;
    }
    origWarn(...args);
  };

  globalThis.fetch = async (url, opts) => {
    if (url.includes('hit_rate_limit')) {
      const { p_key, p_max } = JSON.parse(opts.body);
      if (p_key === 'admin-login-failed-global') {
        globalCount++;
        return new Response(globalCount > p_max ? 'false' : 'true', { status: 200 });
      }
      return new Response('true', { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    // Record 60 global failures across multiple IPs
    for (let i = 0; i < 60; i++) {
      await recordAdminLoginFailureGlobal();
    }
    assert.strictEqual(warnCalled, true, 'Warning admin_login_global_threshold must be logged');

    // Fresh IP attempt must STILL be allowed to reach login (not locked out)
    const freshReq = new Request('http://localhost/api/admin/session', {
      method: 'POST',
      headers: {
        origin: 'https://sard.dev',
        'x-forwarded-for': '10.99.99.1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passcode: 'super-secret-admin-passcode-16+' }),
    });

    const res = await sessionHandler(freshReq);
    // Should NOT be 429
    assert.notStrictEqual(res.status, 429, 'Fresh IP must never be locked out by global threshold');
  } finally {
    globalThis.fetch = origFetch;
    console.warn = origWarn;
  }
});

test('HF-11: Admin login fails closed with 503 when rate limit store is down', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';
  process.env.ADMIN_PASSCODE = 'super-secret-admin-passcode-16+';

  const origFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error('Supabase rate limit DB connection timed out');
  };

  try {
    const req = new Request('http://localhost/api/admin/session', {
      method: 'POST',
      headers: {
        origin: 'https://sard.dev',
        'x-forwarded-for': '10.5.5.5',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passcode: 'super-secret-admin-passcode-16+' }),
    });

    const res = await sessionHandler(req);
    assert.strictEqual(res.status, 503, 'Login must fail closed with 503 on store failure');
    const data = await res.json();
    assert.ok(data.error.includes('Rate limit service unavailable'));
  } finally {
    globalThis.fetch = origFetch;
  }
});
