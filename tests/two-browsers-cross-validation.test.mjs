// Two-Browser Cross-Validation Test
// Proves that Booking created in Browser A (Device 1) is retrieved in Browser B (Device 2)
// via Supabase cloud database with ZERO shared local storage.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hnihrwignetxwudoqntp.supabase.co';
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_678TrTJni7pK0HsdsvpabA_foI6PaWh';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null;

if (!process.env.RUN_INTEGRATION_TESTS && !SECRET_KEY) {
  console.log('⏭️ Skipping live Supabase cross-browser tests: set RUN_INTEGRATION_TESTS=1 and SUPABASE_SECRET_KEY to run.');
  process.exit(0);
}

// Simulated BROWSER A (Device 1: e.g. iPhone in Cairo - Incognito session)
const browserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: { persistSession: false, storage: undefined }
});

// Simulated BROWSER B (Device 2: e.g. MacBook in Dubai - Completely separate browser)
const browserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: { persistSession: false, storage: undefined }
});

// Admin client for cleanup
const admin = SECRET_KEY ? createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, storage: undefined }
}) : null;

const CROSS_TEST_EMAIL = 'cross-device-user@sard.dev';
const CROSS_TEST_DATE = '2099-11-20';
const CROSS_TEST_SLOT = '04:00 PM';

async function runTwoBrowserTest() {
  console.log('================================================================');
  console.log('🌐 RUNNING CROSS-BROWSER LIVE SUPABASE VERIFICATION');
  console.log('   Browser A: Isolated Client 1 (Simulated Chrome on Mobile)');
  console.log('   Browser B: Isolated Client 2 (Simulated Safari on Desktop)');
  console.log('   Storage: ZERO LocalStorage / Shared Cache');
  console.log('================================================================\n');

  // Step 0: Ensure table exists
  console.log('STEP 0: Verifying Supabase table existence...');
  const probe = await browserA.from('calendar_appointments').select('id').limit(1);
  if (probe.error) {
    console.error(`❌ Table check failed: [${probe.error.code}] ${probe.error.message}`);
    console.error('👉 The SQL migration must be executed in Supabase SQL editor first!\n');
    process.exit(1);
  }
  console.log('✅ Table calendar_appointments is confirmed LIVE on Supabase.\n');

  // Cleanup old test records if any
  if (admin) {
    await admin.from('calendar_appointments').delete().eq('client_email', CROSS_TEST_EMAIL);
  } else {
    console.log('ℹ️ SUPABASE_SECRET_KEY not set; skipping admin pre-test cleanup.');
  }

  // STEP 1: Browser A Books an appointment
  console.log(`STEP 1 [Browser A]: Submitting booking for ${CROSS_TEST_EMAIL}...`);
  const { data: createdA, error: errA } = await browserA
    .from('calendar_appointments')
    .insert({
      date: CROSS_TEST_DATE,
      time_slot: CROSS_TEST_SLOT,
      client_name: 'Cross Browser User',
      client_email: CROSS_TEST_EMAIL,
      service_type: 'Multi-Device Verification',
      notes: 'Booked on Device A',
      status: 'confirmed',
      created_via: 'web_form',
    })
    .select()
    .single();

  if (errA) {
    console.error(`❌ Browser A insert failed: ${errA.message}`);
    process.exit(1);
  }

  console.log(`✅ [Browser A] Successfully booked appointment in Supabase cloud!`);
  console.log(`   Database UUID: ${createdA.id}`);
  console.log(`   Slot: ${createdA.date} @ ${createdA.time_slot}\n`);

  // STEP 2: Browser B queries the booking by email (Simulating Find My Booking)
  console.log(`STEP 2 [Browser B]: Querying bookings for ${CROSS_TEST_EMAIL} from a different browser session...`);
  const { data: retrievedB, error: errB } = await browserB
    .from('calendar_appointments')
    .select('*')
    .ilike('client_email', CROSS_TEST_EMAIL);

  if (errB) {
    console.error(`❌ Browser B query failed: ${errB.message}`);
    process.exit(1);
  }

  if (!retrievedB || retrievedB.length === 0) {
    console.error(`❌ Browser B could not find the appointment created by Browser A!`);
    process.exit(1);
  }

  const matchingRecord = retrievedB.find(r => r.id === createdA.id);
  if (!matchingRecord) {
    console.error(`❌ Record ID mismatch between Browser A and Browser B.`);
    process.exit(1);
  }

  console.log(`🎉 [Browser B] SUCCESS! Retrieved exact booking from Supabase cloud:`);
  console.log(`   ID: ${matchingRecord.id}`);
  console.log(`   Name: ${matchingRecord.client_name}`);
  console.log(`   Service: ${matchingRecord.service_type}`);
  console.log(`   Status: ${matchingRecord.status}`);
  console.log(`   Notes: "${matchingRecord.notes}"\n`);

  // STEP 3: Browser B cancels the booking
  console.log(`STEP 3 [Browser B]: Cancelling the appointment...`);
  const { error: cancelErr } = await browserB
    .from('calendar_appointments')
    .update({ status: 'cancelled' })
    .eq('id', createdA.id)
    .eq('client_email', CROSS_TEST_EMAIL);

  if (cancelErr) {
    console.error(`❌ Cancellation failed: ${cancelErr.message}`);
    process.exit(1);
  }
  console.log(`✅ [Browser B] Appointment cancelled successfully in Supabase.\n`);

  // STEP 4: Browser A checks slot availability
  console.log(`STEP 4 [Browser A]: Verifying slot is no longer blocked...`);
  const { data: slotsA } = await browserA
    .from('calendar_appointments')
    .select('time_slot')
    .eq('date', CROSS_TEST_DATE)
    .eq('status', 'confirmed');

  const isSlotBooked = (slotsA || []).some(s => s.time_slot === CROSS_TEST_SLOT);
  if (isSlotBooked) {
    console.error(`❌ Slot is still showing as confirmed!`);
    process.exit(1);
  }
  console.log(`✅ [Browser A] Slot ${CROSS_TEST_SLOT} is now free and open again.\n`);

  // STEP 5: Clean up
  if (admin) {
    await admin.from('calendar_appointments').delete().eq('id', createdA.id);
  } else {
    console.log('ℹ️ SUPABASE_SECRET_KEY not set; skipping admin post-test cleanup.');
  }
  console.log('================================================================');
  console.log('🏆 100% VERIFIED: Data is stored and retrieved across devices');
  console.log('   directly via Supabase cloud database with zero local storage.');
  console.log('================================================================');
}

runTwoBrowserTest().catch(e => {
  console.error('Test execution failed:', e);
  process.exit(1);
});

