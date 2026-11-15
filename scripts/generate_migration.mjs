import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const oldClient = createClient(
  'https://qnrybiutkrqxvvkdduyi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucnliaXV0a3JxeHZ2a2RkdXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTM4NTYsImV4cCI6MjA4MDQyOTg1Nn0.qFyknugVBf_OSwN5tIQ4VDE68nVpjl3-FE4htdVfqsE'
);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val.toString();
  return "'" + val.toString().replace(/'/g, "''") + "'";
}

async function run() {
  console.log('Fetching production data from qnrybiutkrqxvvkdduyi...');
  const [settings, partners, contact, footer] = await Promise.all([
    oldClient.from('site_settings').select('*').maybeSingle(),
    oldClient.from('partnerships').select('*').order('display_order'),
    oldClient.from('contact_info').select('*').maybeSingle(),
    oldClient.from('footer_links').select('*').order('display_order'),
  ]);

  let sql = `-- ==============================================================================
-- Sard Unified Production Database Migration
-- Target Supabase Project: hnihrwignetxwudoqntp
-- ==============================================================================

-- 1. SITE_SETTINGS
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  company_name_ar TEXT NOT NULL DEFAULT 'سرد',
  company_name_en TEXT NOT NULL DEFAULT 'Sard',
  description_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  about_ar TEXT DEFAULT '',
  about_en TEXT DEFAULT '',
  vision_ar TEXT DEFAULT '',
  vision_en TEXT DEFAULT '',
  mission_ar TEXT DEFAULT '',
  mission_en TEXT DEFAULT '',
  values_ar TEXT DEFAULT '',
  values_en TEXT DEFAULT '',
  value_message_ar TEXT DEFAULT '',
  value_message_en TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.site_settings;
CREATE POLICY "Allow public read-only access" ON public.site_settings FOR SELECT USING (true);

`;

  if (settings.data) {
    const s = settings.data;
    sql += `INSERT INTO public.site_settings (
  id, logo_url, company_name_ar, company_name_en, description_ar, description_en,
  about_ar, about_en, vision_ar, vision_en, mission_ar, mission_en, values_ar, values_en,
  value_message_ar, value_message_en
) VALUES (
  ${escapeSql(s.id)}, ${escapeSql(s.logo_url)}, ${escapeSql(s.company_name_ar)}, ${escapeSql(s.company_name_en)},
  ${escapeSql(s.description_ar)}, ${escapeSql(s.description_en)}, ${escapeSql(s.about_ar)}, ${escapeSql(s.about_en)},
  ${escapeSql(s.vision_ar)}, ${escapeSql(s.vision_en)}, ${escapeSql(s.mission_ar)}, ${escapeSql(s.mission_en)},
  ${escapeSql(s.values_ar)}, ${escapeSql(s.values_en)}, ${escapeSql(s.value_message_ar)}, ${escapeSql(s.value_message_en)}
) ON CONFLICT (id) DO UPDATE SET
  logo_url = EXCLUDED.logo_url,
  company_name_ar = EXCLUDED.company_name_ar,
  company_name_en = EXCLUDED.company_name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  about_ar = EXCLUDED.about_ar,
  about_en = EXCLUDED.about_en,
  vision_ar = EXCLUDED.vision_ar,
  vision_en = EXCLUDED.vision_en,
  mission_ar = EXCLUDED.mission_ar,
  mission_en = EXCLUDED.mission_en,
  values_ar = EXCLUDED.values_ar,
  values_en = EXCLUDED.values_en;

`;
  }

  sql += `-- 2. PARTNERSHIPS
CREATE TABLE IF NOT EXISTS public.partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_logo_url TEXT,
  partner_name_ar TEXT NOT NULL,
  partner_name_en TEXT NOT NULL,
  description_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  contract_date DATE,
  contract_details_ar TEXT DEFAULT '',
  contract_details_en TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.partnerships;
CREATE POLICY "Allow public read-only access" ON public.partnerships FOR SELECT USING (true);

`;

  if (partners.data && partners.data.length > 0) {
    for (const p of partners.data) {
      sql += `INSERT INTO public.partnerships (
  id, partner_logo_url, partner_name_ar, partner_name_en, description_ar, description_en,
  contract_date, contract_details_ar, contract_details_en, is_active, display_order
) VALUES (
  ${escapeSql(p.id)}, ${escapeSql(p.partner_logo_url)}, ${escapeSql(p.partner_name_ar)}, ${escapeSql(p.partner_name_en)},
  ${escapeSql(p.description_ar)}, ${escapeSql(p.description_en)}, ${escapeSql(p.contract_date)},
  ${escapeSql(p.contract_details_ar)}, ${escapeSql(p.contract_details_en)}, ${escapeSql(p.is_active)}, ${escapeSql(p.display_order)}
) ON CONFLICT (id) DO UPDATE SET
  partner_logo_url = EXCLUDED.partner_logo_url,
  partner_name_ar = EXCLUDED.partner_name_ar,
  partner_name_en = EXCLUDED.partner_name_en,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

`;
    }
  }

  sql += `-- 3. CONTACT_INFO
CREATE TABLE IF NOT EXISTS public.contact_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  address_ar TEXT,
  address_en TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contact_info ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.contact_info;
CREATE POLICY "Allow public read-only access" ON public.contact_info FOR SELECT USING (true);

`;

  if (contact.data) {
    const c = contact.data;
    sql += `INSERT INTO public.contact_info (id, email, phone, address_ar, address_en, whatsapp)
VALUES (${escapeSql(c.id)}, ${escapeSql(c.email)}, ${escapeSql(c.phone)}, ${escapeSql(c.address_ar)}, ${escapeSql(c.address_en)}, ${escapeSql(c.whatsapp)})
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, phone = EXCLUDED.phone, address_ar = EXCLUDED.address_ar, address_en = EXCLUDED.address_en;

`;
  }

  sql += `-- 4. FOOTER_LINKS
CREATE TABLE IF NOT EXISTS public.footer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  category TEXT DEFAULT 'social',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.footer_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.footer_links;
CREATE POLICY "Allow public read-only access" ON public.footer_links FOR SELECT USING (true);

`;

  if (footer.data && footer.data.length > 0) {
    for (const f of footer.data) {
      sql += `INSERT INTO public.footer_links (id, title_ar, title_en, url, icon, category, display_order)
VALUES (${escapeSql(f.id)}, ${escapeSql(f.title_ar)}, ${escapeSql(f.title_en)}, ${escapeSql(f.url)}, ${escapeSql(f.icon)}, ${escapeSql(f.category)}, ${escapeSql(f.display_order)})
ON CONFLICT (id) DO UPDATE SET
  title_ar = EXCLUDED.title_ar, title_en = EXCLUDED.title_en, url = EXCLUDED.url;

`;
    }
  }

  sql += `-- 5. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  image_url TEXT,
  project_link TEXT,
  partnership_id UUID REFERENCES public.partnerships(id) ON DELETE SET NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.projects;
CREATE POLICY "Allow public read-only access" ON public.projects FOR SELECT USING (true);

`;

  sql += `-- 6. TEAM_MEMBERS
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  role_ar TEXT NOT NULL,
  role_en TEXT NOT NULL,
  photo_url TEXT,
  bio_ar TEXT DEFAULT '',
  bio_en TEXT DEFAULT '',
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_consultant BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.team_members;
CREATE POLICY "Allow public read-only access" ON public.team_members FOR SELECT USING (true);

-- Clear previous members to ensure only active current roster
DELETE FROM public.team_members;

INSERT INTO public.team_members (name_ar, name_en, role_ar, role_en, is_admin, is_consultant, is_active, display_order)
VALUES
  ('رجب سامح', 'Ragab Sameh', 'المدير العام', 'General Manager', true, false, true, 1),
  ('أحمد غانم', 'Ahmed Ghanem', 'رئيس قسم تكنولوجيا المعلومات', 'Lead IT', false, false, true, 2),
  ('آية سعيد', 'Aya Saeed', 'رئيسة قسم التسويق', 'Lead Marketing', false, false, true, 3),
  ('أحمد مهران', 'Ahmed Mahran', 'مطور برمجيات', 'Developer', false, false, true, 4),
  ('خالد غنيم', 'Khaled Ghonem', 'مطور برمجيات', 'Developer', false, false, true, 5);
`;

  fs.writeFileSync('C:/Users/PCM/Projects/Portfolio/sard-info/supabase/migrations/20261114_unify_production_data.sql', sql, 'utf-8');
  console.log('✅ Generated migration successfully at:');
  console.log('C:/Users/PCM/Projects/Portfolio/sard-info/supabase/migrations/20261114_unify_production_data.sql');
}

run();
