// ─────────────────────────────────────────────────────────────────────────────
// ROLLING CONVERSATION SUMMARY
// After every 5-6 messages, compresses full history into 3-4 lines.
// AI prompt then uses: summary (~50 tokens) + last 2 messages (~100 tokens)
// Instead of: all 20 messages (~2000+ tokens)
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

const SUMMARY_THRESHOLD = 5; // Generate summary every N new messages

/**
 * Get the rolling summary + last 2 raw messages for a conversation.
 * This replaces the old getConversationHistory(convId, 20) approach.
 * Total token cost: ~150 instead of ~2000+.
 */
export async function getSmartContext(conversationId) {
  if (!supabase || !conversationId) return { summary: '', recentMessages: [] };

  // Fetch summary and last 2 raw messages in parallel
  const [summaryResult, recentResult] = await Promise.all([
    supabase
      .from('conversation_summaries')
      .select('summary_text, message_count')
      .eq('conversation_id', conversationId)
      .single(),
    supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(2),
  ]);

  const summary = summaryResult.data?.summary_text || '';
  const summarizedCount = summaryResult.data?.message_count || 0;
  const recentMessages = (recentResult.data || [])
    .reverse()
    .map(m => ({
      role: m.role === 'customer' ? 'user' : 'assistant',
      content: m.content,
    }));

  return { summary, recentMessages, summarizedCount };
}

/**
 * Build the context string to inject into the AI prompt.
 * Combines rolling summary + last 2 messages into a compact format.
 */
export function buildContextString(smartContext) {
  const { summary, recentMessages } = smartContext;
  let ctx = '';

  if (summary) {
    ctx += `[CONVERSATION SUMMARY SO FAR]\n${summary}\n\n`;
  }

  if (recentMessages.length > 0) {
    ctx += `[RECENT MESSAGES]\n`;
    for (const msg of recentMessages) {
      const label = msg.role === 'user' ? 'Customer' : 'You';
      ctx += `${label}: ${msg.content.slice(0, 300)}\n`;
    }
  }

  return ctx.trim();
}

/**
 * Check if we need to generate a new summary, and do it if so.
 * Call this AFTER saving a new message (non-blocking).
 *
 * Logic:
 *  1. Count total messages in this conversation
 *  2. If (totalMessages - summarizedCount) >= SUMMARY_THRESHOLD → generate
 *  3. Fetch existing summary + unsummarized messages
 *  4. Call AI to compress into 3-4 lines
 *  5. Upsert into conversation_summaries
 */
export async function maybeGenerateSummary(conversationId, generateAIFn) {
  if (!supabase || !conversationId) return null;

  try {
    // 1. Count total messages
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    const totalMessages = count || 0;

    // 2. Get current summary state
    const { data: existing } = await supabase
      .from('conversation_summaries')
      .select('summary_text, message_count')
      .eq('conversation_id', conversationId)
      .single();

    const summarizedCount = existing?.message_count || 0;
    const unsummarizedCount = totalMessages - summarizedCount;

    // Not enough new messages to warrant a summary
    if (unsummarizedCount < SUMMARY_THRESHOLD) return null;

    // 3. Fetch unsummarized messages
    const { data: newMessages } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(summarizedCount, totalMessages - 1);

    if (!newMessages || newMessages.length === 0) return null;

    // 4. Build the compression prompt
    const existingSummary = existing?.summary_text || '';
    const newMsgText = newMessages
      .map(m => `${m.role === 'customer' ? 'Customer' : 'AI'}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const compressionPrompt = existingSummary
      ? `Previous summary:\n${existingSummary}\n\nNew messages:\n${newMsgText}\n\nCompress ALL of the above into 3-4 concise lines. Include: customer need, budget/price discussed, urgency level, key decisions made, and any pending actions. Be factual.`
      : `Conversation:\n${newMsgText}\n\nCompress into 3-4 concise lines. Include: customer need, budget/price discussed, urgency level, key decisions made, and any pending actions. Be factual.`;

    // 5. Generate compressed summary via the AI
    let summaryText;
    try {
      summaryText = await generateAIFn(compressionPrompt);
    } catch {
      // If AI fails, do a simple extractive summary
      summaryText = newMessages
        .filter(m => m.role === 'customer')
        .map(m => m.content.slice(0, 100))
        .join(' | ');
      if (existingSummary) summaryText = existingSummary + ' | ' + summaryText;
    }

    if (!summaryText) return null;

    // 6. Upsert into DB
    const { data: upserted } = await supabase
      .from('conversation_summaries')
      .upsert({
        conversation_id: conversationId,
        summary_text: summaryText.slice(0, 1000),
        message_count: totalMessages,
        last_updated_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id' })
      .select()
      .single();

    console.log(`📝 Summary generated for conv ${conversationId.slice(0, 8)}... (${totalMessages} msgs compressed)`);
    return upserted;
  } catch (err) {
    console.warn('Summary generation failed:', err.message);
    return null;
  }
}
