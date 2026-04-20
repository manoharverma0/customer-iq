// ─────────────────────────────────────────────────────────────────────────────
// AI Reply Generation — Production-Grade Architecture
// Anti-hallucination + Token-Efficient Design:
//   1. Dynamic product/FAQ context from pgvector (not hardcoded)
//   2. Rolling conversation summary (~150 tokens, not 2000+)
//   3. Price ranges from DB pricing table (never hallucinate)
//   4. Booking slot awareness (agentic actions)
//   5. Post-generation validator using dynamic price ranges
//   6. Graceful fallback if validation fails
// ─────────────────────────────────────────────────────────────────────────────

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

// Model waterfall: fastest/best first
const MODELS = [
  'meta-llama/Llama-3.2-1B-Instruct',
  'google/gemma-2-2b-it',
  'HuggingFaceH4/zephyr-7b-beta',
];

const OFF_TOPIC_WORDS = ['bike', 'motorcycle', 'car', 'vehicle', 'laptop', 'phone', 'mobile', 'pizza', 'food', 'medicine', 'hotel'];

// ─── DYNAMIC PROMPT BUILDER ──────────────────────────────────────────────────
function buildPrompt(
  dbSystemPrompt,
  retrievedProducts,
  retrievedKnowledge,
  pricingContext,
  bookingContext,
  conversationContext,
  businessName,
  buyerIntent
) {

  // ── Helpful tone — NOT pushy salesman ──────────────────────────────────────
  const tone = {
    strong_buy: `Customer is ready to buy. Confirm their choice, give the price, and ask what size/color they want.`,
    soft_buy:   `Customer is interested. Share the relevant product with price. Ask if they'd like to order.`,
    browse:     `Customer is exploring. Answer their question naturally. Mention 1-2 relevant products only if it fits the conversation.`,
    support:    `Customer needs help. Be empathetic, give a clear answer, offer to help further.`,
  }[buyerIntent] || `Answer the customer's question naturally. Be helpful.`;

  // ── Build dynamic product section ─────────────────────────────────────────
  let productSection = '';
  if (retrievedProducts && retrievedProducts.length > 0) {
    productSection = 'PRODUCT DATA (only mention these if customer asked about this category):\n' +
      retrievedProducts.map((p, i) =>
        `${i + 1}. ${p.name}${p.category ? ` [${p.category}]` : ''} — ₹${p.price?.toLocaleString('en-IN')}${p.original_price ? ` (was ₹${p.original_price.toLocaleString('en-IN')})` : ''}${p.discount ? ` | ${p.discount}% OFF` : ''}`
      ).join('\n');
  }

  // ── Build dynamic FAQ/knowledge section ───────────────────────────────────
  let knowledgeSection = '';
  if (retrievedKnowledge && retrievedKnowledge.length > 0) {
    knowledgeSection = 'RELEVANT INFO:\n' +
      retrievedKnowledge.map(k => `• ${k.title}: ${k.content.slice(0, 200)}`).join('\n');
  }

  // ── Compact prompt for small models ───────────────────────────────────────
  let prompt = `You are a helpful assistant for ${businessName}.`;

  if (dbSystemPrompt) {
    prompt += '\n' + dbSystemPrompt.slice(0, 300);
  }

  if (productSection) prompt += '\n\n' + productSection;
  if (pricingContext) prompt += '\n\n' + pricingContext;
  if (knowledgeSection) prompt += '\n\n' + knowledgeSection;
  if (bookingContext) prompt += '\n\n' + bookingContext;
  if (conversationContext) prompt += '\n\n' + conversationContext;

  prompt += `\n\nTASK: ${tone}`;
  prompt += `\nRULES:
- NEVER assume the customer's gender, style, preferences, or taste. You know NOTHING about them unless they told you.
- NEVER say "considering your style" or "based on your preferences" — you have no data on them.
- Only mention products from the PRODUCT DATA above that directly match what the customer asked about. If they asked for shirts, show shirts ONLY. Do not show sarees/jewelry/lehengas unless they asked.
- If the customer just said "hi" or a greeting, greet them back and ask what they're looking for. Do NOT dump product recommendations on a greeting.
- Only discuss ${businessName}'s products/services. If asked about something we don't sell (bikes, phones, food, etc.), say: "We only sell clothing and accessories, I can't help with that."
- Do NOT offer to find other shops or recommend competitors.
- Use prices from the product/pricing list. Give a price RANGE when quoting.
- Keep reply under 3 sentences. Be concise and natural.
- Don't repeat your welcome message.
- Use 1 emoji max.`;

  return prompt;
}

