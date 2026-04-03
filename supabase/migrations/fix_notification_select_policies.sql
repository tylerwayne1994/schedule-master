-- Migration: Fix notification SELECT policies to ensure proper access

-- First, drop any existing overlapping SELECT policies
DROP POLICY IF EXISTS "Admins can view notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;

-- Create a single comprehensive SELECT policy for notifications
-- This allows:
--   1. Admins to view admin broadcasts (recipient_user_id IS NULL)
--   2. Users to view their own notifications (recipient_user_id = auth.uid())
--   3. Admins to also view their own user-targeted notifications
CREATE POLICY "Users and admins can view their notifications" ON notifications
  FOR SELECT USING (
    recipient_user_id = auth.uid()
    OR (recipient_user_id IS NULL AND is_admin())
  );

-- Also ensure admins can delete all notifications (admin broadcast ones)
DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
CREATE POLICY "Admins can delete admin notifications" ON notifications
  FOR DELETE USING (
    is_admin() AND recipient_user_id IS NULL
  );

-- Users should also be able to delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (
    recipient_user_id = auth.uid()
  );
