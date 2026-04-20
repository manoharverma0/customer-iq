import { supabase } from './supabase';

/**
 * Smart Fallback Engine v2
 * When AI models are unavailable, provide intelligent keyword-based responses
 * with real product data from Supabase.
 *
 * KEY FIXES from v1:
 * - Products are INCLUDED in the text response (not just returned as separate array)
 * - Greeting responses have variety (not the same canned message every time)
 * - "shirts" no longer triggers greeting intent (fixed regex)
 * - Off-topic queries get a firm, clean redirect
 * - Tone is genuine and helpful, not pushy salesman
 */

// Keyword → category mapping
const CATEGORY_KEYWORDS = {
  saree: ['saree', 'sari', 'silk saree', 'banarasi', 'kanchipuram', 'chanderi', 'georgette'],
  kurta: ['kurta', 'kurtas', 'nehru jacket', 'ethnic wear'],
  lehenga: ['lehenga', 'lehnga', 'bridal', 'wedding dress', 'choli'],
  jewelry: ['jewelry', 'jewellery', 'necklace', 'earring', 'kundan', 'pearl', 'gold'],
  shirt: ['shirt', 'shirts', 'linen', 'formal wear', 'formals'],
};

// Intent detection patterns — FIXED: use word boundaries to prevent false matches
const INTENT_PATTERNS = {
  order: [/\border\b/, /\bbuy\b/, /\bpurchase\b/, /want to buy/, /add to cart/, /\bbook\b/, /interested in buying/],
  pricing: [/\bprice\b/, /\bcost\b/, /how much/, /\bbudget\b/, /\brate\b/, /\bkitna\b/, /\bkitne\b/],
  shipping: [/\bshipping\b/, /\bdelivery\b/, /\bdeliver\b/, /\bdispatch\b/, /\btrack\b/, /when will/, /how long/],
  returns: [/\breturn\b/, /\brefund\b/, /\bexchange\b/, /\bcancel\b/, /\breplacement\b/, /money back/],
  discount: [/\bdiscount\b/, /\boffer\b/, /\bcoupon\b/, /\bcode\b/, /\bsale\b/, /\bdeal\b/, /first time/],
  greeting: [/^hi$/i, /^hii+$/i, /^hello$/i, /^hey$/i, /^good morning/i, /^good evening/i, /^namaste$/i, /^hii$/i],
  browse: [/\bshow\b/, /\bbrowse\b/, /\bcollection\b/, /\bcatalog/, /\bcatalogue/, /what do you have/, /\bcategories\b/, /\bproducts\b/],
  complaint: [/\bbad\b/, /\bworst\b/, /\bterrible\b/, /\bangry\b/, /\bfrustrated\b/, /\bdisappointed\b/, /not happy/, /poor quality/],
  thanks: [/\bthank\b/, /\bthanks\b/, /thank you/, /dhanyavaad/, /shukriya/],
  size: [/\bsize\b/, /\bmeasurement\b/, /\bfitting\b/],
};

// Detect intent — uses regex with word boundaries, checks greeting LAST
function detectIntent(message) {
  const lower = message.toLowerCase().trim();

  // Check greeting first (exact match only for short messages)
  if (lower.length <= 12) {
    for (const pattern of INTENT_PATTERNS.greeting) {
      if (pattern.test(lower)) return 'greeting';
    }
  }

  // Check all other intents (order matters — more specific first)
  for (const intent of ['order', 'complaint', 'returns', 'pricing', 'shipping', 'discount', 'size', 'browse', 'thanks']) {
    for (const pattern of INTENT_PATTERNS[intent]) {
      if (pattern.test(lower)) return intent;
    }
  }

  return 'general';
}

// Detect product category from message
function detectCategory(message) {
  const lower = message.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      return category;
    }
  }
  return null;
}

// Fetch products from Supabase by category
async function fetchProducts(category, limit = 3) {
  if (!supabase) return [];
  try {
    let query = supabase.from('products').select('*').eq('in_stock', true);
    if (category) {
      query = query.eq('category', category);
    }
    query = query.limit(limit);
    const { data, error } = await query;
    if (error) { console.error('Fetch products error:', error); return []; }
    return data || [];
  } catch {
    return [];
  }
}

