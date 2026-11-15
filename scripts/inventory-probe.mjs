import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hnihrwignetxwudoqntp.supabase.co';
const ANON_KEY = 'sb_publishable_678TrTJni7pK0HsdsvpabA_foI6PaWh';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const TABLES_TO_PROBE = [
  'projects',
  'project_images',
  'team_members',
  'team_member_projects',
  'site_settings',
  'partnerships',
  'contact_info',
  'footer_links',
  'calendar_appointments',
  'user_roles',
  'dashboard_goals',
  'dashboard_updates',
  'dashboard_comments',
  'dashboard_financials',
  'ideas',
  'idea_tasks',
  'registries',
  'profiles'
];

async function runInventory() {
  console.log('====================================================');
  console.log('📡 LIVE SUPABASE INVENTORY PROBE (READ-ONLY)');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('====================================================\n');

  console.log('1. TABLE STATUS VIA POSTGREST API:');
  const tableResults = [];

  for (const table of TABLES_TO_PROBE) {
    try {
      const { data, error, count, status } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) {
        tableResults.push({
          table,
          exists: false,
          status,
          code: error.code,
          message: error.message,
          rows: null
        });
      } else {
        tableResults.push({
          table,
          exists: true,
          status: 200,
          code: 'OK',
          rows: count ?? (Array.isArray(data) ? data.length : 0),
          sampleKeys: data && data[0] ? Object.keys(data[0]) : []
        });
      }
    } catch (e) {
      tableResults.push({
        table,
        exists: false,
        status: 'EXCEPTION',
        code: 'ERR',
        message: e.message,
        rows: null
      });
    }
  }

  for (const r of tableResults) {
    if (r.exists) {
      console.log(`✅ ${r.table.padEnd(24)}: EXISTS | Status 200 | Total Rows: ${r.rows} | Sample Cols: ${r.sampleKeys.join(', ')}`);
    } else {
      console.log(`❌ ${r.table.padEnd(24)}: MISSING / FORBIDDEN | Status ${r.status} | Code: ${r.code} | Msg: ${r.message}`);
    }
  }

  console.log('\n2. TEAM MEMBERS PII PROBE (DEV-82 / D-19 AUDIT):');
  try {
    const { data: piiData, error: piiErr, status: piiStatus } = await supabase
      .from('team_members')
      .select('id, name_en, email, phone, linkedin')
      .limit(3);

    console.log(`Status: ${piiStatus}`);
    if (piiErr) {
      console.log(`Error: ${piiErr.message}`);
    } else {
      console.log('Returned rows:', JSON.stringify(piiData, null, 2));
      const hasNonNullPII = piiData.some(r => r.email || r.phone || r.linkedin);
      console.log(`Contains non-null PII: ${hasNonNullPII}`);
    }
  } catch (e) {
    console.log('PII probe error:', e.message);
  }

  console.log('\n3. STORAGE BUCKETS PROBE (DEV-86 / D-12 AUDIT):');
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) {
      console.log(`List buckets error: ${bErr.message} (Code: ${bErr.statusCode || bErr.code})`);
    } else {
      console.log('Buckets available:', JSON.stringify(buckets, null, 2));
    }
  } catch (e) {
    console.log('Storage probe exception:', e.message);
  }

  console.log('\n4. RPC / DATABASE FUNCTIONS PROBE:');
  const rpcs = ['has_role', 'get_booked_slots_for_date', 'cancel_own_appointment'];
  for (const rpc of rpcs) {
    try {
      const { data, error } = await supabase.rpc(rpc, {});
      console.log(`RPC ${rpc}: ${error ? `Error: ${error.message} (Code: ${error.code})` : 'Callable'}`);
    } catch (e) {
      console.log(`RPC ${rpc}: Exception: ${e.message}`);
    }
  }
}

runInventory();
