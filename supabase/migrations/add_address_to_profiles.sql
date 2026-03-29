-- Migration: Add address column to profiles table
-- Run this if you already have the profiles table created

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
