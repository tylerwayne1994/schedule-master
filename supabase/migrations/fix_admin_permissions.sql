-- Fix admin permissions and RLS policies for bookings
-- Run this in Supabase SQL Editor

-- First, recreate the is_admin function to be more reliable
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN v_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can delete own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can do everything with bookings" ON bookings;

-- Recreate with simpler logic
CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can delete own bookings"
  ON bookings FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- Verify your admin user has the right role (replace with actual admin email)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';

-- Grant execute on RPC functions
GRANT EXECUTE ON FUNCTION update_booking_record TO authenticated;
GRANT EXECUTE ON FUNCTION delete_booking_record TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