// ─── DYNAMIC HALLUCINATION VALIDATOR ─────────────────────────────────────────
function validateResponse(text, message, retrievedProducts = [], pricingRows = []) {
  if (!text) return false;

  const lower = text.toLowerCase();
  const msgLower = message.toLowerCase();

  // Check 1: Off-topic product category
  for (const word of OFF_TOPIC_WORDS) {
    if (lower.includes(word) && !msgLower.includes(word)) {
      console.warn(`🚨 Hallucination: off-topic word "${word}"`);
      return false;
    }
  }

  // Check 2: Dynamic price validation from retrieved products + pricing table
  const validPrices = new Set();
  for (const p of retrievedProducts) {
    if (p.price) validPrices.add(p.price);
    if (p.original_price) validPrices.add(p.original_price);
  }
  for (const p of pricingRows) {
    if (p.price_min) validPrices.add(p.price_min);
    if (p.price_max) validPrices.add(p.price_max);
  }
  // Add common non-product prices (shipping, thresholds)
  validPrices.add(999).add(299).add(199).add(149).add(200);

  const priceMatches = text.match(/₹\s*([\d,]+)/g) || [];
  for (const match of priceMatches) {
    const num = parseInt(match.replace(/[₹,\s]/g, ''));
    if (num > 100 && validPrices.size > 0) {
      // Check if price is within 20% of any known price
      let found = false;
      for (const vp of validPrices) {
        if (num >= vp * 0.8 && num <= vp * 1.2) { found = true; break; }
      }
      if (!found) {
        console.warn(`🚨 Hallucination: invented price ₹${num}`);
        return false;
      }
    }
  }

  // Check 3: Response must not be empty or too short
  if (text.trim().length < 20) return false;

  return true;
}

// ─── DYNAMIC SAFE FALLBACK ───────────────────────────────────────────────────
function getSafeFallback(message, buyerIntent, retrievedProducts = [], businessName = 'our store') {
  const lower = message.toLowerCase();

  // If we have retrieved products, build a dynamic fallback from them
  if (retrievedProducts.length > 0) {
    const productList = retrievedProducts
      .map(p => `• ${p.name} — ₹${p.price?.toLocaleString('en-IN')}${p.discount ? ` (${p.discount}% OFF)` : ''}`)
      .join('\n');

    if (buyerIntent === 'strong_buy') {
      return `Here's what we have:\n\n${productList}\n\nWhich one would you like? I can help with the order.`;
    }
    return `Here are some options:\n\n${productList}\n\nWant more details on any of these?`;
  }

  // Greeting (word boundary to avoid false positives like "shirts")
  if (/^(hi|hii+|hello|hey|namaste)\b/i.test(lower.trim())) {
    return `Hi! 👋 Welcome to ${businessName}. How can I help you today?`;
  }

  // Generic fallback
  return `Hi! I can help you with sarees, kurtas, lehengas, jewelry, and shirts at ${businessName}. What are you looking for?`;
}

import Bytez from "bytez.js";

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────
export async function generateAIReply(
  message,
  conversationHistory = [],
  dbSystemPrompt = null,
  retrievedProducts = [],
  businessName = 'StyleCraft India',
  buyerIntent = 'browse',
  // New production params:
  retrievedKnowledge = [],
  pricingContext = '',
  bookingContext = '',
  conversationContext = '',
  pricingRows = []
) {
  const bytezKey = process.env.BYTEZ_KEY;
  const hfToken = process.env.HF_TOKEN;

  const systemPrompt = buildPrompt(
    dbSystemPrompt,
    retrievedProducts,
    retrievedKnowledge,
    pricingContext,
    bookingContext,
    conversationContext,
    businessName,
    buyerIntent
  );

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
        if (reply && validateResponse(reply, message, retrievedProducts, pricingRows)) {
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

          // ── Validate: did the model hallucinate? ──────────────────────────
          if (!validateResponse(reply, message, retrievedProducts, pricingRows)) {
            console.warn(`⚠️ Hallucination detected in [${model.split('/')[1]}] response — skipping`);
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
  return getSafeFallback(message, buyerIntent, retrievedProducts, businessName);
}

// ─── LIGHTWEIGHT SUMMARY GENERATOR ───────────────────────────────────────────
// Used by conversationSummary.js for the rolling summary compression.
// Uses the cheapest/fastest model available.
export async function generateSummary(prompt) {
  const bytezKey = process.env.BYTEZ_KEY;
  const hfToken = process.env.HF_TOKEN;

  const messages = [{ role: 'user', content: prompt }];

  if (bytezKey) {
    try {
      const sdk = new Bytez(bytezKey);
      const model = sdk.model("openai/gpt-4.1");
      const { error, output } = await model.run(messages);
      if (!error && output) {
        return typeof output === 'string' ? output.trim() : (output[0]?.text || '').trim();
      }
    } catch {}
  }

  if (hfToken) {
    try {
      const { HfInference } = require('@huggingface/inference');
      const hf = new HfInference(hfToken);
      const out = await Promise.race([
        hf.chatCompletion({
          model: MODELS[0],
          messages,
          max_tokens: 150,
          temperature: 0.1,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
      ]);
      return out.choices?.[0]?.message?.content?.trim() || null;
    } catch {}
  }

  return null;
}
