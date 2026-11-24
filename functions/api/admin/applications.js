// Cloudflare Pages Function: /api/admin/applications adapter
import handler from '../../../api/admin/applications.js';

export async function onRequest(context) {
  const env = context.env || {};
  globalThis.__CF_ENV__ = env;
  if (typeof process !== 'undefined' && process.env) {
    try {
      Object.assign(process.env, env);
    } catch (err) {
      void err;
    }
  }
  return handler(context.request, env);
}
