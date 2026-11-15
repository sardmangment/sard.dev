// api/admin/appointments.js
// Vercel Edge Function: Admin Appointments Endpoint (HF-01)
// Protected by HttpOnly session cookie and CSRF token for state-mutating requests.
// Same-origin only; no CORS headers; no DB error leakage.

import {
  validateAdminSession,
  isOriginAllowed,
  sha256Hex,
  constantTimeCompare
} from '../_lib/adminSession.js';

export const config = { runtime: 'edge' };

const TIME_SLOTS = [
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
  '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM',
  '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
  '12:00 AM',
];

export default async function handler(req) {
  // 1. Origin verification (reject cross-origin requests from untrusted origins)
  const origin = req.headers.get('origin');
  if (origin && !isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden: Invalid origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Session verification (all methods require valid session cookie)
  const session = await validateAdminSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. CSRF & Origin verification for state-mutating methods (POST, PATCH, DELETE)
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!origin || !isOriginAllowed(origin)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Invalid origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const providedCsrf = req.headers.get('x-csrf-token') || '';
    if (!providedCsrf) {
      return new Response(JSON.stringify({ error: 'Forbidden: Missing CSRF token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const providedCsrfHash = await sha256Hex(providedCsrf);
    const csrfMatches = await constantTimeCompare(providedCsrfHash, session.csrf_hash);
    if (!csrfMatches) {
      return new Response(JSON.stringify({ error: 'Forbidden: Invalid CSRF token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hnihrwignetxwudoqntp.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration missing.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabaseHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  // GET: List confirmed appointments
  if (req.method === 'GET') {
    try {
      const targetUrl = `${supabaseUrl}/rest/v1/calendar_appointments?status=eq.confirmed&order=date.asc,time_slot.asc`;
      const res = await fetch(targetUrl, { headers: supabaseHeaders });

      if (!res.ok) {
        console.warn(`[admin] Supabase GET returned status ${res.status}`);
        return new Response(JSON.stringify({ error: 'Failed to retrieve appointments' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const rows = await res.json();
      return new Response(JSON.stringify({ data: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Database service unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // POST: Create appointment (Admin manual add)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { date, timeSlot, name, email, service, notes, created_via } = body || {};

      if (!date || !timeSlot || !TIME_SLOTS.includes(timeSlot)) {
        return new Response(JSON.stringify({ error: 'Valid date and timeSlot are required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (name && typeof name === 'string' && name.length > 100) {
        return new Response(JSON.stringify({ error: 'Name must not exceed 100 characters.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const payload = {
        date,
        time_slot: timeSlot,
        client_name: (name || 'Admin Created').trim(),
        client_email: (email || 'admin@sard.dev').trim().toLowerCase(),
        service_type: service || 'AI Consultation',
        notes: notes || 'Created via Admin API',
        status: 'confirmed',
        created_via: created_via || 'admin_api',
      };

      const targetUrl = `${supabaseUrl}/rest/v1/calendar_appointments`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 409) {
          return new Response(JSON.stringify({ error: 'Slot already booked' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        console.warn(`[admin] Supabase POST returned status ${res.status}`);
        return new Response(JSON.stringify({ error: 'Failed to create appointment' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const created = await res.json();
      return new Response(JSON.stringify({ data: Array.isArray(created) ? created[0] : created }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // PATCH: Cancel appointment
  if (req.method === 'PATCH') {
    try {
      const body = await req.json();
      const { id, status } = body || {};

      if (!id || status !== 'cancelled') {
        return new Response(JSON.stringify({ error: 'Appointment id and status="cancelled" are required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const targetUrl = `${supabaseUrl}/rest/v1/calendar_appointments?id=eq.${encodeURIComponent(id)}`;
      const res = await fetch(targetUrl, {
        method: 'PATCH',
        headers: supabaseHeaders,
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!res.ok) {
        console.warn(`[admin] Supabase PATCH returned status ${res.status}`);
        return new Response(JSON.stringify({ error: 'Failed to cancel appointment' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
