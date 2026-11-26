-- 20261126_dev212_app_settings.sql
-- DEV-212: server-only settings, starting with the AI assistant's Gemini API key
-- (set from /admin → Assistant). Stored as plain text by decision (no extra encryption).
--
-- Only the server can read or write this table, through the service role (which bypasses RLS).
-- RLS is on with NO policies, and anon / authenticated lose every privilege, so the browser
-- (publishable key) can never read it.
--
-- If no key is stored here, /api/chat keeps using the Cloudflare secret GEMINI_API_KEY.
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp). Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{1,64}$'),
  value      text NOT NULL CHECK (char_length(value) BETWEEN 1 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

COMMIT;

-- Check: expect rls_on = true and no privileges for anon (both false).
SELECT c.relrowsecurity AS rls_on,
       has_table_privilege('anon', 'public.app_settings', 'SELECT') AS anon_select,
       has_table_privilege('anon', 'public.app_settings', 'INSERT') AS anon_insert
FROM pg_class c
WHERE c.oid = 'public.app_settings'::regclass;
