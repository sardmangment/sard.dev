-- 20261124_dev193_collaborations.sql
-- DEV-193: collaborations shown on /collaborations (entities, companies, institutions and businesses
-- Sard works with). Kept separate from public.partnerships ("Our Partners in Success" on the home page),
-- which holds contract details. Only publish entities that agreed to be shown.
-- Public visitors can read published rows only; writes go through the admin API (DEV-194)
-- with the service role.
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp).

BEGIN;

CREATE TABLE IF NOT EXISTS public.collaborations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar        text NOT NULL,
  name_en        text NOT NULL,
  logo_url       text,          -- public image URL; the card shows the name's initial when empty
  description_ar text,
  description_en text,
  kind           text NOT NULL DEFAULT 'business' CHECK (kind IN ('academic', 'business', 'training', 'other')),
  started_on     date,          -- when the collaboration began (shown as month and year)
  website_url    text,          -- optional link to the partner's site
  is_published   boolean NOT NULL DEFAULT false,
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collaborations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.collaborations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.collaborations TO anon, authenticated;
GRANT ALL ON public.collaborations TO service_role;

DROP POLICY IF EXISTS collaborations_public_read ON public.collaborations;
CREATE POLICY collaborations_public_read ON public.collaborations
  FOR SELECT TO anon, authenticated
  USING (is_published);

CREATE INDEX IF NOT EXISTS idx_collaborations_published_order
  ON public.collaborations (is_published, display_order);

COMMIT;

-- Example (after Eng. Abdullah approves the entity):
--   INSERT INTO public.collaborations (name_ar, name_en, logo_url, description_ar, description_en, kind, started_on, is_published, display_order)
--   VALUES ('…', '…', 'https://…/logo.png', '…', '…', 'academic', '2026-01-01', true, 1);