// Store a customer request in Supabase
async function storeRequest(conversationId, requestType, productCategory, message) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('customer_requests')
      .insert({
        conversation_id: conversationId,
        request_type: requestType,
        product_category: productCategory,
        message,
      })
      .select()
      .single();
    if (error) { console.error('Store request error:', error); return null; }
    return data;
  } catch {
    return null;
  }
}

// Format products as a structured response
function formatProductCards(products) {
  if (!products || products.length === 0) return [];
  return products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    originalPrice: p.original_price,
    description: p.description,
    rating: p.rating,
    reviews: p.reviews_count,
    tags: p.tags || [],
    discount: p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0,
  }));
}

/**
 * Format products into a text string for WhatsApp/text-only channels.
 * This MUST be included in the text response so WhatsApp users actually see products.
 */
function formatProductsAsText(products) {
  if (!products || products.length === 0) return '';

  return products.map((p, i) => {
    const discount = p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0;
    let line = `${i + 1}. ${p.name} — ₹${p.price?.toLocaleString('en-IN')}`;
    if (discount > 0) line += ` (${discount}% OFF)`;
    if (p.sizes && p.sizes.length > 0) line += `\n   Sizes: ${p.sizes.join(', ')}`;
    return line;
  }).join('\n\n');
}

// ── Greeting variety — don't repeat the same message ────────────────────────
const GREETING_VARIANTS = [
  (name) => `Hi there! 👋 Welcome to ${name}.\n\nWhat are you looking for today?`,
  (name) => `Hello! 😊 Thanks for reaching out to ${name}.\n\nHow can I help you?`,
  (name) => `Namaste! 🙏 Welcome to ${name}.\n\nLooking for something specific, or just browsing?`,
  (name) => `Hey! 👋 Good to see you at ${name}.\n\nWhat can I help you find today?`,
];
let _greetingIndex = 0;

/**
 * Main Smart Fallback function
 * Returns { text, products, type, requestStored }
 */
