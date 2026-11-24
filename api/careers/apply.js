// api/careers/apply.js
// DEV-192: receives job / training applications from the /careers form.
// - Same-origin only (no CORS), POST multipart/form-data.
// - Rate limited per IP (fails closed), honeypot field for bots.
// - CV: PDF only (type + magic bytes), 5 MB max, stored in the PRIVATE "job-applications" bucket.
// - Row written to public.job_applications with the service role (no public access to that table).
// - Errors never leak database details.

import { isOriginAllowed, sha256Hex } from '../_lib/adminSession.js';
import { checkCareersApplyRateLimit } from '../_lib/rateLimit.js';

export const config = { runtime: 'edge' };

export const MAX_CV_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_CV_BYTES + 256 * 1024;
const BUCKET = 'job-applications';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,25}$/;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function getConfig(env) {
  const e = env && Object.keys(env).length ? env : ((typeof globalThis !== 'undefined' && globalThis.__CF_ENV__) || {});
  const p = typeof process !== 'undefined' ? process.env : {};
  return {
    url: e.SUPABASE_URL || e.VITE_SUPABASE_URL || p.SUPABASE_URL || p.VITE_SUPABASE_URL || 'https://hnihrwignetxwudoqntp.supabase.co',
    key: e.SUPABASE_SERVICE_ROLE_KEY || p.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');

// Returns { data } or { errors: [field, ...] }
export function validateApplication(form) {
  const data = {
    full_name: text(form.get('full_name'), 120),
    email: text(form.get('email'), 200).toLowerCase(),
    phone: text(form.get('phone'), 25),
    city: text(form.get('city'), 80) || null,
    profile_url: text(form.get('profile_url'), 300) || null,
    message: text(form.get('message'), 2000) || null,
    opening_id: text(form.get('opening_id'), 36) || null,
  };
  const errors = [];
  if (data.full_name.length < 2 || data.full_name.length > 120) errors.push('full_name');
  if (!EMAIL_RE.test(data.email) || data.email.length > 200) errors.push('email');
  if (!PHONE_RE.test(data.phone)) errors.push('phone');
  if (data.city && data.city.length > 80) errors.push('city');
  if (data.profile_url && (data.profile_url.length > 300 || !/^https?:\/\/\S+$/i.test(data.profile_url))) errors.push('profile_url');
  if (data.message && data.message.length > 2000) errors.push('message');
  if (data.opening_id && !UUID_RE.test(data.opening_id)) errors.push('opening_id');
  if (form.get('consent') !== 'yes') errors.push('consent');
  return errors.length ? { errors } : { data };
}

export async function checkCv(file) {
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') return 'cv_missing';
  if (file.size <= 0) return 'cv_missing';
  if (file.size > MAX_CV_BYTES) return 'cv_too_large';
  const nameOk = /\.pdf$/i.test(file.name || '');
  if (file.type !== 'application/pdf' && !nameOk) return 'cv_type';
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') return 'cv_type';
  return null;
}

export default async function handler(req, env = {}) {
  const origin = req.headers.get('origin');
  if (!origin || !isOriginAllowed(origin)) return json(403, { error: 'invalid_origin' });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) {
    return json(415, { error: 'unsupported_media_type' });
  }
  const length = Number(req.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) return json(413, { error: 'cv_too_large' });

  const { url, key } = getConfig(env);
  if (!key) return json(503, { error: 'unavailable' });

  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  try {
    if (!(await checkCareersApplyRateLimit(ip))) return json(429, { error: 'rate_limited' });
  } catch {
    return json(503, { error: 'unavailable' });
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return json(400, { error: 'invalid_input' });
  }

  // Honeypot: bots fill hidden fields. Pretend success and store nothing.
  if (text(form.get('website'), 200)) return json(201, { ok: true });

  const { data, errors } = validateApplication(form);
  if (errors) return json(400, { error: 'invalid_input', fields: errors });

  const cv = form.get('cv');
  const cvError = await checkCv(cv);
  if (cvError) return json(400, { error: cvError });

  const auth = { apikey: key, Authorization: `Bearer ${key}` };

  // A specific opening must exist, be published and still open.
  let openingTitle = null;
  if (data.opening_id) {
    const r = await fetch(`${url}/rest/v1/job_openings?id=eq.${data.opening_id}&select=title_ar,title_en,is_published,closes_at`, { headers: auth });
    const rows = r.ok ? await r.json() : [];
    const o = rows[0];
    const today = new Date().toISOString().slice(0, 10);
    if (!o || !o.is_published || (o.closes_at && o.closes_at < today)) return json(400, { error: 'opening_unavailable' });
    openingTitle = o.title_en || o.title_ar;
  }

  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.pdf`;

  const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    body: await cv.arrayBuffer(),
  });
  if (!up.ok) return json(503, { error: 'unavailable' });

  const row = {
    ...data,
    opening_title: openingTitle,
    cv_path: path,
    consent_at: now.toISOString(),
    ip_hash: await sha256Hex(ip),
    user_agent: (req.headers.get('user-agent') || '').slice(0, 300),
  };
  const ins = await fetch(`${url}/rest/v1/job_applications`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!ins.ok) {
    // Do not keep an orphan CV.
    await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: auth }).catch(() => {});
    return json(503, { error: 'unavailable' });
  }

  return json(201, { ok: true });
}
