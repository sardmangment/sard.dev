-- Migration: D-17 Calendar RLS Lockdown & Ownership Token Stored Procedures (AR-14 / HF-02)
-- Target: Supabase public.calendar_appointments (Database: hnihrwignetxwudoqntp)
-- Note: This revised migration has never been applied live.
-- Eliminates public PII leakage, replaces email-based authorization with cryptographic manage tokens,
-- revokes direct anonymous table INSERT/SELECT/UPDATE/DELETE, and enforces service_role admin access.
-- Idempotent: safe to run multiple times without failure.

-- ============================================================================
-- 1. Schema Alteration: manage_token_hash column & unique index
-- Note: Existing rows created prior to this migration will have NULL manage_token_hash.
-- Only administrative users (via service_role Admin API) can manage or cancel legacy rows.
-- ============================================================================
ALTER TABLE public.calendar_appointments 
  ADD COLUMN IF NOT EXISTS manage_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_appointments_manage_token_hash 
  ON public.calendar_appointments (manage_token_hash) 
  WHERE manage_token_hash IS NOT NULL;

-- ============================================================================
-- 2. Drop Obsolete Insecure Functions (Email-Based Lookup & Cancellation)
-- Email address is not proof of ownership. Replaced by token-based procedures.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_my_appointments(text);
DROP FUNCTION IF EXISTS public.cancel_own_appointment(uuid, text);

-- ============================================================================
-- 3. Function: get_booked_slots_for_date (Public Slot Availability)
-- Returns ONLY booked slot strings for a given date; exposes zero customer PII.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_booked_slots_for_date(p_date date)
RETURNS TABLE (time_slot varchar)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
  SELECT time_slot
  FROM public.calendar_appointments
  WHERE date = p_date AND status = 'confirmed';
$$;

