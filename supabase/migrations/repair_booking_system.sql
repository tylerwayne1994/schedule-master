-- Repair script: restores booking CRUD, notification compatibility, and admin/user booking alerts

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE bookings
SET end_date = date
WHERE end_date IS NULL;

ALTER TABLE bookings
  ALTER COLUMN end_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_date_range'
      AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT valid_date_range CHECK (end_date >= date);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_same_day_time'
      AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT valid_same_day_time CHECK (end_date > date OR end_time > start_time);
  END IF;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS type TEXT;

UPDATE bookings
SET type = COALESCE(type, flight_type)
WHERE type IS NULL;

CREATE OR REPLACE FUNCTION sync_booking_type_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.flight_type IS NULL AND NEW.type IS NOT NULL THEN
    NEW.flight_type := NEW.type;
  END IF;

  IF NEW.type IS NULL AND NEW.flight_type IS NOT NULL THEN
    NEW.type := NEW.flight_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_type_sync_trigger ON bookings;
CREATE TRIGGER bookings_type_sync_trigger
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION sync_booking_type_columns();

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can view own notifications'
  ) THEN
    CREATE POLICY "Users can view own notifications" ON notifications
      FOR SELECT USING (recipient_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications" ON notifications
      FOR UPDATE USING (recipient_user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'booking_notifications' AND policyname = 'Authenticated users can insert booking notifications'
  ) THEN
    CREATE POLICY "Authenticated users can insert booking notifications"
      ON booking_notifications
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'booking_notifications' AND policyname = 'Admins can view booking notifications'
  ) THEN
    CREATE POLICY "Admins can view booking notifications"
      ON booking_notifications
      FOR SELECT
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'booking_notifications' AND policyname = 'Admins can update booking notifications'
  ) THEN
    CREATE POLICY "Admins can update booking notifications"
      ON booking_notifications
      FOR UPDATE
      USING (is_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION create_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_type TEXT;
  v_recipients JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_notification_type := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
      v_notification_type := 'cancelled';
    ELSE
      v_notification_type := 'updated';
    END IF;
  END IF;

  v_recipients := get_booking_recipients(NEW.id);

  IF jsonb_array_length(v_recipients) > 0 THEN
    BEGIN
      INSERT INTO booking_notifications (booking_id, notification_type, recipients)
      VALUES (NEW.id, v_notification_type, v_recipients);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'create_booking_notification failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_user_notification(
  p_recipient_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_booking_id UUID,
  p_created_by UUID
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (type, title, message, booking_id, created_by, recipient_user_id)
  VALUES (p_type, p_title, p_message, p_booking_id, p_created_by, p_recipient_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_admin_notification(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_booking_id UUID,
  p_created_by UUID
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (type, title, message, booking_id, created_by, recipient_user_id)
  VALUES (p_type, p_title, p_message, p_booking_id, p_created_by, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

  PERFORM create_admin_notification(
    'booking_created',
    'New booking created',
    COALESCE(v_row.customer_name, 'A user') || ' booked ' || to_char(v_row.date, 'YYYY-MM-DD') || ' from ' || to_char(v_row.start_time, 'FM999999990.0') || ' to ' || to_char(v_row.end_time, 'FM999999990.0') || '.',
    v_row.id,
    v_actor
  );

  IF is_admin() AND p_user_id <> v_actor THEN
    PERFORM create_user_notification(
      p_user_id,
      'booking_created_by_admin',
      'Booking scheduled for you',
      'An admin scheduled a booking for ' || to_char(v_row.date, 'YYYY-MM-DD') || ' from ' || to_char(v_row.start_time, 'FM999999990.0') || ' to ' || to_char(v_row.end_time, 'FM999999990.0') || '.',
      v_row.id,
      v_actor
    );
  END IF;

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

  PERFORM create_admin_notification(
    'booking_updated',
    'Booking updated',
    COALESCE(v_row.customer_name, 'A user') || ' booking changed to ' || to_char(v_row.date, 'YYYY-MM-DD') || ' from ' || to_char(v_row.start_time, 'FM999999990.0') || ' to ' || to_char(v_row.end_time, 'FM999999990.0') || '.',
    v_row.id,
    v_actor
  );

  IF is_admin() AND v_existing.user_id <> v_actor THEN
    PERFORM create_user_notification(
      v_existing.user_id,
      'booking_updated_by_admin',
      'Your booking was changed',
      'An admin updated your booking to ' || to_char(v_row.date, 'YYYY-MM-DD') || ' from ' || to_char(v_row.start_time, 'FM999999990.0') || ' to ' || to_char(v_row.end_time, 'FM999999990.0') || '.',
      v_row.id,
      v_actor
    );
  END IF;

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

  PERFORM create_admin_notification(
    'booking_cancelled',
    'Booking cancelled',
    COALESCE(v_existing.customer_name, 'A user') || ' cancelled a booking scheduled for ' || to_char(v_existing.date, 'YYYY-MM-DD') || '.',
    p_booking_id,
    v_actor
  );

  IF is_admin() AND v_existing.user_id <> v_actor THEN
    PERFORM create_user_notification(
      v_existing.user_id,
      'booking_cancelled_by_admin',
      'Your booking was cancelled',
      'An admin cancelled your booking scheduled for ' || to_char(v_existing.date, 'YYYY-MM-DD') || '.',
      p_booking_id,
      v_actor
    );
  END IF;

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

  PERFORM create_admin_notification(
    'booking_deleted',
    'Booking deleted',
    COALESCE(v_existing.customer_name, 'A user') || ' booking for ' || to_char(v_existing.date, 'YYYY-MM-DD') || ' was deleted.',
    p_booking_id,
    v_actor
  );

  IF is_admin() AND v_existing.user_id <> v_actor THEN
    PERFORM create_user_notification(
      v_existing.user_id,
      'booking_deleted_by_admin',
      'Your booking was deleted',
      'An admin deleted your booking that was scheduled for ' || to_char(v_existing.date, 'YYYY-MM-DD') || '.',
      p_booking_id,
      v_actor
    );
  END IF;

  DELETE FROM bookings WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
