// ─────────────────────────────────────────────────────────────────────────────
// FULL API END-TO-END TEST — Tests the complete chat pipeline
// Run: node tests/test-api.mjs
// NOTE: Dev server must be running first (npm run dev)
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';

async function testChat(message, conversationId = null, label = '') {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationId,
        conversationHistory: [],
      }),
    });

    const elapsed = Date.now() - start;
    const data = await response.json();

    const status = response.status === 200 ? '✅' : '❌';
    console.log(`\n${status} ${label || `"${message}"`}`);
    console.log(`   Status: ${response.status} | Time: ${elapsed}ms`);
    console.log(`   AI Provider: ${data.metadata?.aiProvider || 'unknown'}`);
    console.log(`   Vector Hits: ${data.metadata?.vectorHits ?? '?'} | Knowledge Hits: ${data.metadata?.knowledgeHits ?? '?'}`);
    console.log(`   Used Summary: ${data.metadata?.usedSummary || false}`);
    console.log(`   Urgency: ${data.urgency || '?'}`);
    console.log(`   Products: ${data.products?.length || 0}`);
    console.log(`   Conv ID: ${data.conversationId?.slice(0, 8) || 'none'}...`);
    console.log(`   Reply: ${(data.reply || data.error || 'NO REPLY').slice(0, 200)}`);

    return data;
  } catch (err) {
    console.log(`\n💥 ${label || `"${message}"`} → ERROR: ${err.message}`);
    if (err.message.includes('ECONNREFUSED')) {
      console.log(`   ⚠️  Is the dev server running? Try: npm run dev`);
    }
    return null;
  }
}

async function main() {
  console.log('\n🧪 FULL API END-TO-END TEST');
  console.log('='.repeat(80));
  console.log(`Target: ${BASE_URL}/api/chat`);
  console.log('⚠️  Make sure dev server is running: npm run dev\n');

  // ── Test 1: Simple greeting ──────────────────────────────────────────────
  const r1 = await testChat('hi', null, 'Test 1: Greeting');

  // ── Test 2: Product search ───────────────────────────────────────────────
  const r2 = await testChat('show me sarees', null, 'Test 2: Product Search');

  // ── Test 3: Price query ──────────────────────────────────────────────────
  await testChat('how much does a silk saree cost?', null, 'Test 3: Pricing Query');

  // ── Test 4: Multi-turn conversation ──────────────────────────────────────
  if (r2?.conversationId) {
    await testChat(
      'do you have it in red color?',
      r2.conversationId,
      'Test 4: Multi-Turn (follow-up on sarees)'
    );
  }

  // ── Test 5: Off-topic rejection ──────────────────────────────────────────
  await testChat('do you sell laptops?', null, 'Test 5: Off-Topic Rejection');

  // ── Test 6: Order intent ─────────────────────────────────────────────────
  await testChat('I want to buy a kurta', null, 'Test 6: Order Intent');

  // ── Test 7: Support query ────────────────────────────────────────────────
  await testChat('what is your return policy?', null, 'Test 7: Support Query');

  // ── Test 8: High urgency ─────────────────────────────────────────────────
  await testChat('I need help urgently with my order, it hasnt arrived!', null, 'Test 8: High Urgency');

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('🏁 End-to-end tests complete!');
  console.log('\n📊 Key things to check:');
  console.log('   1. AI Provider should be "groq" (not "smart-fallback")');
  console.log('   2. Vector Hits should be > 0 for product queries');
  console.log('   3. Response time should be < 3s for Groq');
  console.log('   4. Multi-turn test should reference previous context\n');
}

main().catch(console.error);
