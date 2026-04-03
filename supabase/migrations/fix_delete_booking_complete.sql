-- COMPLETE FIX for booking deletion
-- Run this ENTIRE script in Supabase SQL Editor

-- Step 1: Drop existing delete function
DROP FUNCTION IF EXISTS delete_booking_record(UUID);

-- Step 2: Create a simpler delete function that works
CREATE OR REPLACE FUNCTION delete_booking_record(p_booking_id UUID)
RETURNS VOID AS $$
DECLARE
  v_existing bookings;
  v_actor UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if admin
  SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = v_actor;
  v_is_admin := COALESCE(v_is_admin, FALSE);

  -- Get the booking
  SELECT * INTO v_existing FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Check authorization
  IF v_existing.user_id <> v_actor AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized to delete this booking';
  END IF;

  -- Delete it
  DELETE FROM bookings WHERE id = p_booking_id;
  
  -- If we got here, it worked
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Fix RLS policies - drop all booking policies first
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view all bookings for scheduling" ON bookings;
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can delete own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can do everything with bookings" ON bookings;

-- Step 4: Recreate policies with proper permissions
-- Everyone can see all bookings (for the schedule grid)
CREATE POLICY "Anyone can view bookings"
  ON bookings FOR SELECT
  USING (true);

-- Users can create their own bookings
CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookings, admins can update any
CREATE POLICY "Users and admins can update bookings"
  ON bookings FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can delete their own bookings, admins can delete any
CREATE POLICY "Users and admins can delete bookings"
  ON bookings FOR DELETE
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Step 5: Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_booking_record(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_booking_record(UUID) TO anon;

-- Step 6: Also fix cancel_booking_record
DROP FUNCTION IF EXISTS cancel_booking_record(UUID);

CREATE OR REPLACE FUNCTION cancel_booking_record(p_booking_id UUID)
RETURNS bookings AS $$
DECLARE
  v_existing bookings;
  v_row bookings;
  v_actor UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if admin
  SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = v_actor;
  v_is_admin := COALESCE(v_is_admin, FALSE);

  -- Get the booking
  SELECT * INTO v_existing FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Check authorization
  IF v_existing.user_id <> v_actor AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized to cancel this booking';
  END IF;

  -- Cancel it
  UPDATE bookings SET status = 'cancelled' WHERE id = p_booking_id RETURNING * INTO v_row;
  
  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION cancel_booking_record(UUID) TO authenticated;

-- Step 7: Verify the functions exist
SELECT proname FROM pg_proc WHERE proname IN ('delete_booking_record', 'cancel_booking_record');
