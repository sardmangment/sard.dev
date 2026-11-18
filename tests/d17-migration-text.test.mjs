import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.resolve(__dirname, '../supabase/migrations/20261115_d17_calendar_rls.sql');

test('HF-08: D-17 migration text audit - zero LIKE email checks and full validation present', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  // 1. Must NOT contain obsolete LIKE checks that break valid emails with underscores
  assert.strictEqual(
    sql.includes("LIKE '% %'"),
    false,
    "Migration must not contain LIKE '% %' check"
  );
  assert.strictEqual(
    sql.includes("LIKE '%\_%'"),
    false,
    "Migration must not contain LIKE '%\\_%' check which broke legitimate emails like first_last@example.com"
  );
  assert.strictEqual(
    sql.includes("LIKE '%\%%'"),
    false,
    "Migration must not contain LIKE '%\\%%' check"
  );

  // 2. Must contain email regex check
  assert.ok(
    sql.includes("!~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'"),
    "Migration must contain regex email format check"
  );
  assert.ok(
    sql.includes("length(v_clean_email) > 255"),
    "Migration must enforce 255 character limit on email"
  );

  // 3. D-31: exactly the 10 approved slots (10:00 AM … 07:00 PM); evening slots are gone
  const REQUIRED_SLOTS = [
    '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM',
    '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM',
  ];
  for (const slot of REQUIRED_SLOTS) {
    assert.ok(sql.includes(`'${slot}'`), `Migration must validate slot '${slot}'`);
  }
  for (const slot of ['08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM', '12:00 AM']) {
    assert.ok(!sql.includes(`'${slot}'`), `Migration must no longer accept slot '${slot}' (D-31)`);
  }
  assert.ok(sql.includes('EXTRACT(ISODOW FROM p_date) = 5'), 'Migration must reject Fridays (D-31)');
  assert.ok(sql.includes("ERRCODE = 'SB006'"), 'Friday rejection must use SB006 CLOSED_DAY');
  assert.ok(sql.includes("AT TIME ZONE 'Africa/Cairo'"), 'Dates must be evaluated in Cairo time (D-31)');
  assert.ok(sql.includes("ERRCODE = 'SB007'"), 'Same-day past slots must be rejected with SB007');

  // 3b. Must reject untrimmed slots and validate the raw value that is inserted
  assert.ok(
    sql.includes('p_time_slot <> TRIM(p_time_slot)'),
    "Migration must reject untrimmed time slots (e.g. ' 12:00 PM') so they cannot bypass uq_confirmed_slot"
  );
  assert.ok(
    !sql.includes('TRIM(p_time_slot) NOT IN'),
    'Migration must validate the raw p_time_slot, not a trimmed copy, against the 13 approved slots'
  );

  // 4. Must enforce 90-day booking bound
  assert.ok(
    sql.includes('p_date < v_today'),
    "Migration must reject past dates (Cairo date)"
  );
  assert.ok(
    sql.includes('p_date > (v_today + 90)'),
    "Migration must reject dates > 90 days ahead (Cairo date)"
  );

  // 5. Must enforce field lengths
  assert.ok(
    sql.includes('length(v_clean_name) > 100'),
    "Migration must cap client_name at 100 characters"
  );
  assert.ok(
    sql.includes('length(v_clean_service) > 255'),
    "Migration must cap service_type at 255 characters"
  );
  assert.ok(
    sql.includes('length(v_clean_notes) > 1000'),
    "Migration must cap notes at 1000 characters"
  );

  // 6. Must enforce D-29 daily limit and transaction advisory lock
  assert.ok(
    sql.includes('pg_advisory_xact_lock'),
    "Migration must use transaction-level advisory lock to serialize concurrent bookings"
  );
  assert.ok(
    sql.includes('v_daily_count >= 3'),
    "Migration must cap confirmed bookings at 3 per email per day"
  );
  assert.ok(
    sql.includes('DAILY_LIMIT_REACHED'),
    "Migration must raise DAILY_LIMIT_REACHED on limit exhaustion"
  );
});
