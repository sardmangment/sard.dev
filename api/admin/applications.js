// api/admin/applications.js
// DEV-194: job applications submitted from /careers (DEV-192). Personal data: admin only.
//   GET    /api/admin/applications?opening=<uuid|general>&status=<status>  → newest first
//   PATCH  /api/admin/applications  {id, status}                          → update status
//   POST   /api/admin/applications  {action:"cv", id}                     → { url } signed CV link, valid 60 s
//   DELETE /api/admin/applications?id=…                                   → delete the application AND its CV
// The CV bucket is private; links are short-lived signed URLs, never public links.
// Protected by the admin session cookie + CSRF. Database / storage errors are not returned.

import { guardAdminRequest, getServiceConfig, serviceHeaders, json, UUID_RE } from '../_lib/adminGuard.js';

export const config = { runtime: 'edge' };

export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'];
export const CV_LINK_SECONDS = 60;
const BUCKET = 'job-applications';
const CV_PATH_RE = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/i;
// Only what the dashboard shows (no ip_hash / user_agent / cv_path).
const LIST_FIELDS = 'id,opening_id,opening_title,full_name,email,phone,city,profile_url,message,status,created_at';

async function readJson(req) {
  if (Number(req.headers.get('content-length') || 0) > 4096) return null;
  try { return await req.json(); } catch { return null; }
}

export default async function handler(req, env = {}) {
  const denied = await guardAdminRequest(req);
  if (denied) return denied;

  const { url, key } = getServiceConfig(env);
  if (!key) return json(503, { error: 'Server configuration missing.' });
  const base = `${url}/rest/v1/job_applications`;
  const headers = serviceHeaders(key, { 'Content-Type': 'application/json', Prefer: 'return=representation' });
  const params = new URL(req.url).searchParams;

  try {
    if (req.method === 'GET') {
      const filters = [];
      const opening = params.get('opening');
      if (opening === 'general') filters.push('opening_id=is.null');
      else if (opening) {
        if (!UUID_RE.test(opening)) return json(400, { error: 'invalid', fields: ['opening'] });
        filters.push(`opening_id=eq.${opening}`);
      }
      const status = params.get('status');
      if (status) {
        if (!APPLICATION_STATUSES.includes(status)) return json(400, { error: 'invalid', fields: ['status'] });
        filters.push(`status=eq.${status}`);
      }
      const q = [`select=${LIST_FIELDS}`, ...filters, 'order=created_at.desc', 'limit=500'].join('&');
      const res = await fetch(`${base}?${q}`, { headers });
      if (!res.ok) { console.warn(`[admin/applications] GET ${res.status}`); return json(502, { error: 'load_failed' }); }
      return json(200, { data: await res.json() });
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (!body || typeof body.id !== 'string' || !UUID_RE.test(body.id)) return json(400, { error: 'invalid', fields: ['id'] });
      if (!APPLICATION_STATUSES.includes(body.status)) return json(400, { error: 'invalid', fields: ['status'] });
      const res = await fetch(`${base}?id=eq.${body.id}&select=id,status`, { method: 'PATCH', headers, body: JSON.stringify({ status: body.status }) });
      if (!res.ok) { console.warn(`[admin/applications] PATCH ${res.status}`); return json(502, { error: 'save_failed' }); }
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return json(404, { error: 'not_found' });
      return json(200, { data: rows[0] });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      if (!body || body.action !== 'cv') return json(400, { error: 'invalid', fields: ['action'] });
      if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) return json(400, { error: 'invalid', fields: ['id'] });
      const res = await fetch(`${base}?id=eq.${body.id}&select=cv_path`, { headers });
      const rows = res.ok ? await res.json() : [];
      const path = rows[0]?.cv_path;
      if (!path) return json(404, { error: 'not_found' });
      if (!CV_PATH_RE.test(path)) return json(404, { error: 'cv_missing' });

      const sign = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
        method: 'POST',
        headers: serviceHeaders(key, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ expiresIn: CV_LINK_SECONDS }),
      });
      if (!sign.ok) { console.warn(`[admin/applications] sign ${sign.status}`); return json(sign.status === 404 || sign.status === 400 ? 404 : 502, { error: 'cv_missing' }); }
      const signed = await sign.json();
      const rel = signed.signedURL || signed.signedUrl;
      if (typeof rel !== 'string' || !rel.startsWith('/')) return json(502, { error: 'cv_missing' });
      return json(200, { url: `${url}/storage/v1${rel}`, expiresIn: CV_LINK_SECONDS });
    }

    if (req.method === 'DELETE') {
      const id = params.get('id') || '';
      if (!UUID_RE.test(id)) return json(400, { error: 'invalid', fields: ['id'] });
      const res = await fetch(`${base}?id=eq.${id}&select=id,cv_path`, { method: 'DELETE', headers });
      if (!res.ok) { console.warn(`[admin/applications] DELETE ${res.status}`); return json(502, { error: 'delete_failed' }); }
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return json(404, { error: 'not_found' });

      let cvDeleted = false;
      const path = rows[0].cv_path;
      if (typeof path === 'string' && CV_PATH_RE.test(path)) {
        const del = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: serviceHeaders(key) }).catch(() => null);
        cvDeleted = Boolean(del && del.ok);
        if (!cvDeleted) console.warn('[admin/applications] cv_delete_failed');
      }
      return json(200, { success: true, cvDeleted });
    }
  } catch {
    return json(502, { error: 'Database service unavailable' });
  }

  return json(405, { error: 'Method not allowed' });
}
