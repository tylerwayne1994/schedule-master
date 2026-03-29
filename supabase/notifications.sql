-- =============================================
-- Email Notifications for Bookings
-- =============================================
-- This sets up the database trigger to call an Edge Function
-- when a new booking is created or updated.

-- =============================================
-- BOOKING NOTIFICATION LOG TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('created', 'updated', 'cancelled', 'reminder')),
  recipients JSONB NOT NULL, -- Array of {email, name, role}
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_notifications_booking ON booking_notifications(booking_id);
CREATE INDEX idx_booking_notifications_status ON booking_notifications(status);

-- =============================================
-- FUNCTION: Get all recipients for a booking
-- Returns user, instructor, and all admins
-- =============================================
CREATE OR REPLACE FUNCTION get_booking_recipients(p_booking_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_recipients JSONB := '[]'::JSONB;
  v_booking RECORD;
  v_user RECORD;
  v_instructor RECORD;
  v_admin RECORD;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN v_recipients;
  END IF;
  
  -- Get user who made the booking
  SELECT * INTO v_user FROM profiles WHERE id = v_booking.user_id;
  IF COALESCE(v_booking.customer_email, '') != '' THEN
    v_recipients := v_recipients || jsonb_build_array(jsonb_build_object(
      'email', v_booking.customer_email,
      'name', COALESCE(v_booking.customer_name, 'Customer'),
      'role', 'customer'
    ));
  ELSIF FOUND THEN
    v_recipients := v_recipients || jsonb_build_array(jsonb_build_object(
      'email', v_user.email,
      'name', COALESCE(v_booking.customer_name, v_user.name, 'Customer'),
      'role', 'customer'
    ));
  END IF;
  
  -- Get instructor if assigned
  IF v_booking.instructor_id IS NOT NULL THEN
    SELECT * INTO v_instructor FROM instructors WHERE id = v_booking.instructor_id;
    IF FOUND AND v_instructor.email IS NOT NULL THEN
      v_recipients := v_recipients || jsonb_build_array(jsonb_build_object(
        'email', v_instructor.email,
        'name', v_instructor.name,
        'role', 'instructor'
      ));
    END IF;
  END IF;
  
  -- Get all admins
  FOR v_admin IN SELECT * FROM profiles WHERE role = 'admin' LOOP
    -- Don't duplicate if admin is also the customer
    IF v_admin.id != v_booking.user_id THEN
      v_recipients := v_recipients || jsonb_build_array(jsonb_build_object(
        'email', v_admin.email,
        'name', COALESCE(v_admin.name, 'Admin'),
        'role', 'admin'
      ));
    END IF;
  END LOOP;
  
  RETURN v_recipients;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCTION: Create notification record
-- =============================================
CREATE OR REPLACE FUNCTION create_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_type TEXT;
  v_recipients JSONB;
BEGIN
  -- Determine notification type
  IF TG_OP = 'INSERT' THEN
    v_notification_type := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
      v_notification_type := 'cancelled';
    ELSE
      v_notification_type := 'updated';
    END IF;
  END IF;
  
  -- Get recipients
  v_recipients := get_booking_recipients(NEW.id);
  
  -- Only create notification if we have recipients
  IF jsonb_array_length(v_recipients) > 0 THEN
    INSERT INTO booking_notifications (booking_id, notification_type, recipients)
    VALUES (NEW.id, v_notification_type, v_recipients);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS on_booking_created ON bookings;
CREATE TRIGGER on_booking_created
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION create_booking_notification();

DROP TRIGGER IF EXISTS on_booking_updated ON bookings;
CREATE TRIGGER on_booking_updated
  AFTER UPDATE ON bookings
  FOR EACH ROW 
  WHEN (
    OLD.date IS DISTINCT FROM NEW.date OR
    OLD.start_time IS DISTINCT FROM NEW.start_time OR
    OLD.end_time IS DISTINCT FROM NEW.end_time OR
    OLD.helicopter_id IS DISTINCT FROM NEW.helicopter_id OR
    OLD.instructor_id IS DISTINCT FROM NEW.instructor_id OR
    OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION create_booking_notification();

-- =============================================
-- VIEW: Pending notifications with full details
-- =============================================
CREATE OR REPLACE VIEW pending_booking_notifications AS
SELECT 
  bn.id AS notification_id,
  bn.notification_type,
  bn.recipients,
  bn.created_at AS notification_created_at,
  b.id AS booking_id,
  b.date,
  b.start_time,
  b.end_time,
  b.flight_type,
  b.notes,
  b.status AS booking_status,
  COALESCE(b.customer_name, p.name) AS customer_name,
  COALESCE(b.customer_email, p.email) AS customer_email,
  h.tail_number,
  h.model AS helicopter_model,
  h.hourly_rate,
  i.name AS instructor_name,
  i.email AS instructor_email
FROM booking_notifications bn
JOIN bookings b ON bn.booking_id = b.id
JOIN profiles p ON b.user_id = p.id
JOIN helicopters h ON b.helicopter_id = h.id
LEFT JOIN instructors i ON b.instructor_id = i.id
WHERE bn.status = 'pending'
ORDER BY bn.created_at;

-- =============================================
-- FUNCTION: Mark notification as sent
-- =============================================
CREATE OR REPLACE FUNCTION mark_notification_sent(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE booking_notifications 
  SET status = 'sent', sent_at = NOW()
  WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCTION: Mark notification as failed
-- =============================================
CREATE OR REPLACE FUNCTION mark_notification_failed(p_notification_id UUID, p_error TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE booking_notifications 
  SET status = 'failed', error_message = p_error
  WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql;
