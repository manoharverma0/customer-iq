import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embeddings';

// ─── Product definitions (will be embedded & stored in Supabase) ─────────────
const STYLECRAFT_PRODUCTS = [
  {
    name: 'Banarasi Silk Saree — Maroon',
    description: 'Pure Banarasi silk saree in deep maroon with intricate gold zari weave and traditional motifs. Perfect for weddings, receptions, and festive occasions. Comes with matching blouse piece. Rich texture with real gold threads.',
    category: 'saree',
    price: 5299,
    original_price: 7999,
    discount: 34,
    tags: ['silk', 'wedding', 'zari border', 'blouse included', 'festive', 'bridal', 'traditional', 'maroon', 'Banarasi'],
    sizes: ['Free Size (5.5m)'],
    image_url: '/products/saree-maroon.png',
  },
  {
    name: 'Emerald Silk Saree — Green',
    description: 'Gorgeous emerald green silk saree with golden temple border and peacock motifs. A showstopper for festivals, functions and special occasions. Lightweight and comfortable to drape. Comes with blouse piece.',
    category: 'saree',
    price: 4499,
    original_price: 6499,
    discount: 31,
    tags: ['silk', 'festival', 'peacock motif', 'temple border', 'green', 'new arrival', 'ethnic'],
    sizes: ['Free Size (5.5m)'],
    image_url: '/products/saree-green.png',
  },
  {
    name: 'Royal Designer Kurta — Blue',
    description: 'Elegant royal blue cotton-silk kurta with hand-embroidered collar and cuffs. Complete set includes matching churidar. Ideal for pujas, weddings, celebrations and office festivals. Available in all sizes.',
    category: 'kurta',
    price: 1499,
    original_price: 2299,
    discount: 35,
    tags: ['kurta', 'cotton-silk', 'embroidered', 'churidar set', 'festive', 'blue', 'mens', 'ethnic wear'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    image_url: '/products/kurta-blue.png',
  },
  {
    name: 'Bridal Lehenga Choli — Pink',
    description: 'Breathtaking bridal lehenga in blush pink with heavy zardozi and mirror embroidery. Full bridal set with lehenga, matching choli and dupatta. Custom sizing available. Perfect for wedding and engagement ceremonies.',
    category: 'lehenga',
    price: 8999,
    original_price: 15999,
    discount: 44,
    tags: ['bridal', 'lehenga', 'zardozi', 'mirror work', 'dupatta included', 'pink', 'wedding', 'engagement', 'luxury'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'Custom'],
    image_url: '/products/lehenga-pink.png',
  },
  {
    name: 'Kundan Jewelry Set',
    description: 'Exquisite full bridal jewelry set with Kundan necklace, matching earrings and maang tikka. Set with colorful gemstones and polki diamonds. Complements any bridal or festive look. Comes in premium velvet box.',
    category: 'jewelry',
    price: 3199,
    original_price: 5499,
    discount: 42,
    tags: ['kundan', 'polki', 'bridal set', 'earrings', 'maang tikka', 'necklace', 'jewelry', 'gemstone', 'festive accessories'],
    sizes: ['One Size'],
    image_url: '/products/jewelry-kundan.png',
  },
  {
    name: 'Premium Linen Shirt — Cream',
    description: 'Premium pure linen casual shirt in off-white cream. Ultra breathable fabric perfect for summer and everyday wear. Minimal elegant design with premium mother-of-pearl buttons. Slim fit, machine washable.',
    category: 'shirt',
    price: 899,
    original_price: 1499,
    discount: 40,
    tags: ['linen', 'casual', 'breathable', 'summer', 'cream', 'shirt', 'slim fit', 'mens wear', 'eco fabric'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    image_url: '/products/shirt-cream.png',
  },
];

// POST /api/seed-products — inserts or updates all products with fresh embeddings
export async function POST(request) {
  try {
    const { secret } = await request.json().catch(() => ({}));
    // Basic auth
    if (secret !== (process.env.SEED_SECRET || 'stylecraft-seed-2026')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not connected' }, { status: 503 });
    }

    // Get the StyleCraft business ID
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_email', 'admin@stylecraft.com')
      .single();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'StyleCraft business not found in DB', details: bizErr?.message }, { status: 404 });
    }

    const businessId = business.id;
    const results = [];

    for (const product of STYLECRAFT_PRODUCTS) {
      // Build embedding text: name + description + tags + category
      const embeddingText = [
        product.name,
        product.description,
        product.category,
        product.tags.join(', '),
      ].join('. ');

      console.log(`Generating embedding for: ${product.name}`);
      const embedding = await generateEmbedding(embeddingText);

      if (!embedding) {
        results.push({ name: product.name, status: 'embedding_failed' });
        continue;
      }

      // Upsert product
      const { error } = await supabase
        .from('products')
        .upsert(
          {
            business_id: businessId,
            name: product.name,
            description: product.description,
            category: product.category,
            price: product.price,
            original_price: product.original_price,
            discount: product.discount,
            tags: product.tags,
            sizes: product.sizes,
            image_url: product.image_url,
            in_stock: true,
            embedding,
          },
          { onConflict: 'name,business_id' }
        );

      results.push({
        name: product.name,
        status: error ? `error: ${error.message}` : 'seeded ✅',
        embeddingDim: embedding.length,
      });
    }

    return NextResponse.json({
      ok: true,
      businessId,
      productsSeeded: results.filter(r => r.status === 'seeded ✅').length,
      results,
    });
  } catch (err) {
    console.error('Seed products error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — just returns current products (for verification)
export async function GET() {
  if (!supabase) return NextResponse.json({ products: [] });
  const { data } = await supabase
    .from('products')
    .select('id, name, category, price, in_stock, embedding')
    .limit(20);
  return NextResponse.json({
    products: (data || []).map(p => ({
      ...p,
      hasEmbedding: !!p.embedding,
      embedding: undefined, // don't return vector
    })),
  });
}
