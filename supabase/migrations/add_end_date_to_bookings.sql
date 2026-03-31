-- Migration: add end_date to bookings for multi-day scheduling

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
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_date_range'
      AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT valid_date_range CHECK (end_date >= date);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_same_day_time'
      AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT valid_same_day_time CHECK (end_date > date OR end_time > start_time);
  END IF;
END $$;
