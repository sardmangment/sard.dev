import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hnihrwignetxwudoqntp.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_678TrTJni7pK0HsdsvpabA_foI6PaWh';

const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY);

const tablesToCheck = [
  'projects',
  'project_images',
  'team_members',
  'team_member_projects',
  'site_settings',
  'partnerships',
  'contact_info',
  'footer_links',
  'user_roles',
  'calendar_appointments',
  // dashboard tables
  'ideas',
  'idea_comments',
  'idea_projects',
  'idea_project_finances',
  'physical_assets',
  'feasibility_studies',
  'digital_assets',
  'projects_registry'
];

async function probe() {
  console.log('=== PROBING LIVE SUPABASE TABLES (hnihrwignetxwudoqntp) ===\n');
  const results = [];

  for (const table of tablesToCheck) {
    try {
      const { data, error, count, status } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (error) {
        results.push({
          table,
          exists: error.code !== 'PGRST205' && !error.message.includes('schema cache'),
          status: `Error [${error.code}]: ${error.message}`,
          rowCount: 'N/A',
          httpStatus: status
        });
      } else {
        results.push({
          table,
          exists: true,
          status: 'Accessible',
          rowCount: count !== null ? count : (data ? data.length : 0),
          httpStatus: status,
          sample: data && data.length > 0 ? Object.keys(data[0]) : []
        });
      }
    } catch (e) {
      results.push({
        table,
        exists: false,
        status: `Exception: ${e.message}`,
        rowCount: 'N/A'
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));

  // Also probe storage buckets via REST
  console.log('\n=== PROBING STORAGE BUCKETS ===');
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'apikey': PUBLISHABLE_KEY,
        'Authorization': `Bearer ${PUBLISHABLE_KEY}`
      }
    });
    const buckets = await res.json();
    console.log('Storage Buckets:', buckets);
  } catch (e) {
    console.error('Storage bucket probe error:', e.message);
  }
}

probe();
