import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAppointmentByToken,
  cancelAppointmentByToken,
  saveAppointment,
  getBookedSlotsForDate,
  normalizeAppointment,
  STRICT_EMAIL_REGEX,
  BookingValidationError,
  getBookingErrorMessage
} from '../src/utils/calendarStorage.js';
import { supabase } from '../src/integrations/supabase/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('HF-02 / HF-08: STRICT_EMAIL_REGEX validates clean email addresses correctly and permits underscores', () => {
  assert.ok(STRICT_EMAIL_REGEX.test('client@sard.dev'));
  assert.ok(STRICT_EMAIL_REGEX.test('first.last@example.com'));
  assert.ok(STRICT_EMAIL_REGEX.test('first_last@example.com'), 'Must permit legitimate email addresses containing underscores');
  assert.ok(!STRICT_EMAIL_REGEX.test('invalid-email'));
  assert.ok(!STRICT_EMAIL_REGEX.test(''));
  assert.ok(!STRICT_EMAIL_REGEX.test('spaces in@email.com'));
});

test('HF-02: normalizeAppointment formats fields and preserves manageToken', () => {
  const normalized = normalizeAppointment({
    id: 'test-id-1',
    date: '2026-11-20',
    time_slot: '02:00 PM',
    client_name: 'Sara',
    client_email: 'sara@example.com',
    service_type: 'AI Consultation',
    status: 'confirmed',
    manage_token: '64hexcharacterstokenhere1234567890123456789012345678901234567890',
  });

  assert.strictEqual(normalized.id, 'test-id-1');
  assert.strictEqual(normalized.timeSlot, '02:00 PM');
  assert.strictEqual(normalized.name, 'Sara');
  assert.strictEqual(normalized.email, 'sara@example.com');
  assert.strictEqual(normalized.manageToken, '64hexcharacterstokenhere1234567890123456789012345678901234567890');
});

test('HF-02: getAppointmentByToken returns null on missing ID or token', async () => {
  assert.strictEqual(await getAppointmentByToken('', 'token'), null);
  assert.strictEqual(await getAppointmentByToken('id', ''), null);
  assert.strictEqual(await getAppointmentByToken(null, 'token'), null);
  assert.strictEqual(await getAppointmentByToken('id', null), null);
});

test('HF-02: getAppointmentByToken calls RPC and returns normalized appointment', async () => {
  const origRpc = supabase.rpc;
  let capturedArgs = null;

  supabase.rpc = async (fn, args) => {
    capturedArgs = { fn, args };
    if (fn === 'get_appointment_by_token' && args.p_token === 'valid-token') {
      return {
        data: [{
          id: 'apt-1',
          date: '2026-11-20',
          time_slot: '03:00 PM',
          service_type: 'AI Automation',
          status: 'confirmed',
        }],
        error: null,
      };
    }
    return { data: [], error: null };
  };

  try {
    const apt = await getAppointmentByToken('apt-1', 'valid-token');
    assert.strictEqual(capturedArgs.fn, 'get_appointment_by_token');
    assert.strictEqual(capturedArgs.args.p_id, 'apt-1');
    assert.strictEqual(capturedArgs.args.p_token, 'valid-token');
    assert.ok(apt);
    assert.strictEqual(apt.id, 'apt-1');
    assert.strictEqual(apt.timeSlot, '03:00 PM');

    const notFound = await getAppointmentByToken('apt-1', 'invalid-token');
    assert.strictEqual(notFound, null);
  } finally {
    supabase.rpc = origRpc;
  }
});

test('HF-02: cancelAppointmentByToken validates inputs and calls cancel RPC', async () => {
  await assert.rejects(
    async () => cancelAppointmentByToken('', 'token'),
    /Appointment ID and manage token are required/
  );
  await assert.rejects(
    async () => cancelAppointmentByToken('apt-1', ''),
    /Appointment ID and manage token are required/
  );

  const origRpc = supabase.rpc;

  supabase.rpc = async (fn, args) => {
    if (fn === 'cancel_appointment_by_token') {
      if (args.p_token === 'valid-token') return { data: true, error: null };
      return { data: false, error: null };
    }
    return { data: null, error: new Error('Unknown RPC') };
  };

  try {
    const success = await cancelAppointmentByToken('apt-1', 'valid-token');
    assert.strictEqual(success, true);

    await assert.rejects(
      async () => cancelAppointmentByToken('apt-1', 'wrong-token'),
      /Invalid or expired manage token/
    );
  } finally {
    supabase.rpc = origRpc;
  }
});

