-- ═══════════════════════════════════════════════════════════════
-- Seed ALL StyleCraft Products (Kurtas, Lehengas, Jewelry, Shirts)
-- Run in Supabase SQL Editor
-- These products were missing because the embedding API was down
-- during seeding. Keyword search works fine without embeddings.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  biz_id UUID;
BEGIN
  -- Get StyleCraft business ID
  SELECT id INTO biz_id FROM businesses WHERE owner_email = 'admin@stylecraft.com' LIMIT 1;
  
  IF biz_id IS NULL THEN
    RAISE EXCEPTION 'StyleCraft India business not found';
  END IF;

  -- ═══ KURTAS ═══════════════════════════════════════════════════
  INSERT INTO products (business_id, name, description, category, price, original_price, discount, tags, sizes, image_url, in_stock)
  VALUES
    (biz_id, 'Classic Cotton Kurta', 'Comfortable everyday cotton kurta in solid colors. Breathable fabric with button-down placket. Perfect for office, festivals, and daily wear.', 'kurta', 899, 1299, 31, ARRAY['cotton', 'kurta', 'daily wear', 'office', 'breathable', 'mens'], ARRAY['S', 'M', 'L', 'XL', 'XXL'], '/products/kurta-blue.png', true),
    (biz_id, 'Designer Silk Kurta', 'Premium silk-cotton blend kurta with hand-embroidered collar and mirror work. Complete set with matching churidar. Ideal for weddings and celebrations.', 'kurta', 1999, 2999, 33, ARRAY['silk', 'kurta', 'embroidered', 'churidar set', 'wedding', 'festive', 'designer', 'mens'], ARRAY['S', 'M', 'L', 'XL', 'XXL'], '/products/kurta-blue.png', true),
    (biz_id, 'Embroidered Nehru Jacket Set', 'Elegant Nehru jacket with matching kurta in royal blue. Rich Lucknowi chikan embroidery. Statement piece for any occasion.', 'kurta', 2999, 4499, 33, ARRAY['nehru jacket', 'kurta', 'chikan', 'embroidered', 'royal blue', 'luxury', 'mens', 'ethnic'], ARRAY['S', 'M', 'L', 'XL', 'XXL'], '/products/kurta-blue.png', true)
  ON CONFLICT (name, business_id) DO UPDATE SET
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    discount = EXCLUDED.discount,
    tags = EXCLUDED.tags,
    sizes = EXCLUDED.sizes,
    image_url = EXCLUDED.image_url;

  -- ═══ LEHENGAS ═════════════════════════════════════════════════
  INSERT INTO products (business_id, name, description, category, price, original_price, discount, tags, sizes, image_url, in_stock)
  VALUES
    (biz_id, 'Bridal Lehenga Choli', 'Breathtaking bridal lehenga in blush pink with heavy zardozi and mirror embroidery. Full set with lehenga, matching choli and dupatta. Custom sizing available.', 'lehenga', 15999, 25999, 38, ARRAY['bridal', 'lehenga', 'zardozi', 'mirror work', 'dupatta included', 'pink', 'wedding', 'luxury'], ARRAY['XS', 'S', 'M', 'L', 'XL', 'Custom'], '/products/lehenga-pink.png', true),
    (biz_id, 'Party Wear Lehenga', 'Elegant party wear lehenga in midnight blue with sequin and thread work. Lightweight and comfortable for long events. Includes matching choli and net dupatta.', 'lehenga', 8999, 12999, 31, ARRAY['party', 'lehenga', 'sequin', 'blue', 'festive', 'reception', 'engagement'], ARRAY['S', 'M', 'L', 'XL'], '/products/lehenga-pink.png', true),
    (biz_id, 'Festive Lehenga Set', 'Beautiful festive lehenga in deep red with golden embroidery. Perfect for Diwali, Navratri, and family celebrations. Easy to drape and move in.', 'lehenga', 5999, 8999, 33, ARRAY['festive', 'lehenga', 'red', 'golden', 'diwali', 'navratri', 'celebration'], ARRAY['S', 'M', 'L', 'XL'], '/products/lehenga-pink.png', true)
  ON CONFLICT (name, business_id) DO UPDATE SET
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    discount = EXCLUDED.discount,
    tags = EXCLUDED.tags,
    sizes = EXCLUDED.sizes,
    image_url = EXCLUDED.image_url;

  -- ═══ JEWELRY ══════════════════════════════════════════════════
  INSERT INTO products (business_id, name, description, category, price, original_price, discount, tags, sizes, image_url, in_stock)
  VALUES
    (biz_id, 'Kundan Bridal Jewelry Set', 'Exquisite full bridal set with Kundan necklace, matching earrings and maang tikka. Set with colorful gemstones. Comes in premium velvet box.', 'jewelry', 5999, 8999, 33, ARRAY['kundan', 'bridal', 'necklace', 'earrings', 'maang tikka', 'gemstone', 'gold'], ARRAY['One Size'], '/products/jewelry-kundan.png', true),
    (biz_id, 'Pearl Earrings Set', 'Elegant pearl drop earrings with gold-plated setting. Versatile design for both traditional and western outfits. Lightweight and comfortable.', 'jewelry', 1499, 2499, 40, ARRAY['pearl', 'earrings', 'gold plated', 'lightweight', 'elegant', 'daily wear'], ARRAY['One Size'], '/products/jewelry-kundan.png', true),
    (biz_id, 'Polki Choker Necklace', 'Stunning polki choker necklace with meenakari work on the reverse. Pairs beautifully with sarees and lehengas. Premium craftsmanship.', 'jewelry', 3499, 5499, 36, ARRAY['polki', 'choker', 'necklace', 'meenakari', 'traditional', 'festive'], ARRAY['One Size'], '/products/jewelry-kundan.png', true)
  ON CONFLICT (name, business_id) DO UPDATE SET
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    discount = EXCLUDED.discount,
    tags = EXCLUDED.tags,
    sizes = EXCLUDED.sizes,
    image_url = EXCLUDED.image_url;

  -- ═══ SHIRTS ═══════════════════════════════════════════════════
  INSERT INTO products (business_id, name, description, category, price, original_price, discount, tags, sizes, image_url, in_stock)
  VALUES
    (biz_id, 'Premium Linen Shirt', 'Pure linen casual shirt in off-white cream. Ultra breathable, perfect for summer. Minimal design with mother-of-pearl buttons. Slim fit.', 'shirt', 899, 1499, 40, ARRAY['linen', 'shirt', 'casual', 'breathable', 'summer', 'cream', 'slim fit'], ARRAY['S', 'M', 'L', 'XL', 'XXL'], '/products/shirt-cream.png', true),
    (biz_id, 'Formal Cotton Shirt', 'Classic formal cotton shirt in crisp white. Wrinkle-resistant fabric, perfect for office and meetings. Regular fit with premium buttons.', 'shirt', 1199, 1799, 33, ARRAY['cotton', 'shirt', 'formal', 'office', 'white', 'regular fit', 'wrinkle free'], ARRAY['S', 'M', 'L', 'XL', 'XXL'], '/products/shirt-cream.png', true),
    (biz_id, 'Festive Printed Shirt', 'Trendy printed shirt with ethnic motifs. Perfect for festivals, brunches and casual outings. Soft cotton-blend fabric.', 'shirt', 1499, 1999, 25, ARRAY['printed', 'shirt', 'festive', 'casual', 'cotton blend', 'ethnic print'], ARRAY['S', 'M', 'L', 'XL', 'XXL'], '/products/shirt-cream.png', true)
  ON CONFLICT (name, business_id) DO UPDATE SET
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    discount = EXCLUDED.discount,
    tags = EXCLUDED.tags,
    sizes = EXCLUDED.sizes,
    image_url = EXCLUDED.image_url;

  RAISE NOTICE 'All products seeded successfully ✅';
END $$;

-- Verify product counts by category
SELECT category, COUNT(*) as count, MIN(price) as min_price, MAX(price) as max_price
FROM products
WHERE business_id = (SELECT id FROM businesses WHERE owner_email = 'admin@stylecraft.com')
GROUP BY category
ORDER BY category;
