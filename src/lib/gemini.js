// AI Reply Generation — HuggingFace Inference API
// Business context and product data come from Supabase (not hardcoded here)

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

// Model waterfall: try each in order until one responds
const MODELS = [
  'Qwen/Qwen2.5-72B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'HuggingFaceH4/zephyr-7b-beta',
];

/**
 * Build the full system prompt from DB data + vector-retrieved products.
 *
 * @param {string|null} dbSystemPrompt  - business.system_prompt from Supabase
 * @param {Array}       retrievedProducts - from vectorSearchProducts()
 * @param {string|null} businessName    - business.name from Supabase
 */
function buildSystemPrompt(dbSystemPrompt, retrievedProducts = [], businessName = 'StyleCraft India') {
  // ── Base: use DB system_prompt if available ────────────────────────────────
  const base = dbSystemPrompt || `
You are a helpful AI assistant for ${businessName}.
Be warm, professional, and only discuss products and services from ${businessName}.
Never discuss unrelated topics like vehicles, electronics, food, etc.
  `.trim();

  // ── Inject vector-retrieved products into prompt ───────────────────────────
  let productContext = '';
  if (retrievedProducts && retrievedProducts.length > 0) {
    productContext = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOST RELEVANT PRODUCTS FOR THIS QUERY (from semantic search):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${retrievedProducts.map((p, i) => `
${i + 1}. ${p.name}
   Category: ${p.category} | Price: ₹${p.price?.toLocaleString('en-IN')}${p.original_price ? ` (was ₹${p.original_price?.toLocaleString('en-IN')})` : ''}${p.discount > 0 ? ` | ${p.discount}% OFF` : ''}
   Description: ${p.description}
   Tags: ${p.tags?.join(', ')}
   Sizes: ${p.sizes?.join(', ')}
   Image: ${p.image_url || 'available in catalog'}
   Similarity: ${((p.similarity || 0) * 100).toFixed(0)}% match
`).join('')}
Use the above products to answer the customer's query with specific prices, descriptions and details.
ONLY mention products from this list or your general catalog — NEVER invent new ones.
If none of the above perfectly match, use your catalog knowledge to suggest the closest product.
`;
  }

  return base + productContext;
}

/**
 * Generate an AI reply using HuggingFace Inference API.
 *
 * @param {string} message              - Customer's latest message
 * @param {Array}  conversationHistory  - [{role:'user'|'assistant', content:string}] from DB
 * @param {string|null} dbSystemPrompt  - From businesses.system_prompt in Supabase
 * @param {Array}  retrievedProducts    - From vectorSearchProducts() (pgvector RAG)
 * @param {string|null} businessName    - From businesses.name in Supabase
 */
export async function generateAIReply(
  message,
  conversationHistory = [],
  dbSystemPrompt = null,
  retrievedProducts = [],
  businessName = 'StyleCraft India'
) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) throw new Error('HF_TOKEN not set');

  const systemPrompt = buildSystemPrompt(dbSystemPrompt, retrievedProducts, businessName);

  // Build chat messages array for conversational models
  const messages = [
    { role: 'system', content: systemPrompt },
    // Include last 15 messages of history (true stateful context)
    ...conversationHistory.slice(-15),
    { role: 'user', content: message },
  ];

  let lastError;

  for (const model of MODELS) {
    try {
      const response = await fetch(`${HF_API_BASE}/${model}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 512,
          temperature: 0.3,      // Low = more focused, less hallucination
          top_p: 0.9,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${response.status}: ${errText.slice(0, 120)}`);
      }

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();

      if (!reply) throw new Error('Empty reply from model');

      console.log(`✅ AI replied via ${model} | products_used: ${retrievedProducts.length}`);
      return reply;

    } catch (err) {
      lastError = err;
      console.warn(`❌ Model ${model} failed:`, err.message?.slice(0, 80));
    }
  }

  throw new Error(`All models failed. Last: ${lastError?.message}`);
}