test('HF-02: saveAppointment returns manageToken from RPC response', async () => {
  const origRpc = supabase.rpc;

  supabase.rpc = async (fn, args) => {
    if (fn === 'book_appointment') {
      return {
        data: [{
          id: 'new-apt-uuid',
          date: args.p_date,
          time_slot: args.p_time_slot,
          status: 'confirmed',
          manage_token: 'generated64chartokenhex123456789012345678901234567890123456789012',
        }],
        error: null,
      };
    }
    return { data: null, error: null };
  };

  try {
    const result = await saveAppointment({
      date: '2026-11-20',
      timeSlot: '04:00 PM',
      name: 'Test Client',
      email: 'client@sard.dev',
    });

    assert.strictEqual(result.id, 'new-apt-uuid');
    assert.strictEqual(result.manageToken, 'generated64chartokenhex123456789012345678901234567890123456789012');
  } finally {
    supabase.rpc = origRpc;
  }
});

test('HF-02: zero client-side references to get_my_appointments or cancel_own_appointment', () => {
  const calendarStoragePath = path.resolve(__dirname, '../src/utils/calendarStorage.js');
  const calendarPagePath = path.resolve(__dirname, '../src/pages/CalendarPage.jsx');
  const chatPagePath = path.resolve(__dirname, '../src/components/ChatPage.jsx');

  const storageCode = fs.readFileSync(calendarStoragePath, 'utf8');
  const calendarCode = fs.readFileSync(calendarPagePath, 'utf8');
  const chatCode = fs.readFileSync(chatPagePath, 'utf8');

  assert.ok(!storageCode.includes('get_my_appointments'), 'calendarStorage must not reference get_my_appointments');
  assert.ok(!storageCode.includes('cancel_own_appointment'), 'calendarStorage must not reference cancel_own_appointment');
  assert.ok(!calendarCode.includes('getAppointmentsByEmail'), 'CalendarPage must not have email lookup UI or function');
  assert.ok(!chatCode.includes('get_my_appointments'), 'ChatPage must not reference get_my_appointments');
});

test('HF-02: getAppointmentByToken returns null for expired tokens/appointments', async () => {
  const origRpc = supabase.rpc;
  supabase.rpc = async (fn) => {
    if (fn === 'get_appointment_by_token') {
      // Postgres procedure filters out rows older than 30 days, returning 0 rows
      return { data: [], error: null };
    }
    return { data: null, error: null };
  };

  try {
    const res = await getAppointmentByToken('expired-id', 'token123');
    assert.strictEqual(res, null, 'Expired appointment lookup must return null');
  } finally {
    supabase.rpc = origRpc;
  }
});

test('HF-02: cancelAppointmentByToken throws on past appointments (cancellation expiration)', async () => {
  const origRpc = supabase.rpc;
  supabase.rpc = async (fn) => {
    if (fn === 'cancel_appointment_by_token') {
      // Postgres procedure enforces date >= CURRENT_DATE, returning false on past dates
      return { data: false, error: null };
    }
    return { data: null, error: null };
  };

  try {
    await assert.rejects(
      async () => cancelAppointmentByToken('past-apt-id', 'token123'),
      /Invalid or expired manage token/,
      'Must reject cancellation of past appointment'
    );
  } finally {
    supabase.rpc = origRpc;
  }
});

