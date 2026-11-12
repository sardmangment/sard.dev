import { supabase } from '../integrations/supabase/client';

export const TIME_SLOTS = [
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM',
  '09:00 PM',
  '10:00 PM',
  '11:00 PM',
  '12:00 AM',
];

const LOCAL_STORAGE_BACKUP_KEY = 'sard_ai_calendar_bookings';

/**
 * Normalizes appointment object between Supabase snake_case and UI camelCase.
 */
function normalizeAppointment(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    timeSlot: row.time_slot || row.timeSlot,
    time_slot: row.time_slot || row.timeSlot,
    name: row.client_name || row.name,
    client_name: row.client_name || row.name,
    email: row.client_email || row.email || '',
    client_email: row.client_email || row.email || '',
    service: row.service_type || row.service,
    service_type: row.service_type || row.service,
    notes: row.notes || '',
    status: row.status || 'confirmed',
    created_via: row.created_via || 'web_form',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    created_at: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

/**
 * Fetch all confirmed appointments from Supabase (with fallback to localStorage).
 */
export async function getBookedAppointments() {
  try {
    const { data, error } = await supabase
      .from('calendar_appointments')
      .select('*')
      .eq('status', 'confirmed')
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true });

    if (!error && Array.isArray(data)) {
      const normalized = data.map(normalizeAppointment);
      // Keep a local cache backup
      localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(normalized));
      return normalized;
    }

    if (error) {
      console.warn('Supabase calendar_appointments query error, checking local backup:', error.message);
    }
  } catch (err) {
    console.error('Network error fetching calendar_appointments:', err);
  }

  // Graceful fallback from localStorage if offline or during table creation
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch booked time slot strings for a specific date (e.g. ['02:00 PM', '04:00 PM']).
 */
export async function getBookedSlotsForDate(dateStr) {
  if (!dateStr) return [];
  try {
    const { data, error } = await supabase
      .from('calendar_appointments')
      .select('time_slot')
      .eq('date', dateStr)
      .eq('status', 'confirmed');

    if (!error && data) {
      return data.map(item => item.time_slot);
    }
  } catch (err) {
    console.warn(`Error getting slots for date ${dateStr}:`, err);
  }

  // Fallback to filtering all appointments
  const all = await getBookedAppointments();
  return all
    .filter(b => b.date === dateStr && b.status === 'confirmed')
    .map(b => b.timeSlot || b.time_slot);
}

/**
 * Insert a new appointment into Supabase calendar_appointments.
 */
export async function saveAppointment(booking) {
  const timeSlot = booking.timeSlot || booking.time_slot;
  const clientName = booking.name || booking.client_name || 'Guest Client';
  const clientEmail = booking.email || booking.client_email || '';
  const serviceType = booking.service || booking.service_type || 'AI Consultation';

  const payload = {
    date: booking.date,
    time_slot: timeSlot,
    client_name: clientName,
    client_email: clientEmail,
    service_type: serviceType,
    notes: booking.notes || '',
    status: 'confirmed',
    created_via: booking.created_via || 'web_form',
  };

  try {
    const { data, error } = await supabase
      .from('calendar_appointments')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      const normalized = normalizeAppointment(data);
      // Sync local cache
      const current = await getBookedAppointments();
      localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify([...current, normalized]));
      return normalized;
    }

    if (error) {
      console.error('Error inserting into calendar_appointments:', error);
      throw error;
    }
  } catch (err) {
    console.warn('Falling back to local storage save due to database error:', err);
    // Local fallback creation
    const fallbackBooking = {
      id: 'local-' + Date.now(),
      createdAt: new Date().toISOString(),
      ...payload,
      timeSlot,
      name: clientName,
      email: clientEmail,
      service: serviceType,
    };
    const cached = await getBookedAppointments();
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify([...cached, fallbackBooking]));
    return fallbackBooking;
  }
}

/**
 * Delete or cancel an appointment by ID.
 */
export async function deleteAppointment(id) {
  try {
    const { error } = await supabase
      .from('calendar_appointments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting from calendar_appointments:', error);
    }
  } catch (err) {
    console.warn('Network error deleting appointment, removing from local storage:', err);
  }

  // Update local cache
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    if (cached) {
      const updated = JSON.parse(cached).filter(b => b.id !== id);
      localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(updated));
      return updated;
    }
  } catch {
    // ignore
  }

  return await getBookedAppointments();
}

/**
 * Retrieve active appointments for a specific client email (Self-service lookup).
 */
export async function getAppointmentsByEmail(email) {
  if (!email || !email.trim()) return [];
  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('calendar_appointments')
      .select('*')
      .ilike('client_email', cleanEmail)
      .order('date', { ascending: true });

    if (!error && data) {
      return data.map(normalizeAppointment);
    }
  } catch (err) {
    console.error('Error finding appointments by email:', err);
  }

  // Fallback lookup from cache
  const cached = await getBookedAppointments();
  return cached.filter(b => (b.email || b.client_email || '').toLowerCase() === cleanEmail);
}
