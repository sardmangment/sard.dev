-- 20261124_dev191_project_status_date.sql
-- DEV-191: per-project status badge and project date on the projects pages.
--   status        'in_development' (orange badge) or 'launched' (navy badge); default in_development.
--   project_date  shown on the project details page instead of the row's created_at.
-- The site falls back safely before this runs (no status = In Development, no date = created_at).
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp).

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_development',
  ADD COLUMN IF NOT EXISTS project_date date;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check CHECK (status IN ('in_development', 'launched'));

-- Sard for Fit: in development since 1 Nov 2026.
UPDATE public.projects
   SET status = 'in_development', project_date = DATE '2026-11-01', updated_at = now()
 WHERE id = 'a70286de-0294-4c1a-afea-7f74254cfc08';

-- Sard Visuals: launched, running since 1 Jan 2023.
UPDATE public.projects
   SET status = 'launched', project_date = DATE '2023-01-01', updated_at = now()
 WHERE id = 'a4dff878-9947-4c01-871c-3cc531f8f9b8';

SELECT id, title_en, status, project_date FROM public.projects ORDER BY display_order;

COMMIT;
