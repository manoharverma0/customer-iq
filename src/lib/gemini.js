// ─────────────────────────────────────────────────────────────────────────────
// AI Reply Generation — Production-Grade Architecture
// Anti-hallucination + Token-Efficient Design:
//   1. Dynamic product/FAQ context from pgvector (not hardcoded)
//   2. Rolling conversation summary (~150 tokens, not 2000+)
//   3. Price ranges from DB pricing table (never hallucinate)
//   4. Booking slot awareness (agentic actions)
//   5. Post-generation validator using dynamic price ranges
//   6. Graceful fallback if validation fails
//
// LLM Priority:
//   1. Groq (Llama 3.3 70B) — ultra-fast, free tier, primary
//   2. HuggingFace Inference API — fallback
//   3. Deterministic safe fallback — last resort
// ─────────────────────────────────────────────────────────────────────────────

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

// HuggingFace fallback models
const HF_MODELS = [
  'meta-llama/Llama-3.2-1B-Instruct',
  'google/gemma-2-2b-it',
  'HuggingFaceH4/zephyr-7b-beta',
];

// Groq API config
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

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
    strong_buy: `Customer wants to order/buy. Confirm the product they want from PRODUCT DATA, state the price, then ask for: 1) Size (S/M/L/XL/XXL), 2) Color preference, 3) Delivery address or pin code. Guide them step by step. Mention COD is available and shipping is free above ₹999.`,
    soft_buy:   `Customer is interested. Share the relevant product from PRODUCT DATA with the exact price. Ask if they'd like to order — mention COD available and free shipping above ₹999.`,
    browse:     `Customer is exploring or asked to see the collection. List the available products from PRODUCT DATA below with names and prices. If no specific category was mentioned, show a sample of what's available.`,
    support:    `Customer needs help. Be empathetic, give a clear answer, offer to help further.`,
  }[buyerIntent] || `Answer the customer's question naturally. Be helpful.`;

  // ── Build dynamic product section ─────────────────────────────────────────
  let productSection = '';
  if (retrievedProducts && retrievedProducts.length > 0) {
    productSection = 'PRODUCT DATA (show these to the customer with names and prices):\n' +
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
- When showing products, use the PRODUCT DATA above. Include the product name and price. If the customer asked for a specific category, show only that category. If they asked vaguely ("collection", "show me", "what do you have"), show a sample of what's available.
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


// ─── GROQ API CALL ───────────────────────────────────────────────────────────
async function callGroq(messages, maxTokens = 250, temperature = 0.3) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API ${response.status}: ${errText.slice(0, 150)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}


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

  // Build messages array with system prompt + conversation history + current message
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // Add recent conversation history for multi-turn context
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-6)) {
      messages.push({
        role: msg.role === 'user' || msg.role === 'customer' ? 'user' : 'assistant',
        content: msg.content.slice(0, 500),
      });
    }
  }

  // Add the current customer message
  messages.push({ role: 'user', content: message });

  // ─── PRIORITY 1: Groq (Llama 3.3 70B — ultra-fast, high quality) ─────────
  if (process.env.GROQ_API_KEY) {
    try {
      const reply = await callGroq(messages, 250, 0.3);
      if (reply && validateResponse(reply, message, retrievedProducts, pricingRows)) {
        console.log(`✅ Groq [${GROQ_MODEL}] intent:${buyerIntent} len:${reply.length}`);
        return reply;
      } else if (reply) {
        console.warn(`⚠️ Groq response failed hallucination check — trying fallback`);
      }
    } catch (err) {
      console.warn(`❌ Groq failed:`, err.message?.slice(0, 100));
    }
  }

  // ─── PRIORITY 2: HuggingFace Models (fallback) ───────────────────────────
  const hfToken = process.env.HF_TOKEN;
  if (hfToken) {
    try {
      const { HfInference } = require('@huggingface/inference');
      const hf = new HfInference(hfToken);

      // For HF models, use single-message format (they don't handle system role well)
      const hfMessages = [
        { role: 'user', content: systemPrompt + '\n\nCustomer says: ' + message },
      ];

      for (const model of HF_MODELS) {
        try {
          // Race against a 30-second timeout (increased from 8s for cold starts)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('HF timeout after 30s')), 30000)
          );

          const apiPromise = hf.chatCompletion({
            model,
            messages: hfMessages,
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

          console.log(`✅ HF [${model.split('/')[1]}] intent:${buyerIntent} len:${reply.length}`);
          return reply;

        } catch (err) {
          console.warn(`❌ ${model.split('/')[1]} failed:`, err.message?.slice(0, 80));
        }
      }
    } catch (sdkErr) {
      console.warn(`❌ Failed to init HF SDK:`, sdkErr.message);
    }
  } else {
    console.warn('No HF_TOKEN set — HuggingFace fallback unavailable.');
  }

  // All models failed — use safe deterministic fallback
  console.warn('⚠️ All models failed — using safe fallback');
  return getSafeFallback(message, buyerIntent, retrievedProducts, businessName);
}

// ─── LIGHTWEIGHT SUMMARY GENERATOR ───────────────────────────────────────────
// Used by conversationSummary.js for the rolling summary compression.
// Uses Groq first (fast + smart), then cheapest HF model.
export async function generateSummary(prompt) {
  const messages = [{ role: 'user', content: prompt }];

  // Try Groq first
  if (process.env.GROQ_API_KEY) {
    try {
      const reply = await callGroq(messages, 150, 0.1);
      if (reply) return reply;
    } catch (err) {
      console.warn('Groq summary failed:', err.message?.slice(0, 80));
    }
  }

  // Fallback to HuggingFace
  const hfToken = process.env.HF_TOKEN;
  if (hfToken) {
    try {
      const { HfInference } = require('@huggingface/inference');
      const hf = new HfInference(hfToken);
      const out = await Promise.race([
        hf.chatCompletion({
          model: HF_MODELS[0],
          messages,
          max_tokens: 150,
          temperature: 0.1,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]);
      return out.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.warn('HF summary failed:', err.message?.slice(0, 80));
    }
  }

  return null;
}
