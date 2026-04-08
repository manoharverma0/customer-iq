-- ==============================================================
-- CustomerIQ — Complete Database Setup Script
-- Run this ONCE in your Supabase SQL Editor.
-- This creates all tables from scratch in the correct order.
-- ==============================================================

-- 1. Create businesses table (with owner info and approval status)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT UNIQUE,
  status TEXT DEFAULT 'pending',          -- pending | approved | active
  system_prompt TEXT,                     -- Generated AFTER approval
  welcome_message TEXT DEFAULT 'Hi there! How can I help you today?',
  products_summary JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name TEXT DEFAULT 'Visitor',
  channel TEXT DEFAULT 'website',
  urgency TEXT DEFAULT 'low',
  status TEXT DEFAULT 'active',
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                     -- 'customer' | 'ai'
  content TEXT NOT NULL,
  urgency TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_business ON analytics_events(business_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- 6. Enable Row Level Security and create public access policies
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access businesses" ON businesses;
CREATE POLICY "Public access businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access conversations" ON conversations;
CREATE POLICY "Public access conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access messages" ON messages;
CREATE POLICY "Public access messages" ON messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access analytics" ON analytics_events;
CREATE POLICY "Public access analytics" ON analytics_events FOR ALL USING (true) WITH CHECK (true);

-- 7. Seed the default "StyleCraft India" demo business (already active/approved for demo)
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
- We sell: Silk Sarees (₹2,999-₹15,999), Designer Kurtas (₹899-₹2,999), Lehengas (₹5,999-₹25,999), Jewelry Sets (₹1,499-₹8,999), Casual Shirts (₹699-₹1,999)
- We ship across India. Standard (5-7 days, free above ₹999), Express (2-3 days, ₹149), Next-Day (₹299)
- Return policy: 7 days easy returns, full refund within 24 hours
- We offer 15% off for first-time buyers

YOUR PERSONALITY:
- Warm, professional, and empathetic (Indian hospitality style)
- Use appropriate emojis but do not overdo it (1-2 per message)
- Always try to help, suggest alternatives, and upsell when natural
- For complaints: be empathetic FIRST, then offer solutions
- Keep responses concise (2-4 paragraphs max)
- Use the Rupee symbol for prices
- Reference specific products with prices when relevant

IMPORTANT RULES:
- Never make up order numbers or tracking info
- Never promise things outside our policies
- Always end with a question or call-to-action to keep the conversation going',
      'Namaste! Welcome to StyleCraft India. How can I help you find the perfect outfit today? ✨',
      '["saree", "kurta", "lehenga", "jewelry", "shirt"]'
    ) RETURNING id INTO default_biz_id;
  END IF;

END $$;
