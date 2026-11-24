-- 20261124_dev192_job_openings.sql
-- DEV-192: openings shown on /careers (jobs and training programmes).
-- Public visitors can read published rows only; writes go through the admin API (DEV-194)
-- with the service role.
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp).

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_openings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL DEFAULT 'job' CHECK (kind IN ('job', 'training')),
  title_ar       text NOT NULL,
  title_en       text NOT NULL,
  description_ar text,
  description_en text,
  location_ar    text,
  location_en    text,
  work_mode      text CHECK (work_mode IN ('onsite', 'remote', 'hybrid')),
  apply_url      text,          -- optional external form; otherwise visitors email the official address
  is_published   boolean NOT NULL DEFAULT false,
  display_order  integer NOT NULL DEFAULT 0,
  closes_at      date,          -- optional; hidden from the page after this date
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.job_openings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.job_openings TO anon, authenticated;
GRANT ALL ON public.job_openings TO service_role;

DROP POLICY IF EXISTS job_openings_public_read ON public.job_openings;
CREATE POLICY job_openings_public_read ON public.job_openings
  FOR SELECT TO anon, authenticated
  USING (is_published AND (closes_at IS NULL OR closes_at >= current_date));

CREATE INDEX IF NOT EXISTS idx_job_openings_published_order
  ON public.job_openings (is_published, display_order);

COMMIT;
