-- ═══════════════════════════════════════════════════════════════
-- WhatsApp Notification Tracking — Run in Supabase SQL Editor
-- Adds owner_notified column to track which leads triggered alerts
-- ═══════════════════════════════════════════════════════════════

-- 1. Add owner_notified column to lead_scores (tracks if owner was alerted)
ALTER TABLE lead_scores
ADD COLUMN IF NOT EXISTS owner_notified BOOLEAN DEFAULT false;

-- 2. Ensure owner_phone is set for StyleCraft India
UPDATE businesses
SET owner_phone = '+918823815378'
WHERE owner_email = 'admin@stylecraft.com'
  AND (owner_phone IS NULL OR owner_phone = '');

-- 3. Verify
SELECT 'Migration complete ✅' AS status;
SELECT id, name, owner_phone, owner_email FROM businesses WHERE owner_email = 'admin@stylecraft.com';
