-- Migration: Shared Rate Limiter (HF-03)
-- Target: Supabase public.rate_limits (Database: hnihrwignetxwudoqntp)
-- Atomic rate-limiting table and stored procedure for Vercel Edge/Serverless functions.
-- RLS enabled with NO policies: strictly accessible only by service_role.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT NOW(),
  count int NOT NULL DEFAULT 1
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.hit_rate_limit(
  p_key text,
  p_window_seconds int,
  p_max int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, NOW(), 1)
  ON CONFLICT (key) DO UPDATE
  SET 
    count = CASE 
      WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::interval < NOW() THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE 
      WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::interval < NOW() THEN NOW()
      ELSE rate_limits.window_start
    END
  RETURNING rate_limits.count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, int, int) TO service_role;

-- Periodic cleanup function: Prunes rate limit rows older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE window_start < NOW() - INTERVAL '7 days';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;
