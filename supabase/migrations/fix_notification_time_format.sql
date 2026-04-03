-- Fix time formatting in notifications
-- Run this in Supabase SQL Editor

-- Helper function to format decimal time (e.g., 12.5) to readable time (e.g., "12:30 PM")
CREATE OR REPLACE FUNCTION format_time_display(p_time DECIMAL)
RETURNS TEXT AS $$
DECLARE
  v_hours INT;
  v_minutes INT;
  v_ampm TEXT;
  v_hour12 INT;
BEGIN
  v_hours := FLOOR(p_time);
  v_minutes := CASE WHEN (p_time - v_hours) >= 0.5 THEN 30 ELSE 0 END;
  
  IF v_hours >= 12 THEN
    v_ampm := 'PM';
    v_hour12 := CASE WHEN v_hours > 12 THEN v_hours - 12 ELSE v_hours END;
  ELSE
    v_ampm := 'AM';
    v_hour12 := CASE WHEN v_hours = 0 THEN 12 ELSE v_hours END;
  END IF;
  
  IF v_minutes = 0 THEN
    RETURN v_hour12::TEXT || ' ' || v_ampm;
  ELSE
    RETURN v_hour12::TEXT || ':' || LPAD(v_minutes::TEXT, 2, '0') || ' ' || v_ampm;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the update_booking_record function with proper time formatting
CREATE OR REPLACE FUNCTION update_booking_record(
  p_booking_id UUID,
  p_user_id UUID,
  p_helicopter_id UUID,
  p_date DATE,
  p_end_date DATE,
  p_start_time DECIMAL,
  p_end_time DECIMAL,
  p_instructor_id UUID DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_flight_type TEXT DEFAULT 'training',
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'confirmed',
  p_actual_hours DECIMAL DEFAULT NULL,
  p_actual_hours_submitted_at TIMESTAMPTZ DEFAULT NULL,
  p_actual_hours_status TEXT DEFAULT 'not_submitted',
  p_actual_hours_approved_at TIMESTAMPTZ DEFAULT NULL,
  p_actual_hours_approved_by UUID DEFAULT NULL
)
RETURNS bookings AS $$
DECLARE
  v_existing bookings;
  v_row bookings;
  v_actor UUID;
  v_time_display TEXT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_existing FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_existing.user_id <> v_actor AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to update this booking';
  END IF;

  UPDATE bookings
  SET user_id = p_user_id,
      helicopter_id = p_helicopter_id,
      date = p_date,
      end_date = COALESCE(p_end_date, p_date),
      start_time = p_start_time,
      end_time = p_end_time,
      instructor_id = p_instructor_id,
      customer_name = p_customer_name,
      customer_phone = p_customer_phone,
      customer_email = p_customer_email,
      flight_type = p_flight_type,
      type = p_flight_type,
      notes = p_notes,
      status = p_status,
      actual_hours = p_actual_hours,
      actual_hours_submitted_at = p_actual_hours_submitted_at,
      actual_hours_status = p_actual_hours_status,
      actual_hours_approved_at = p_actual_hours_approved_at,
      actual_hours_approved_by = p_actual_hours_approved_by
  WHERE id = p_booking_id
  RETURNING * INTO v_row;

  -- Format time for display
  v_time_display := format_time_display(v_row.start_time) || ' to ' || format_time_display(v_row.end_time);

  PERFORM create_admin_notification(
    'booking_updated',
    'Booking updated',
    COALESCE(v_row.customer_name, 'A user') || ' booking changed to ' || to_char(v_row.date, 'Mon DD, YYYY') || ' from ' || v_time_display || '.',
    v_row.id,
    v_actor
  );

  IF is_admin() AND v_existing.user_id <> v_actor THEN
    PERFORM create_user_notification(
      v_existing.user_id,
      'booking_updated_by_admin',
      'Your booking was changed',
      'An admin updated your booking to ' || to_char(v_row.date, 'Mon DD, YYYY') || ' from ' || v_time_display || '.',
      v_row.id,
      v_actor
    );
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update delete_booking_record to also use proper formatting
CREATE OR REPLACE FUNCTION delete_booking_record(p_booking_id UUID)
RETURNS VOID AS $$
DECLARE
  v_existing bookings;
  v_actor UUID;
  v_time_display TEXT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_existing FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_existing.user_id <> v_actor AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to delete this booking';
  END IF;

  v_time_display := format_time_display(v_existing.start_time) || ' to ' || format_time_display(v_existing.end_time);

  PERFORM create_admin_notification(
    'booking_deleted',
    'Booking deleted',
    COALESCE(v_existing.customer_name, 'A user') || ' booking for ' || to_char(v_existing.date, 'Mon DD, YYYY') || ' (' || v_time_display || ') was deleted.',
    p_booking_id,
    v_actor
  );

  IF is_admin() AND v_existing.user_id <> v_actor THEN
    PERFORM create_user_notification(
      v_existing.user_id,
      'booking_deleted_by_admin',
      'Your booking was deleted',
      'An admin deleted your booking that was scheduled for ' || to_char(v_existing.date, 'Mon DD, YYYY') || ' (' || v_time_display || ').',
      p_booking_id,
      v_actor
    );
  END IF;

  DELETE FROM bookings WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update cancel_booking_record too
CREATE OR REPLACE FUNCTION cancel_booking_record(p_booking_id UUID)
RETURNS bookings AS $$
DECLARE
  v_existing bookings;
  v_row bookings;
  v_actor UUID;
  v_time_display TEXT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_existing FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_existing.user_id <> v_actor AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to cancel this booking';
  END IF;

  UPDATE bookings
  SET status = 'cancelled'
  WHERE id = p_booking_id
  RETURNING * INTO v_row;

  v_time_display := format_time_display(v_row.start_time) || ' to ' || format_time_display(v_row.end_time);

  PERFORM create_admin_notification(
    'booking_cancelled',
    'Booking cancelled',
    COALESCE(v_row.customer_name, 'A user') || ' cancelled their booking for ' || to_char(v_row.date, 'Mon DD, YYYY') || ' (' || v_time_display || ').',
    v_row.id,
    v_actor
  );

  IF is_admin() AND v_existing.user_id <> v_actor THEN
    PERFORM create_user_notification(
      v_existing.user_id,
      'booking_cancelled_by_admin',
      'Your booking was cancelled',
      'An admin cancelled your booking that was scheduled for ' || to_char(v_row.date, 'Mon DD, YYYY') || ' (' || v_time_display || ').',
      v_row.id,
      v_actor
    );
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION format_time_display TO authenticated;