test('HF-08: getBookingErrorMessage maps all validation error codes to localized messages', () => {
  // DAILY_LIMIT_REACHED
  const dailyErr = new BookingValidationError('DAILY_LIMIT_REACHED', 'Limit reached');
  assert.strictEqual(
    getBookingErrorMessage(dailyErr, false),
    "You've reached the limit of 3 bookings per day for this email."
  );
  assert.strictEqual(
    getBookingErrorMessage(dailyErr, true),
    "وصلت للحد الأقصى: ٣ مواعيد في اليوم لنفس البريد الإلكتروني."
  );

  // DATE_OUT_OF_RANGE
  const dateErr = new BookingValidationError('DATE_OUT_OF_RANGE', 'Out of range');
  assert.strictEqual(
    getBookingErrorMessage(dateErr, false),
    "Bookings are available from today up to 90 days ahead."
  );
  assert.strictEqual(
    getBookingErrorMessage(dateErr, true),
    "يمكن الحجز من اليوم وحتى ٩٠ يوماً قادمة."
  );

  // INVALID_EMAIL
  const emailErr = new BookingValidationError('INVALID_EMAIL', 'Bad email');
  assert.strictEqual(
    getBookingErrorMessage(emailErr, false),
    "Please enter a valid email address."
  );
  assert.strictEqual(
    getBookingErrorMessage(emailErr, true),
    "يرجى إدخال بريد إلكتروني صحيح."
  );

  // INVALID_SLOT
  const slotErr = new BookingValidationError('INVALID_SLOT', 'Bad slot');
  assert.strictEqual(
    getBookingErrorMessage(slotErr, false),
    "Please check your booking details."
  );
  assert.strictEqual(
    getBookingErrorMessage(slotErr, true),
    "يرجى مراجعة بيانات الحجز."
  );

  // FIELD_TOO_LONG
  const lenErr = new BookingValidationError('FIELD_TOO_LONG', 'Too long');
  assert.strictEqual(
    getBookingErrorMessage(lenErr, false),
    "Please check your booking details."
  );
  assert.strictEqual(
    getBookingErrorMessage(lenErr, true),
    "يرجى مراجعة بيانات الحجز."
  );

  // 23505 Slot collision
  const collisionErr = { code: '23505', message: 'duplicate key value violates unique constraint' };
  assert.strictEqual(
    getBookingErrorMessage(collisionErr, false),
    "This slot is already booked. Please choose another slot."
  );
  assert.strictEqual(
    getBookingErrorMessage(collisionErr, true),
    "هذا الموعد محجوز بالفعل! يرجى اختيار موعد آخر."
  );
});

test('HF-08: saveAppointment throws typed BookingValidationError on RPC validation failures', async () => {
  const origRpc = supabase.rpc;

  try {
    // Test DAILY_LIMIT_REACHED (SB005)
    supabase.rpc = async () => ({
      data: null,
      error: { code: 'SB005', message: 'DAILY_LIMIT_REACHED: 3 bookings max' }
    });

    await assert.rejects(
      async () => saveAppointment({ date: '2026-11-20', timeSlot: '02:00 PM', name: 'A', email: 'test@example.com' }),
      (err) => {
        assert.ok(err instanceof BookingValidationError);
        assert.strictEqual(err.code, 'DAILY_LIMIT_REACHED');
        return true;
      }
    );

    // Test DATE_OUT_OF_RANGE (SB003)
    supabase.rpc = async () => ({
      data: null,
      error: { code: 'SB003', message: 'DATE_OUT_OF_RANGE: Past date' }
    });

    await assert.rejects(
      async () => saveAppointment({ date: '2026-11-20', timeSlot: '02:00 PM', name: 'A', email: 'test@example.com' }),
      (err) => {
        assert.ok(err instanceof BookingValidationError);
        assert.strictEqual(err.code, 'DATE_OUT_OF_RANGE');
        return true;
      }
    );

    // Test 23505 (Slot already booked)
    supabase.rpc = async () => ({
      data: null,
      error: { code: '23505', message: 'uq_confirmed_slot violation' }
    });

    await assert.rejects(
      async () => saveAppointment({ date: '2026-11-20', timeSlot: '02:00 PM', name: 'A', email: 'test@example.com' }),
      (err) => {
        assert.strictEqual(err.code, '23505');
        return true;
      }
    );
  } finally {
    supabase.rpc = origRpc;
  }
});
