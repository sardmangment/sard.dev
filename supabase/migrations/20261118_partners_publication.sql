-- 20261118_partners_publication.sql
-- CC-40 (C-F02, C-F03, D-41). Partners are public only when verified for publication (signed agreement or
-- actual joint work + name/logo permission + no confidentiality conflict). Contract data is never public.
-- Apply on STAGING first (RB-09). Data (which partners are published) is set separately per the
-- partner checklist; every partner starts unpublished (fail closed).

BEGIN;

ALTER TABLE public.partnerships
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_summary_ar text,
  ADD COLUMN IF NOT EXISTS public_summary_en text;

-- anon loses direct table access (a column REVOKE would not remove Supabase's table-level grant).
-- Public reads go through the RPCs below. authenticated is left unchanged (internal dashboard).
REVOKE SELECT ON public.partnerships FROM anon;

CREATE OR REPLACE FUNCTION public.get_published_partners()
RETURNS TABLE (
  id uuid,
  partner_name_ar text,
  partner_name_en text,
  partner_logo_url text,
  display_order int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.partner_name_ar, p.partner_name_en, p.partner_logo_url, p.display_order
  FROM public.partnerships p
  WHERE p.is_active AND p.is_published
  ORDER BY p.display_order, p.partner_name_en;
$$;

CREATE OR REPLACE FUNCTION public.get_published_partner(p_id uuid)
RETURNS TABLE (
  id uuid,
  partner_name_ar text,
  partner_name_en text,
  partner_logo_url text,
  summary_ar text,
  summary_en text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.partner_name_ar, p.partner_name_en, p.partner_logo_url,
         COALESCE(p.public_summary_ar, p.description_ar),
         COALESCE(p.public_summary_en, p.description_en)
  FROM public.partnerships p
  WHERE p.id = p_id AND p.is_active AND p.is_published;
$$;

REVOKE EXECUTE ON FUNCTION public.get_published_partners() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_published_partner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_partners() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_published_partner(uuid) TO anon, authenticated, service_role;

COMMIT;

-- Verify with the anon key (expect 401/42501 on the table, [] from the RPC until partners are published):
--   GET  /rest/v1/partnerships?select=contract_date        -> permission denied
--   POST /rest/v1/rpc/get_published_partners               -> []
-- Publish a verified partner (after the checklist):
--   UPDATE public.partnerships SET is_published = true, public_summary_en = '…', public_summary_ar = '…' WHERE id = '…';
