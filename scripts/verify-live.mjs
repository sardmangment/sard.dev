#!/usr/bin/env node
// scripts/verify-live.mjs
// Live Verification Script for SARD UNIFIED (HF-05 / HF-12 / DEV-110 / DEV-111)
// Verifies live Preview, Staging, or Production deployments without leaking secrets.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const APPROVED_13_SLOTS = [
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
  '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM',
  '10:00 PM', '11:00 PM', '12:00 AM'
];

/**
 * Scan dates from CURRENT_DATE + 60 to +90 and find the first available slot among 13 approved slots.
 * Never goes past +90 days and never returns 2099.
 */
export async function findFreeTestSlot(supabaseUrl, anonKey, customFetch = fetch) {
  const now = new Date();

  for (let offset = 60; offset <= 90; offset++) {
    const d = new Date(now.getTime() + offset * 86400 * 1000);
    const dateStr = d.toISOString().split('T')[0];

    try {
      const res = await customFetch(`${supabaseUrl}/rest/v1/rpc/get_booked_slots_for_date`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_date: dateStr }),
      });

      if (res.ok) {
        const booked = await res.json();
        const bookedSlots = Array.isArray(booked) ? booked.map((b) => b.time_slot || b) : [];
        const freeSlot = APPROVED_13_SLOTS.find((s) => !bookedSlots.includes(s));
        if (freeSlot) {
          return { date: dateStr, slot: freeSlot, offset };
        }
      }
    } catch {
      // try next date
    }
  }

  return null;
}

