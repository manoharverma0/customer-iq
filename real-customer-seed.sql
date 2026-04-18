-- ═══════════════════════════════════════════════════════════════════════════
-- REAL CUSTOMER DEMO DATA — StyleCraft India
-- Run this in Supabase SQL Editor ONCE before the hackathon demo
-- It creates 1 real customer conversation with full message history
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Get your StyleCraft Business ID
-- (replace the business_id values below with your actual ID from the businesses table)
-- Run:  SELECT id FROM businesses WHERE owner_email = 'admin@stylecraft.com';

DO $$
DECLARE
  v_business_id UUID;
  v_conv_id     UUID;
BEGIN

  -- ── Find StyleCraft India business ─────────────────────────────────────────
  SELECT id INTO v_business_id
  FROM businesses
  WHERE owner_email = 'admin@stylecraft.com'
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'StyleCraft India business not found. Make sure supabase-complete-setup.sql was run first.';
  END IF;

  -- ── Clean up previous demo data (safe to re-run) ─────────────────────────
  DELETE FROM messages
  WHERE conversation_id IN (
    SELECT id FROM conversations
    WHERE business_id = v_business_id
    AND customer_name = 'Priya Sharma'
  );

  DELETE FROM conversations
  WHERE business_id = v_business_id
  AND customer_name = 'Priya Sharma';

  -- ── Create the real conversation ──────────────────────────────────────────
  INSERT INTO conversations (
    id,
    business_id,
    customer_name,
    channel,
    status,
    urgency,
    revenue,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_business_id,
    'Priya Sharma',
    'whatsapp',
    'active',
    'high',
    8799,  -- Silk Saree (₹5300) + Express Delivery (₹299) + Kundan Jewelry (₹3200) = ₹8799
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '45 minutes'
  )
  RETURNING id INTO v_conv_id;

  -- ── Insert the real message thread ────────────────────────────────────────
  INSERT INTO messages (conversation_id, role, content, urgency, metadata, created_at)
  VALUES
  -- Message 1: Customer opens with urgent wedding request
  (v_conv_id, 'customer',
   'Hi! I need a silk saree for my sister''s wedding this Saturday. Can you deliver by Friday? I''m in Pune. Please its urgent 🙏',
   'high',
   '{"channel": "whatsapp", "from": "+919876543210", "intent": ["urgent_delivery", "product_inquiry"]}'::jsonb,
   NOW() - INTERVAL '2 hours'),

  -- Message 2: AI detects urgency, responds with empathy + express offer
  (v_conv_id, 'ai',
   'Hi Priya! 🙏 Congratulations on your sister''s wedding! I completely understand the urgency — we absolutely can help! ✅ Express delivery to Pune is available — order by tonight and receive by Friday morning. We have beautiful silk sarees in stock. Which color are you looking for — Royal Blue, Maroon, or Gold? I''ll check availability right away!',
   NULL,
   '{"aiProvider": "huggingface", "urgency": "high", "suggestedAction": "Upsell express delivery"}'::jsonb,
   NOW() - INTERVAL '1 hour 58 minutes'),

  -- Message 3: Customer narrows down choice
  (v_conv_id, 'customer',
   'Maroon please! Budget is around ₹5000-6000 for the saree. And yes express delivery is fine. What''s the price?',
   'medium',
   '{"channel": "whatsapp", "from": "+919876543210", "intent": ["pricing", "purchase"]}'::jsonb,
   NOW() - INTERVAL '1 hour 50 minutes'),

  -- Message 4: AI gives specific product + upsell
  (v_conv_id, 'ai',
   'Great choice! 💎 Here''s what I have in Maroon for you:

🥻 **Banarasi Silk Saree (Maroon)** — ₹5,299
- Pure silk, zari border, comes with blouse piece
- Perfect for wedding occasions
- Size: 5.5m x 1.1m

🚚 **Express Delivery to Pune** — ₹299 (Friday arrival, guaranteed)

Total: ₹5,598

Also — would you like matching **Kundan Jewelry Set** (₹3,200)? It pairs beautifully with Maroon and I can dispatch both together. Many brides love this combo! 😊',
   NULL,
   '{"aiProvider": "huggingface", "urgency": "medium", "suggestedAction": "Cross-sell jewelry set"}'::jsonb,
   NOW() - INTERVAL '1 hour 48 minutes'),

  -- Message 5: Customer adds jewelry — conversion!
  (v_conv_id, 'customer',
   'Yes! Add the jewelry set too. How do I pay? UPI is fine?',
   'low',
   '{"channel": "whatsapp", "from": "+919876543210", "intent": ["purchase", "payment"]}'::jsonb,
   NOW() - INTERVAL '1 hour 30 minutes'),

  -- Message 6: AI closes the sale
  (v_conv_id, 'ai',
   'Wonderful! 🎉 Here''s your order summary:

✅ Banarasi Silk Saree (Maroon) — ₹5,299
✅ Kundan Jewelry Set — ₹3,200
✅ Express Delivery (Pune, Friday) — ₹299

**Total: ₹8,798**

Payment via UPI: **stylecraft@upi**
Just send the payment and share the screenshot here — I''ll confirm your order instantly and share the tracking link! 📦

Your sister is going to look stunning! 🌸',
   NULL,
   '{"aiProvider": "huggingface", "urgency": "low", "suggestedAction": "Close sale — order confirmed"}'::jsonb,
   NOW() - INTERVAL '1 hour 28 minutes'),

  -- Message 7: Customer confirms payment
  (v_conv_id, 'customer',
   'Done! Sent ₹8799 to stylecraft@upi. Screenshot attached. Please confirm 🙏',
   'medium',
   '{"channel": "whatsapp", "from": "+919876543210", "intent": ["purchase", "confirmation"]}'::jsonb,
   NOW() - INTERVAL '1 hour'),

  -- Message 8: AI confirms and builds trust
  (v_conv_id, 'ai',
   'Payment received! ✅ Thank you Priya!

**Order Confirmed:** SC-2026-0418-001
- Banarasi Silk Saree (Maroon) + Kundan Jewelry Set
- Express Dispatch: Tonight
- Expected Delivery: Friday by 11 AM, Pune
- Tracking link will be shared by tomorrow morning

Your sister will be the star of the wedding! 💫 Feel free to message us anytime for updates. Wishing your family a beautiful celebration! 🙏🎊',
   NULL,
   '{"aiProvider": "huggingface", "urgency": "low", "suggestedAction": "Order confirmed — retention message"}'::jsonb,
   NOW() - INTERVAL '58 minutes');

  -- ── Log analytics event ───────────────────────────────────────────────────
  INSERT INTO analytics_events (business_id, event_type, data, created_at)
  VALUES (
    v_business_id,
    'sale_completed',
    jsonb_build_object(
      'conversationId', v_conv_id::text,
      'customerName', 'Priya Sharma',
      'channel', 'whatsapp',
      'revenue', 8799,
      'aiProvider', 'huggingface',
      'urgency', 'high',
      'messagesCount', 8,
      'note', 'Real demo customer — hackathon 2026'
    ),
    NOW() - INTERVAL '58 minutes'
  );

  RAISE NOTICE 'SUCCESS ✅ Real customer conversation created!';
  RAISE NOTICE 'Business ID: %', v_business_id;
  RAISE NOTICE 'Conversation ID: %', v_conv_id;
  RAISE NOTICE 'Customer: Priya Sharma | Revenue: ₹8,799 | Channel: WhatsApp';

END $$;
