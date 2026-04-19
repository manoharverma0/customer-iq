// ─────────────────────────────────────────────────────────────────────────────
// AI Reply Generation — HuggingFace Inference API
// Anti-hallucination architecture:
//   1. ALL products + prices embedded as ground truth (never rely on model memory)
//   2. Temperature 0.1 — minimal creativity, maximum accuracy
//   3. Short, tight prompt — smaller models obey short prompts, ignore long ones
//   4. Post-generation validator — catches hallucinated prices/topics
//   5. Graceful fallback if validation fails
// ─────────────────────────────────────────────────────────────────────────────

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

// Model waterfall: fastest/best first (using un-gated models for free tier)
const MODELS = [
  'meta-llama/Llama-3.2-1B-Instruct', 
  'google/gemma-2-2b-it',
  'HuggingFaceH4/zephyr-7b-beta',
];

// ─── GROUND TRUTH CATALOG ─────────────────────────────────────────────────────
// These exact prices/products are ALWAYS injected into the prompt.
// This is the single source of truth. The AI CANNOT invent prices not listed here.
// ─────────────────────────────────────────────────────────────────────────────
const GROUND_TRUTH_CATALOG = `
OUR EXACT PRODUCT LIST (use ONLY these — no other products exist):
1. Banarasi Silk Saree (Maroon)  — ₹5,299  | was ₹7,999 | 34% OFF | Wedding/festive | Free size
2. Emerald Silk Saree (Green)    — ₹4,499  | was ₹6,499 | 31% OFF | Festival/function | Free size
3. Royal Designer Kurta (Blue)   — ₹1,499  | was ₹2,299 | 35% OFF | Ethnic/wedding | Sizes: S,M,L,XL,XXL
4. Bridal Lehenga Choli (Pink)   — ₹8,999  | was ₹15,999 | 44% OFF | Bridal/engagement | Sizes: XS–XL + Custom
5. Kundan Jewelry Set            — ₹3,199  | was ₹5,499 | 42% OFF | Bridal/festive | Necklace+earrings+tikka
6. Premium Linen Shirt (Cream)   — ₹899   | was ₹1,499 | 40% OFF | Casual/summer | Sizes: S,M,L,XL,XXL

POLICIES:
- Shipping: FREE above ₹999 | 3-5 days standard | Express ₹299 (next-day)
- Returns: 7-day easy returns, no questions asked, free pickup
- Payment: UPI, Credit/Debit Card, Net Banking, Cash on Delivery (COD)
- Custom sizing available for lehengas at no extra cost
`.trim();

// ─── VALID PRICE SET (for hallucination detection) ────────────────────────────
const VALID_PRICES = new Set([5299, 7999, 4499, 6499, 1499, 2299, 8999, 15999, 3199, 5499, 899, 1499, 299, 999]);
const OFF_TOPIC_WORDS = ['bike', 'motorcycle', 'car', 'vehicle', 'laptop', 'phone', 'mobile', 'pizza', 'food', 'medicine', 'hotel'];

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────
function buildPrompt(dbSystemPrompt, retrievedProducts, businessName, buyerIntent) {

  // ── Sales tone (SHORT — 1 line per mode) ──────────────────────────────────
  const salesTone = {
    strong_buy: `Close the sale. Confirm choice, mention limited stock, ask for delivery address.`,
    soft_buy:   `Customer is interested. Recommend the BEST product with price. Offer to order.`,
    browse:     `Customer is exploring. Recommend 1-2 products, end with a question.`,
    support:    `Customer has an issue. Show empathy, state policy (7-day returns), offer fix.`,
  }[buyerIntent] || `Be helpful and recommend products.`;

  // ── Compact prompt for small models (under 600 tokens) ────────────────────
  return `You are Priya, AI sales assistant for ${businessName}.

PRODUCTS:
1. Banarasi Silk Saree (Maroon) — ₹5,299 (34% OFF)
2. Emerald Silk Saree (Green) — ₹4,499 (31% OFF)
3. Royal Designer Kurta (Blue) — ₹1,499 (35% OFF)
4. Bridal Lehenga Choli (Pink) — ₹8,999 (44% OFF)
5. Kundan Jewelry Set — ₹3,199 (42% OFF)
6. Premium Linen Shirt (Cream) — ₹899 (40% OFF)

Shipping: FREE above ₹999. Returns: 7-day easy returns. Payment: UPI/COD/Card.

TASK: ${salesTone}
RULES: Only discuss these 6 products. Use exact prices. Keep reply under 4 sentences. Be warm and helpful. Use 1-2 emojis.`;
}

