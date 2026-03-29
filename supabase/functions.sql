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
-- UPDATE HOBBS TIME AFTER FLIGHT
-- =============================================
CREATE OR REPLACE FUNCTION update_hobbs_after_flight()
RETURNS TRIGGER AS $$
DECLARE
  flight_hours DECIMAL;
BEGIN
  -- Only update when booking is marked as completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    flight_hours := NEW.end_time - NEW.start_time;
    
    UPDATE helicopters
    SET hobbs_time = hobbs_time + flight_hours
    WHERE id = NEW.helicopter_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hobbs_on_completion
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_hobbs_after_flight();

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
