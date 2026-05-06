// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDING DIAGNOSTIC TEST — Tests HuggingFace embedding API
// Run: node tests/test-embeddings.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { config } from 'dotenv';
config({ path: '.env.local' });

const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

async function testEmbedding(text) {
  const start = Date.now();
  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true },
        }),
      }
    );

    const elapsed = Date.now() - start;

    if (!response.ok) {
      const err = await response.text();
      console.log(`❌ "${text}" | ${response.status} | ${elapsed}ms | ${err.slice(0, 120)}`);
      return null;
    }

    const data = await response.json();
    const dims = Array.isArray(data[0]) ? data[0].length : Array.isArray(data) ? data.length : 0;
    const sample = Array.isArray(data[0]) ? data[0].slice(0, 3) : Array.isArray(data) ? data.slice(0, 3) : [];
    console.log(`✅ "${text}" | ${response.status} | ${elapsed}ms | ${dims} dims | sample: [${sample.map(n => n.toFixed(4)).join(', ')}...]`);
    return data;
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`💥 "${text}" | ERROR | ${elapsed}ms | ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🧪 EMBEDDING DIAGNOSTIC TEST');
  console.log('='.repeat(70));
  console.log(`HF_TOKEN: ${process.env.HF_TOKEN ? '✅ Set' : '❌ MISSING'}`);
  console.log(`Model: ${EMBEDDING_MODEL}`);

  if (!process.env.HF_TOKEN) {
    console.log('\n❌ Cannot proceed without HF_TOKEN.');
    return;
  }

  const tests = [
    'show me sarees',
    'silk wedding saree',
    'return policy',
    'I want to buy a kurta',
    'what is your delivery time?',
  ];

  console.log('\n── Running embedding tests ─────────────────');
  for (const text of tests) {
    await testEmbedding(text);
  }

  // Test cosine similarity between related queries
  console.log('\n── Similarity sanity check ─────────────────');
  const emb1 = await testEmbedding('silk saree');
  const emb2 = await testEmbedding('wedding saree');
  const emb3 = await testEmbedding('laptop computer');

  if (emb1 && emb2 && emb3) {
    const vec1 = Array.isArray(emb1[0]) ? emb1[0] : emb1;
    const vec2 = Array.isArray(emb2[0]) ? emb2[0] : emb2;
    const vec3 = Array.isArray(emb3[0]) ? emb3[0] : emb3;

    const sim12 = cosineSimilarity(vec1, vec2);
    const sim13 = cosineSimilarity(vec1, vec3);

    console.log(`\n   "silk saree" ↔ "wedding saree" = ${sim12.toFixed(4)} (should be HIGH)`);
    console.log(`   "silk saree" ↔ "laptop computer" = ${sim13.toFixed(4)} (should be LOW)`);
    console.log(`   ${sim12 > sim13 ? '✅ Similarity is correct!' : '⚠️ Similarity seems wrong'}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('🏁 Embedding diagnostic complete!\n');
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

main().catch(console.error);
