// api/_lib/adminGuard.js
// DEV-194: shared checks for admin endpoints (same rules as api/admin/appointments.js):
// trusted origin, valid admin session cookie, and CSRF token + origin on every mutating request.

import { validateAdminSession, isOriginAllowed, sha256Hex, constantTimeCompare } from './adminSession.js';

export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export function getServiceConfig(env) {
  const e = env && Object.keys(env).length ? env : ((typeof globalThis !== 'undefined' && globalThis.__CF_ENV__) || {});
  const p = typeof process !== 'undefined' ? process.env : {};
  return {
    url: e.SUPABASE_URL || e.VITE_SUPABASE_URL || p.SUPABASE_URL || p.VITE_SUPABASE_URL || 'https://hnihrwignetxwudoqntp.supabase.co',
    key: e.SUPABASE_SERVICE_ROLE_KEY || p.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

export function serviceHeaders(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

/** Returns a Response to send back when the request is not allowed, or null when it may proceed. */
export async function guardAdminRequest(req) {
  const origin = req.headers.get('origin');
  if (origin && !isOriginAllowed(origin)) return json(403, { error: 'Forbidden: Invalid origin' });

  const session = await validateAdminSession(req);
  if (!session) return json(401, { error: 'Unauthorized' });

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    if (!origin || !isOriginAllowed(origin)) return json(403, { error: 'Forbidden: Invalid origin' });
    const provided = req.headers.get('x-csrf-token') || '';
    if (!provided) return json(403, { error: 'Forbidden: Missing CSRF token' });
    const ok = await constantTimeCompare(await sha256Hex(provided), session.csrf_hash);
    if (!ok) return json(403, { error: 'Forbidden: Invalid CSRF token' });
  }
  return null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
