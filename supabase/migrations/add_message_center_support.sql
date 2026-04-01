-- Migration: Message Center support for all users
-- Ensures notifications table has proper policies for:
-- 1. Admin users to see notifications where recipient_user_id IS NULL (admin broadcasts)
-- 2. All users to see notifications where recipient_user_id matches their ID
-- 3. Proper INSERT policies for trigger/RPC functions that create notifications

-- Ensure the insertions from SECURITY DEFINER functions work properly
DO $$
BEGIN
  -- Allow system/trigger insertions (already exists but be safe)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'System can insert notifications'
  ) THEN
    CREATE POLICY "System can insert notifications" ON notifications
      FOR INSERT
      WITH CHECK (true);
  END IF;

  -- Allow marked-as-read updates by the recipient
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Recipients can mark own notifications read'
  ) THEN
    CREATE POLICY "Recipients can mark own notifications read" ON notifications
      FOR UPDATE
      USING (recipient_user_id = auth.uid())
      WITH CHECK (recipient_user_id = auth.uid());
  END IF;

  -- Ensure admins can mark admin broadcast notifications as read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Admins can update admin broadcast notifications'
  ) THEN
    CREATE POLICY "Admins can update admin broadcast notifications" ON notifications
      FOR UPDATE
      USING (is_admin() AND recipient_user_id IS NULL)
      WITH CHECK (is_admin() AND recipient_user_id IS NULL);
  END IF;
END $$;

-- Create notification when flight hours are approved (notify the user)
CREATE OR REPLACE FUNCTION notify_user_on_hours_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_name TEXT;
  v_tail_number TEXT;
BEGIN
  -- Only fire when status changes to approved
  IF OLD.actual_hours_status = 'pending' AND NEW.actual_hours_status = 'approved' THEN
    SELECT COALESCE(name, email)
    INTO v_admin_name
    FROM profiles
    WHERE id = NEW.actual_hours_approved_by;

    SELECT tail_number
    INTO v_tail_number
    FROM helicopters
    WHERE id = NEW.helicopter_id;

    INSERT INTO notifications (
      type,
      title,
      message,
      booking_id,
      recipient_user_id,
      created_by
    )
    VALUES (
      'flight_hours_approved_user',
      'Flight hours approved',
      'Your flight of ' || to_char(NEW.actual_hours, 'FM999999990.0') || ' hrs on ' || COALESCE(v_tail_number, 'the helicopter') || ' has been approved.',
      NEW.id,
      NEW.user_id,
      NEW.actual_hours_approved_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS bookings_notify_user_approval_trigger ON bookings;
CREATE TRIGGER bookings_notify_user_approval_trigger
AFTER UPDATE ON bookings
FOR EACH ROW
WHEN (OLD.actual_hours_status IS DISTINCT FROM NEW.actual_hours_status)
EXECUTE FUNCTION notify_user_on_hours_approval();

COMMENT ON TABLE notifications IS 'Stores notifications for all users. recipient_user_id NULL means admin broadcast notification.';
