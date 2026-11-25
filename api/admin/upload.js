// api/admin/upload.js
// DEV-194: image upload for project images and collaboration logos.
//   POST /api/admin/upload  multipart/form-data { file, folder: "projects" | "collaborations" | "partners" | "team" }
//   → { url } public URL in the "site-media" bucket.
// PNG / JPEG / WebP only (checked by file signature, not just the declared type), 2 MB max. No SVG.
// Protected by the admin session cookie + CSRF.

import { guardAdminRequest, getServiceConfig, serviceHeaders, json } from '../_lib/adminGuard.js';

export const config = { runtime: 'edge' };

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const FOLDERS = new Set(['projects', 'collaborations', 'partners', 'team']);
const BUCKET = 'site-media';

/** Detects the image type from its first bytes. Returns { ext, mime } or null. */
export function sniffImage(bytes) {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

export default async function handler(req, env = {}) {
  const denied = await guardAdminRequest(req);
  if (denied) return denied;
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) {
    return json(415, { error: 'unsupported_media_type' });
  }
  if (Number(req.headers.get('content-length') || 0) > MAX_IMAGE_BYTES + 64 * 1024) return json(413, { error: 'image_too_large' });

  const { url, key } = getServiceConfig(env);
  if (!key) return json(503, { error: 'Server configuration missing.' });

  let form;
  try { form = await req.formData(); } catch { return json(400, { error: 'invalid_form' }); }
  const folder = form.get('folder');
  const file = form.get('file');
  if (typeof folder !== 'string' || !FOLDERS.has(folder)) return json(400, { error: 'invalid_folder' });
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function' || file.size <= 0) return json(400, { error: 'image_missing' });
  if (file.size > MAX_IMAGE_BYTES) return json(413, { error: 'image_too_large' });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return json(415, { error: 'image_type' });

  const path = `${folder}/${crypto.randomUUID()}.${kind.ext}`;
  try {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: serviceHeaders(key, { 'Content-Type': kind.mime, 'x-upsert': 'false', 'Cache-Control': 'max-age=31536000' }),
      body: bytes,
    });
    if (!res.ok) { console.warn(`[admin/upload] storage ${res.status}`); return json(502, { error: 'upload_failed' }); }
  } catch {
    return json(502, { error: 'upload_failed' });
  }
  return json(201, { url: `${url}/storage/v1/object/public/${BUCKET}/${path}` });
}
