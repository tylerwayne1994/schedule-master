-- Move notification tracking from localStorage to Supabase
-- Run this in Supabase SQL Editor

-- 1. Track flight completion prompt dismissal on the booking itself
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS prompt_dismissed BOOLEAN NOT NULL DEFAULT false;

-- 2. Track admin's last-seen approval set on their profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_approvals TEXT DEFAULT '';
