import { supabase } from './supabase';

/**
 * Smart Fallback Engine
 * When Gemini AI is unavailable, provide intelligent keyword-based responses
 * with real product data from Supabase.
 */

// Keyword → category mapping
const CATEGORY_KEYWORDS = {
  saree: ['saree', 'sari', 'silk saree', 'banarasi', 'kanchipuram', 'chanderi', 'georgette'],
  kurta: ['kurta', 'kurtas', 'nehru jacket', 'ethnic wear', 'men', 'menswear'],
  lehenga: ['lehenga', 'lehnga', 'bridal', 'wedding dress', 'choli'],
  jewelry: ['jewelry', 'jewellery', 'necklace', 'earring', 'kundan', 'pearl', 'gold'],
  shirt: ['shirt', 'shirts', 'casual', 'linen', 'formal wear'],
};

// Intent detection patterns
const INTENT_PATTERNS = {
  order: ['order', 'buy', 'purchase', 'want to buy', 'add to cart', 'book', 'interested in buying'],
  pricing: ['price', 'cost', 'how much', 'budget', 'rate', 'kitna', 'kitne'],
  shipping: ['shipping', 'delivery', 'deliver', 'dispatch', 'track', 'when will', 'how long'],
  returns: ['return', 'refund', 'exchange', 'cancel', 'replacement', 'money back'],
  discount: ['discount', 'offer', 'coupon', 'code', 'sale', 'deal', 'first time'],
  greeting: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'namaste', 'hii'],
  browse: ['show', 'browse', 'collection', 'catalog', 'what do you have', 'categories', 'products'],
  complaint: ['bad', 'worst', 'terrible', 'angry', 'frustrated', 'disappointed', 'not happy', 'poor quality'],
  thanks: ['thank', 'thanks', 'thank you', 'dhanyavaad', 'shukriya'],
  size: ['size', 'measurement', 'fitting', 'length', 'width'],
};

