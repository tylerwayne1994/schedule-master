-- Migration: booking notifications + flight-hours admin approval workflow

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS actual_hours_status TEXT DEFAULT 'not_submitted'
    CHECK (actual_hours_status IN ('not_submitted', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS actual_hours_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_hours_approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

UPDATE bookings
SET actual_hours_status = CASE
  WHEN actual_hours IS NOT NULL AND status = 'completed' THEN 'approved'
  WHEN actual_hours IS NOT NULL THEN 'pending'
  ELSE 'not_submitted'
END
WHERE actual_hours_status IS NULL;

CREATE OR REPLACE FUNCTION create_admin_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
  v_tail_number TEXT;
BEGIN
  IF NEW.flight_type = 'maintenance' OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, email)
  INTO v_user_name
  FROM profiles
  WHERE id = NEW.user_id;

  SELECT tail_number
  INTO v_tail_number
  FROM helicopters
  WHERE id = NEW.helicopter_id;

  INSERT INTO notifications (type, title, message, booking_id, created_by)
  VALUES (
    'booking_created',
    'New booking created',
    COALESCE(v_user_name, NEW.customer_name, NEW.customer_email, 'A user')
      || ' booked '
      || COALESCE(v_tail_number, 'a helicopter')
      || ' on '
      || to_char(NEW.date, 'YYYY-MM-DD')
      || ' from '
      || to_char(NEW.start_time, 'FM999999990.0')
      || ' to '
      || to_char(NEW.end_time, 'FM999999990.0')
      || '.',
    NEW.id,
    NEW.user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS bookings_admin_notification_trigger ON bookings;
CREATE TRIGGER bookings_admin_notification_trigger
AFTER INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION create_admin_booking_notification();

CREATE OR REPLACE FUNCTION submit_flight_hours(
  p_booking_id UUID,
  p_actual_hours DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_booking RECORD;
  v_actor UUID;
  v_user_name TEXT;
  v_tail_number TEXT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_actual_hours IS NULL OR p_actual_hours <= 0 THEN
    RAISE EXCEPTION 'Invalid actual hours';
  END IF;

  SELECT *
  INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RAISE EXCEPTION 'Booking is cancelled';
  END IF;

  IF v_booking.user_id <> v_actor AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to submit hours for this booking';
  END IF;

  UPDATE bookings
  SET actual_hours = p_actual_hours,
      actual_hours_submitted_at = NOW(),
      actual_hours_status = 'pending',
      actual_hours_approved_at = NULL,
      actual_hours_approved_by = NULL
  WHERE id = p_booking_id;

  SELECT COALESCE(name, email)
  INTO v_user_name
  FROM profiles
  WHERE id = v_booking.user_id;

  SELECT tail_number
  INTO v_tail_number
  FROM helicopters
  WHERE id = v_booking.helicopter_id;

  INSERT INTO notifications (type, title, message, booking_id, created_by)
  VALUES (
    'flight_hours_submitted',
    'Flight hours submitted',
    COALESCE(v_user_name, 'User')
      || ' submitted '
      || to_char(p_actual_hours, 'FM999999990.0')
      || ' hrs for '
      || COALESCE(v_tail_number, 'helicopter')
      || ' on '
      || to_char(v_booking.date, 'YYYY-MM-DD')
      || '.',
    p_booking_id,
    v_actor
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_flight_hours(
  p_booking_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_booking RECORD;
  v_actor UUID;
  v_user_name TEXT;
  v_tail_number TEXT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to approve flight hours';
  END IF;

  SELECT *
  INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.actual_hours IS NULL OR v_booking.actual_hours_status <> 'pending' THEN
    RAISE EXCEPTION 'Booking has no pending submitted hours';
  END IF;

  UPDATE bookings
  SET status = 'completed',
      actual_hours_status = 'approved',
      actual_hours_approved_at = NOW(),
      actual_hours_approved_by = v_actor
  WHERE id = p_booking_id;

  UPDATE helicopters
  SET hobbs_time = COALESCE(hobbs_time, 0) + v_booking.actual_hours
  WHERE id = v_booking.helicopter_id;

  SELECT COALESCE(name, email)
  INTO v_user_name
  FROM profiles
  WHERE id = v_booking.user_id;

  SELECT tail_number
  INTO v_tail_number
  FROM helicopters
  WHERE id = v_booking.helicopter_id;

  INSERT INTO notifications (type, title, message, booking_id, created_by)
  VALUES (
    'flight_hours_approved',
    'Flight hours approved',
    COALESCE(v_user_name, 'User')
      || ' had '
      || to_char(v_booking.actual_hours, 'FM999999990.0')
      || ' hrs approved for '
      || COALESCE(v_tail_number, 'helicopter')
      || '.',
    p_booking_id,
    v_actor
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
