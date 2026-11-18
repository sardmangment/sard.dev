// src/utils/calendarStorage.js
// Client data-access layer for Calendar and Admin management.
// Enforces cryptographic manage tokens (HF-02) and session-based Admin API (HF-01).

import { supabase } from '../integrations/supabase/client.js';

// D-31: Saturday–Thursday, 10:00 AM – 8:00 PM Cairo time; ten hourly start slots (last starts 7:00 PM).
export const TIME_SLOTS = [
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
];

// D-31 helpers: business dates are Cairo dates; Friday is closed.
export const BUSINESS_TIME_ZONE = 'Africa/Cairo';

function cairoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function cairoToday(now = new Date()) {
  return cairoParts(now).date;
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

export function isFriday(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay() === 5;
}

export function slotToMinutes(slot) {
  const m = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(slot || '');
  if (!m) return NaN;
  let h = Number(m[1]) % 12;
  if (m[3] === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

// True when the slot on dateStr has already started in Cairo time.
export function isSlotPast(dateStr, slot, now = new Date()) {
  const c = cairoParts(now);
  if (dateStr < c.date) return true;
  if (dateStr > c.date) return false;
  return slotToMinutes(slot) <= c.minutes;
}

export const STRICT_EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export class BookingValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BookingValidationError';
    this.code = code;
  }
}

export function getBookingErrorMessage(err, isRTL = false) {
  const code = err?.code || '';
  const msg = err?.message || '';

  if (code === 'DAILY_LIMIT_REACHED' || code === 'SB005' || msg.includes('DAILY_LIMIT_REACHED')) {
    return isRTL
      ? 'وصلت للحد الأقصى: ٣ مواعيد في اليوم لنفس البريد الإلكتروني.'
      : "You've reached the limit of 3 bookings per day for this email.";
  }
  if (code === 'DATE_OUT_OF_RANGE' || code === 'SB003' || msg.includes('DATE_OUT_OF_RANGE')) {
    return isRTL
      ? 'يمكن الحجز من اليوم وحتى ٩٠ يوماً قادمة.'
      : 'Bookings are available from today up to 90 days ahead.';
  }
  if (code === 'CLOSED_DAY' || code === 'SB006' || msg.includes('CLOSED_DAY')) {
    return isRTL
      ? 'هذا اليوم غير متاح للحجز (مغلق يوم الجمعة).'
      : 'This day is not available for bookings (closed on Fridays).';
  }
  if (code === 'SLOT_IN_PAST' || code === 'SB007' || msg.includes('SLOT_IN_PAST')) {
    return isRTL
      ? 'انقضى هذا الموعد بالفعل. يُرجى اختيار موعد لاحق.'
      : 'This time has already passed. Please choose a later slot.';
  }
  if (code === 'INVALID_EMAIL' || code === 'SB001' || msg.includes('INVALID_EMAIL')) {
    return isRTL
      ? 'يرجى إدخال بريد إلكتروني صحيح.'
      : 'Please enter a valid email address.';
  }
  if (
    code === 'INVALID_SLOT' ||
    code === 'SB002' ||
    msg.includes('INVALID_SLOT') ||
    code === 'FIELD_TOO_LONG' ||
    code === 'SB004' ||
    msg.includes('FIELD_TOO_LONG')
  ) {
    return isRTL
      ? 'يرجى مراجعة بيانات الحجز.'
      : 'Please check your booking details.';
  }
  if (code === '23505' || msg.includes('23505') || msg.includes('SLOT_ALREADY_BOOKED')) {
    return isRTL
      ? 'هذا الموعد محجوز بالفعل! يرجى اختيار موعد آخر.'
      : 'This slot is already booked. Please choose another slot.';
  }
  return isRTL
    ? 'حدث خطأ أثناء حفظ الموعد في قاعدة البيانات'
    : 'Failed to save appointment';
}

/**
 * Normalizes appointment object between Supabase snake_case and UI camelCase.
 */
export function normalizeAppointment(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    timeSlot: row.time_slot || row.timeSlot,
    time_slot: row.time_slot || row.timeSlot,
    name: row.client_name || row.name || 'Client',
    client_name: row.client_name || row.name || 'Client',
    email: row.client_email || row.email || '',
    client_email: row.client_email || row.email || '',
    service: row.service_type || row.service || 'AI Consultation',
    service_type: row.service_type || row.service || 'AI Consultation',
    notes: row.notes || '',
    status: row.status || 'confirmed',
    created_via: row.created_via || 'web_form',
    manageToken: row.manage_token || row.manageToken || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    created_at: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

/**
 * Formats standard Postgres / PostgREST errors into descriptive typed Errors.
 */
function handleDatabaseError(error, context = 'Database operation') {
  if (!error) return;
  if (error.code === 'SB005' || error.message?.includes('DAILY_LIMIT_REACHED')) {
    throw new BookingValidationError('DAILY_LIMIT_REACHED', error.message || 'Daily limit reached');
  }
  if (error.code === 'SB003' || error.message?.includes('DATE_OUT_OF_RANGE')) {
    throw new BookingValidationError('DATE_OUT_OF_RANGE', error.message || 'Date out of range');
  }
  if (error.code === 'SB006' || error.message?.includes('CLOSED_DAY')) {
    throw new BookingValidationError('CLOSED_DAY', error.message || 'Closed day');
  }
  if (error.code === 'SB007' || error.message?.includes('SLOT_IN_PAST')) {
    throw new BookingValidationError('SLOT_IN_PAST', error.message || 'Slot in past');
  }
  if (error.code === 'SB001' || error.message?.includes('INVALID_EMAIL')) {
    throw new BookingValidationError('INVALID_EMAIL', error.message || 'Invalid email');
  }
  if (error.code === 'SB002' || error.message?.includes('INVALID_SLOT')) {
    throw new BookingValidationError('INVALID_SLOT', error.message || 'Invalid slot');
  }
  if (error.code === 'SB004' || error.message?.includes('FIELD_TOO_LONG')) {
    throw new BookingValidationError('FIELD_TOO_LONG', error.message || 'Field too long');
  }
  if (error.code === '23505' || error.message?.includes('23505')) {
    const err = new Error('SLOT_ALREADY_BOOKED: This slot was just booked by someone else. Please choose another slot.');
    err.code = '23505';
    throw err;
  }
  if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
    const err = new Error('TABLE_NOT_FOUND: calendar_appointments table is missing in Supabase schema.');
    err.code = 'PGRST205';
    throw err;
  }
  const genericErr = new Error(`${context} failed: ${error.message} (${error.code || 'UNKNOWN'})`);
  genericErr.code = error.code;
  throw genericErr;
}

/**
 * Fetch booked time slot strings for a specific date (e.g. ['02:00 PM', '04:00 PM']).
 * Uses secure RPC 'get_booked_slots_for_date' (zero customer PII exposed).
 */
export async function getBookedSlotsForDate(dateStr) {
  if (!dateStr) return [];

  // 1. Attempt secure RPC get_booked_slots_for_date
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_booked_slots_for_date', {
      p_date: dateStr,
    });
    if (!rpcErr && Array.isArray(rpcData)) {
      return rpcData.map(item => item.time_slot);
    }
    if (rpcErr && rpcErr.code !== 'PGRST202') {
      handleDatabaseError(rpcErr, `Fetch slots for ${dateStr}`);
    }
  } catch (err) {
    if (err.code !== 'PGRST202') throw err;
  }

  // 2. Direct table fallback only behind PGRST202 check
  const { data, error } = await supabase
    .from('calendar_appointments')
    .select('time_slot')
    .eq('date', dateStr)
    .eq('status', 'confirmed');

  if (error) {
    handleDatabaseError(error, `Fetch slots for ${dateStr}`);
  }

  return (data || []).map(item => item.time_slot);
}

