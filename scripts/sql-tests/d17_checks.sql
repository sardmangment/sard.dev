-- scripts/sql-tests/d17_checks.sql
-- Live/Staging Verification Suite for D-17 Revised Calendar RLS & Validation (HF-08)
-- Instructions for Owner: Execute in Supabase SQL Editor against Staging or Preview database.
-- WARNING: Do not execute against production without maintenance window authorization.
-- All created test rows are marked with created_via = 'd17_checks_test' and cleaned up at the end.

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  -- D-31: Cairo dates; the test date is the first non-Friday on or after today + 30
  v_cairo_today date := (now() AT TIME ZONE 'Africa/Cairo')::date;
  v_test_date date := CASE WHEN EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Africa/Cairo')::date + 30) = 5
                           THEN (now() AT TIME ZONE 'Africa/Cairo')::date + 31
                           ELSE (now() AT TIME ZONE 'Africa/Cairo')::date + 30 END;
  v_friday date := (now() AT TIME ZONE 'Africa/Cairo')::date + 30
                   + ((5 - EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Africa/Cairo')::date + 30)::int + 7) % 7);
  v_yesterday date := (now() AT TIME ZONE 'Africa/Cairo')::date - 1;
  v_too_far_date date := (now() AT TIME ZONE 'Africa/Cairo')::date + 91;
  v_test_email text := 'd17_first_last@example.com';
  v_res record;
  v_caught boolean;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STARTING D-17 CALENDAR RLS & VALIDATION CHECKS';
  RAISE NOTICE '============================================================';

  -- Clean up any residual test records first
  DELETE FROM public.calendar_appointments WHERE created_via = 'd17_checks_test';

  -- --------------------------------------------------------------------------
  -- STEP 1: Verify valid email with underscore (first_last@example.com) books OK
  -- Expected: Returns 1 row with uuid, date, time_slot, status='confirmed', and 64-char token.
  -- --------------------------------------------------------------------------
  SELECT * INTO v_res FROM public.book_appointment(
    v_test_date,
    '12:00 PM',
    'Test Customer',
    v_test_email,
    'AI Consultation',
    'Initial test booking',
    'd17_checks_test'
  );

  IF v_res.id IS NULL OR length(v_res.manage_token) != 64 THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: book_appointment did not return valid ID and token for valid email.';
  END IF;
  RAISE NOTICE '✅ CHECK 1 PASSED: first_last@example.com booked successfully with token %', substring(v_res.manage_token, 1, 8) || '...';

  -- --------------------------------------------------------------------------
  -- STEP 2: Bad slot, yesterday date, and today+91 rejection
  -- --------------------------------------------------------------------------
  -- 2a: Bad slot
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_test_date, '01:30 PM', 'A', v_test_email, 'Service', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB002' OR OTHERS THEN
    IF SQLERRM LIKE '%INVALID_SLOT%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 2a FAILED: Invalid slot was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 2a PASSED: Invalid slot correctly rejected with INVALID_SLOT.';

  -- 2a-bis: Untrimmed approved slot (' 12:00 PM') must be rejected, otherwise it bypasses uq_confirmed_slot
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_test_date, ' 12:00 PM', 'A', v_test_email, 'Service', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB002' OR OTHERS THEN
    IF SQLERRM LIKE '%INVALID_SLOT%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 2a-bis FAILED: Untrimmed slot '' 12:00 PM'' was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 2a-bis PASSED: Untrimmed slot correctly rejected with INVALID_SLOT.';

  -- 2a-ter: Former evening slot '09:00 PM' is outside business hours (D-31)
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_test_date, '09:00 PM', 'A', v_test_email, 'Service', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB002' OR OTHERS THEN
    IF SQLERRM LIKE '%INVALID_SLOT%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 2a-ter FAILED: Out-of-hours slot 09:00 PM was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 2a-ter PASSED: 09:00 PM rejected with INVALID_SLOT.';

  -- 2a-quater: Friday is closed (D-31)
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_friday, '10:00 AM', 'A', v_test_email, 'Service', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB006' OR OTHERS THEN
    IF SQLERRM LIKE '%CLOSED_DAY%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 2a-quater FAILED: Friday booking was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 2a-quater PASSED: Friday rejected with CLOSED_DAY.';

  -- 2b: Yesterday date (< Cairo today)
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_yesterday, '01:00 PM', 'A', v_test_email, 'Service', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB003' OR OTHERS THEN
    IF SQLERRM LIKE '%DATE_OUT_OF_RANGE%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 2b FAILED: Past date was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 2b PASSED: Past date correctly rejected with DATE_OUT_OF_RANGE.';

  -- 2c: Today + 91 date (> Cairo today + 90)
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_too_far_date, '01:00 PM', 'A', v_test_email, 'Service', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB003' OR OTHERS THEN
    IF SQLERRM LIKE '%DATE_OUT_OF_RANGE%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 2c FAILED: Date > 90 days was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 2c PASSED: Date > 90 days correctly rejected with DATE_OUT_OF_RANGE.';

  -- --------------------------------------------------------------------------
  -- STEP 3: Length validation (101-char name, 1001-char notes, 256-char email)
  -- --------------------------------------------------------------------------
  -- 3a: 101-char name
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_test_date, '02:00 PM', repeat('A', 101), v_test_email, 'S', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB004' OR OTHERS THEN
    IF SQLERRM LIKE '%FIELD_TOO_LONG%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 3a FAILED: 101-char name was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 3a PASSED: 101-char name rejected with FIELD_TOO_LONG.';

  -- 3b: 1001-char notes
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_test_date, '02:00 PM', 'Name', v_test_email, 'S', repeat('N', 1001), 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB004' OR OTHERS THEN
    IF SQLERRM LIKE '%FIELD_TOO_LONG%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 3b FAILED: 1001-char notes was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 3b PASSED: 1001-char notes rejected with FIELD_TOO_LONG.';

  -- 3c: 256-char email (> 255)
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_test_date, '02:00 PM', 'Name', repeat('a', 244) || '@example.com', 'S', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB001' OR OTHERS THEN
    IF SQLERRM LIKE '%INVALID_EMAIL%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 3c FAILED: 256-char email was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 3c PASSED: >255 char email rejected with INVALID_EMAIL.';

  -- --------------------------------------------------------------------------
  -- STEP 4: Daily Limit (Max 3 bookings per day for same email)
  -- --------------------------------------------------------------------------
  -- Book 2nd slot for same email & day:
  PERFORM public.book_appointment(v_test_date, '01:00 PM', 'Test Client', v_test_email, 'S', '', 'd17_checks_test');
  -- Book 3rd slot for same email & day:
  PERFORM public.book_appointment(v_test_date, '02:00 PM', 'Test Client', v_test_email, 'S', '', 'd17_checks_test');

  -- Attempt 4th booking for same email & day: MUST fail with DAILY_LIMIT_REACHED
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_test_date, '03:00 PM', 'Test Client', v_test_email, 'S', '', 'd17_checks_test');
  EXCEPTION WHEN SQLSTATE 'SB005' OR OTHERS THEN
    IF SQLERRM LIKE '%DAILY_LIMIT_REACHED%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: 4th same-day booking for same email was not rejected.';
  END IF;
  RAISE NOTICE '✅ CHECK 4 PASSED: 4th same-day booking rejected with DAILY_LIMIT_REACHED.';

  -- --------------------------------------------------------------------------
  -- STEP 5: Duplicate Slot Collision (23505)
  -- --------------------------------------------------------------------------
  -- Attempt to book '12:00 PM' on v_test_date again with a DIFFERENT email:
  v_caught := false;
  BEGIN
    PERFORM public.book_appointment(v_test_date, '12:00 PM', 'Other Client', 'other_client@example.com', 'S', '', 'd17_checks_test');
  EXCEPTION WHEN unique_violation THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'CHECK 5 FAILED: Duplicate slot booking did not raise unique_violation (23505).';
  END IF;
  RAISE NOTICE '✅ CHECK 5 PASSED: Concurrent duplicate slot booking raised unique_violation (23505).';

  -- --------------------------------------------------------------------------
  -- CLEANUP: Delete all synthetic test rows created during this run
  -- --------------------------------------------------------------------------
  DELETE FROM public.calendar_appointments WHERE created_via = 'd17_checks_test';
  RAISE NOTICE '✅ CLEANUP COMPLETE: All d17_checks_test records pruned.';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'ALL D-17 CALENDAR CHECKS PASSED (5/5)';
  RAISE NOTICE '============================================================';
END;
$$;

COMMIT;
