// Cloudflare Pages Function: /api/careers/apply adapter (DEV-192)
import handler from '../../../api/careers/apply.js';

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