/**
 * Insert a new appointment via secure RPC 'book_appointment' (HF-02).
 * Generates and returns a single-use manage token for decentralized ownership.
 */
export async function saveAppointment(booking) {
  const timeSlot = booking.timeSlot || booking.time_slot;
  const clientName = (booking.name || booking.client_name || '').trim();
  const clientEmail = (booking.email || booking.client_email || '').trim().toLowerCase();
  const serviceType = booking.service || booking.service_type || 'AI Consultation';

  if (!booking.date || !timeSlot) {
    throw new Error('Date and time slot are required for appointment.');
  }

  // 1. Attempt secure RPC book_appointment (AR-14 / HF-02)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('book_appointment', {
      p_date: booking.date,
      p_time_slot: timeSlot,
      p_name: clientName || 'Guest Client',
      p_email: clientEmail,
      p_service: serviceType,
      p_notes: booking.notes || '',
      p_created_via: booking.created_via || 'web_form',
    });

    if (!rpcErr && rpcData) {
      const record = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      return normalizeAppointment({
        ...record,
        client_name: clientName,
        client_email: clientEmail,
        service_type: serviceType,
        notes: booking.notes || '',
        manage_token: record.manage_token,
      });
    }

    if (rpcErr) {
      if (
        rpcErr.code === '23505' ||
        rpcErr.code === 'SB001' ||
        rpcErr.code === 'SB002' ||
        rpcErr.code === 'SB003' ||
        rpcErr.code === 'SB004' ||
        rpcErr.code === 'SB005' ||
        rpcErr.message?.includes('23505') ||
        rpcErr.message?.includes('DAILY_LIMIT_REACHED') ||
        rpcErr.message?.includes('DATE_OUT_OF_RANGE') ||
        rpcErr.message?.includes('INVALID_EMAIL') ||
        rpcErr.message?.includes('INVALID_SLOT') ||
        rpcErr.message?.includes('FIELD_TOO_LONG')
      ) {
        handleDatabaseError(rpcErr, 'Insert appointment');
      }
      // If RPC is missing (PGRST202) prior to migration, continue to fallback
      if (rpcErr.code !== 'PGRST202' && !rpcErr.message?.includes('schema cache')) {
        handleDatabaseError(rpcErr, 'Insert appointment');
      }
    }
  } catch (err) {
    if (
      err.code === '23505' ||
      err instanceof BookingValidationError ||
      ['DAILY_LIMIT_REACHED', 'DATE_OUT_OF_RANGE', 'INVALID_EMAIL', 'INVALID_SLOT', 'FIELD_TOO_LONG'].includes(err.code)
    ) {
      throw err;
    }
  }

  // 2. Direct table insert fallback (only active prior to D-17 migration execution)
  const payload = {
    date: booking.date,
    time_slot: timeSlot,
    client_name: clientName || 'Guest Client',
    client_email: clientEmail,
    service_type: serviceType,
    notes: booking.notes || '',
    status: 'confirmed',
    created_via: booking.created_via || 'web_form',
  };

  const { data, error } = await supabase
    .from('calendar_appointments')
    .insert(payload)
    .select()
    .single();

  if (error) {
    handleDatabaseError(error, 'Insert appointment');
  }

  return normalizeAppointment(data);
}