// ─── HALLUCINATION VALIDATOR ──────────────────────────────────────────────────
function validateResponse(text, message) {
  if (!text) return false;

  const lower = text.toLowerCase();
  const msgLower = message.toLowerCase();

  // Check 1: Off-topic product category
  for (const word of OFF_TOPIC_WORDS) {
    if (lower.includes(word) && !msgLower.includes(word)) {
      console.warn(`🚨 Hallucination detected: off-topic word "${word}" in response`);
      return false;
    }
  }

  // Check 2: Suspicious price mentions (extract numbers > 100 from response)
  const priceMatches = text.match(/₹\s*(\d{2,6})/g) || [];
  for (const match of priceMatches) {
    const num = parseInt(match.replace(/[₹,\s]/g, ''));
    if (num > 100 && !VALID_PRICES.has(num)) {
      console.warn(`🚨 Hallucination detected: invented price ₹${num} in response`);
      return false;
    }
  }

  // Check 3: Response must not be empty or too short
  if (text.trim().length < 20) return false;

  return true;
}

// ─── SAFE FALLBACK (when AI fails or hallucinates) ────────────────────────────
function getSafeFallback(message, buyerIntent) {
  const lower = message.toLowerCase();

  // Saree
  if (/saree|sari|banarasi|silk/i.test(lower)) {
    return `We have two gorgeous silk sarees right now:\n\n` +
      `1. 👗 Banarasi Silk Saree (Maroon) — ₹5,299 (was ₹7,999) | Perfect for weddings\n` +
      `2. 👗 Emerald Silk Saree (Green) — ₹4,499 (was ₹6,499) | Great for festivals\n\n` +
      `Both come with matching blouse piece and free shipping! Which appeals to you? 😊`;
  }
  // Lehenga / bridal
  if (/lehenga|bridal|bride|wedding dress|choli/i.test(lower)) {
    return `Our Bridal Lehenga Choli (Pink) is stunning! 💃\n\n` +
      `💰 ₹8,999 (was ₹15,999 — 44% OFF)\n` +
      `✨ Zardozi + mirror embroidery, full bridal set with dupatta\n` +
      `📐 Custom sizing available\n\n` +
      `For a bridal piece at this price, it's unbeatable value! Shall I share full details? 😊`;
  }
  // Kurta
  if (/kurta|kurtas|ethnic wear/i.test(lower)) {
    return `Our Royal Designer Kurta (Blue) is a bestseller!\n\n` +
      `💰 ₹1,499 (was ₹2,299 — 35% OFF)\n` +
      `✨ Hand-embroidered collar, cotton-silk blend\n` +
      `📐 Sizes: S, M, L, XL, XXL\n\n` +
      `Perfect for weddings, pujas, and festivals! Want to order one? 😊`;
  }
  // Jewelry
  if (/jewelry|jewellery|necklace|kundan|earring/i.test(lower)) {
    return `Our Kundan Jewelry Set is perfect! 💎\n\n` +
      `💰 ₹3,199 (was ₹5,499 — 42% OFF)\n` +
      `✨ Full bridal set: necklace + earrings + maang tikka\n` +
      `Complements our lehengas and sarees beautifully!\n\n` +
      `Interested in ordering? 😊`;
  }
  // Shirt
  if (/shirt|linen|casual/i.test(lower)) {
    return `Our Premium Linen Shirt (Cream) is perfect for summer!\n\n` +
      `💰 ₹899 (was ₹1,499 — 40% OFF)\n` +
      `✨ Pure linen, breathable, slim fit\n` +
      `📐 Sizes: S, M, L, XL, XXL\n\n` +
      `Want one? You can order right here! 😊`;
  }
  // Price / budget
  if (/price|budget|how much|kitna|cost/i.test(lower)) {
    return `Here's our full price list:\n\n` +
      `👗 Banarasi Silk Saree — ₹5,299\n` +
      `👗 Emerald Silk Saree — ₹4,499\n` +
      `👔 Designer Kurta (Blue) — ₹1,499\n` +
      `💃 Bridal Lehenga Choli — ₹8,999\n` +
      `💎 Kundan Jewelry Set — ₹3,199\n` +
      `👕 Linen Shirt (Cream) — ₹899\n\n` +
      `All have 30–44% discount! Which interests you? 😊`;
  }
  // Greeting
  if (/hi|hello|hey|namaste/i.test(lower)) {
    return `Namaste! 🙏 Welcome to StyleCraft India!\n\n` +
      `I'm Priya, your personal fashion assistant. We have beautiful ethnic wear:\n` +
      `👗 Silk Sarees | 💃 Bridal Lehengas | 👔 Kurtas | 💎 Jewelry | 👕 Shirts\n\n` +
      `What occasion are you shopping for? 😊`;
  }

  return `Namaste! 🙏 I'm Priya from StyleCraft India. I can help you with:\n\n` +
    `👗 Silk Sarees (₹4,499–₹5,299) | 💃 Lehengas (₹8,999) | 👔 Kurtas (₹1,499)\n` +
    `💎 Jewelry Sets (₹3,199) | 👕 Linen Shirts (₹899)\n\n` +
    `What are you looking for today? 😊`;
}