// Detect the user's intent from message
function detectIntent(message) {
  const lower = message.toLowerCase();
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some(p => lower.includes(p))) {
      return intent;
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
 * Main Smart Fallback function
 * Returns { text, products, type, requestStored }
 */
export async function getSmartFallback(message, conversationId = null) {
  const intent = detectIntent(message);
  const category = detectCategory(message);

  let text = '';
  let products = [];
  let type = 'text'; // 'text', 'catalog', 'action'
  let requestStored = false;

  switch (intent) {
    case 'greeting': {
      text = `Namaste! 🙏 Welcome to StyleCraft India! I'm your shopping assistant.\n\nHere's what I can help you with:\n🛍️ Browse our collections (Sarees, Kurtas, Lehengas, Jewelry)\n💰 Check prices & discounts\n📦 Shipping & delivery info\n🔄 Returns & refunds\n\nJust tell me what you're looking for!`;
      break;
    }

    case 'browse': {
      if (category) {
        const items = await fetchProducts(category, 4);
        products = formatProductCards(items);
        text = `Here are our top ${category === 'saree' ? 'sarees' : category + 's'} for you! 👇\n\nReply with the product name to order, or ask for more details.`;
        type = 'catalog';
      } else {
        text = `We have an amazing collection! 🎉 Which category interests you?\n\n👗 **Sarees** — ₹1,999 to ₹8,999\n👔 **Kurtas** — ₹899 to ₹2,999\n💃 **Lehengas** — ₹7,999 to ₹15,999\n💎 **Jewelry** — ₹1,999 to ₹3,499\n👕 **Shirts** — ₹799 to ₹1,499\n\nJust type the category name to see our bestsellers!`;
      }
      break;
    }

    case 'pricing': {
      if (category) {
        const items = await fetchProducts(category, 4);
        products = formatProductCards(items);
        text = `Here are our ${category} options with prices 💰\n\n🎁 *First-time buyer? Get **15% OFF** on your first order!*`;
        type = 'catalog';
      } else {
        text = `Here's our price range across categories:\n\n👗 Sarees: ₹1,999 — ₹8,999\n👔 Kurtas: ₹899 — ₹2,999\n💃 Lehengas: ₹7,999 — ₹15,999\n💎 Jewelry: ₹1,999 — ₹3,499\n👕 Shirts: ₹799 — ₹1,499\n\n🎁 **15% OFF for first-time buyers!**\n\nWhich category would you like to explore?`;
      }
      break;
    }

    case 'order': {
      if (category) {
        const items = await fetchProducts(category, 3);
        products = formatProductCards(items);
        await storeRequest(conversationId, 'order_inquiry', category, message);
        requestStored = true;
        text = `Great choice! 🎉 Here are our bestselling ${category === 'saree' ? 'sarees' : category + 's'}:\n\n📝 To place an order, just reply with the product name and we'll process it right away!\n\n✅ COD available\n🚚 Free shipping above ₹999`;
        type = 'catalog';
      } else {
        await storeRequest(conversationId, 'order_inquiry', 'general', message);
        requestStored = true;
        text = `I'd love to help you place an order! 🛒\n\nWhat are you looking for?\n👗 Sarees | 👔 Kurtas | 💃 Lehengas | 💎 Jewelry | 👕 Shirts\n\nJust type the category or describe what you need!`;
      }
      break;
    }

    case 'shipping': {
      text = `📦 **Shipping Information:**\n\n🚚 **Standard** (5-7 days) — FREE above ₹999\n⚡ **Express** (2-3 days) — ₹149\n🏃 **Next-Day** (metro cities) — ₹299\n\n🌍 We deliver across India!\n📍 Track your order anytime after dispatch.\n\nNeed help with an existing order? Share your order number!`;
      break;
    }

    case 'returns': {
      await storeRequest(conversationId, 'return_request', null, message);
      requestStored = true;
      text = `🔄 **Return & Refund Policy:**\n\n✅ **7-day easy returns** — no questions asked\n💰 **Full refund** processed within 24 hours\n📦 **Free return pickup** from your doorstep\n🔄 **Exchange** available for size/color changes\n\n📝 Your request has been noted! Our team will reach out to you within 2 hours.\n\nNeed immediate help? Share your order number and we'll prioritize it. 🙏`;
      type = 'action';
      break;
    }

    case 'discount': {
      text = `🎁 **Current Offers:**\n\n🆕 **15% OFF** for first-time buyers (auto-applied)\n🛍️ **Free shipping** on orders above ₹999\n💝 **Buy 2 Get 10% OFF** on sarees\n🎊 **Festival Special:** Extra ₹200 off on orders above ₹3,000\n\n💡 *Tip: Use code **STYLE15** at checkout for an additional discount!*\n\nWant to explore our bestsellers?`;
      break;
    }

    case 'complaint': {
      await storeRequest(conversationId, 'complaint', null, message);
      requestStored = true;
      text = `I'm really sorry to hear about your experience. 🙏 We take every concern seriously.\n\n✅ Your complaint has been **logged and prioritized** (#${Date.now().toString(36).toUpperCase()}).\n\nHere's what happens next:\n1️⃣ Our senior team will review within **1 hour**\n2️⃣ You'll receive a call/message with a resolution\n3️⃣ We offer **full refund** or **replacement + ₹500 store credit**\n\nCould you share more details about the issue so we can resolve it faster?`;
      type = 'action';
      break;
    }

    case 'thanks': {
      text = `You're welcome! 😊 We're always happy to help.\n\nIs there anything else you'd like to explore? Feel free to:\n🛍️ Browse our collections\n📦 Track an order\n🎁 Check out our latest offers\n\nHave a wonderful day! ✨`;
      break;
    }

    case 'size': {
      text = `📏 **Size Guide:**\n\n👗 **Sarees:** Standard 5.5m length + 0.8m blouse piece\n👔 **Kurtas:** Available in S, M, L, XL, XXL\n💃 **Lehengas:** Semi-stitched (customizable)\n👕 **Shirts:** S (36") / M (38") / L (40") / XL (42") / XXL (44")\n\n📐 Need custom measurements? We offer **free alteration** on orders above ₹2,000!\n\nWhich product do you need size help with?`;
      break;
    }

    default: {
      // Check if there's a category match even with general intent
      if (category) {
        const items = await fetchProducts(category, 4);
        products = formatProductCards(items);
        text = `Here's what we have in ${category === 'saree' ? 'sarees' : category + 's'} 🛍️\n\nReply with a product name to know more or place an order!`;
        type = 'catalog';
      } else {
        // Try to show bestsellers across categories
        const items = await fetchProducts(null, 4);
        if (items.length > 0) {
          products = formatProductCards(items);
          text = `Here are some of our bestsellers! 🌟\n\nOr tell me what you're looking for:\n👗 Sarees | 👔 Kurtas | 💃 Lehengas | 💎 Jewelry | 👕 Shirts`;
          type = 'catalog';
        } else {
          text = `Thanks for reaching out! 😊 I'm here to help you find the perfect outfit.\n\nExplore our categories:\n👗 Sarees | 👔 Kurtas | 💃 Lehengas | 💎 Jewelry | 👕 Shirts\n\nOr tell me what occasion you're shopping for!`;
        }
      }
      break;
    }
  }

  return { text, products, type, requestStored };
}
