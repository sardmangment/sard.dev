import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_PAGE_PATH = path.resolve(__dirname, '../src/pages/AdminPage.jsx');

test('HF-01: AdminPage has zero hardcoded passcodes and zero x-admin-passcode header', () => {
  const code = fs.readFileSync(ADMIN_PAGE_PATH, 'utf8');

  // Must not contain 246800
  assert.ok(!code.includes('246800'), 'Hardcoded passcode 246800 must be completely eliminated');
  // Must NOT pass x-admin-passcode
  assert.ok(!code.includes('x-admin-passcode'), 'Must NOT pass x-admin-passcode header (HF-01)');
  // Must route session login via /api/admin/session
  assert.ok(code.includes("'/api/admin/session'"), 'AdminPage must route session login via server session API');
});

test('HF-01: AdminPage manages in-memory CSRF token and resumes session on mount', () => {
  const code = fs.readFileSync(ADMIN_PAGE_PATH, 'utf8');

  // Must have csrfToken state
  assert.ok(code.includes('csrfToken'), 'AdminPage must hold csrfToken in state');
  // Must call GET /api/admin/session on mount
  assert.ok(code.includes("fetch('/api/admin/session'"), 'Must call /api/admin/session to check existing session');
  // Must have a Logout handler
  assert.ok(code.includes('handleLogout'), 'AdminPage must implement handleLogout');
});

test('HF-01 / HF-10: AdminPage handleDelete cancels appointment with CSRF token and reloads bookings', () => {
  const code = fs.readFileSync(ADMIN_PAGE_PATH, 'utf8');

  assert.ok(code.includes('adminCancelAppointment(id,'), 'Must pass CSRF token to adminCancelAppointment');
  assert.ok(code.includes('getBookedAppointments(csrfToken)'), 'Must reload bookings via getBookedAppointments with csrfToken');
  assert.ok(code.includes('executeWithCsrfRetry'), 'Must wrap admin mutations in executeWithCsrfRetry');
  assert.ok(code.includes('refreshCsrf'), 'Must provide refreshCsrf helper to fetch updated CSRF on 403');
});

test('AR-01: AdminPage uses defensive rendering for bookings array', () => {
  const code = fs.readFileSync(ADMIN_PAGE_PATH, 'utf8');

  // Safe bookings guard
  assert.ok(
    code.includes('Array.isArray(bookings) ? bookings : []'),
    'Must guard bookings state with Array.isArray before mapping'
  );
  assert.ok(code.includes('safeBookings.map'), 'Must render using safeBookings');
});

test('AR-01: AdminPage wraps all mutations and async handlers in try/catch', () => {
  const code = fs.readFileSync(ADMIN_PAGE_PATH, 'utf8');

  assert.ok(code.includes('handleDelete'), 'handleDelete exists');
  assert.ok(code.includes('handleManualAdd'), 'handleManualAdd exists');
  assert.ok(code.includes('handleLogin'), 'handleLogin exists');

  // Ensure try/catch blocks are present in handlers
  const tryCount = (code.match(/try\s*\{/g) || []).length;
  assert.ok(tryCount >= 4, `Expected at least 4 try/catch blocks across async handlers, found ${tryCount}`);
});

test('AR-06 / D-24: AdminPage uses sard.dev email domains instead of sard.ai', () => {
  const code = fs.readFileSync(ADMIN_PAGE_PATH, 'utf8');

  assert.ok(!code.includes('admin@sard.ai'), 'Must not use admin@sard.ai');
  assert.ok(!code.includes('agent@sard.ai'), 'Must not use agent@sard.ai');
  assert.ok(code.includes('admin@sard.dev'), 'Must use admin@sard.dev');
  assert.ok(code.includes('agent@sard.dev'), 'Must use agent@sard.dev');
});
