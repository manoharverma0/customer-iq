-- ═══════════════════════════════════════════════════════════════
-- Vector Search Setup for CustomerIQ
-- Run in Supabase SQL Editor ONCE
-- ═══════════════════════════════════════════════════════════════

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Products table with 384-dim embeddings (all-MiniLM-L6-v2)
CREATE TABLE IF NOT EXISTS products (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL,   -- saree | kurta | lehenga | jewelry | shirt
  price        INTEGER NOT NULL, -- in INR
  original_price INTEGER,
  discount     INTEGER DEFAULT 0,
  tags         TEXT[] DEFAULT '{}',
  sizes        TEXT[] DEFAULT '{}',
  image_url    TEXT,
  in_stock     BOOLEAN DEFAULT true,
  embedding    vector(384),      -- set by /api/seed-products
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  -- UNIQUE constraint required for upsert (onConflict) to work
  UNIQUE(name, business_id)
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS products_embedding_idx
  ON products USING hnsw (embedding vector_cosine_ops);

-- 3. RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert products" ON products;
CREATE POLICY "Public insert products" ON products FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update products" ON products;
CREATE POLICY "Public update products" ON products FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public delete products" ON products;
CREATE POLICY "Public delete products" ON products FOR DELETE USING (true);

-- 4. Similarity search function (called from Node.js via supabase.rpc)
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(384),
  business_id_filter UUID,
  match_count INT DEFAULT 3,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  price INTEGER,
  original_price INTEGER,
  discount INTEGER,
  tags TEXT[],
  sizes TEXT[],
  image_url TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.category,
    p.price,
    p.original_price,
    p.discount,
    p.tags,
    p.sizes,
    p.image_url,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE
    p.business_id = business_id_filter
    AND p.in_stock = true
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > similarity_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Update StyleCraft system_prompt to be comprehensive (not hardcoded in code)
UPDATE businesses
SET system_prompt = '
You are "Priya", StyleCraft India''s AI fashion assistant. You are warm, knowledgeable, and passionate about Indian ethnic wear.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABOUT STYLECRAFT INDIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Premium ethnic wear brand — sarees, lehengas, kurtas, jewelry & shirts.
Serving customers across India with authentic craftsmanship since 2015.
Website: customer-iq-nine.vercel.app/catalog

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR PERSONALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Address customers by name when you know it
- Use warm Indian phrases: "Namaste", "Ji", "bilkul"
- Be enthusiastic about fashion and occasions
- Always end with a question or call-to-action

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCT CATEGORIES & PRICE RANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👗 Silk Sarees         ₹2,999 – ₹15,999  (Banarasi, Kanjeevaram, Chanderi)
👔 Designer Kurtas     ₹899  – ₹2,999   (Cotton-silk, embroidered)
💃 Lehengas            ₹5,999 – ₹25,999  (Bridal, party, festive)
💎 Jewelry Sets        ₹1,499 – ₹8,999   (Kundan, Polki, Meenakari)
👕 Casual Shirts       ₹699  – ₹1,999   (Linen, cotton, festive)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POLICIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Shipping: Free above ₹999 | 3-5 days standard | Express ₹299 (next day)
Returns:  7-day easy returns | No questions asked
Payment:  UPI, Credit/Debit Card, Net Banking, COD
Sizes:    XS to XXL | Custom sizing available for lehengas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES — NEVER BREAK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ONLY discuss StyleCraft India products and policies
- NEVER give prices for products outside our catalog (bikes, electronics, food, etc.)
- NEVER make up unavailable products or fake discounts
- If asked off-topic, say: "I am Priya from StyleCraft India! I can only help with our ethnic wear. What occasion are you shopping for? 😊"
- Always recommend browsing our catalog at /catalog
'
WHERE owner_email = 'admin@stylecraft.com';

SELECT 'Setup complete ✅' AS status;
