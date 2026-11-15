// tests/verify-live-harness.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { findFreeTestSlot, runVerification, APPROVED_13_SLOTS } from '../scripts/verify-live.mjs';

test('verify-live harness: findFreeTestSlot respects 90-day bound and approved 13 slots', async () => {
  const datesQueried = [];
  const mockFetch = async (url, options) => {
    const body = JSON.parse(options.body || '{}');
    datesQueried.push(body.p_date);
    // Return that slot 0 is booked for all dates
    return {
      ok: true,
      status: 200,
      json: async () => [{ time_slot: APPROVED_13_SLOTS[0] }],
    };
  };

  const slotInfo = await findFreeTestSlot('https://mock.supabase.co', 'mock-anon-key', mockFetch);
  assert.ok(slotInfo, 'Should return a free test slot');
  assert.ok(APPROVED_13_SLOTS.includes(slotInfo.slot), 'Slot must be in APPROVED_13_SLOTS');
  assert.notEqual(slotInfo.slot, APPROVED_13_SLOTS[0], 'Should not return the booked slot');

  // Verify date bound: offset must be between 60 and 90
  assert.ok(slotInfo.offset >= 60 && slotInfo.offset <= 90, `Offset ${slotInfo.offset} must be between 60 and 90`);
  assert.ok(!slotInfo.date.startsWith('2099'), 'Date must never be 2099');

  const now = new Date();
  const slotDate = new Date(slotInfo.date);
  const diffDays = Math.round((slotDate.getTime() - now.getTime()) / (86400 * 1000));
  assert.ok(diffDays <= 90, `Slot date offset ${diffDays} must not exceed 90 days`);
  assert.ok(diffDays >= 59, `Slot date offset ${diffDays} must be at least ~60 days`);
});

test('verify-live harness: findFreeTestSlot returns null if no dates between +60 and +90 have slots', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => APPROVED_13_SLOTS.map((s) => ({ time_slot: s })),
  });

  const slotInfo = await findFreeTestSlot('https://mock.supabase.co', 'mock-anon-key', mockFetch);
  assert.equal(slotInfo, null, 'Should return null when all slots are booked');
});

test('verify-live harness: CAL-03 and CAL-04 fail when obsolete RPC returns 200 instead of 404', async () => {
  const logs = [];
  const logFn = (msg) => logs.push(msg);

  const mockFetch = async (url) => {
    if (url.includes('get_booked_slots_for_date')) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    }
    if (url.includes('get_my_appointments') || url.includes('cancel_own_appointment')) {
      // Intentionally return 200 OK (violating expected 404)
      return {
        ok: true,
        status: 200,
        text: async () => 'Found records',
        json: async () => [{ id: '1' }],
      };
    }
    // Default safe stub for other calls
    return {
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
      json: async () => ({}),
    };
  };

  const results = await runVerification({
    target: 'local',
    activeSuites: ['calendar'],
    anonKey: 'mock-anon-key',
    customFetch: mockFetch,
    logFn,
  });

  const cal03 = results.find((r) => r.checkId === 'CAL-03');
  const cal04 = results.find((r) => r.checkId === 'CAL-04');

  assert.ok(cal03, 'CAL-03 must be recorded');
  assert.equal(cal03.status, 'FAIL', 'CAL-03 must fail when get_my_appointments returns 200');
  assert.ok(cal04, 'CAL-04 must be recorded');
  assert.equal(cal04.status, 'FAIL', 'CAL-04 must fail when cancel_own_appointment returns 200');
});

async function runObsoleteRpcCase(obsoleteResponseBody) {
  const mockFetch = async (url) => {
    if (url.includes('get_booked_slots_for_date')) {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (url.includes('get_my_appointments') || url.includes('cancel_own_appointment')) {
      return {
        ok: false,
        status: 404,
        text: async () => obsoleteResponseBody,
        json: async () => ({}),
      };
    }
    return { ok: false, status: 403, text: async () => 'Forbidden', json: async () => ({}) };
  };

  const results = await runVerification({
    target: 'local',
    activeSuites: ['calendar'],
    anonKey: 'mock-anon-key',
    customFetch: mockFetch,
    logFn: () => {},
  });
  return {
    cal03: results.find((r) => r.checkId === 'CAL-03'),
    cal04: results.find((r) => r.checkId === 'CAL-04'),
  };
}

test('verify-live harness: CAL-03 and CAL-04 FAIL on a generic 404 without PGRST202 (e.g. wrong Supabase URL)', async () => {
  const { cal03, cal04 } = await runObsoleteRpcCase('<html><body>404 Not Found</body></html>');
  assert.ok(cal03 && cal04, 'CAL-03 and CAL-04 must be recorded');
  assert.equal(cal03.status, 'FAIL', 'CAL-03 must fail on a bare 404');
  assert.equal(cal04.status, 'FAIL', 'CAL-04 must fail on a bare 404');
});

test('verify-live harness: CAL-03 and CAL-04 PASS only when the response explicitly contains PGRST202', async () => {
  const { cal03, cal04 } = await runObsoleteRpcCase(
    JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' })
  );
  assert.ok(cal03 && cal04, 'CAL-03 and CAL-04 must be recorded');
  assert.equal(cal03.status, 'PASS', 'CAL-03 must pass on PGRST202');
  assert.equal(cal04.status, 'PASS', 'CAL-04 must pass on PGRST202');
});

test('verify-live harness: checks fail and throw no unhandled exceptions when fetch throws', async () => {
  const logs = [];
  const logFn = (msg) => logs.push(msg);

  let fetchCallCount = 0;
  const throwingFetch = async (url) => {
    fetchCallCount++;
    if (url.includes('get_booked_slots_for_date')) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    }
    throw new Error('Network simulated failure / connection reset');
  };

  const results = await runVerification({
    target: 'local',
    activeSuites: ['calendar'],
    anonKey: 'mock-anon-key',
    customFetch: throwingFetch,
    logFn,
  });

  assert.ok(results.length > 0, 'Checks must be recorded despite fetch errors');
  const failedChecks = results.filter((r) => r.status === 'FAIL');
  assert.ok(failedChecks.length > 0, 'All network-failing checks must be FAIL');

  // Verify CAL-01, CAL-02, CAL-03, CAL-04, CAL-06 are all FAIL
  const cal01 = results.find((r) => r.checkId === 'CAL-01');
  const cal02 = results.find((r) => r.checkId === 'CAL-02');
  assert.equal(cal01?.status, 'FAIL');
  assert.equal(cal02?.status, 'FAIL');
});
