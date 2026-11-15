// Migration Script for D-12 / DEV-86: Supabase Storage Asset Migration
// Reads the 13 verified local asset backups from SARD_UNIFIED_ASSET_BACKUP_MANIFEST.json
// Uploads them to the target Supabase project 'hnihrwignetxwudoqntp' under a new public bucket 'media'
// Requires SUPABASE_SERVICE_ROLE_KEY (provided by Supabase Owner).

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_SUPABASE_URL = process.env.SUPABASE_URL || 'https://hnihrwignetxwudoqntp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const BUCKET_NAME = 'media';
const MANIFEST_PATH = path.resolve(__dirname, '../../../docs/SARD_UNIFIED_ASSET_BACKUP_MANIFEST.json');

async function main() {
  console.log('====================================================');
  console.log('📦 SARD UNIFIED: ASSET MIGRATION TO NEW SUPABASE STORAGE (D-12)');
  console.log(`Target: ${TARGET_SUPABASE_URL}`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log('====================================================\n');

  if (!SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY.');
    console.error('The public anon key cannot create storage buckets or bypass storage policies.');
    console.error('Please run with:');
    console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="<service_key>"; node scripts/migrate-assets-to-storage.mjs\n');
    console.log('--- SQL INSTRUCTIONS FOR SUPABASE OWNER DASHBOARD ---');
    console.log(`
-- 1. Create public 'media' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('${BUCKET_NAME}', '${BUCKET_NAME}', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public read access to objects in 'media'
CREATE POLICY "Allow public read access on media"
ON storage.objects FOR SELECT
USING (bucket_id = '${BUCKET_NAME}');
    `);
    process.exit(1);
  }

  const supabase = createClient(TARGET_SUPABASE_URL, SERVICE_KEY);

  // 1. Ensure bucket exists
  console.log(`Ensuring bucket '${BUCKET_NAME}' exists...`);
  const { data: bucketData, error: bucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
  });

  if (bucketError && !bucketError.message?.includes('already exists')) {
    console.warn(`Bucket creation note: ${bucketError.message}`);
  } else {
    console.log(`✅ Bucket '${BUCKET_NAME}' verified.`);
  }

  // 2. Read manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`❌ Manifest not found at: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  console.log(`Loaded ${manifest.length} assets from manifest.\n`);

  const sqlUpdates = [];

  for (const item of manifest) {
    const localFilePath = item.savedTo;
    if (!fs.existsSync(localFilePath)) {
      console.error(`❌ Local file missing: ${localFilePath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(localFilePath);
    const fileName = path.basename(localFilePath);
    const storagePath = item.category === 'brand' ? `logos/${fileName}` : `partnerships/${fileName}`;

    console.log(`Uploading ${fileName} -> ${BUCKET_NAME}/${storagePath}...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: item.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`❌ Failed uploading ${fileName}: ${uploadError.message}`);
      continue;
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    const newPublicUrl = publicUrlData.publicUrl;
    console.log(`   ✅ Success: ${newPublicUrl}`);

    if (item.category === 'brand') {
      sqlUpdates.push(`UPDATE public.site_settings SET logo_url = '${newPublicUrl}' WHERE logo_url = '${item.sourceUrl}';`);
    } else {
      sqlUpdates.push(`UPDATE public.partnerships SET partner_logo_url = '${newPublicUrl}' WHERE partner_logo_url = '${item.sourceUrl}';`);
    }
  }

  console.log('\n--- GENERATED SQL TO UPDATE DATABASE ASSET POINTERS ---');
  console.log(sqlUpdates.join('\n'));
}

main().catch(console.error);
