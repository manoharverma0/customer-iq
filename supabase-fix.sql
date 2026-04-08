-- ==============================================================
-- CustomerIQ — Fix Script
-- Run this if you already have conversations/messages tables
-- but are missing the businesses table and business_id columns.
-- ==============================================================

-- STEP 1: Create the businesses table (with full owner + approval fields)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  system_prompt TEXT,
  welcome_message TEXT DEFAULT 'Hi there! How can I help you today?',
  products_summary JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 2: Add business_id to existing tables (safe — won't fail if column already exists)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

-- STEP 3: Enable RLS on businesses and create access policy
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access businesses" ON businesses;
CREATE POLICY "Public access businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);

-- STEP 4: Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_business ON analytics_events(business_id);

-- STEP 5: Seed the default "StyleCraft India" demo account
DO $$
DECLARE
  default_biz_id UUID;
BEGIN
  SELECT id INTO default_biz_id FROM businesses WHERE owner_email = 'admin@stylecraft.com' LIMIT 1;

  IF default_biz_id IS NULL THEN
    INSERT INTO businesses (
      name, industry, owner_name, owner_email, status,
      system_prompt, welcome_message, products_summary
    )
    VALUES (
      'StyleCraft India',
      'Fashion & E-Commerce',
      'Admin',
      'admin@stylecraft.com',
      'active',
      'You are an AI customer support assistant for "StyleCraft India", a premium fashion and ethnic wear e-commerce brand.

BRAND CONTEXT:
- We sell: Silk Sarees (Rs.2,999-Rs.15,999), Designer Kurtas (Rs.899-Rs.2,999), Lehengas (Rs.5,999-Rs.25,999), Jewelry Sets (Rs.1,499-Rs.8,999), Casual Shirts (Rs.699-Rs.1,999)
- We ship across India. Standard (5-7 days, free above Rs.999), Express (2-3 days, Rs.149), Next-Day (Rs.299)
- Return policy: 7 days easy returns, full refund within 24 hours
- We offer 15% off for first-time buyers

YOUR PERSONALITY:
- Warm, professional, and empathetic
- Use appropriate emojis but do not overdo it (1-2 per message)
- Always try to help, suggest alternatives, and upsell when natural
- For complaints: be empathetic FIRST, then offer solutions
- Keep responses concise (2-4 paragraphs max)
- Always end with a question or call-to-action to keep the conversation going

IMPORTANT RULES:
- Never make up order numbers or tracking info
- Never promise things outside our policies',
      'Namaste! Welcome to StyleCraft India. How can I help you find the perfect outfit today?',
      '["saree", "kurta", "lehenga", "jewelry", "shirt"]'
    ) RETURNING id INTO default_biz_id;
  END IF;

  -- STEP 6: Link all existing conversations/analytics to the default business
  UPDATE conversations SET business_id = default_biz_id WHERE business_id IS NULL;
  UPDATE analytics_events SET business_id = default_biz_id WHERE business_id IS NULL;

END $$;
