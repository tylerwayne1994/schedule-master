-- Migration: temporary compatibility for legacy booking code using `type`

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
