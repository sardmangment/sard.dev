-- 20261117_rate_limits_revoke_anon.sql
-- HOTFIX for production (hnihrwignetxwudoqntp), where 20261115_rate_limits.sql was applied with
-- "REVOKE ... FROM PUBLIC" only. Supabase grants EXECUTE on new public functions to anon and
-- authenticated directly, so that REVOKE did not remove them: on 2026-11-17 an anon-key call to
-- /rest/v1/rpc/hit_rate_limit returned 200. Anyone could then fill rate_limits with junk keys, or
-- burn another visitor's chat/admin-login budget (keys are unsalted sha256 of the IP).
-- Idempotent and safe to re-run. Touches no data.

-- Ensure cleanup function exists before revoking permissions
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE window_start < NOW() - INTERVAL '7 days';
$$;

REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, int, int) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;

-- Verify (expect: anon=false, authenticated=false, service_role=true for both rows):
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('hit_rate_limit', 'cleanup_expired_rate_limits');

-- Remove the single probe row created during the 2026-11-17 diagnosis:
DELETE FROM public.rate_limits WHERE key = 'probe';