import Bytez from "bytez.js";

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────
export async function generateAIReply(
  message,
  conversationHistory = [],
  dbSystemPrompt = null,
  retrievedProducts = [],
  businessName = 'StyleCraft India',
  buyerIntent = 'browse'
) {
  const bytezKey = process.env.BYTEZ_KEY;
  const hfToken = process.env.HF_TOKEN;

  const systemPrompt = buildPrompt(dbSystemPrompt, retrievedProducts, businessName, buyerIntent);

  // Normalize history roles: DB stores 'customer'/'ai', HF expects 'user'/'assistant'
  const normalizedHistory = conversationHistory.slice(-6).map(m => ({
    role: m.role === 'customer' ? 'user' : (m.role === 'ai' ? 'assistant' : m.role),
    content: (m.content || '').slice(0, 300), // Trim long messages to keep prompt small
  }));

  const messages = [
    { role: 'user', content: systemPrompt + '\n\nCustomer says: ' + message },
  ];

  // Try Bytez (GPT-4.1) First
  if (bytezKey) {
    try {
      const sdk = new Bytez(bytezKey);
      const model = sdk.model("openai/gpt-4.1");
      
      const { error, output } = await model.run(messages);
      
      if (error) {
        console.warn('❌ Bytez failed:', error);
      } else if (output) {
        const reply = typeof output === 'string' ? output.trim() : (output[0]?.text || '').trim();
        if (reply && validateResponse(reply, message)) {
          console.log(`✅ Bytez AI [openai/gpt-4.1] intent:${buyerIntent} len:${reply.length}`);
          return reply;
        } else {
          console.warn(`⚠️ Hallucination detected in Bytez response or empty string.`);
        }
      }
    } catch (err) {
      console.warn(`❌ Bytez API Error:`, err.message?.slice(0, 80));
    }
  }

  // Fallback to HuggingFace Models if Bytez fails or key is missing
  if (hfToken) {
    try {
      const { HfInference } = require('@huggingface/inference');
      const hf = new HfInference(hfToken);
      
      for (const model of MODELS) {
        try {
          // Race against a 8-second timeout (Vercel hobby = 10s max)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('HF timeout after 8s')), 8000)
          );

          const apiPromise = hf.chatCompletion({
            model,
            messages,
            max_tokens: 200,
            temperature: 0.3,
          });

          const out = await Promise.race([apiPromise, timeoutPromise]);

          const reply = out.choices?.[0]?.message?.content?.trim();
          if (!reply) throw new Error('Empty reply from model');

          // ── Validate: did the model hallucinate? ──────────────────────────────
          if (!validateResponse(reply, message)) {
            console.warn(`⚠️ Hallucination detected in [${model.split('/')[1]}] response — skipping to next`);
            continue;
          }

          console.log(`✅ AI [${model.split('/')[1]}] intent:${buyerIntent} len:${reply.length}`);
          return reply;

        } catch (err) {
          console.warn(`❌ ${model.split('/')[1]} failed:`, err.message?.slice(0, 80));
        }
      }
    } catch (sdkErr) {
      console.warn(`❌ Failed to init HF SDK:`, sdkErr.message);
    }
  } else {
    console.warn('Neither BYTEZ_KEY nor HF_TOKEN is set.');
  }

  // All models failed — use safe deterministic fallback
  console.warn('⚠️ All models failed — using safe fallback');
  return getSafeFallback(message, buyerIntent);
}
