// Cloudflare Pages Function: /api/admin/session adapter
import handler from '../../../api/admin/session.js';

export async function onRequest(context) {
  if (typeof process === 'undefined') {
    globalThis.process = { env: {} };
  }
  if (!process.env) {
    process.env = {};
  }
  if (context.env) {
    Object.assign(process.env, context.env);
  }
  return handler(context.request);
}
