# SARD UNIFIED — Cloudflare Pages Deployment Audit & Issues Report

**Project:** SARD UNIFIED (`sard.dev`)  
**Deployment Target:** Cloudflare Pages (`sard-unified.pages.dev`)  
**Branch:** `sard-unified/release`  
**Date:** 2026-11-17  
**Status:** Preflight Verified (83/83 Tests Pass) — Live Runtime Environment Binding Blocked  

---

## 1. Executive Summary & Context

Due to Vercel account recovery restrictions (phone number lock linked to the former CTO), the team authorized switching the hosting provider from Vercel to **Cloudflare Pages**. 

Local audit, linting, build, and automated test suites are **100% complete and passing** (83/83 tests). However, the live deployment on `https://sard-unified.pages.dev` currently encounters runtime errors on `/admin` and `/ai` due to environment variable binding resolution and database RPC state.

---

## 2. Current Observed Runtime Issues

| # | Endpoint / Page | Observed Error | HTTP Status | Code Path |
|---|---|---|---|---|
| **1** | `/admin` (POST login) | `Server configuration error: ADMIN_PASSCODE must be at least 16 characters.` | `503 Service Unavailable` | `api/admin/session.js` (L68) |
| **2** | `/ai` (POST message) | `Rate limit service temporarily unavailable. Chat protected against overage.` | `503 Service Unavailable` | `api/chat.js` (L113) / `rateLimit.js` |
| **3** | `/admin` (Initial GET) | `Failed to load resource: 401 (Unauthorized)` | `401 Unauthorized` | `api/admin/session.js` (L30) — *Normal unauthenticated probe* |

---

## 3. Root Cause Analysis (Deep Dive)

### Root Cause A: Cloudflare Pages Environment Variable Ingestion & Worker Isolation

In Cloudflare Pages, environment variables operate differently from standard Node.js server environments:
1. **No Global `process.env` by Default:** Cloudflare Pages Functions run in a V8 isolate (`workerd`). Environment variables defined in the Cloudflare Dashboard are injected into `context.env` per request, NOT into the global `process.env`.
2. **Dashboard Variables Do Not Apply Retroactively:** When variables or secrets are created or updated in the Cloudflare Pages Dashboard, **they are not injected into existing deployments**. They only take effect upon a subsequent fresh build/deployment.
3. **`wrangler.toml` Precedence Rule:** When a `wrangler.toml` file exists in the repository root, Cloudflare Pages enforces strict configuration boundaries:
   - Plain `Text` variables added via the Dashboard may be ignored or overridden by `wrangler.toml`.
   - Only variables marked explicitly as **`Secret`** (encrypted) in the Dashboard are merged at runtime.
4. **Environment Scoping (Production vs. Preview):**
   - Cloudflare Pages separates variables into **Production** and **Preview** environments.
   - If a project's Production branch is set to `main`, visits to `sard-unified.pages.dev` or branch deployments may be treated under the Preview scope. Variables must be populated and identical in both scopes.

### Root Cause B: Supabase Database Functions (RPC) & Rate Limiting

The backend architecture implements a **fail-closed security posture (Decision D-28)**:
1. **`hit_rate_limit` RPC:** `api/chat.js` invokes `public.hit_rate_limit(p_key, p_window_seconds, p_max)` on Supabase to prevent unauthorized quota exhaustion on Google AI Studio (Gemini).
   - If `SUPABASE_SERVICE_ROLE_KEY` is not present, `rateLimit.js` throws `CONFIG_MISSING`.
   - If the RPC function has not been applied to the database, Supabase returns HTTP `404` (`PGRST202`).
   - Either condition forces `api/chat.js` to fail closed and return `503 Rate limit service temporarily unavailable`.
2. **`admin_sessions` Table:** Required for managing session cookies (`__Host-sard_admin`), idle timeouts, and SHA-256 hashed CSRF tokens. If the table is missing, admin login returns `503 Failed to create session`.

---

## 4. Validations Completed (Preflight Green)

All application code, UI styling, and automated security harnesses have been strictly validated:

```
> sard@0.0.0 test
> node --test ...

ℹ tests 83
ℹ suites 0
ℹ pass 83
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 35307.0083
🏁 Test suite completed with exit code: 0
```

- **ESLint:** 0 errors, 0 warnings (`npx eslint .`).
- **Production Build:** Clean bundle generated in `dist/` (7.69s).
- **SPA Fallback:** `public/_redirects` configured (`/* /index.html 200`) and verified in `dist/_redirects`.
- **CORS & Origin Hardening:** `api/chat.js` and `api/_lib/adminSession.js` updated to accept `*.pages.dev` and `*.sard.dev` while strictly blocking unauthorized origins.
- **Client IP Handling:** `cf-connecting-ip` prioritized for Cloudflare Edge with fallback to `x-forwarded-for`.

---

## 5. Checklist to Clear Runtime Blockers

### Step 1: Cloudflare Dashboard Secrets
In **Cloudflare Dashboard > Workers & Pages > sard-unified > Settings > Variables and secrets**:
Ensure the following **5 secrets** exist under **BOTH Production and Preview**:

| Secret Name | Type | Value Description |
|---|---|---|
| `ADMIN_PASSCODE` | `Secret` | Administrative passcode (minimum 16 characters) |
| `GEMINI_API_KEY` | `Secret` | Fresh API Key from Google AI Studio |
| `SUPABASE_SERVICE_ROLE_KEY` | `Secret` | Supabase Service Role Key (`sb_secret_...`) |
| `VITE_SUPABASE_URL` | `Secret` / `Text` | `https://hnihrwignetxwudoqntp.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `Secret` / `Text` | `sb_publishable_678TrTJni7pK0HsdsvpabA_foI6PaWh` |

> [!IMPORTANT]
> Verify character exactness: ensure no leading/trailing spaces and no dropped letters (e.g. `SUPABASE_SERVICE_ROLE_KEY`, not `UPABASE...` or `..._ROLE_KE`).

---

### Step 2: Supabase Migrations
Ensure the following SQL migrations are applied in [Supabase SQL Editor](https://supabase.com/dashboard/project/hnihrwignetxwudoqntp/sql/new):

1. **`20261115_admin_sessions.sql`:**
   ```sql
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
   ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
   GRANT ALL ON public.admin_sessions TO service_role;
   CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON public.admin_sessions (token_hash);
   CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON public.admin_sessions (expires_at);
   CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked_at ON public.admin_sessions (revoked_at);
   ```

2. **`20261115_rate_limits.sql`:**
   ```sql
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
   REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(text, int, int) FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, int, int) TO service_role;
   ```

3. **`20261115_d17_calendar_rls.sql`:** (Calendar RPCs & RLS hardening).

---

### Step 3: Triggering a Fresh Deployment
To force Cloudflare Pages to compile a new Worker bundle with the saved Secrets:
- In Cloudflare Pages: go to **Deployments** -> select the latest deployment -> click **Retry deployment** (or trigger a new commit).