/**
 * Retrieve an appointment by its ID and ownership manage token (HF-02).
 * Returns null if token does not match or appointment is missing.
 */
export async function getAppointmentByToken(id, token) {
  if (!id || !token || typeof token !== 'string') return null;

  try {
    const { data, error } = await supabase.rpc('get_appointment_by_token', {
      p_id: id,
      p_token: token.trim(),
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return normalizeAppointment(row);
  } catch {
    return null;
  }
}

/**
 * Cancel an appointment using its verified ownership manage token (HF-02).
 * Returns true if successfully cancelled, false otherwise.
 */
export async function cancelAppointmentByToken(id, token) {
  if (!id || !token || typeof token !== 'string') {
    throw new Error('Appointment ID and manage token are required to cancel.');
  }

  const { data, error } = await supabase.rpc('cancel_appointment_by_token', {
    p_id: id,
    p_token: token.trim(),
  });

  if (error) {
    handleDatabaseError(error, 'Cancel appointment by token');
  }

  if (data !== true) {
    throw new Error('Invalid or expired manage token.');
  }

  return true;
}

/**
 * Fetch all confirmed appointments for the authenticated Admin panel (HF-01).
 * Uses same-origin server-side Admin API (/api/admin/appointments).
 * NO direct table fallback.
 */
export async function getBookedAppointments(csrfToken) {
  const headers = csrfToken ? { 'x-csrf-token': csrfToken } : {};
  const res = await fetch('/api/admin/appointments', {
    credentials: 'same-origin',
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to retrieve admin appointments (HTTP ${res.status})`);
  }

  const body = await res.json();
  return (body.data || []).map(normalizeAppointment);
}

/**
 * Admin cancel appointment via server-side Admin API (HF-01).
 * NO direct table fallback.
 */
export async function adminCancelAppointment(id, csrfToken) {
  if (!id) throw new Error('Appointment ID is required to cancel.');

  const res = await fetch('/api/admin/appointments', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken || '',
    },
    body: JSON.stringify({ id, status: 'cancelled' }),
  });

  if (!res.ok) {
    throw new Error(`Failed to cancel appointment (HTTP ${res.status})`);
  }

  return true;
}
