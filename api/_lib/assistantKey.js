// api/_lib/assistantKey.js
// DEV-212: the AI assistant's Gemini API key.
// Order: the key saved from /admin (public.app_settings, read with the service role) → the Cloudflare
// secret GEMINI_API_KEY. The key never leaves the server. Lookups are cached for 60 s per worker so
// /api/chat does not query the database on every message.

import { getServiceConfig, serviceHeaders } from './adminGuard.js';

export const ASSISTANT_KEY_SETTING = 'gemini_api_key';
const CACHE_MS = 60 * 1000;
let cache = null; // { value: string|null, updatedAt: string|null, at: number }

export function clearAssistantKeyCache() {
  cache = null;
}

function envKey(env) {
  const e = env && Object.keys(env).length ? env : ((typeof globalThis !== 'undefined' && globalThis.__CF_ENV__) || {});
  return e.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || '';
}

/** Reads the admin-saved key. Returns { value, updatedAt } or null. Throws only on configuration errors. */
export async function readStoredKey(env) {
  const { url, key } = getServiceConfig(env);
  if (!key) return null;
  const res = await fetch(`${url}/rest/v1/app_settings?key=eq.${ASSISTANT_KEY_SETTING}&select=value,updated_at`, {
    headers: serviceHeaders(key),
  });
  if (!res.ok) throw new Error(`app_settings ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows[0]?.value ? { value: rows[0].value, updatedAt: rows[0].updated_at || null } : null;
}

/** The key /api/chat should use, and where it came from ('admin' | 'env' | 'none'). */
export async function getAssistantKey(env) {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    try {
      const stored = await readStoredKey(env);
      cache = { value: stored?.value || null, updatedAt: stored?.updatedAt || null, at: Date.now() };
    } catch (err) {
      // Database unavailable or table missing: fall back to the Cloudflare secret (not cached).
      console.warn(`[assistant-key] stored key unavailable: ${err.message}`);
      const fallback = envKey(env);
      return { key: fallback, source: fallback ? 'env' : 'none' };
    }
  }
  if (cache.value) return { key: cache.value, source: 'admin' };
  const fallback = envKey(env);
  return { key: fallback, source: fallback ? 'env' : 'none' };
}

export function hasEnvKey(env) {
  return Boolean(envKey(env));
}
