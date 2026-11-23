-- 20261123_dev188_current_projects.sql
-- DEV-188: the projects page lists Sard's current projects (no client names) instead of demonstrations.
-- Replaces the two demonstration rows in place, keeping their ids (tests/project-details.test.mjs
-- opens a70286de-... by id). Data only; no schema change.
--
-- Sources:
--   Sard for Fit  = the SARD business operating platform described in "SARD Marketing Strategy"
--                   (not yet launched; confirmed by the team on 2026-11-23).
--   Sard Visuals  = "Sard Visuals Brand & Marketing Strategy" (positioning statement, slide 15).
-- Images: illustrative device mockups with sample data, served from public/projects/ on the site.
-- Wording follows the strategy guardrails: no live-feature, result, or client claims.
--
-- Run in the Supabase SQL editor (project hnihrwignetxwudoqntp). Apply on STAGING first if available.

BEGIN;

UPDATE public.projects SET
  title_ar       = 'Sard for Fit',
  title_en       = 'Sard for Fit',
  description_ar = 'منصة ذكية لتشغيل الأعمال تربط الموقع الإلكتروني بالمبيعات والمخزون والموظفين والعمليات في منظومة واحدة، مع تحليلات مدعومة بالذكاء الاصطناعي.',
  description_en = 'An intelligent business operating platform that connects your website with sales, inventory, workforce, and operations in one system, with AI-powered analysis.',
  image_url      = '/projects/sard-for-fit.png',
  project_link   = NULL,
  partnership_id = NULL,
  display_order  = 1,
  updated_at     = now()
WHERE id = 'a70286de-0294-4c1a-afea-7f74254cfc08';

UPDATE public.projects SET
  title_ar       = 'Sard Visuals',
  title_en       = 'Sard Visuals',
  description_ar = 'تجارب عرض تفاعلية للمشروعات العقارية، تجمع بين الماكيت الرقمي والماكيت الذكي، وتساعد المطورين وفرق المبيعات على عرض مشروعاتهم واستكشافها بوضوح.',
  description_en = 'Interactive real estate presentation experiences that combine digital and smart physical maquettes, helping developers and sales teams present and explore their projects more clearly.',
  image_url      = '/projects/sard-visuals.png',
  project_link   = NULL,
  partnership_id = NULL,
  display_order  = 2,
  updated_at     = now()
WHERE id = 'a4dff878-9947-4c01-871c-3cc531f8f9b8';

-- Expect exactly these two rows afterwards.
SELECT id, display_order, title_en FROM public.projects ORDER BY display_order;

COMMIT;
