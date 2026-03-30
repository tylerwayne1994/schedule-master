-- Migration: Add 50hr and 100hr inspection tracking columns to helicopters table

ALTER TABLE helicopters ADD COLUMN IF NOT EXISTS inspection_50_hour DECIMAL(10, 1);
ALTER TABLE helicopters ADD COLUMN IF NOT EXISTS inspection_100_hour DECIMAL(10, 1);
