-- Fix time range constraint for multi-day bookings
-- Drop the old constraint that doesn't account for multi-day bookings
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS valid_time_range;

-- Ensure the correct constraint exists (allows end_time < start_time if end_date > date)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS valid_same_day_time;
ALTER TABLE bookings 
  ADD CONSTRAINT valid_same_day_time 
  CHECK (end_date > date OR end_time > start_time);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT valid_same_day_time ON bookings IS 
  'For same-day bookings, end_time must be after start_time. For multi-day bookings (end_date > date), end_time can be any value.';
