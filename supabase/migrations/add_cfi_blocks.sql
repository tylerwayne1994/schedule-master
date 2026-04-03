-- Create cfi_blocks table for blocking out CFI availability
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cfi_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time NUMERIC NOT NULL DEFAULT 0,
  end_time NUMERIC NOT NULL DEFAULT 24,
  all_day BOOLEAN NOT NULL DEFAULT true,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE cfi_blocks ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocks, everyone can view
CREATE POLICY "Anyone can view cfi_blocks"
  ON cfi_blocks FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert cfi_blocks"
  ON cfi_blocks FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete cfi_blocks"
  ON cfi_blocks FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Grant access
GRANT ALL ON cfi_blocks TO authenticated;
GRANT SELECT ON cfi_blocks TO anon;
