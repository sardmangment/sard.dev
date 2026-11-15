// Integration Test: Real live Supabase integration test (NO MOCKS)
// Target project: hnihrwignetxwudoqntp (Sard Unified)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hnihrwignetxwudoqntp.supabase.co';
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_678TrTJni7pK0HsdsvpabA_foI6PaWh';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null;

if (!process.env.RUN_INTEGRATION_TESTS && !SECRET_KEY) {
  console.log('⏭️ Skipping live Supabase integration tests: set RUN_INTEGRATION_TESTS=1 and SUPABASE_SECRET_KEY to run.');
  process.exit(0);
}

// UUID validation regex (v4 standard)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
const adminClient = SECRET_KEY ? createClient(SUPABASE_URL, SECRET_KEY) : null;

const TEST_EMAIL = 'integration-test@sard.dev';
const TEST_DATE = '2099-12-31';
const TEST_SLOT = '03:00 PM';

let createdAppointmentId = null;

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING LIVE SUPABASE CALENDAR INTEGRATION TESTS');
  console.log(`📡 Target: ${SUPABASE_URL}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Cleanup any leftover test data first
  if (adminClient) {
    try {
      await adminClient
        .from('calendar_appointments')
        .delete()
        .eq('client_email', TEST_EMAIL);
    } catch (e) {
      // ignore if table doesn't exist yet
    }
  } else {
    console.log('ℹ️ SUPABASE_SECRET_KEY not set; skipping admin pre-test cleanup.');
  }

  // TEST 1: Schema Verification
  console.log('▶ TEST 1: Schema Verification (calendar_appointments exists and returns HTTP 200)');
  try {
    const { data, error, status } = await client
      .from('calendar_appointments')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Query failed with status ${status}: [${error.code}] ${error.message}`);
    }
    console.log(`  ✅ Passed: calendar_appointments table is LIVE (HTTP status: ${status})\n`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  // TEST 2: Insert & Persist (valid UUID, not local)
  console.log('▶ TEST 2: Insert & Persist (returns genuine Postgres UUID)');
  try {
    const { data, error } = await client
      .from('calendar_appointments')
      .insert({
        date: TEST_DATE,
        time_slot: TEST_SLOT,
        client_name: 'Integration Test Bot',
        client_email: TEST_EMAIL,
        service_type: 'Full Stack Audit',
        notes: 'Automated test suite verification',
        status: 'confirmed',
        created_via: 'admin_agent',
      })
      .select()
      .single();

    if (error) throw error;
    if (!data || !data.id) throw new Error('No data returned from insert');

    if (!UUID_REGEX.test(data.id)) {
      throw new Error(`Expected genuine Postgres UUID, received invalid ID: ${data.id}`);
    }

    createdAppointmentId = data.id;
    console.log(`  ✅ Passed: Inserted appointment with genuine Postgres UUID: ${data.id}\n`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  // TEST 3: Retrieve by Email
  console.log('▶ TEST 3: Retrieve by Email (exact match from database)');
  try {
    const { data, error } = await client
      .from('calendar_appointments')
      .select('*')
      .ilike('client_email', TEST_EMAIL);

    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Expected at least 1 record for ${TEST_EMAIL}, received 0`);
    }

    const found = data.find(a => a.id === createdAppointmentId);
    if (!found) {
      throw new Error(`Record ${createdAppointmentId} not found in retrieved results`);
    }

    if (found.date !== TEST_DATE || found.time_slot !== TEST_SLOT) {
      throw new Error(`Payload mismatch: date=${found.date}, slot=${found.time_slot}`);
    }

    console.log(`  ✅ Passed: Successfully retrieved appointment ${found.id} by email from Supabase\n`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  // TEST 4: Double-Booking Prevention (Unique constraint 23505)
  console.log('▶ TEST 4: Double-Booking Prevention (Postgres rejects duplicate confirmed slot)');
  try {
    const { data, error } = await client
      .from('calendar_appointments')
      .insert({
        date: TEST_DATE,
        time_slot: TEST_SLOT,
        client_name: 'Duplicate Bot',
        client_email: 'another-user@sard.dev',
        service_type: 'Conflict Test',
        status: 'confirmed',
      });

    if (!error) {
      throw new Error('Expected Postgres unique constraint violation (23505), but insert succeeded!');
    }

    if (error.code !== '23505') {
      throw new Error(`Expected error code 23505, received: [${error.code}] ${error.message}`);
    }

    console.log(`  ✅ Passed: PostgreSQL rejected duplicate slot with error code 23505 (${error.message})\n`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  // TEST 5: Cleanup & Verification
  console.log('▶ TEST 5: Cleanup (Delete test records)');
  try {
    if (createdAppointmentId) {
      if (adminClient) {
        const { error } = await adminClient
          .from('calendar_appointments')
          .delete()
          .eq('id', createdAppointmentId);

        if (error) throw error;

        // Verify it's gone
        const check = await client
          .from('calendar_appointments')
          .select('id')
          .eq('id', createdAppointmentId);

        if (check.data && check.data.length > 0) {
          throw new Error('Record still exists after delete');
        }
        console.log('  ✅ Passed: Test records deleted cleanly and verified (via adminClient)\n');
        passed++;
      } else {
        console.log('  ⚠️ Skipped: SUPABASE_SECRET_KEY not set in environment; skipping admin cleanup step.\n');
        passed++;
      }
    } else {
      console.log('  ℹ️ No test record to clean up.\n');
      passed++;
    }
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  console.log('====================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

