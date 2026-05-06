// ─────────────────────────────────────────────────────────────────────────────
// LLM DIAGNOSTIC TEST — Tests Groq + HuggingFace models in isolation
// Run: node tests/test-llm.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { config } from 'dotenv';
config({ path: '.env.local' });

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const HF_API_BASE = 'https://api-inference.huggingface.co/models';
const HF_MODELS = [
  'meta-llama/Llama-3.2-1B-Instruct',
  'google/gemma-2-2b-it',
];

// ─── Test Groq ───────────────────────────────────────────────────────────────
async function testGroq(message) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log(`❌ Groq | SKIPPED — GROQ_API_KEY not set`);
    return null;
  }

  const start = Date.now();
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful shopping assistant for StyleCraft India. Keep replies under 3 sentences.' },
          { role: 'user', content: message },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    const elapsed = Date.now() - start;

    if (!response.ok) {
      const err = await response.text();
      console.log(`❌ Groq [${GROQ_MODEL}] | ${response.status} | ${elapsed}ms | ${err.slice(0, 120)}`);
      return null;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    const tokens = data.usage;
    console.log(`✅ Groq [${GROQ_MODEL}] | ${response.status} | ${elapsed}ms | tokens: ${tokens?.total_tokens || '?'}`);
    console.log(`   Reply: ${reply?.slice(0, 200)}`);
    return { reply, elapsed, tokens };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`💥 Groq | ERROR | ${elapsed}ms | ${err.message}`);
    return null;
  }
}

// ─── Test HuggingFace ────────────────────────────────────────────────────────
async function testHF(model, message) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    console.log(`❌ HF [${model.split('/')[1]}] | SKIPPED — HF_TOKEN not set`);
    return null;
  }

  const start = Date.now();
  try {
    const response = await fetch(`${HF_API_BASE}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: `You are a helpful shopping assistant. Customer says: ${message}`,
        parameters: { max_new_tokens: 200, temperature: 0.3 },
      }),
    });

    const elapsed = Date.now() - start;

    if (!response.ok) {
      const err = await response.text();
      console.log(`❌ HF [${model.split('/')[1]}] | ${response.status} | ${elapsed}ms | ${err.slice(0, 120)}`);
      return null;
    }

    const data = await response.json();
    const reply = data[0]?.generated_text || JSON.stringify(data).slice(0, 200);
    console.log(`✅ HF [${model.split('/')[1]}] | ${response.status} | ${elapsed}ms`);
    console.log(`   Reply: ${reply.slice(0, 200)}`);
    return { reply: reply.slice(0, 200), elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`💥 HF [${model.split('/')[1]}] | ERROR | ${elapsed}ms | ${err.message}`);
    return null;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🧪 LLM DIAGNOSTIC TEST');
  console.log('='.repeat(80));
  console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ MISSING'}`);
  console.log(`HF_TOKEN:     ${process.env.HF_TOKEN ? '✅ Set' : '❌ MISSING'}`);

  const testMessages = [
    'hi',
    'show me sarees',
    'I want to buy a silk saree under 5000',
    'what is your return policy?',
  ];

  for (const msg of testMessages) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📩 Test: "${msg}"`);
    console.log('─'.repeat(80));

    // Test Groq (primary)
    await testGroq(msg);

    // Test HF models (fallback)
    for (const model of HF_MODELS) {
      await testHF(model, msg);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('🏁 LLM diagnostic complete!\n');
}

main().catch(console.error);
