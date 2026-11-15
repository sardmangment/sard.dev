// api/admin/session.js
// Vercel Edge Function: Admin Session Controller (HF-01)
// Handles POST (login), GET (resume/rotate CSRF), and DELETE (logout).
// Same-origin only, HttpOnly+Secure+SameSite=Strict cookie, in-memory CSRF token.

import {
  isOriginAllowed,
  constantTimeCompare,
  createAdminSession,
  validateAdminSession,
  rotateSessionCsrf,
  revokeAdminSession,
  buildClearCookie
} from '../_lib/adminSession.js';
import { hitAdminLoginAttempt, recordAdminLoginFailureGlobal } from '../_lib/rateLimit.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Strict same-origin verification
  if (req.method !== 'GET' && !isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'Unauthorized origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET: Resume session / check auth / rotate CSRF
  if (req.method === 'GET') {
    let session;
    try {
      session = await validateAdminSession(req);
    } catch {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!session) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const newCsrfToken = await rotateSessionCsrf(session);
      return new Response(JSON.stringify({ authenticated: true, csrfToken: newCsrfToken }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // CSRF rotation failure returns 503 per HF-10
      return new Response(JSON.stringify({ error: 'Failed to rotate session CSRF' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // POST: Login
  if (req.method === 'POST') {
    const expectedPasscode = process.env.ADMIN_PASSCODE;
    if (!expectedPasscode || expectedPasscode.length < 16) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: ADMIN_PASSCODE must be at least 16 characters.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check: 10 attempts per 15 min per IP. Fails closed with 503 if store unavailable.
    try {
      const allowed = await hitAdminLoginAttempt(clientIp);
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: 'Too many login attempts. Please wait 15 minutes before retrying.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      // Fail closed (D-28)
      return new Response(
        JSON.stringify({ error: 'Rate limit service unavailable. Login locked for security.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { passcode } = body || {};
    const isValid = await constantTimeCompare(passcode || '', expectedPasscode);

    if (!isValid) {
      await recordAdminLoginFailureGlobal();
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create session and set HttpOnly cookie
    try {
      const { rawCsrfToken, cookieHeader } = await createAdminSession({ ip: clientIp, userAgent });

      return new Response(JSON.stringify({ success: true, csrfToken: rawCsrfToken }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // DELETE: Logout
  if (req.method === 'DELETE') {
    try {
      await revokeAdminSession(req);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': buildClearCookie(),
        },
      });
    } catch {
      // HF-10: If revocation fails, DELETE /api/admin/session returns 503 AND still sends Set-Cookie clearing cookie
      return new Response(JSON.stringify({ error: 'Session revocation failed' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': buildClearCookie(),
        },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

