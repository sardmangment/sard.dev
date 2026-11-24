-- 20261124_dev194_admin_content.sql
-- DEV-194: admin dashboard for site content.
--   1. projects.is_published — lets the admin hide a project without deleting it.
--      Existing projects stay visible (default true). Visitors can read published projects only.
--   2. Storage bucket "site-media" (public read) for project images and collaboration logos.
--      Only the admin API (service role) uploads; PNG / JPEG / WebP, 2 MB max.
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp).
-- The last statement lists the policies on public.projects so you can check the result.

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- Public read limited to published projects. Earlier SELECT policies (created in the dashboard,
-- not in this repo) are replaced so a hidden project is not readable by visitors.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.projects', p.policyname);
  END LOOP;
END $$;

GRANT SELECT ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;

CREATE POLICY projects_public_read ON public.projects
  FOR SELECT TO anon, authenticated
  USING (is_published);

-- Public bucket for site images (no SVG: it can carry scripts).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

COMMIT;

SELECT policyname, cmd, roles, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'projects'
ORDER BY policyname;
