// ─── StyleCraft Anti-Hallucination Guardrail ─────────────────────────────────
// This is injected into EVERY message sent to the AI.
// It overrides the model's general knowledge and locks it to StyleCraft India only.
const STYLECRAFT_GUARDRAIL = `
⚠️ ABSOLUTE CONSTRAINT — READ BEFORE ANSWERING:
You are the AI assistant EXCLUSIVELY for "StyleCraft India", a fashion & ethnic wear brand.

YOU MUST ONLY DISCUSS:
- Silk Sarees (₹2,999 – ₹15,999)
- Designer Kurtas (₹899 – ₹2,999)
- Lehengas (₹5,999 – ₹25,999)
- Jewelry Sets (₹1,499 – ₹8,999)
- Casual Shirts (₹699 – ₹1,999)
- Our shipping, returns, discounts, and size guide

YOU MUST NEVER:
- Give prices or info for products NOT in the above list (bikes, electronics, food, cars, etc.)
- Make up products, prices, or policies not listed above
- Act as a general assistant or answer unrelated questions
- Discuss competitors or other brands

If asked about ANYTHING outside our catalog, respond ONLY:
"I'm StyleCraft India's fashion assistant! I can only help with our ethnic wear — sarees, kurtas, lehengas, jewelry, or shirts. What can I help you with? 😊"

CUSTOMER MESSAGE:
`.trim();

const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

// Fast models prioritized — small & responsive on free HF tier
// Ordered: fastest first, quality fallbacks after
const MODEL_FALLBACKS = [
  'Qwen/Qwen2.5-7B-Instruct',           // Fast, excellent quality, ~3-5s
  'google/gemma-3-4b-it',               // Google's fast small model, ~4-6s
  'mistralai/Mistral-7B-Instruct-v0.3', // Reliable fallback, ~5-8s
  'google/gemma-3-12b-it',              // Larger fallback if all above fail
];

export async function generateAIReply(message, conversationHistory = [], systemPrompt) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    throw new Error('HF_TOKEN not configured — get a free token from https://huggingface.co/settings/tokens');
  }

  // Always prepend the guardrail to the system prompt.
  // If a DB system_prompt exists, merge it AFTER the guardrail so the guardrail wins.
  const baseGuardrail = `You are StyleCraft India's AI customer service assistant.\n\n${STYLECRAFT_GUARDRAIL}\n\n`;
  const sysPrompt = systemPrompt
    ? `${baseGuardrail}\n---\nADDITIONAL BUSINESS CONTEXT:\n${systemPrompt}`
    : baseGuardrail;

  // Build conversation messages in OpenAI chat format
  const messages = [
    { role: 'system', content: sysPrompt },
  ];

  // Add conversation history (last 6 messages for context)
  const recentHistory = conversationHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'customer' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add the current message — prefix with guardrail so model reads constraint RIGHT before the question
  messages.push({ role: 'user', content: `${STYLECRAFT_GUARDRAIL}\n\n${message}` });

  // Try each model until one works
  let lastError = null;
  for (const modelName of MODEL_FALLBACKS) {
    try {
      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          max_tokens: 300,
          temperature: 0.3,  // Lower = less hallucination, more grounded
          top_p: 0.85,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const status = response.status;

        // Rate limited or model loading — try next model
        if (status === 429 || status === 503 || status === 500) {
          console.warn(`⚠ Model ${modelName} returned ${status}, trying next...`);
          lastError = new Error(`${modelName} returned ${status}`);
          continue;
        }

        throw new Error(`HF API error ${status}: ${errorBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (text) {
        console.log(`✅ Gemma reply via ${modelName} (${text.length} chars)`);
        return text;
      }

      lastError = new Error(`Empty response from ${modelName}`);
    } catch (error) {
      lastError = error;
      console.warn(`⚠ Model ${modelName} failed:`, error.message?.slice(0, 120));
      continue;
    }
  }

  throw lastError || new Error('All HuggingFace models failed');
}
