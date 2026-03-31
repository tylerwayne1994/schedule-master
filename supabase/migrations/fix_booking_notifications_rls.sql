-- Migration: fix booking_notifications trigger blocking booking inserts under RLS

ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_notifications'
      AND policyname = 'Authenticated users can insert booking notifications'
  ) THEN
    CREATE POLICY "Authenticated users can insert booking notifications"
      ON booking_notifications
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_notifications'
      AND policyname = 'Admins can view booking notifications'
  ) THEN
    CREATE POLICY "Admins can view booking notifications"
      ON booking_notifications
      FOR SELECT
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_notifications'
      AND policyname = 'Admins can update booking notifications'
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
      -- Do not block the booking itself if notification logging fails.
      RAISE NOTICE 'create_booking_notification failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
