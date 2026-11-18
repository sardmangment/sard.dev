-- 20261118_team_verification.sql
-- CC-50 (D-35, C-G01…C-G06). Minimal member badge + public team listing via SECURITY DEFINER RPCs that
-- return ONLY approved professional fields. Alumni/interns are returned only with recorded consent.
-- Apply on STAGING first (RB-10). Requires D-19 (RB-04) to be applied for full PII protection on the
-- base table; this migration does not widen any existing grant.

BEGIN;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS member_type text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS intern_status text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS former_role_ar text,
  ADD COLUMN IF NOT EXISTS former_role_en text,
  ADD COLUMN IF NOT EXISTS internship_area_ar text,
  ADD COLUMN IF NOT EXISTS internship_area_en text,
  ADD COLUMN IF NOT EXISTS contribution_ar text,
  ADD COLUMN IF NOT EXISTS contribution_en text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_member_type_chk') THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_member_type_chk CHECK (member_type IN ('current', 'alumni', 'intern'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_intern_status_chk') THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_intern_status_chk CHECK (
        intern_status IS NULL OR (member_type = 'intern' AND intern_status IN ('current', 'completed'))
      );
  END IF;
END $$;

-- Base-table hardening for anon (supersedes RB-04 step 2, which was ineffective: Supabase grants anon a
-- TABLE-level SELECT, and REVOKE of individual columns does not remove a table-level grant).
-- anon keeps only approved professional columns; email/phone/linkedin/join_date/bio/consent data are denied.
-- authenticated is left unchanged (used by the internal sard-info dashboard).
REVOKE SELECT ON public.team_members FROM anon;
GRANT SELECT (id, name_ar, name_en, role_ar, role_en, photo_url, is_active, display_order, updated_at)
  ON public.team_members TO anon;

-- Badge (C-G02): name, title, affiliation status, verification date, photo. Nothing else.
-- A former member/intern returns is_affiliated = false and no identifying fields.
CREATE OR REPLACE FUNCTION public.get_member_badge(p_id uuid)
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  role_ar text,
  role_en text,
  photo_url text,
  is_affiliated boolean,
  verified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    CASE WHEN a.ok THEN m.name_ar END,
    CASE WHEN a.ok THEN m.name_en END,
    CASE WHEN a.ok THEN m.role_ar END,
    CASE WHEN a.ok THEN m.role_en END,
    CASE WHEN a.ok THEN m.photo_url END,
    a.ok,
    CASE WHEN a.ok THEN COALESCE(m.verified_at, m.updated_at) END
  FROM public.team_members m
  CROSS JOIN LATERAL (SELECT (m.is_active AND m.member_type = 'current') AS ok) a
  WHERE m.id = p_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_member_badge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_badge(uuid) TO anon, authenticated, service_role;

-- Team page (C-G01, C-G05, C-G06): current active members + consented alumni/interns.
CREATE OR REPLACE FUNCTION public.get_public_team()
RETURNS TABLE (
  id uuid,
  section text,
  name_ar text,
  name_en text,
  role_ar text,
  role_en text,
  photo_url text,
  former_role_ar text,
  former_role_en text,
  internship_area_ar text,
  internship_area_en text,
  intern_status text,
  contribution_ar text,
  contribution_en text,
  display_order int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, 'current', m.name_ar, m.name_en, m.role_ar, m.role_en, m.photo_url,
         NULL, NULL, NULL, NULL, NULL, NULL, NULL, m.display_order
  FROM public.team_members m
  WHERE m.member_type = 'current' AND m.is_active
  UNION ALL
  SELECT m.id, 'alumni', m.name_ar, m.name_en, NULL, NULL, NULL,
         m.former_role_ar, m.former_role_en, NULL, NULL, NULL, m.contribution_ar, m.contribution_en, m.display_order
  FROM public.team_members m
  WHERE m.member_type = 'alumni' AND m.consent_at IS NOT NULL
  UNION ALL
  SELECT m.id, 'intern', m.name_ar, m.name_en, NULL, NULL, NULL,
         NULL, NULL, m.internship_area_ar, m.internship_area_en, m.intern_status,
         m.contribution_ar, m.contribution_en, m.display_order
  FROM public.team_members m
  WHERE m.member_type = 'intern' AND m.consent_at IS NOT NULL
  ORDER BY 2, 15;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_team() TO anon, authenticated, service_role;

COMMIT;

-- Verify (expect: both RPCs return no email/phone/linkedin/join_date/bio columns, and anon is denied
-- the contact columns: has_column_privilege('anon','public.team_members','email','SELECT') = false):
-- SELECT has_column_privilege('anon','public.team_members','email','SELECT') AS anon_email,
--        has_column_privilege('anon','public.team_members','phone','SELECT') AS anon_phone,
--        has_column_privilege('anon','public.team_members','name_en','SELECT') AS anon_name;
-- SELECT * FROM public.get_public_team();
-- SELECT * FROM public.get_member_badge('<some member uuid>');
