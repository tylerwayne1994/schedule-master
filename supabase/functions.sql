-- =============================================
-- Next Level Helicopters - Utility Functions
-- =============================================

-- =============================================
-- BOOKING CONFLICT CHECK
-- =============================================
-- Returns true if there's a conflict with existing bookings
CREATE OR REPLACE FUNCTION check_booking_conflict(
  p_helicopter_id UUID,
  p_date DATE,
  p_start_time DECIMAL,
  p_end_time DECIMAL,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bookings
    WHERE helicopter_id = p_helicopter_id
      AND date = p_date
      AND status != 'cancelled'
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND (
        (p_start_time >= start_time AND p_start_time < end_time) OR
        (p_end_time > start_time AND p_end_time <= end_time) OR
        (p_start_time <= start_time AND p_end_time >= end_time)
      )
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- GET BOOKINGS FOR DATE RANGE
-- =============================================
CREATE OR REPLACE FUNCTION get_bookings_for_date(p_date DATE)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  helicopter_id UUID,
  tail_number TEXT,
  helicopter_model TEXT,
  instructor_id UUID,
  instructor_name TEXT,
  date DATE,
  start_time DECIMAL,
  end_time DECIMAL,
  flight_type TEXT,
  notes TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.user_id,
    p.name AS user_name,
    p.email AS user_email,
    b.helicopter_id,
    h.tail_number,
    h.model AS helicopter_model,
    b.instructor_id,
    i.name AS instructor_name,
    b.date,
    b.start_time,
    b.end_time,
    b.flight_type,
    b.notes,
    b.status
  FROM bookings b
  JOIN profiles p ON b.user_id = p.id
  JOIN helicopters h ON b.helicopter_id = h.id
  LEFT JOIN instructors i ON b.instructor_id = i.id
  WHERE b.date = p_date
  ORDER BY h.tail_number, b.start_time;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- GET USER BOOKING STATS
-- =============================================
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_flights BIGINT,
  total_hours DECIMAL,
  total_spent DECIMAL,
  upcoming_flights BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_flights,
    COALESCE(SUM(b.end_time - b.start_time), 0) AS total_hours,
    COALESCE(SUM((b.end_time - b.start_time) * h.hourly_rate), 0) AS total_spent,
    COUNT(*) FILTER (WHERE b.date >= CURRENT_DATE AND b.status = 'confirmed')::BIGINT AS upcoming_flights
  FROM bookings b
  JOIN helicopters h ON b.helicopter_id = h.id
  WHERE b.user_id = p_user_id
    AND b.status != 'cancelled';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMPLETE FLIGHT (actual hours + hobbs + admin notification)
-- =============================================
CREATE OR REPLACE FUNCTION complete_flight(
  p_booking_id UUID,
  p_actual_hours DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_booking RECORD;
  v_delta DECIMAL;
  v_actor UUID;
  v_user_name TEXT;
  v_tail_number TEXT;
  v_action TEXT;
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
    RAISE EXCEPTION 'Not authorized to complete this booking';
  END IF;

  v_delta := p_actual_hours - COALESCE(v_booking.actual_hours, 0);
  v_action := CASE WHEN v_booking.actual_hours IS NULL THEN 'submitted' ELSE 'updated' END;

  UPDATE bookings
  SET actual_hours = p_actual_hours,
      actual_hours_submitted_at = NOW(),
      status = 'completed'
  WHERE id = p_booking_id;

  IF v_delta <> 0 THEN
    UPDATE helicopters
    SET hobbs_time = COALESCE(hobbs_time, 0) + v_delta
    WHERE id = v_booking.helicopter_id;
  END IF;

  SELECT COALESCE(p.name, p.email)
  INTO v_user_name
  FROM profiles p
  WHERE p.id = v_booking.user_id;

  SELECT h.tail_number
  INTO v_tail_number
  FROM helicopters h
  WHERE h.id = v_booking.helicopter_id;

  INSERT INTO notifications (type, title, message, booking_id, created_by)
  VALUES (
    'flight_hours_' || v_action,
    'Flight hours ' || v_action,
    COALESCE(v_user_name, 'User') || ' ' || v_action || ' ' || to_char(p_actual_hours, 'FM999999990.0') || ' hrs for ' || COALESCE(v_tail_number, 'helicopter') || ' on ' || to_char(v_booking.date, 'YYYY-MM-DD') || '.',
    p_booking_id,
    v_actor
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ADMIN DASHBOARD STATS
-- =============================================
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_helicopters BIGINT,
  helicopters_available BIGINT,
  helicopters_maintenance BIGINT,
  total_instructors BIGINT,
  active_instructors BIGINT,
  total_users BIGINT,
  bookings_today BIGINT,
  bookings_this_week BIGINT,
  revenue_this_month DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM helicopters)::BIGINT,
    (SELECT COUNT(*) FROM helicopters WHERE status = 'available')::BIGINT,
    (SELECT COUNT(*) FROM helicopters WHERE status = 'maintenance')::BIGINT,
    (SELECT COUNT(*) FROM instructors)::BIGINT,
    (SELECT COUNT(*) FROM instructors WHERE status = 'active')::BIGINT,
    (SELECT COUNT(*) FROM profiles WHERE role = 'user')::BIGINT,
    (SELECT COUNT(*) FROM bookings WHERE date = CURRENT_DATE AND status = 'confirmed')::BIGINT,
    (SELECT COUNT(*) FROM bookings WHERE date >= CURRENT_DATE AND date < CURRENT_DATE + INTERVAL '7 days' AND status = 'confirmed')::BIGINT,
    (SELECT COALESCE(SUM((b.end_time - b.start_time) * h.hourly_rate), 0)
     FROM bookings b
     JOIN helicopters h ON b.helicopter_id = h.id
     WHERE b.status IN ('confirmed', 'completed')
       AND DATE_TRUNC('month', b.date) = DATE_TRUNC('month', CURRENT_DATE));
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MAKE USER ADMIN
-- =============================================
CREATE OR REPLACE FUNCTION make_user_admin(p_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET role = 'admin' WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example: SELECT make_user_admin('admin@nextlevelhelicopters.com');
