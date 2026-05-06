// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE DIAGNOSTIC TEST — Tests all DB connections and RPC functions
// Run: node tests/test-supabase.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('\n🧪 SUPABASE DIAGNOSTIC TEST');
  console.log('='.repeat(60));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log(`URL: ${url ? '✅ Set' : '❌ MISSING'}`);
  console.log(`Key: ${key ? '✅ Set' : '❌ MISSING'}`);

  if (!url || !key) {
    console.log('\n❌ Cannot proceed without Supabase credentials.');
    return;
  }

  const supabase = createClient(url, key);

  // Test 1: Businesses
  console.log('\n── Test 1: Businesses ──────────────────────');
  const { data: biz, error: bizErr } = await supabase
    .from('businesses').select('id, name').limit(5);
  if (bizErr) {
    console.log(`❌ ${bizErr.message}`);
  } else {
    console.log(`✅ ${biz?.length || 0} businesses found`);
    biz?.forEach(b => console.log(`   → ${b.name} (${b.id.slice(0, 8)}...)`));
  }

  // Test 2: Products
  console.log('\n── Test 2: Products ────────────────────────');
  const { data: prods, error: prodErr } = await supabase
    .from('products').select('id, name, price, category').limit(5);
  if (prodErr) {
    console.log(`❌ ${prodErr.message}`);
  } else {
    console.log(`✅ ${prods?.length || 0} products found`);
    prods?.forEach(p => console.log(`   → ${p.name} | ₹${p.price} | ${p.category}`));
  }

  // Test 3: Conversations
  console.log('\n── Test 3: Conversations ───────────────────');
  const { data: convs, error: convErr } = await supabase
    .from('conversations').select('id, customer_name, urgency, channel').limit(5);
  if (convErr) {
    console.log(`❌ ${convErr.message}`);
  } else {
    console.log(`✅ ${convs?.length || 0} conversations found`);
    convs?.forEach(c => console.log(`   → ${c.customer_name} | ${c.urgency} | ${c.channel}`));
  }

  // Test 4: Messages
  console.log('\n── Test 4: Messages ────────────────────────');
  const { count: msgCount, error: msgErr } = await supabase
    .from('messages').select('id', { count: 'exact', head: true });
  if (msgErr) {
    console.log(`❌ ${msgErr.message}`);
  } else {
    console.log(`✅ ${msgCount} total messages`);
  }

  // Test 5: Vector search (match_products)
  console.log('\n── Test 5: Vector Search (match_products) ──');
  const testBizId = biz?.[0]?.id || '00000000-0000-0000-0000-000000000000';
  const { data: vecData, error: rpcErr } = await supabase.rpc('match_products', {
    query_embedding: new Array(384).fill(0.01),
    business_id_filter: testBizId,
    match_count: 3,
    similarity_threshold: 0.1,
  });
  if (rpcErr) {
    console.log(`❌ ${rpcErr.message}`);
  } else {
    console.log(`✅ Working — ${vecData?.length || 0} results`);
    vecData?.forEach(p => console.log(`   → ${p.name} (sim: ${p.similarity?.toFixed(3)})`));
  }

  // Test 6: Knowledge search (match_knowledge)
  console.log('\n── Test 6: Vector Search (match_knowledge) ─');
  const { data: kbData, error: kbErr } = await supabase.rpc('match_knowledge', {
    query_embedding: new Array(384).fill(0.01),
    business_id_filter: testBizId,
    match_count: 3,
    similarity_threshold: 0.1,
  });
  if (kbErr) {
    console.log(`❌ ${kbErr.message}`);
  } else {
    console.log(`✅ Working — ${kbData?.length || 0} results`);
  }

  // Test 7: Conversation summaries table
  console.log('\n── Test 7: Conversation Summaries ──────────');
  const { count: sumCount, error: sumErr } = await supabase
    .from('conversation_summaries').select('id', { count: 'exact', head: true });
  if (sumErr) {
    console.log(`❌ ${sumErr.message}`);
  } else {
    console.log(`✅ ${sumCount} summaries stored`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Supabase diagnostic complete!\n');
}

main().catch(console.error);