REVOKE EXECUTE ON FUNCTION public.get_booked_slots_for_date(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_slots_for_date(date) TO anon, authenticated;

-- ============================================================================
-- 4. Function: book_appointment (Secure Customer Booking with Manage Token)
-- Generates 32-byte cryptographically secure random manage token.
-- Stores SHA-256 hash in database; returns raw token exactly ONCE to client.
-- Error Codes (P0001 / custom SQLSTATEs):
--   - SB001 (INVALID_EMAIL): Email regex check failed or length > 255
--   - SB002 (INVALID_SLOT): Slot is not one of 13 approved TIME_SLOTS
--   - SB003 (DATE_OUT_OF_RANGE): Date is not between CURRENT_DATE and CURRENT_DATE + 90
--   - SB004 (FIELD_TOO_LONG): Name > 100, service > 255, or notes > 1000 characters
--   - SB005 (DAILY_LIMIT_REACHED): Email reached maximum of 3 bookings for date (D-29)
--   - 23505 (unique_violation): Concurrent slot collision (uq_confirmed_slot)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_date date,
  p_time_slot varchar,
  p_name text,
  p_email text,
  p_service text DEFAULT 'AI Consultation',
  p_notes text DEFAULT '',
  p_created_via text DEFAULT 'web_form'
)
RETURNS TABLE (
  id uuid,
  date date,
  time_slot varchar,
  status varchar,
  manage_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_status varchar := 'confirmed';
  v_clean_email text;
  v_clean_name text;
  v_clean_service text;
  v_clean_notes text;
  v_daily_count int;
  v_raw_token text;
  v_token_hash text;
BEGIN
  -- 1. Date validation: must be between CURRENT_DATE and CURRENT_DATE + 90
  IF p_date IS NULL OR p_date < CURRENT_DATE OR p_date > (CURRENT_DATE + 90) THEN
    RAISE EXCEPTION 'DATE_OUT_OF_RANGE: Bookings are available from today up to 90 days ahead.' USING ERRCODE = 'SB003';
  END IF;

  -- 2. Time slot validation: must match one of the 13 approved slots exactly
  -- Reject untrimmed values: the raw p_time_slot is what gets inserted, so ' 12:00 PM' would bypass uq_confirmed_slot
  IF p_time_slot IS NULL OR p_time_slot <> TRIM(p_time_slot) OR p_time_slot NOT IN (
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
    '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM',
    '10:00 PM', '11:00 PM', '12:00 AM'
  ) THEN
    RAISE EXCEPTION 'INVALID_SLOT: Please check your booking details.' USING ERRCODE = 'SB002';
  END IF;

  -- 3. Email validation: lowercase, trim, regex ^[^@\s]+@[^@\s]+\.[^@\s]+$, max 255 chars
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  IF v_clean_email = '' OR length(v_clean_email) > 255 OR v_clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL: Please enter a valid email address.' USING ERRCODE = 'SB001';
  END IF;

  -- 4. Field length validation: name <= 100, service <= 255, notes <= 1000 characters
  v_clean_name := COALESCE(NULLIF(TRIM(p_name), ''), 'Guest Client');
  v_clean_service := COALESCE(NULLIF(TRIM(p_service), ''), 'AI Consultation');
  v_clean_notes := COALESCE(p_notes, '');

  IF length(v_clean_name) > 100 OR length(v_clean_service) > 255 OR length(v_clean_notes) > 1000 THEN
    RAISE EXCEPTION 'FIELD_TOO_LONG: Please check your booking details.' USING ERRCODE = 'SB004';
  END IF;

  -- 5. Daily limit (Decision D-29): max 3 confirmed bookings per day per email
  -- Transaction-level advisory lock serializes concurrent bookings for same email and day
  PERFORM pg_advisory_xact_lock(hashtext('book:' || v_clean_email || ':' || p_date::text));

  SELECT count(*) INTO v_daily_count
  FROM public.calendar_appointments
  WHERE LOWER(client_email) = v_clean_email
    AND date = p_date
    AND status = 'confirmed';

  IF v_daily_count >= 3 THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED: You have reached the limit of 3 bookings per day for this email.' USING ERRCODE = 'SB005';
  END IF;

  -- 6. Generate 32-byte cryptographically secure random token and its SHA-256 digest
  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  -- 7. Insert appointment record (concurrent slot booking will trigger unique constraint 23505)
  INSERT INTO public.calendar_appointments (
    date,
    time_slot,
    client_name,
    client_email,
    service_type,
    notes,
    status,
    created_via,
    manage_token_hash
  ) VALUES (
    p_date,
    p_time_slot,
    v_clean_name,
    v_clean_email,
    v_clean_service,
    v_clean_notes,
    v_status,
    COALESCE(NULLIF(TRIM(p_created_via), ''), 'web_form'),
    v_token_hash
  )
  RETURNING calendar_appointments.id INTO v_id;

  RETURN QUERY
  SELECT 
    v_id,
    p_date,
    p_time_slot,
    v_status,
    v_raw_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_appointment(date, varchar, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment(date, varchar, text, text, text, text, text) TO anon, authenticated;

-- ============================================================================
-- 5. Function: get_appointment_by_token (Token-Authenticated Lookup)
-- Returns booking details only when provided token hash matches appointment id.
-- Otherwise returns 0 rows without revealing whether the id exists.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_appointment_by_token(
  p_id uuid,
  p_token text
)
RETURNS TABLE (
  id uuid,
  date date,
  time_slot varchar,
  service_type varchar,
  status varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE
  v_token_hash text;
BEGIN
  IF p_id IS NULL OR p_token IS NULL OR TRIM(p_token) = '' THEN
    RETURN;
  END IF;

  v_token_hash := encode(extensions.digest(TRIM(p_token), 'sha256'), 'hex');

  RETURN QUERY
  SELECT 
    ca.id,
    ca.date,
    ca.time_slot,
    ca.service_type,
    ca.status
  FROM public.calendar_appointments ca
  WHERE ca.id = p_id 
    AND ca.manage_token_hash = v_token_hash
    -- Token expiration: Token lookup is valid up to 30 days past appointment date
    AND ca.date >= (CURRENT_DATE - INTERVAL '30 days')::date;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_appointment_by_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_token(uuid, text) TO anon, authenticated;

-- ============================================================================
-- 6. Function: cancel_appointment_by_token (Token-Authenticated Cancellation)
-- Soft-deletes (status='cancelled') only when BOTH id and token hash match.
-- Enforces cancellation expiration: Past appointments cannot be cancelled.
-- Returns true on successful cancellation, false otherwise.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(
  p_id uuid,
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_updated integer;
  v_token_hash text;
BEGIN
  IF p_id IS NULL OR p_token IS NULL OR TRIM(p_token) = '' THEN
    RETURN false;
  END IF;

  v_token_hash := encode(extensions.digest(TRIM(p_token), 'sha256'), 'hex');

  UPDATE public.calendar_appointments
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_id 
    AND manage_token_hash = v_token_hash
    AND status = 'confirmed'
    -- Cancellation expiration: Only future or same-day appointments can be cancelled
    AND date >= CURRENT_DATE;
    
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid, text) TO anon, authenticated;

-- ============================================================================
-- 7. Row-Level Security (RLS) Lockdown
-- All direct anonymous SELECT, INSERT, UPDATE, and DELETE policies are dropped.
-- Public clients MUST use book_appointment, get_appointment_by_token, and cancel_appointment_by_token.
-- Administrative access is granted exclusively to service_role (via Admin API).
-- ============================================================================
ALTER TABLE public.calendar_appointments ENABLE ROW LEVEL SECURITY;

-- Drop all public read, write, update, and delete policies
DROP POLICY IF EXISTS "public_read_appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "public_insert_appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "client_cancel_own_appointment" ON public.calendar_appointments;
DROP POLICY IF EXISTS "admin_delete_appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "admin_read_appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "admin_manage_appointments" ON public.calendar_appointments;

-- Allow service_role full administrative access (used by /api/admin/appointments)
DROP POLICY IF EXISTS "service_role_manage_appointments" ON public.calendar_appointments;
CREATE POLICY "service_role_manage_appointments"
  ON public.calendar_appointments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
