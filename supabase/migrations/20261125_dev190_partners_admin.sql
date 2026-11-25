-- 20261125_dev190_partners_admin.sql
-- DEV-190: the "Our Partners in Success" ribbon on the home page is now managed from /admin → Partners.
-- Start from an EMPTY ribbon: every existing partner is hidden (kept in the table, not deleted).
-- Each one can be published again from the admin, edited, reordered or deleted.
--
-- No schema change: the admin writes through the service role, and the public ribbon keeps reading
-- get_published_partners() (is_active AND is_published). The admin always sets is_active = true.
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp). Safe to run more than once.

BEGIN;

UPDATE public.partnerships
SET is_published = false, updated_at = now()
WHERE is_published;

COMMIT;

-- Check: expect 0 published, and the hidden count = all partners.
SELECT count(*) FILTER (WHERE is_published) AS published,
       count(*) FILTER (WHERE NOT is_published) AS hidden
FROM public.partnerships;
