import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing — using fallback mode');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper: Get a business profile
export async function getBusinessProfile(businessId) {
  if (!supabase || !businessId) return null;
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
  if (error) { console.error('Get business error:', error); return null; }
  return data;
}

// Helper: Create a new conversation
export async function createConversation(businessId, customerName = 'Visitor', channel = 'website') {
  if (!supabase) return null;
  const insertData = { customer_name: customerName, channel };
  if (businessId) insertData.business_id = businessId;

  const { data, error } = await supabase
    .from('conversations')
    .insert(insertData)
    .select()
    .single();
  if (error) { console.error('Create conversation error:', error); return null; }
  return data;
}

// Helper: Add message to conversation
export async function addMessage(conversationId, role, content, urgency = null, metadata = {}) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      urgency,
      metadata,
    })
    .select()
    .single();
  if (error) { console.error('Add message error:', error); return null; }

  // Update conversation's updated_at and urgency
  if (urgency) {
    await supabase
      .from('conversations')
      .update({ urgency, updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  return data;
}

// Helper: Get conversation with messages
export async function getConversation(conversationId) {
  if (!supabase) return null;
  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (!conv) return null;

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return { ...conv, messages: messages || [] };
}

// Helper: Get all conversations
export async function getAllConversations() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('conversations')
    .select('*, messages(*)')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) { console.error('Get conversations error:', error); return []; }
  return data || [];
}

// Helper: Log analytics event
export async function logAnalyticsEvent(eventType, eventData = {}) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('analytics_events')
    .insert({ event_type: eventType, data: eventData })
    .select()
    .single();
  if (error) { console.error('Analytics event error:', error); return null; }
  return data;
}

// Helper: Get analytics summary
export async function getAnalyticsSummary(businessId) {
  if (!supabase) return null;

  let convQuery = supabase
    .from('conversations')
    .select('id, urgency, revenue, status, created_at');
    
  if (businessId) convQuery = convQuery.eq('business_id', businessId);
  const { data: conversations } = await convQuery;
  
  if (!conversations) return null;

  const totalConversations = conversations.length;
  const totalRevenue = conversations.reduce((sum, c) => sum + (Number(c.revenue) || 0), 0);
  const urgencyBreakdown = {
    high: conversations.filter(c => c.urgency === 'high').length,
    medium: conversations.filter(c => c.urgency === 'medium').length,
    low: conversations.filter(c => c.urgency === 'low').length,
  };

  return {
    totalConversations,
    totalMessages: 0,
    totalRevenue,
    urgencyBreakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Stateful Conversation History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the full message history for a conversation from Supabase.
 * Returns messages formatted for AI consumption: [{role, content}]
 * This enables TRUE stateful conversations — even after page refresh.
 */
export async function getConversationHistory(conversationId, limit = 20) {
  if (!supabase || !conversationId) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) { console.error('Get history error:', error); return []; }
  return (data || []).map(m => ({
    role: m.role === 'customer' ? 'user' : 'assistant',
    content: m.content,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Vector Search (pgvector RAG)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semantic product search using pgvector cosine similarity.
 * Requires the match_products() SQL function and embeddings to be seeded.
 * Returns top-k products most semantically similar to the query embedding.
 */
export async function vectorSearchProducts(queryEmbedding, businessId, limit = 3) {
  if (!supabase || !queryEmbedding || !businessId) return [];
  try {
    const { data, error } = await supabase.rpc('match_products', {
      query_embedding: queryEmbedding,
      business_id_filter: businessId,
      match_count: limit,
      similarity_threshold: 0.4,
    });
    if (error) { console.warn('Vector search error:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.warn('Vector search failed:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Vector Search for Knowledge/FAQ Chunks (RAG)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semantic knowledge/FAQ search using pgvector cosine similarity.
 * Requires the match_knowledge() SQL function from supabase-production-upgrade.sql.
 * Returns top-k knowledge chunks most relevant to the query.
 */
export async function vectorSearchKnowledge(queryEmbedding, businessId, limit = 3) {
  if (!supabase || !queryEmbedding || !businessId) return [];
  try {
    const { data, error } = await supabase.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      business_id_filter: businessId,
      match_count: limit,
      similarity_threshold: 0.25,
    });
    if (error) { console.warn('Knowledge search error:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.warn('Knowledge search failed:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK: Keyword-based product search (when embeddings are unavailable)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_MAP = {
  saree: ['saree', 'sari', 'silk', 'banarasi', 'kanchipuram', 'chanderi', 'georgette'],
  kurta: ['kurta', 'kurtas', 'nehru', 'ethnic'],
  lehenga: ['lehenga', 'lehnga', 'bridal', 'wedding', 'choli'],
  jewelry: ['jewelry', 'jewellery', 'necklace', 'earring', 'kundan', 'pearl', 'gold', 'bangle'],
  shirt: ['shirt', 'shirts', 'linen', 'formal', 'casual'],
};

/**
 * Direct keyword-based product search — NO embeddings needed.
 * Used as fallback when HuggingFace embedding API is down.
 * Detects category from message, queries products directly from DB.
 * For vague queries like "collection"/"show me" → returns a mix of all categories.
 */
export async function keywordSearchProducts(message, businessId, limit = 4) {
  if (!supabase) return [];

  const lower = (message || '').toLowerCase();

  // Detect specific category
  let matchedCategory = null;
  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => lower.includes(k))) {
      matchedCategory = category;
      break;
    }
  }

  try {
    // Build query — try with business_id first, fall back without it
    let query = supabase
      .from('products')
      .select('id, name, category, price, original_price, description');

    // Try to filter by business — will silently fail if column doesn't exist
    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    if (matchedCategory) {
      query = query.ilike('category', `%${matchedCategory}%`);
    }

    query = query.order('price', { ascending: matchedCategory ? true : false }).limit(limit);

    let { data, error } = await query;

    // If business_id column doesn't exist, retry without it
    if (error && error.message?.includes('business_id')) {
      console.log('🔄 products table has no business_id — querying without it');
      let retryQuery = supabase
        .from('products')
        .select('id, name, category, price, original_price, description');

      if (matchedCategory) {
        retryQuery = retryQuery.ilike('category', `%${matchedCategory}%`);
      }

      retryQuery = retryQuery.order('price', { ascending: matchedCategory ? true : false }).limit(limit);

      const retry = await retryQuery;
      data = retry.data;
      error = retry.error;
    }

    if (error) { console.warn('Keyword product search error:', error.message); return []; }
    console.log(`🔍 Keyword search: "${matchedCategory || 'broad'}" → ${(data || []).length} products`);
    return data || [];
  } catch (err) {
    console.warn('Keyword search failed:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Demo Business from DB (cached, not hardcoded)
// ─────────────────────────────────────────────────────────────────────────────

let _cachedBusiness = null;
let _cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load StyleCraft India from Supabase businesses table.
 * Cached in-memory for 5 minutes to avoid repeated DB calls.
 * Falls back to null if DB is unavailable.
 */
export async function getDemoBusiness() {
  if (_cachedBusiness && Date.now() < _cacheExpiry) return _cachedBusiness;
  if (!supabase) return null;
  const { data } = await supabase
    .from('businesses')
    .select('id, name, owner_email, system_prompt, welcome_message')
    .eq('owner_email', 'admin@stylecraft.com')
    .single();
  if (data) {
    _cachedBusiness = data;
    _cacheExpiry = Date.now() + CACHE_TTL;
  }
  return data || null;
}