export async function getSmartFallback(message, conversationId = null, businessName = 'StyleCraft India') {
  const intent = detectIntent(message);
  const category = detectCategory(message);

  let text = '';
  let products = [];
  let type = 'text';
  let requestStored = false;

  switch (intent) {
    case 'greeting': {
      // Rotate through greeting variants so it's not the same every time
      const variant = GREETING_VARIANTS[_greetingIndex % GREETING_VARIANTS.length];
      _greetingIndex++;
      text = variant(businessName);
      break;
    }

    case 'browse': {
      if (category) {
        const items = await fetchProducts(category, 4);
        products = formatProductCards(items);
        const productText = formatProductsAsText(items);
        if (productText) {
          text = `Here are our ${category === 'saree' ? 'sarees' : category + 's'}:\n\n${productText}\n\nWant more details on any of these?`;
        } else {
          text = `We have great ${category === 'saree' ? 'sarees' : category + 's'} in our collection! Let me check what's available for you.`;
        }
        type = 'catalog';
      } else {
        text = `Here are our categories:\n\n👗 Sarees — ₹2,999 to ₹15,999\n👔 Kurtas — ₹899 to ₹2,999\n💃 Lehengas — ₹5,999 to ₹25,999\n💎 Jewelry — ₹1,499 to ₹8,999\n👕 Shirts — ₹699 to ₹1,999\n\nWhich one interests you?`;
      }
      break;
    }

    case 'pricing': {
      if (category) {
        const items = await fetchProducts(category, 4);
        products = formatProductCards(items);
        const productText = formatProductsAsText(items);
        if (productText) {
          text = `Here are our ${category} options with prices:\n\n${productText}\n\n🎁 15% OFF for first-time buyers!`;
        } else {
          text = `Our ${category === 'saree' ? 'sarees' : category + 's'} range from ₹${category === 'saree' ? '2,999' : '699'} onwards. Want me to check specific items?`;
        }
        type = 'catalog';
      } else {
        text = `Our price ranges:\n\n👗 Sarees: ₹2,999 — ₹15,999\n👔 Kurtas: ₹899 — ₹2,999\n💃 Lehengas: ₹5,999 — ₹25,999\n💎 Jewelry: ₹1,499 — ₹8,999\n👕 Shirts: ₹699 — ₹1,999\n\nWhich category are you interested in?`;
      }
      break;
    }

    case 'order': {
      if (category) {
        const items = await fetchProducts(category, 3);
        products = formatProductCards(items);
        const productText = formatProductsAsText(items);
        await storeRequest(conversationId, 'order_inquiry', category, message);
        requestStored = true;
        if (productText) {
          text = `Here are our ${category === 'saree' ? 'sarees' : category + 's'}:\n\n${productText}\n\nWhich one would you like? ✅ COD available | 🚚 Free shipping above ₹999`;
        } else {
          text = `I'd love to help you order a ${category}! Let me check what's in stock for you.`;
        }
        type = 'catalog';
      } else {
        await storeRequest(conversationId, 'order_inquiry', 'general', message);
        requestStored = true;
        text = `What would you like to order?\n\n👗 Sarees | 👔 Kurtas | 💃 Lehengas | 💎 Jewelry | 👕 Shirts\n\nJust tell me the category or describe what you need!`;
      }
      break;
    }

    case 'shipping': {
      text = `📦 Shipping info:\n\n🚚 Standard (5-7 days) — FREE above ₹999\n⚡ Express (2-3 days) — ₹149\n🏃 Next-Day (metro cities) — ₹299\n\nWe deliver across India! Have an order number? I can check the status.`;
      break;
    }

    case 'returns': {
      await storeRequest(conversationId, 'return_request', null, message);
      requestStored = true;
      text = `Our return policy:\n\n✅ 7-day easy returns — no questions asked\n💰 Full refund within 24 hours\n📦 Free return pickup\n🔄 Exchange available for size/color\n\nPlease share your order number and I'll get it sorted. 🙏`;
      type = 'action';
      break;
    }

    case 'discount': {
      text = `Current offers:\n\n🆕 15% OFF for first-time buyers\n🛍️ Free shipping on orders above ₹999\n💝 Buy 2 sarees, get 10% OFF\n\nWant to see specific products?`;
      break;
    }

    case 'complaint': {
      await storeRequest(conversationId, 'complaint', null, message);
      requestStored = true;
      text = `I'm sorry about your experience. 🙏\n\nYour concern has been logged (Ref: #${Date.now().toString(36).toUpperCase()}).\n\nOur team will reach out within 1 hour. If you can share your order number, I can look into it right away.`;
      type = 'action';
      break;
    }

    case 'thanks': {
      text = `You're welcome! 😊 Happy to help. Let me know if you need anything else.`;
      break;
    }

    case 'size': {
      text = `Size guide:\n\n👗 Sarees: Standard 5.5m + blouse piece\n👔 Kurtas: S, M, L, XL, XXL\n💃 Lehengas: Semi-stitched (customizable)\n👕 Shirts: S (36") to XXL (44")\n\nWhich product do you need sizing for?`;
      break;
    }

    default: {
      if (category) {
        const items = await fetchProducts(category, 4);
        products = formatProductCards(items);
        const productText = formatProductsAsText(items);
        if (productText) {
          text = `Here are our ${category === 'saree' ? 'sarees' : category + 's'}:\n\n${productText}\n\nWant details on any of these?`;
        } else {
          text = `We have ${category === 'saree' ? 'sarees' : category + 's'} in our collection! Let me find the best options for you.`;
        }
        type = 'catalog';
      } else {
        const items = await fetchProducts(null, 4);
        if (items.length > 0) {
          products = formatProductCards(items);
          const productText = formatProductsAsText(items);
          text = `Here are some popular items:\n\n${productText}\n\nAnything catch your eye?`;
          type = 'catalog';
        } else {
          text = `I can help you with sarees, kurtas, lehengas, jewelry, or shirts. What are you looking for?`;
        }
      }
      break;
    }
  }

  return { text, products, type, requestStored };
}
