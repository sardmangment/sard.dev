// D-31 / CC-30…CC-34: Saturday–Thursday, 10:00 AM – 8:00 PM Cairo time; ten hourly start slots.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIME_SLOTS, isFriday, isSlotPast, cairoToday, addDays, slotToMinutes } from '../src/utils/calendarStorage.js';
import { TIME_SLOTS as ADMIN_SLOTS } from '../api/admin/appointments.js';
import { APPROVED_SLOTS } from '../scripts/verify-live.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED = ['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'];

test('UI, admin API, verify-live and migration share the same 10 slots', () => {
  assert.deepEqual(TIME_SLOTS, EXPECTED);
  assert.deepEqual(ADMIN_SLOTS, EXPECTED);
  assert.deepEqual(APPROVED_SLOTS, EXPECTED);
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261115_d17_calendar_rls.sql'), 'utf8');
  for (const s of EXPECTED) assert.ok(sql.includes(`'${s}'`), `migration must accept ${s}`);
});

test('Friday detection and Cairo-date helpers', () => {
  assert.equal(isFriday('2026-11-20'), true);
  assert.equal(isFriday('2026-11-21'), false);
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(slotToMinutes('12:00 PM'), 720);
  assert.equal(slotToMinutes('10:00 AM'), 600);
  assert.equal(slotToMinutes('07:00 PM'), 1140);
  // 2026-11-17 10:30 Cairo (UTC+2) = 08:30Z
  const now = new Date('2026-11-17T08:30:00Z');
  assert.equal(cairoToday(now), '2026-11-17');
  assert.equal(isSlotPast('2026-11-17', '10:00 AM', now), true);
  assert.equal(isSlotPast('2026-11-17', '11:00 AM', now), false);
  assert.equal(isSlotPast('2026-11-18', '10:00 AM', now), false);
  assert.equal(isSlotPast('2026-11-16', '07:00 PM', now), true);
  // Cairo date rolls over before UTC: 23:30Z on the 17th is already the 18th in Cairo
  assert.equal(cairoToday(new Date('2026-11-17T23:30:00Z')), '2026-11-18');
});

test('Calendar page disables Fridays and past slots; shows booking notice (CC-31, CC-34)', () => {
  const page = fs.readFileSync(path.join(root, 'src/pages/CalendarPage.jsx'), 'utf8');
  assert.ok(page.includes('disabled={day.closed}'), 'Friday day button must be disabled');
  assert.ok(page.includes('isSlotPast(selectedDate, slot)'), 'past slots must be locked');
  assert.ok(page.includes("t('calendar.fridayClosed')"), 'Friday closed message must render');
  assert.ok(page.includes('data-testid="booking-notice"') && page.includes('to="/privacy"'), 'booking notice must link /privacy');
});