export async function runVerification({
  target = 'preview',
  activeSuites = ['admin', 'chat', 'calendar'],
  includeRateLimit = false,
  baseUrl = 'https://sard.dev',
  supabaseUrl = 'https://hnihrwignetxwudoqntp.supabase.co',
  anonKey = '',
  adminPasscode = '',
  customFetch = fetch,
  logFn = console.log
} = {}) {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const cleanSupabaseUrl = supabaseUrl.replace(/\/+$/, '');
  const results = [];

  function recordResult(suite, checkId, title, pass, detail, httpStatus = '-') {
    const resultObj = {
      suite,
      checkId,
      title,
      status: pass ? 'PASS' : 'FAIL',
      httpStatus: String(httpStatus),
      detail,
    };
    results.push(resultObj);
    const icon = pass ? '✅' : '❌';
    logFn(`  ${icon} [${suite.toUpperCase()} - ${checkId}] ${title}: ${pass ? 'PASS' : 'FAIL'} (${detail})`);
  }

  // --------------------------------------------------------------------------
  // Calendar Suite
  // --------------------------------------------------------------------------
  if (activeSuites.includes('calendar')) {
    logFn('\n--- Running Calendar Security & Token Suite ---');

    if (!anonKey) {
      recordResult('calendar', 'CAL-PRECHECK', 'Supabase Anon Key configuration', false, 'Missing SUPABASE_ANON_KEY in env');
    } else {
      const freeSlotInfo = await findFreeTestSlot(cleanSupabaseUrl, anonKey, customFetch);

      if (!freeSlotInfo) {
        recordResult('calendar', 'CAL-SLOT', 'Free test slot availability', false, 'no free test slot between day +60 and +90');
      } else {
        const { date: testDate, slot: testSlot } = freeSlotInfo;
        const testEmail = `verify-live+${Date.now()}@example.com`;
        let createdBookingId = null;
        let manageToken = null;
        let cancelled = false;

        // 1. Direct anonymous SELECT must return empty array or error
        try {
          const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/calendar_appointments?select=*`, {
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          });
          if (res.ok) {
            const data = await res.json();
            const isSecure = Array.isArray(data) && data.length === 0;
            recordResult('calendar', 'CAL-01', 'Anon direct SELECT blocked/empty', isSecure, isSecure ? 'Returned 0 records' : `Leaked ${data.length} records (VIOLATION)`, res.status);
          } else {
            const isBlocked = [400, 401, 403, 404].includes(res.status);
            recordResult('calendar', 'CAL-01', 'Anon direct SELECT blocked/empty', isBlocked, `HTTP ${res.status} blocked by RLS`, res.status);
          }
        } catch (err) {
          recordResult('calendar', 'CAL-01', 'Anon direct SELECT blocked/empty', false, `Request failed: ${err.message}`);
        }

        // 2. Direct anonymous INSERT must fail
        try {
          const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/calendar_appointments`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              date: testDate,
              time_slot: testSlot,
              client_name: 'Direct Insert Hacker',
              client_email: 'hacker@test.local',
            }),
          });
          const denied = !res.ok;
          recordResult('calendar', 'CAL-02', 'Anon direct table INSERT denied', denied, denied ? `HTTP ${res.status} blocked` : 'Allowed direct table insert (SECURITY VIOLATION)', res.status);
        } catch (err) {
          recordResult('calendar', 'CAL-02', 'Anon direct table INSERT denied', false, `Request failed: ${err.message}`);
        }

        // 3. Obsolete email functions must return 404 / PGRST202
        try {
          const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/get_my_appointments`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_email: 'test@sard.dev' }),
          });
          const errText = !res.ok ? await res.text() : '';
          const absent = errText.includes('PGRST202');
          recordResult('calendar', 'CAL-03', 'Obsolete get_my_appointments absent', absent, absent ? 'Function not found (PGRST202)' : `Unexpected status ${res.status}`, res.status);
        } catch (err) {
          recordResult('calendar', 'CAL-03', 'Obsolete get_my_appointments absent', false, `Request failed: ${err.message}`);
        }

        try {
          const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/cancel_own_appointment`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_id: '00000000-0000-0000-0000-000000000000', p_email: 'test@sard.dev' }),
          });
          const errText = !res.ok ? await res.text() : '';
          const absent = errText.includes('PGRST202');
          recordResult('calendar', 'CAL-04', 'Obsolete cancel_own_appointment absent', absent, absent ? 'Function not found (PGRST202)' : `Unexpected status ${res.status}`, res.status);
        } catch (err) {
          recordResult('calendar', 'CAL-04', 'Obsolete cancel_own_appointment absent', false, `Request failed: ${err.message}`);
        }

        // 4. get_booked_slots_for_date RPC returns valid 200 array
        try {
          const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/get_booked_slots_for_date`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_date: testDate }),
          });
          const ok = res.status === 200;
          recordResult('calendar', 'CAL-05', 'Public slot query returns 200', ok, ok ? 'Slot lookup functional' : `HTTP ${res.status}`, res.status);
        } catch (err) {
          recordResult('calendar', 'CAL-05', 'Public slot query returns 200', false, `Request failed: ${err.message}`);
        }

        // 5. book_appointment returns raw manage_token
        try {
          const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/book_appointment`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              p_date: testDate,
              p_time_slot: testSlot,
              p_name: 'Verify Live Bot',
              p_email: testEmail,
              p_service: 'Automated Test',
              p_notes: 'Temporary verification test appointment',
              p_created_via: 'verify_live',
            }),
          });

          if (res.status === 200) {
            const data = await res.json();
            const booking = Array.isArray(data) ? data[0] : data;
            if (booking?.id && booking?.manage_token && typeof booking.manage_token === 'string' && booking.manage_token.length === 64) {
              createdBookingId = booking.id;
              manageToken = booking.manage_token;
              recordResult('calendar', 'CAL-06', 'Secure booking returns manage_token', true, 'Token generated (64 hex chars)', res.status);
            } else {
              recordResult('calendar', 'CAL-06', 'Secure booking returns manage_token', false, 'Missing id or manage_token in RPC response', res.status);
            }
          } else {
            recordResult('calendar', 'CAL-06', 'Secure booking returns manage_token', false, `HTTP ${res.status}`, res.status);
          }
        } catch (err) {
          recordResult('calendar', 'CAL-06', 'Secure booking returns manage_token', false, `Request failed: ${err.message}`);
        }

        try {
          // 6. Duplicate slot booking fails with 23505 / 409
          if (createdBookingId) {
            try {
              const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/book_appointment`, {
                method: 'POST',
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${anonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_date: testDate,
                  p_time_slot: testSlot,
                  p_name: 'Duplicate Bot',
                  p_email: 'dup@example.com',
                  p_created_via: 'verify_live',
                }),
              });
              const errText = !res.ok ? await res.text() : '';
              const isConflict = res.status === 409 || errText.includes('23505');
              recordResult('calendar', 'CAL-07', 'Duplicate slot booking prevented', isConflict, isConflict ? `Blocked with HTTP ${res.status} (23505)` : `Duplicate allowed or wrong status ${res.status}`, res.status);
            } catch (err) {
              recordResult('calendar', 'CAL-07', 'Duplicate slot booking prevented', false, `Request failed: ${err.message}`);
            }
          }

          // 7. Token-based lookup: invalid token returns 0 rows
          if (createdBookingId) {
            try {
              const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/get_appointment_by_token`, {
                method: 'POST',
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${anonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_id: createdBookingId,
                  p_token: '0000000000000000000000000000000000000000000000000000000000000000',
                }),
              });
              if (res.status === 200) {
                const data = await res.json();
                const empty = Array.isArray(data) && data.length === 0;
                recordResult('calendar', 'CAL-08', 'Lookup with invalid token returns 0 rows', empty, empty ? 'Correctly returned 0 rows' : 'Leaked data on invalid token', res.status);
              } else {
                recordResult('calendar', 'CAL-08', 'Lookup with invalid token returns 0 rows', false, `HTTP ${res.status}`, res.status);
              }
            } catch (err) {
              recordResult('calendar', 'CAL-08', 'Lookup with invalid token returns 0 rows', false, `Request failed: ${err.message}`);
            }
          }

          // 8. Token-based lookup: valid token returns booking details
          if (createdBookingId && manageToken) {
            try {
              const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/get_appointment_by_token`, {
                method: 'POST',
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${anonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_id: createdBookingId,
                  p_token: manageToken,
                }),
              });
              if (res.status === 200) {
                const data = await res.json();
                const valid = Array.isArray(data) && data.length === 1 && data[0].id === createdBookingId;
                recordResult('calendar', 'CAL-09', 'Lookup with valid token returns appointment', valid, valid ? 'Found appointment record' : 'Failed to retrieve record', res.status);
              } else {
                recordResult('calendar', 'CAL-09', 'Lookup with valid token returns appointment', false, `HTTP ${res.status}`, res.status);
              }
            } catch (err) {
              recordResult('calendar', 'CAL-09', 'Lookup with valid token returns appointment', false, `Request failed: ${err.message}`);
            }
          }

          // 9. Token-based cancellation: invalid token fails
          if (createdBookingId) {
            try {
              const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/cancel_appointment_by_token`, {
                method: 'POST',
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${anonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_id: createdBookingId,
                  p_token: 'wrongtoken',
                }),
              });
              if (res.status === 200) {
                const data = await res.json();
                const failed = data === false;
                recordResult('calendar', 'CAL-10', 'Cancellation with wrong token returns false', failed, failed ? 'Unauthorized cancel blocked' : 'Cancelled with wrong token (VIOLATION)', res.status);
              } else {
                recordResult('calendar', 'CAL-10', 'Cancellation with wrong token returns false', false, `HTTP ${res.status}`, res.status);
              }
            } catch (err) {
              recordResult('calendar', 'CAL-10', 'Cancellation with wrong token returns false', false, `Request failed: ${err.message}`);
            }
          }

          // 10. Token-based cancellation: valid token succeeds and cleans up
          if (createdBookingId && manageToken) {
            try {
              const res = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/cancel_appointment_by_token`, {
                method: 'POST',
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${anonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_id: createdBookingId,
                  p_token: manageToken,
                }),
              });
              if (res.status === 200) {
                const data = await res.json();
                const success = data === true;
                if (success) cancelled = true;
                recordResult('calendar', 'CAL-11', 'Cancellation with valid token returns true', success, success ? 'Successfully cancelled & cleaned up' : 'Cancel returned false', res.status);
              } else {
                recordResult('calendar', 'CAL-11', 'Cancellation with valid token returns true', false, `HTTP ${res.status}`, res.status);
              }
            } catch (err) {
              recordResult('calendar', 'CAL-11', 'Cancellation with valid token returns true', false, `Request failed: ${err.message}`);
            }
          }
        } finally {
          // Guaranteed cleanup: cancel test booking if created and not yet cancelled
          if (createdBookingId && manageToken && !cancelled) {
            try {
              const cleanRes = await customFetch(`${cleanSupabaseUrl}/rest/v1/rpc/cancel_appointment_by_token`, {
                method: 'POST',
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${anonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_id: createdBookingId,
                  p_token: manageToken,
                }),
              });
              const cleanData = cleanRes.ok ? await cleanRes.json() : null;
              if (cleanData !== true) {
                recordResult('calendar', 'CAL-CLEANUP', 'Test booking cleanup', false, `cleanup failed — admin must cancel id ${createdBookingId}`);
              }
            } catch {
              recordResult('calendar', 'CAL-CLEANUP', 'Test booking cleanup', false, `cleanup failed — admin must cancel id ${createdBookingId}`);
            }
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Admin Suite
  // --------------------------------------------------------------------------
  if (activeSuites.includes('admin')) {
    logFn('\n--- Running Admin Session & Security Suite ---');

    if (!adminPasscode) {
      recordResult('admin', 'ADM-PRECHECK', 'ADMIN_PASSCODE configuration', false, 'Missing ADMIN_PASSCODE in env');
    } else {
      let sessionCookie = '';
      let csrfToken = '';

      // 1. Wrong passcode rejected with 401
      try {
        const res = await customFetch(`${cleanBaseUrl}/api/admin/session`, {
          method: 'POST',
          headers: {
            Origin: cleanBaseUrl,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ passcode: 'incorrect_passcode_test' }),
        });
        const rejected = res.status === 401;
        recordResult('admin', 'ADM-01', 'Login with wrong passcode returns 401', rejected, rejected ? 'Rejected with 401' : `Unexpected status ${res.status}`, res.status);
      } catch (err) {
        recordResult('admin', 'ADM-01', 'Login with wrong passcode returns 401', false, `Request failed: ${err.message}`);
      }

      // 2. Successful login sets __Host- cookie and returns CSRF token
      try {
        const res = await customFetch(`${cleanBaseUrl}/api/admin/session`, {
          method: 'POST',
          headers: {
            Origin: cleanBaseUrl,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ passcode: adminPasscode }),
        });

        if (res.status === 200) {
          const rawCookie = res.headers.get('set-cookie') || '';
          const data = await res.json();
          csrfToken = data.csrfToken || '';

          const match = rawCookie.match(/__Host-sard_admin=([^;]+)/);
          sessionCookie = match ? match[1] : '';

          const hasHost = rawCookie.includes('__Host-sard_admin=');
          const hasHttpOnly = /httponly/i.test(rawCookie);
          const hasSecure = /secure/i.test(rawCookie);
          const hasSameSite = /samesite=strict/i.test(rawCookie);
          const hasPath = /path=\//i.test(rawCookie);

          const cookieFlagsOk = hasHost && hasHttpOnly && hasSecure && hasSameSite && hasPath;
          const csrfOk = typeof csrfToken === 'string' && csrfToken.length === 64;

          recordResult('admin', 'ADM-02', 'Login sets __Host- cookie with required security flags', cookieFlagsOk, cookieFlagsOk ? 'All cookie security flags present' : `Missing flags in: ${rawCookie}`, res.status);
          recordResult('admin', 'ADM-03', 'Login returns in-memory CSRF token', csrfOk, csrfOk ? '64-hex CSRF token issued' : 'Invalid CSRF token', res.status);
        } else {
          recordResult('admin', 'ADM-02', 'Login sets __Host- cookie with required security flags', false, `HTTP ${res.status}`, res.status);
          recordResult('admin', 'ADM-03', 'Login returns in-memory CSRF token', false, `HTTP ${res.status}`, res.status);
        }
      } catch (err) {
        recordResult('admin', 'ADM-02', 'Login sets __Host- cookie with required security flags', false, `Request failed: ${err.message}`);
      }

      // 3. GET /api/admin/appointments without cookie returns 401
      try {
        const res = await customFetch(`${cleanBaseUrl}/api/admin/appointments`, {
          headers: { Origin: cleanBaseUrl },
        });
        const unauthorized = res.status === 401;
        recordResult('admin', 'ADM-04', 'Appointments API without session cookie returns 401', unauthorized, unauthorized ? 'Denied with 401' : `Status ${res.status}`, res.status);
      } catch (err) {
        recordResult('admin', 'ADM-04', 'Appointments API without session cookie returns 401', false, `Request failed: ${err.message}`);
      }

      // 4. GET /api/admin/appointments with session cookie returns 200
      if (sessionCookie) {
        try {
          const res = await customFetch(`${cleanBaseUrl}/api/admin/appointments`, {
            headers: {
              Origin: cleanBaseUrl,
              Cookie: `__Host-sard_admin=${sessionCookie}`,
            },
          });
          const ok = res.status === 200;
          recordResult('admin', 'ADM-05', 'Appointments API with valid session cookie returns 200', ok, ok ? 'Authorized' : `Status ${res.status}`, res.status);
        } catch (err) {
          recordResult('admin', 'ADM-05', 'Appointments API with valid session cookie returns 200', false, `Request failed: ${err.message}`);
        }
      }

      // 5. Mutation without CSRF token returns 403
      if (sessionCookie) {
        try {
          const res = await customFetch(`${cleanBaseUrl}/api/admin/appointments`, {
            method: 'PATCH',
            headers: {
              Origin: cleanBaseUrl,
              Cookie: `__Host-sard_admin=${sessionCookie}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000000' }),
          });
          const forbidden = res.status === 403;
          recordResult('admin', 'ADM-06', 'Mutation without CSRF token returns 403', forbidden, forbidden ? 'Protected by CSRF check (403)' : `Status ${res.status}`, res.status);
        } catch (err) {
          recordResult('admin', 'ADM-06', 'Mutation without CSRF token returns 403', false, `Request failed: ${err.message}`);
        }
      }

      // 6. DELETE /api/admin/session (logout) clears cookie
      if (sessionCookie) {
        try {
          const res = await customFetch(`${cleanBaseUrl}/api/admin/session`, {
            method: 'DELETE',
            headers: {
              Origin: cleanBaseUrl,
              Cookie: `__Host-sard_admin=${sessionCookie}`,
            },
          });
          const rawCookie = res.headers.get('set-cookie') || '';
          const cleared = res.status === 200 && /max-age=0/i.test(rawCookie);
          recordResult('admin', 'ADM-07', 'Logout revokes session and clears cookie', cleared, cleared ? 'Cookie cleared with Max-Age=0' : `Status ${res.status}`, res.status);
        } catch (err) {
          recordResult('admin', 'ADM-07', 'Logout revokes session and clears cookie', false, `Request failed: ${err.message}`);
        }

        // 7. Revoked cookie subsequently returns 401
        try {
          const res = await customFetch(`${cleanBaseUrl}/api/admin/appointments`, {
            headers: {
              Origin: cleanBaseUrl,
              Cookie: `__Host-sard_admin=${sessionCookie}`,
            },
          });
          const revoked = res.status === 401;
          recordResult('admin', 'ADM-08', 'Revoked session cookie returns 401', revoked, revoked ? 'Session successfully invalidated (401)' : `Status ${res.status}`, res.status);
        } catch (err) {
          recordResult('admin', 'ADM-08', 'Revoked session cookie returns 401', false, `Request failed: ${err.message}`);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Chat Suite
  // --------------------------------------------------------------------------
  if (activeSuites.includes('chat')) {
    logFn('\n--- Running AI Chat & Origin Security Suite ---');

    // 1. Foreign origin returns 403
    try {
      const res = await customFetch(`${cleanBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          Origin: 'https://evil-unauthorized-site.example.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        }),
      });
      const forbidden = res.status === 403;
      recordResult('chat', 'CHAT-01', 'Foreign origin rejected with 403', forbidden, forbidden ? 'Strict origin check passed' : `Status ${res.status}`, res.status);
    } catch (err) {
      recordResult('chat', 'CHAT-01', 'Foreign origin rejected with 403', false, `Request failed: ${err.message}`);
    }

    // 2. Valid request returns 200 with text
    try {
      const res = await customFetch(`${cleanBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          Origin: cleanBaseUrl,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'مرحبا، ما هي خدمات سارد؟' }] }],
        }),
      });
      if (res.status === 200) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const hasResponse = text.length > 0;
        recordResult('chat', 'CHAT-02', 'Valid chat request returns 200 with response', hasResponse, hasResponse ? 'AI response received' : 'Empty response text', res.status);
      } else {
        recordResult('chat', 'CHAT-02', 'Valid chat request returns 200 with response', false, `HTTP ${res.status}`, res.status);
      }
    } catch (err) {
      recordResult('chat', 'CHAT-02', 'Valid chat request returns 200 with response', false, `Request failed: ${err.message}`);
    }

    // 3. Optional Rate Limiting Test
    if (includeRateLimit) {
      logFn('  Testing chat rate limit burst...');
      let hit429 = false;
      for (let i = 0; i < 25; i++) {
        try {
          const res = await customFetch(`${cleanBaseUrl}/api/chat`, {
            method: 'POST',
            headers: {
              Origin: cleanBaseUrl,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `Burst test #${i}` }] }],
            }),
          });
          if (res.status === 429) {
            hit429 = true;
            break;
          }
        } catch {
          // ignore burst failures
        }
      }
      recordResult('chat', 'CHAT-03', 'Rate limit enforced (429 Too Many Requests)', hit429, hit429 ? '429 triggered on burst' : 'Rate limit not triggered within 25 requests');
    }
  }

  return results;
}

