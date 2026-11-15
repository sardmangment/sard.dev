import test from 'node:test';
import assert from 'node:assert';
import handler from '../api/chat.js';

// Setup mock rate-limiting environment for proxy testing
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key-for-tests';
const defaultFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (typeof url === 'string' && url.includes('hit_rate_limit')) {
    return new Response('true', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return defaultFetch(url, options);
};

test('AR-04 / AR-06: chat proxy rejects missing, foreign, and look-alike origins with 403', async () => {
  // Missing origin
  const req1 = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {},
  });
  const res1 = await handler(req1);
  assert.strictEqual(res1.status, 403);
  const data1 = await res1.json();
  assert.strictEqual(data1.error, 'Unauthorized origin');

  // Look-alike origin prefix attack (https://sard.dev.evil.com)
  const req2 = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { origin: 'https://sard.dev.evil.com' },
  });
  const res2 = await handler(req2);
  assert.strictEqual(res2.status, 403);

  // Removed legacy sard.ai domain (D-24)
  const req3 = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { origin: 'https://sard.ai' },
  });
  const res3 = await handler(req3);
  assert.strictEqual(res3.status, 403);
});

test('AR-04: chat proxy returns 204 on OPTIONS for allowed origin with Vary header', async () => {
  const req = new Request('http://localhost/api/chat', {
    method: 'OPTIONS',
    headers: { origin: 'https://sard.dev' },
  });
  const res = await handler(req);
  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://sard.dev');
  assert.strictEqual(res.headers.get('Vary'), 'Origin');
});

test('AR-05: chat proxy returns 503 when GEMINI_API_KEY is not set', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        origin: 'https://sard.dev',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }],
      }),
    });
    const res = await handler(req);
    assert.strictEqual(res.status, 503);
    const data = await res.json();
    assert.ok(data.error.includes('GEMINI_API_KEY'));
  } finally {
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  }
});

test('AR-04: chat proxy returns 413 when payload exceeds 32 KB', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const largeString = 'a'.repeat(33 * 1024);

  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      origin: 'https://sard.dev',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: largeString }] }],
    }),
  });
  const res = await handler(req);
  assert.strictEqual(res.status, 413);
  const data = await res.json();
  assert.strictEqual(data.error, 'Payload too large');
});

test('AR-04: chat proxy returns 400 on invalid payload structures', async () => {
  process.env.GEMINI_API_KEY = 'test-key';

  // Empty contents
  const req1 = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { origin: 'https://sard.dev', 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [] }),
  });
  const res1 = await handler(req1);
  assert.strictEqual(res1.status, 400);

  // Non-array contents
  const req2 = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { origin: 'https://sard.dev', 'content-type': 'application/json' },
    body: JSON.stringify({ contents: 'invalid' }),
  });
  const res2 = await handler(req2);
  assert.strictEqual(res2.status, 400);
});

test('AR-04: chat proxy passes API key in header and calls fixed supported models', async () => {
  process.env.GEMINI_API_KEY = 'test-secret-key-12345';
  const originalFetch = globalThis.fetch;
  let capturedHeaders = null;
  let capturedUrl = null;

  globalThis.fetch = async (url, options) => {
    if (typeof url === 'string' && url.includes('hit_rate_limit')) {
      return new Response('true', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    capturedUrl = url;
    capturedHeaders = options.headers;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Mock response' }] } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        origin: 'https://sard.dev',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Ping' }] }],
        model: 'untrusted-client-model-exploit',
      }),
    });

    const res = await handler(req);
    assert.strictEqual(res.status, 200);

    // Verify key was NOT in URL query string
    assert.ok(!capturedUrl.includes('test-secret-key-12345'), 'API key must not be passed in URL query param');
    // Verify key WAS in header
    assert.strictEqual(capturedHeaders['x-goog-api-key'], 'test-secret-key-12345');
    // Verify client model was IGNORED and supported model used
    assert.ok(capturedUrl.includes('gemini-3.5-flash-lite'), 'Must use server-sanctioned model');
    assert.ok(!capturedUrl.includes('untrusted-client-model-exploit'), 'Client model must be ignored');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
