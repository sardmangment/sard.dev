-- 20261124_dev192_job_applications.sql
-- DEV-192: applications submitted from the /careers form.
-- Personal data: NO public access at all. Only the server endpoint (api/careers/apply.js, service role)
-- writes here, and the admin dashboard (DEV-194) reads through the admin API.
-- CVs are stored in the private Storage bucket "job-applications" (PDF only, 5 MB max).
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp) AFTER 20261124_dev192_job_openings.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_id     uuid REFERENCES public.job_openings(id) ON DELETE SET NULL,  -- NULL = general application
  opening_title  text,                       -- snapshot of the title at the time of applying
  full_name      text NOT NULL,
  email          text NOT NULL,
  phone          text NOT NULL,
  city           text,
  profile_url    text,                       -- LinkedIn / portfolio (optional)
  message        text,
  cv_path        text NOT NULL,              -- object path inside the job-applications bucket
  status         text NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  consent_at     timestamptz NOT NULL,
  ip_hash        text,                       -- SHA-256 of the client IP (abuse tracing only)
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_applications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.job_applications TO service_role;

CREATE INDEX IF NOT EXISTS idx_job_applications_created ON public.job_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_opening ON public.job_applications (opening_id);

-- Private bucket for CVs (no public URLs; files are read with signed URLs from the admin API).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-applications', 'job-applications', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['application/pdf'];

COMMIT;
