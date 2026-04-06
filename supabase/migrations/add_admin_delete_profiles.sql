-- Allow admins to delete user profiles
-- Run this in Supabase SQL Editor

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
