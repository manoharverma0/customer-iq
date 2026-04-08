-- ================================================================
-- CustomerIQ — Complete Fix Script (with password auth)
-- Run this in Supabase SQL Editor.
-- Safe to run even if businesses table already exists.
-- ================================================================

-- 1. Create businesses table if it doesn't exist
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT UNIQUE,
  password TEXT,                            -- hashed business login password
  status TEXT DEFAULT 'pending',            -- pending | approved | active
  system_prompt TEXT,
  welcome_message TEXT DEFAULT 'Hi! How can I help you today?',
  products_summary JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Safely add columns to existing tables
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 3. Add business_id to existing data tables
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

-- 4. RLS policies
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access businesses" ON businesses;
CREATE POLICY "Public access businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_business ON analytics_events(business_id);

-- 6. Seed default StyleCraft India demo account (already active)
DO $$
DECLARE
  default_biz_id UUID;
BEGIN
  SELECT id INTO default_biz_id FROM businesses WHERE owner_email = 'admin@stylecraft.com' LIMIT 1;

  IF default_biz_id IS NULL THEN
    INSERT INTO businesses (
      name, industry, owner_name, owner_email, password, status,
      system_prompt, welcome_message, products_summary
    )
    VALUES (
      'StyleCraft India',
      'Fashion & E-Commerce',
      'Admin',
      'admin@stylecraft.com',
      'demo1234',
      'active',
      'You are an AI customer support assistant for "StyleCraft India", a premium fashion and ethnic wear e-commerce brand.

PRODUCTS:
- Silk Sarees: Rs.2,999 - Rs.15,999
- Designer Kurtas: Rs.899 - Rs.2,999
- Lehengas: Rs.5,999 - Rs.25,999
- Jewelry Sets: Rs.1,499 - Rs.8,999
- Casual Shirts: Rs.699 - Rs.1,999

SHIPPING & RETURNS:
- Standard shipping: 5-7 days, free above Rs.999
- Express: 2-3 days at Rs.149
- Next-day: Rs.299
- Returns: 7 days, full refund within 24 hours
- First-time buyers get 15% off

PERSONALITY:
- Warm, professional, Indian hospitality style
- Use 1-2 emojis per message max
- Suggest relevant products and upsells naturally
- For complaints: empathy first, then solution
- Keep responses to 2-4 short paragraphs
- Always end with a question or CTA to keep conversation going

RULES:
- Never invent order numbers or tracking info
- Never promise outside standard policies',
      'Namaste! Welcome to StyleCraft India. How can I help you today?',
      '["saree", "kurta", "lehenga", "jewelry", "shirt"]'
    ) RETURNING id INTO default_biz_id;
  END IF;

  UPDATE conversations SET business_id = default_biz_id WHERE business_id IS NULL;
  UPDATE analytics_events SET business_id = default_biz_id WHERE business_id IS NULL;
END $$;
