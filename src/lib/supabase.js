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

  // We need to count messages by business ID, but messages don't have business_id directly.
  // We can join conversations or just get the count for now.
  // Actually, we can just omit message count for business level, or calculate it.
  
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
    totalMessages: 0, // Mock for now at business level
    totalRevenue,
    urgencyBreakdown,
  };
}
