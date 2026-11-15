-- Migration: Admin Session Management (HF-01)
-- Target: Supabase public.admin_sessions (Database: hnihrwignetxwudoqntp)
-- Stores SHA-256 hashed session and CSRF tokens. Plaintext tokens never stored.
-- RLS enabled with NO policies: strictly accessible only by service_role.

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,
  csrf_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text,
  user_agent text
);

-- Enable RLS and revoke all direct permissions from anon and authenticated clients
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;

-- Performance indexes for lookup and pruning
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON public.admin_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON public.admin_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked_at ON public.admin_sessions (revoked_at);
