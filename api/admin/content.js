// api/admin/content.js
// DEV-194: admin CRUD for site content: projects, job/training openings and collaborations.
//   GET    /api/admin/content?type=projects                 → all rows (published and hidden), by display_order
//   POST   /api/admin/content?type=projects   {fields}      → create (added at the end of the list)
//   PATCH  /api/admin/content?type=projects   {id, fields}  → partial update (also hide / publish)
//   PATCH  /api/admin/content?type=projects   {order:[ids]} → reorder
//   DELETE /api/admin/content?type=projects&id=…            → delete permanently
// Protected by the admin session cookie + CSRF (api/_lib/adminGuard.js). Writes use the service role.
// Database errors are never returned to the browser.

import { guardAdminRequest, getServiceConfig, serviceHeaders, json, UUID_RE } from '../_lib/adminGuard.js';
import { CONTENT_TYPES, validateRecord } from '../../src/config/adminContentSchema.js';

export const config = { runtime: 'edge' };

const MAX_BODY = 64 * 1024;

async function readJson(req) {
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY) return { tooLarge: true };
  try { return { body: await req.json() }; } catch { return { body: null }; }
}

function mediaPath(url, value) {
  const prefix = `${url}/storage/v1/object/public/site-media/`;
  return typeof value === 'string' && value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

export default async function handler(req, env = {}) {
  const denied = await guardAdminRequest(req);
  if (denied) return denied;

  const params = new URL(req.url).searchParams;
  const type = params.get('type') || '';
  const def = CONTENT_TYPES[type];
  if (!def) return json(400, { error: 'unknown_type' });

  const { url, key } = getServiceConfig(env);
  if (!key) return json(503, { error: 'Server configuration missing.' });
  const base = `${url}/rest/v1/${def.table}`;
  const headers = serviceHeaders(key, { 'Content-Type': 'application/json', Prefer: 'return=representation' });

  try {
    if (req.method === 'GET') {
      const res = await fetch(`${base}?select=*&order=display_order.asc,created_at.asc`, { headers });
      if (!res.ok) { console.warn(`[admin/content] GET ${type} ${res.status}`); return json(502, { error: 'load_failed' }); }
      return json(200, { data: await res.json() });
    }

    if (req.method === 'POST') {
      const { body, tooLarge } = await readJson(req);
      if (tooLarge) return json(413, { error: 'too_large' });
      const { data, errors } = validateRecord(type, body);
      if (errors) return json(400, { error: 'invalid', fields: errors });

      const last = await fetch(`${base}?select=display_order&order=display_order.desc&limit=1`, { headers });
      const rows = last.ok ? await last.json() : [];
      data.display_order = (Array.isArray(rows) && rows[0] ? Number(rows[0].display_order) || 0 : 0) + 1;

      const res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(data) });
      if (!res.ok) { console.warn(`[admin/content] POST ${type} ${res.status}`); return json(502, { error: 'save_failed' }); }
      const created = await res.json();
      return json(201, { data: Array.isArray(created) ? created[0] : created });
    }

    if (req.method === 'PATCH') {
      const { body, tooLarge } = await readJson(req);
      if (tooLarge) return json(413, { error: 'too_large' });
      if (!body || typeof body !== 'object') return json(400, { error: 'invalid', fields: ['body'] });

      if (Array.isArray(body.order)) {
        const ids = body.order;
        if (ids.length === 0 || ids.length > 200 || !ids.every((id) => typeof id === 'string' && UUID_RE.test(id)) || new Set(ids).size !== ids.length) {
          return json(400, { error: 'invalid', fields: ['order'] });
        }
        for (let i = 0; i < ids.length; i++) {
          const res = await fetch(`${base}?id=eq.${ids[i]}`, { method: 'PATCH', headers, body: JSON.stringify({ display_order: i + 1 }) });
          if (!res.ok) { console.warn(`[admin/content] reorder ${type} ${res.status}`); return json(502, { error: 'save_failed' }); }
        }
        return json(200, { success: true });
      }

      const { id, ...fields } = body;
      if (typeof id !== 'string' || !UUID_RE.test(id)) return json(400, { error: 'invalid', fields: ['id'] });
      const { data, errors } = validateRecord(type, fields, { partial: true });
      if (errors) return json(400, { error: 'invalid', fields: errors });
      data.updated_at = new Date().toISOString();

      const res = await fetch(`${base}?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify(data) });
      if (!res.ok) { console.warn(`[admin/content] PATCH ${type} ${res.status}`); return json(502, { error: 'save_failed' }); }
      const updated = await res.json();
      if (!Array.isArray(updated) || updated.length === 0) return json(404, { error: 'not_found' });
      return json(200, { data: updated[0] });
    }

    if (req.method === 'DELETE') {
      const id = params.get('id') || '';
      if (!UUID_RE.test(id)) return json(400, { error: 'invalid', fields: ['id'] });
      const res = await fetch(`${base}?id=eq.${id}`, { method: 'DELETE', headers });
      if (!res.ok) { console.warn(`[admin/content] DELETE ${type} ${res.status}`); return json(502, { error: 'delete_failed' }); }
      const deleted = await res.json();
      if (!Array.isArray(deleted) || deleted.length === 0) return json(404, { error: 'not_found' });

      // Remove an uploaded image that only this row used (best effort).
      const path = def.imageField ? mediaPath(url, deleted[0][def.imageField]) : null;
      if (path) {
        await fetch(`${url}/storage/v1/object/site-media/${path}`, { method: 'DELETE', headers: serviceHeaders(key) }).catch(() => {});
      }
      return json(200, { success: true });
    }
  } catch {
    return json(502, { error: 'Database service unavailable' });
  }

  return json(405, { error: 'Method not allowed' });
}
