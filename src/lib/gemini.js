// AI Engine — Hugging Face Inference API with Google Gemma 4
// Uses the OpenAI-compatible endpoint (free tier with HF token)
// Falls back to smart template replies if API is unavailable

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

  // Fallback if no system prompt provided
  const sysPrompt = systemPrompt || 'You are a helpful AI customer support assistant.';

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

  // Add the current message
  messages.push({ role: 'user', content: message });

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
          max_tokens: 280,
          temperature: 0.7,
          top_p: 0.95,
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
