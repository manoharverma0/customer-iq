-- ═══════════════════════════════════════════════════════════════════════════════
-- CustomerIQ — Production Upgrade Migration
-- Run this ONCE in Supabase SQL Editor AFTER the base setup is done.
-- Creates: summaries, bookings, slots, pricing, lead_scores, knowledge_chunks
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure pgvector is available
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CONVERSATION SUMMARIES — Rolling AI-compressed history
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE UNIQUE,
  summary_text     TEXT NOT NULL DEFAULT '',
  message_count    INT NOT NULL DEFAULT 0,
  last_updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv
  ON conversation_summaries(conversation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BOOKINGS — Appointment / order bookings created by AI
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id      UUID REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id  UUID REFERENCES conversations(id) ON DELETE SET NULL,
  customer_name    TEXT NOT NULL DEFAULT 'Customer',
  customer_phone   TEXT,
  service_type     TEXT NOT NULL,
  slot_datetime    TIMESTAMPTZ,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_datetime);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AVAILABLE SLOTS — Business availability calendar
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS available_slots (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id    UUID REFERENCES businesses(id) ON DELETE CASCADE,
  slot_datetime  TIMESTAMPTZ NOT NULL,
  is_booked      BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, slot_datetime)
);

CREATE INDEX IF NOT EXISTS idx_slots_business_available
  ON available_slots(business_id, is_booked, slot_datetime);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PRICING — Price range table (anti-hallucination)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id    UUID REFERENCES businesses(id) ON DELETE CASCADE,
  service_type   TEXT NOT NULL,
  price_min      INTEGER NOT NULL,
  price_max      INTEGER NOT NULL,
  unit           TEXT DEFAULT 'per item',
  conditions     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, service_type)
);

CREATE INDEX IF NOT EXISTS idx_pricing_business ON pricing(business_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. LEAD SCORES — AI-extracted intelligence per conversation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_scores (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE UNIQUE,
  score            INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  budget_detected  TEXT,
  urgency_detected TEXT,
  needs_summary    TEXT,
  next_action      TEXT,
  last_updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_conv ON lead_scores(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. KNOWLEDGE CHUNKS — FAQ + policies + business knowledge for RAG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   UUID REFERENCES businesses(id) ON DELETE CASCADE,
  chunk_type    TEXT NOT NULL DEFAULT 'faq',  -- faq | policy | pricing | about
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  embedding     vector(384),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, title)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_business ON knowledge_chunks(business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MATCH KNOWLEDGE — RPC function for semantic FAQ search
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(384),
  business_id_filter UUID,
  match_count INT DEFAULT 3,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  chunk_type TEXT,
  title TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.chunk_type,
    k.title,
    k.content,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks k
  WHERE
    k.business_id = business_id_filter
    AND k.embedding IS NOT NULL
    AND 1 - (k.embedding <=> query_embedding) > similarity_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS — Enable Row Level Security on all new tables (public for now)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Public access policies (tighten later with proper auth)
CREATE POLICY "Public conversation_summaries" ON conversation_summaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public available_slots" ON available_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public pricing" ON pricing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public lead_scores" ON lead_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public knowledge_chunks" ON knowledge_chunks FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. AUTO-GENERATE DEMO SLOTS for StyleCraft India (next 7 days, 9AM-5PM)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  biz_id UUID;
  d INT;
  h INT;
  slot_ts TIMESTAMPTZ;
BEGIN
  SELECT id INTO biz_id FROM businesses WHERE owner_email = 'admin@stylecraft.com' LIMIT 1;

  IF biz_id IS NOT NULL THEN
    FOR d IN 1..7 LOOP
      FOR h IN 9..17 LOOP
        slot_ts := (CURRENT_DATE + d * INTERVAL '1 day') + (h * INTERVAL '1 hour');
        INSERT INTO available_slots (business_id, slot_datetime, is_booked)
        VALUES (biz_id, slot_ts, false)
        ON CONFLICT (business_id, slot_datetime) DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SEED PRICING for StyleCraft India demo
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  biz_id UUID;
BEGIN
  SELECT id INTO biz_id FROM businesses WHERE owner_email = 'admin@stylecraft.com' LIMIT 1;

  IF biz_id IS NOT NULL THEN
    INSERT INTO pricing (business_id, service_type, price_min, price_max, unit, conditions) VALUES
      (biz_id, 'Silk Saree',        2999, 15999, 'per piece', 'Price varies by fabric and embroidery type'),
      (biz_id, 'Designer Kurta',     899,  2999, 'per piece', 'Custom embroidery may cost extra'),
      (biz_id, 'Lehenga Choli',     5999, 25999, 'per set',   'Bridal sets include dupatta. Custom sizing free.'),
      (biz_id, 'Jewelry Set',       1499,  8999, 'per set',   'Includes necklace + earrings. Maang tikka extra for some sets.'),
      (biz_id, 'Casual Shirt',       699,  1999, 'per piece', 'Linen and cotton options available'),
      (biz_id, 'Express Shipping',    199,   299, 'per order', 'Free standard shipping above ₹999'),
      (biz_id, 'Custom Sizing',        0,     0, 'per order', 'Free for lehengas. ₹200 for other items above ₹2000.')
    ON CONFLICT (business_id, service_type) DO NOTHING;
  END IF;
END $$;

SELECT 'Production upgrade complete ✅' AS status;
