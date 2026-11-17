// api/_lib/rateLimit.js
// Shared rate-limiter: SHA-256 IP hashing, atomic Postgres RPC, fail-closed for admin and chat.

import { sha256Hex } from './adminSession.js';

function getSupabaseConfig() {
  const env = (typeof globalThis !== 'undefined' && globalThis.__CF_ENV__) ? globalThis.__CF_ENV__ : {};
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) : '') || 'https://hnihrwignetxwudoqntp.supabase.co';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : '');
  return { supabaseUrl, serviceRoleKey };
}

async function callRateLimitRpc(key, windowSeconds, maxAllowed) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) {
    throw new Error('CONFIG_MISSING: SUPABASE_SERVICE_ROLE_KEY is required for rate-limiting.');
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/hit_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: maxAllowed,
    }),
  });

  if (!res.ok) {
    throw new Error(`RPC_ERROR: Rate limit check failed with HTTP ${res.status}`);
  }

  const allowed = await res.json();
  return allowed === true;
}

/**
 * Chat Rate Limiting:
 * - 20 requests per minute per IP
 * - 300 requests per day per IP
 * Fails closed (throws Error) if shared database store is unavailable to protect Gemini quota.
 */
export async function checkChatRateLimit(ip) {
  const hashedIp = await sha256Hex(ip || 'unknown');
  const withinMin = await callRateLimitRpc(`chat:${hashedIp}:min`, 60, 20);
  if (!withinMin) return false;

  const withinDay = await callRateLimitRpc(`chat:${hashedIp}:day`, 86400, 300);
  if (!withinDay) return false;

  return true;
}

/**
 * Admin Login Rate Limiting (HF-11 / Decisions D-27, D-28):
 * - 10 attempts per 15 minutes per IP (atomic hit_rate_limit, fails closed with 503 if store down)
 * - After a failed attempt, hits 'admin-login-failed-global' (max 50/hour); if exceeded, logs a warning without blocking
 */
export async function hitAdminLoginAttempt(ip) {
  const hashedIp = await sha256Hex(ip || 'unknown');
  // Atomic increment and window check: 10 attempts in 900 seconds
  return await callRateLimitRpc(`admin-login:${hashedIp}`, 900, 10);
}

export async function recordAdminLoginFailureGlobal() {
  try {
    const withinGlobal = await callRateLimitRpc('admin-login-failed-global', 3600, 50);
    if (!withinGlobal) {
      console.warn('admin_login_global_threshold');
    }
  } catch (err) {
    console.warn('admin_login_global_threshold_check_failed:', err.message);
  }
}
