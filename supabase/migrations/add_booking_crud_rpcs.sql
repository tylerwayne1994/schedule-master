-- Migration: booking CRUD RPCs so admin scheduling is not blocked by RLS

CREATE OR REPLACE FUNCTION create_booking_record(
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
  p_status TEXT DEFAULT 'confirmed'
)
RETURNS bookings AS $$
DECLARE
  v_row bookings;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_actor <> p_user_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to create this booking';
  END IF;

  INSERT INTO bookings (
    user_id, helicopter_id, date, end_date, start_time, end_time,
    instructor_id, customer_name, customer_phone, customer_email,
    flight_type, type, notes, status
  )
  VALUES (
    p_user_id, p_helicopter_id, p_date, COALESCE(p_end_date, p_date), p_start_time, p_end_time,
    p_instructor_id, p_customer_name, p_customer_phone, p_customer_email,
    p_flight_type, p_flight_type, p_notes, COALESCE(p_status, 'confirmed')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION cancel_booking_record(p_booking_id UUID)
RETURNS bookings AS $$
DECLARE
  v_existing bookings;
  v_row bookings;
  v_actor UUID;
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

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION delete_booking_record(p_booking_id UUID)
RETURNS VOID AS $$
DECLARE
  v_existing bookings;
  v_actor UUID;
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

  DELETE FROM bookings WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
