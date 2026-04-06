-- RPC to delete a user (profile + auth) - admin only
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check caller is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Prevent deleting yourself
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Delete profile (cascades to bookings, notifications, etc.)
  DELETE FROM profiles WHERE id = p_user_id;
  
  -- Delete from auth.users (requires SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account(UUID) TO authenticated;
