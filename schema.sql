-- ==========================================
-- SUPABASE POSTGRESQL DATABASE SCHEMA
-- ==========================================

-- Enable UUID extension (standard in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create BRANDS table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 100
);

-- Seed initial brands in ordered sequence
INSERT INTO brands (name, sort_order) VALUES
  ('BATTERY (CLOCK)', 1),
  ('Bigotti', 2),
  ('Bonia', 3),
  ('Caesar', 4),
  ('Casio', 5),
  ('Cro wc', 6),
  ('Chronctech', 7),
  ('Digitec', 8),
  ('Daniel klein', 9),
  ('J.bovier', 10),
  ('L. strap', 11),
  ('Mini Focus', 12),
  ('Naviforce', 13),
  ('Pvc strap', 14),
  ('R-bat', 15),
  ('R&E', 16),
  ('REWARDS WATCH', 17),
  ('S-bat', 18),
  ('Slo/pokemon', 19),
  ('S.parts', 20),
  ('Submarine', 21),
  ('service', 22)
ON CONFLICT (name) DO UPDATE 
SET sort_order = EXCLUDED.sort_order;

-- 2. Create DAILY_SALES table
CREATE TABLE IF NOT EXISTS daily_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sales_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT unique_date_brand UNIQUE (date, brand_id)
);

-- Index for speedy monthly aggregates queries
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales(date);
