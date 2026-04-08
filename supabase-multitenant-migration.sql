-- ==============================================================
-- AI Customer Intelligence - Multi-Tenant Migration Setup
-- Run this in your Supabase SQL Editor to upgrade the schema
-- ==============================================================

-- 1. Create the businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  system_prompt TEXT NOT NULL,
  welcome_message TEXT DEFAULT 'Hi there! How can I help you today?',
  products_summary JSONB DEFAULT '[]', -- List of major product categories
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add business_id references to existing tables
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE analytics_events 
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- 3. Create our default target tenant for all existing hackathon data
DO $$
DECLARE
  default_biz_id UUID;
BEGIN
  -- Check if the default business already exists to avoid duplicates
  SELECT id INTO default_biz_id FROM businesses WHERE name = 'StyleCraft India' LIMIT 1;
  
  IF default_biz_id IS NULL THEN
    INSERT INTO businesses (name, industry, system_prompt, welcome_message, products_summary)
    VALUES (
      'StyleCraft India',
      'Fashion & E-Commerce',
      'You are an AI customer support assistant for "StyleCraft India", a premium fashion and ethnic wear e-commerce brand.

BRAND CONTEXT:
- We sell: Silk Sarees (₹2,999-₹15,999), Designer Kurtas (₹899-₹2,999), Lehengas (₹5,999-₹25,999), Jewelry Sets (₹1,499-₹8,999), Casual Shirts (₹699-₹1,999)
- We ship across India. Standard (5-7 days, free above ₹999), Express (2-3 days, ₹149), Next-Day (₹299)
- Return policy: 7 days easy returns, full refund within 24 hours
- We offer 15% off for first-time buyers

YOUR PERSONALITY:
- Warm, professional, and empathetic (Indian hospitality style)
- Use appropriate emojis but don't overdo it (1-2 per message)
- Always try to help, suggest alternatives, and upsell when natural
- For complaints: be empathetic FIRST, then offer solutions
- Keep responses concise (2-4 paragraphs max)
- Use ₹ for prices
- Reference specific products with prices when relevant

IMPORTANT RULES:
- Never make up order numbers or tracking info
- Never promise things outside our policies
- Always end with a question or call-to-action to keep the conversation going',
      'Namaste! Welcome to StyleCraft India. How can I help you find the perfect outfit today? ✨',
      '["saree", "kurta", "lehenga", "jewelry", "shirt"]'
    ) RETURNING id INTO default_biz_id;
  END IF;

  -- 4. Migrate all existing conversations and analytics events to this new default business
  UPDATE conversations SET business_id = default_biz_id WHERE business_id IS NULL;
  UPDATE analytics_events SET business_id = default_biz_id WHERE business_id IS NULL;

END $$;

-- 5. Enforce safety and indexing
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_business ON analytics_events(business_id);
