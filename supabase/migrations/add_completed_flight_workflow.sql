-- Migration: Completed flight workflow (actual hours + admin notifications)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Persist actual flight time on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(10, 1);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_hours_submitted_at TIMESTAMPTZ;

-- 2) Admin notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT,
  message TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Admins can view notifications'
  ) THEN
    CREATE POLICY "Admins can view notifications" ON notifications
      FOR SELECT USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Admins can update notifications'
  ) THEN
    CREATE POLICY "Admins can update notifications" ON notifications
      FOR UPDATE USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Admins can delete notifications'
  ) THEN
    CREATE POLICY "Admins can delete notifications" ON notifications
      FOR DELETE USING (is_admin());
  END IF;
END $$;

-- 3) RPC: complete_flight(booking_id, actual_hours)
-- Updates booking.actual_hours, adds delta to helicopter.hobbs_time, inserts notification.
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
