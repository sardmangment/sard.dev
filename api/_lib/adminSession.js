// api/_lib/adminSession.js
// Session management helper: cookies, tokens, HMAC constant-time compare, and DB validation.

export const COOKIE_NAME = '__Host-sard_admin';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours absolute
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle

const PRODUCTION_ORIGINS = [
  'https://sard.dev',
  'https://www.sard.dev',
];

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
];

export function isOriginAllowed(origin) {
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && LOCAL_DEV_ORIGINS.includes(origin)) {
    return true;
  }
  return false;
}

export async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateRandomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const macA = await crypto.subtle.sign('HMAC', key, encoder.encode(a));
  const macB = await crypto.subtle.sign('HMAC', key, encoder.encode(b));
  const u8A = new Uint8Array(macA);
  const u8B = new Uint8Array(macB);
  let diff = 0;
  for (let i = 0; i < u8A.length; i++) {
    diff |= u8A[i] ^ u8B[i];
  }
  return diff === 0;
}

export function parseCookies(headerStr) {
  if (!headerStr) return {};
  const map = {};
  const cookies = headerStr.split(';');
  for (const c of cookies) {
    const [k, ...v] = c.trim().split('=');
    if (k) {
      map[k] = decodeURIComponent(v.join('='));
    }
  }
  return map;
}

export function parseCookie(headerStr, name) {
  return parseCookies(headerStr)[name] || null;
}

export function serializeCookie(name, value, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict;`;
}

export function buildSessionCookie(token) {
  return serializeCookie(COOKIE_NAME, token, SESSION_MAX_AGE_SECONDS);
}

export function buildClearCookie() {
  return serializeCookie(COOKIE_NAME, '', 0);
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hnihrwignetxwudoqntp.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, serviceRoleKey };
}

export async function createAdminSession({ ip, userAgent }) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) {
    throw new Error('CONFIG_MISSING: SUPABASE_SERVICE_ROLE_KEY is required.');
  }

  const rawSessionToken = generateRandomToken(32);
  const rawCsrfToken = generateRandomToken(32);

  const tokenHash = await sha256Hex(rawSessionToken);
  const csrfHash = await sha256Hex(rawCsrfToken);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

  const payload = {
    token_hash: tokenHash,
    csrf_hash: csrfHash,
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: expiresAt,
    ip: ip || 'unknown',
    user_agent: userAgent || 'unknown',
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/admin_sessions`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('DATABASE_ERROR: Failed to persist admin session.');
  }

  return {
    rawSessionToken,
    rawCsrfToken,
    cookieHeader: buildSessionCookie(rawSessionToken),
  };
}

export async function validateAdminSession(req) {
  const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie') || '';
  const token = parseCookie(cookieHeader, COOKIE_NAME);
  if (!token) return null;

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) return null;

  const tokenHash = await sha256Hex(token);
  const res = await fetch(
    `${supabaseUrl}/rest/v1/admin_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}&select=*`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const session = rows[0];
  if (session.revoked_at) return null;

  const now = Date.now();
  const expiresAt = new Date(session.expires_at).getTime();
  const lastSeenAt = new Date(session.last_seen_at).getTime();

  if (now > expiresAt) return null;
  if (now - lastSeenAt > SESSION_IDLE_TIMEOUT_MS) return null;

  // Slide idle timeout: must be awaited per HF-10
  try {
    const touchRes = await fetch(`${supabaseUrl}/rest/v1/admin_sessions?id=eq.${encodeURIComponent(session.id)}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ last_seen_at: new Date(now).toISOString() }),
    });
    if (!touchRes.ok) {
      console.warn('session_touch_failed');
    }
  } catch {
    console.warn('session_touch_failed');
  }

  return session;
}

export async function rotateSessionCsrf(session) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) throw new Error('CONFIG_MISSING');

  const newCsrf = generateRandomToken(32);
  const newCsrfHash = await sha256Hex(newCsrf);

  const res = await fetch(`${supabaseUrl}/rest/v1/admin_sessions?id=eq.${encodeURIComponent(session.id)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ csrf_hash: newCsrfHash }),
  });

  if (!res.ok) {
    throw new Error(`CSRF_ROTATION_FAILED: store returned ${res.status}`);
  }

  return newCsrf;
}

export async function revokeAdminSession(req) {
  const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie') || '';
  const token = parseCookie(cookieHeader, COOKIE_NAME);
  if (!token) return;

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) throw new Error('CONFIG_MISSING');

  const tokenHash = await sha256Hex(token);
  const res = await fetch(
    `${supabaseUrl}/rest/v1/admin_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    }
  );

  if (!res.ok) {
    throw new Error(`SESSION_REVOCATION_FAILED: store returned ${res.status}`);
  }
}

