-- 20261125_dev199_team_page.sql
-- DEV-199: /team shows three sections managed from /admin → Team:
--   owner   = company owners
--   manager = department heads
--   staff   = team members
-- is_published decides who shows on the page. It is separate from is_active, which still means
-- "works at Sard" and drives the /member/:id verification badge (get_member_badge is unchanged).
-- Alumni and interns are no longer shown on the page; their rows and columns are kept.
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp). Safe to run more than once.

BEGIN;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS is_published boolean;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_tier_chk') THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_tier_chk CHECK (tier IN ('owner', 'manager', 'staff'));
  END IF;
END $$;

-- Keep today's page as it is: current active members stay visible, everyone else starts hidden.
UPDATE public.team_members
SET is_published = (member_type = 'current' AND COALESCE(is_active, false))
WHERE is_published IS NULL;

ALTER TABLE public.team_members
  ALTER COLUMN is_published SET DEFAULT false,
  ALTER COLUMN is_published SET NOT NULL;

-- The return columns change, so the function is dropped and created again.
DROP FUNCTION IF EXISTS public.get_public_team();

CREATE FUNCTION public.get_public_team()
RETURNS TABLE (
  id uuid,
  tier text,
  name_ar text,
  name_en text,
  role_ar text,
  role_en text,
  photo_url text,
  display_order int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.tier, m.name_ar, m.name_en, m.role_ar, m.role_en, m.photo_url, m.display_order
  FROM public.team_members m
  WHERE m.member_type = 'current' AND m.is_active AND m.is_published
  ORDER BY CASE m.tier WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END, m.display_order, m.name_en;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_team() TO anon, authenticated, service_role;

COMMIT;

-- Check: every current member with their section and visibility (all start in "staff").
SELECT name_en, role_en, tier, is_published, is_active
FROM public.team_members
WHERE member_type = 'current'
ORDER BY display_order;