// ----------------------------------------------------------------------------
// CLI Execution
// ----------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  let target = 'preview';
  let suitesArg = 'admin,chat,calendar';
  let includeRateLimit = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) {
      target = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--suite' && args[i + 1]) {
      suitesArg = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--include-ratelimit') {
      includeRateLimit = true;
    } else if (args[i] === '--help') {
      console.log(`
Usage: node scripts/verify-live.mjs [options]

Options:
  --target <preview|production|staging|local>   Target deployment environment (default: preview)
  --suite <admin,chat,calendar>                Comma-separated suites to run (default: all)
  --include-ratelimit                          Include destructive/locking rate-limit verification
  --help                                       Show this help message
`);
      process.exit(0);
    }
  }

  const activeSuites = suitesArg.split(',').map((s) => s.trim());
  const baseUrl = (process.env.BASE_URL || 'https://sard.dev').replace(/\/+$/, '');
  const supabaseUrl = (process.env.SUPABASE_URL || 'https://hnihrwignetxwudoqntp.supabase.co').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const adminPasscode = process.env.ADMIN_PASSCODE || '';

  console.log('='.repeat(70));
  console.log(` SARD UNIFIED — Live Verification Suite`);
  console.log(` Target: ${target.toUpperCase()} | Base URL: ${baseUrl}`);
  console.log(` Suites: ${activeSuites.join(', ')}`);
  console.log('='.repeat(70));

  const startTime = Date.now();
  const results = await runVerification({
    target,
    activeSuites,
    includeRateLimit,
    baseUrl,
    supabaseUrl,
    anonKey,
    adminPasscode,
    customFetch: fetch,
    logFn: console.log,
  });

  const durationMs = Date.now() - startTime;
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log('\n' + '='.repeat(70));
  console.log(` Summary: ${passed}/${total} checks PASSED, ${failed} FAILED (${durationMs}ms)`);
  console.log('='.repeat(70));

  // Write markdown evidence report (zero secrets logged or exposed)
  const today = new Date().toISOString().split('T')[0];
  const reportDir = path.resolve(__dirname, '../../docs/evidence');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, `verify-live-${target}-${today}.md`);
  const reportMarkdown = `# Live Verification Report: ${target.toUpperCase()} (${today})

- **Target Deployment:** \`${target}\`
- **Base URL:** \`${baseUrl}\`
- **Executed At:** \`${new Date().toISOString()}\`
- **Total Checks:** ${total}
- **Passed:** ${passed}
- **Failed:** ${failed}
- **Overall Verdict:** **${failed === 0 ? 'ALL CHECKS PASSED' : 'VERIFICATION FAILED'}**

## Results Matrix

| Suite | Check ID | Title | Status | HTTP | Details |
|---|---|---|---|---|---|
${results.map((r) => `| ${r.suite} | \`${r.checkId}\` | ${r.title} | **${r.status}** | \`${r.httpStatus}\` | ${r.detail} |`).join('\n')}

---
*Generated by \`scripts/verify-live.mjs\` (Zero secrets logged or exposed).*
`;

  fs.writeFileSync(reportPath, reportMarkdown, 'utf8');
  console.log(` Report written to: ${reportPath}`);

  if (failed > 0) {
    console.error(`\n❌ Live verification failed with ${failed} failing check(s).`);
    process.exit(1);
  } else {
    console.log(`\n✅ All live verification checks passed successfully.`);
    process.exit(0);
  }
}

// Auto-run if executed as CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}
