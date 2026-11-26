// api/admin/assistant-key.js
// DEV-212: set the AI assistant's Gemini API key from the admin dashboard.
//   GET    → { source: 'admin'|'env'|'none', last4, updatedAt, envConfigured }  (never the key itself)
//   POST   { key } → tests the key with Google, saves it only if it works → { last4, updatedAt }
//   DELETE → removes the saved key; /api/chat goes back to the Cloudflare secret GEMINI_API_KEY
// Protected by the admin session cookie + CSRF (api/_lib/adminGuard.js). Writes use the service role.

import { guardAdminRequest, getServiceConfig, serviceHeaders, json } from '../_lib/adminGuard.js';
import { ASSISTANT_KEY_SETTING, clearAssistantKeyCache, readStoredKey, hasEnvKey } from '../_lib/assistantKey.js';
import { normalizeAssistantKey, isPlausibleAssistantKey } from '../../src/config/assistantKeyFormat.js';

export const config = { runtime: 'edge' };

const MAX_BODY = 4 * 1024;

const last4 = (k) => (k ? k.slice(-4) : null);

/** Asks Google whether the key works (lists models; nothing is generated, no cost). */
export async function testGeminiKey(key) {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      headers: { 'x-goog-api-key': key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, env = {}) {
  const denied = await guardAdminRequest(req);
  if (denied) return denied;

  const { url, key: serviceKey } = getServiceConfig(env);
  if (!serviceKey) return json(503, { error: 'Server configuration missing.' });
  const base = `${url}/rest/v1/app_settings`;

  try {
    if (req.method === 'GET') {
      let stored = null;
      try {
        stored = await readStoredKey(env);
      } catch {
        return json(502, { error: 'load_failed' });
      }
      const envConfigured = hasEnvKey(env);
      return json(200, {
        source: stored ? 'admin' : envConfigured ? 'env' : 'none',
        last4: last4(stored?.value),
        updatedAt: stored?.updatedAt || null,
        envConfigured,
      });
    }

    if (req.method === 'POST') {
      if (Number(req.headers.get('content-length') || 0) > MAX_BODY) return json(413, { error: 'too_large' });
      let body;
      try { body = await req.json(); } catch { body = null; }
      const newKey = normalizeAssistantKey(body?.key);
      if (!isPlausibleAssistantKey(newKey)) return json(400, { error: 'invalid_key' });

      if (!(await testGeminiKey(newKey))) return json(422, { error: 'key_rejected' });

      const updatedAt = new Date().toISOString();
      const res = await fetch(`${base}?on_conflict=key`, {
        method: 'POST',
        headers: serviceHeaders(serviceKey, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ key: ASSISTANT_KEY_SETTING, value: newKey, updated_at: updatedAt }),
      });
      if (!res.ok) { console.warn(`[admin/assistant-key] save ${res.status}`); return json(502, { error: 'save_failed' }); }
      clearAssistantKeyCache();
      return json(200, { source: 'admin', last4: last4(newKey), updatedAt });
    }

    if (req.method === 'DELETE') {
      const res = await fetch(`${base}?key=eq.${ASSISTANT_KEY_SETTING}`, { method: 'DELETE', headers: serviceHeaders(serviceKey) });
      if (!res.ok) { console.warn(`[admin/assistant-key] delete ${res.status}`); return json(502, { error: 'delete_failed' }); }
      clearAssistantKeyCache();
      const envConfigured = hasEnvKey(env);
      return json(200, { source: envConfigured ? 'env' : 'none', last4: null, updatedAt: null, envConfigured });
    }
  } catch {
    return json(502, { error: 'Database service unavailable' });
  }

  return json(405, { error: 'Method not allowed' });
}
