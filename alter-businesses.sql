-- 1. Add new columns for owner details and approval gating
ALTER TABLE businesses 
ADD COLUMN owner_name TEXT,
ADD COLUMN owner_phone TEXT,
ADD COLUMN owner_email TEXT UNIQUE,
ADD COLUMN status TEXT DEFAULT 'pending';

-- 2. Update existing records so the app doesn't break
-- Assume the default "StyleCraft India" is already approved and active
UPDATE businesses
SET status = 'active', 
    owner_email = 'admin@stylecraft.com', 
    owner_name = 'Admin' 
WHERE name = 'StyleCraft India';
