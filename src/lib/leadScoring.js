// ─────────────────────────────────────────────────────────────────────────────
// LEAD SCORING ENGINE
// Analyzes conversation summary + metadata to compute a 0-100 lead score.
// Extracts: Budget, Urgency, Needs, Timeline.
// Suggests "Next Best Action" for the business owner.
// Triggered after every rolling summary update.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import { notifyOwnerHotLead } from './ownerNotifier';

// ── Scoring weights ──────────────────────────────────────────────────────────
const SCORING_RULES = {
  // Urgency signals (max 30 points)
  urgency: {
    high: 30,
    medium: 15,
    low: 5,
  },
  // Buyer intent signals (max 35 points)
  intent: {
    strong_buy: 35,
    soft_buy: 20,
    browse: 8,
    support: 10,
  },
  // Engagement signals (max 20 points)
  engagement: {
    hasPhone: 8,        // Customer shared phone number
    hasName: 4,         // Customer shared name
    multipleMessages: 8, // Customer sent 3+ messages
  },
  // Budget signals (max 15 points)
  budget: {
    mentioned: 10,      // Any budget/price discussion
    highValue: 15,      // Budget > ₹5000 mentioned
  },
};

// ── Budget detection patterns ────────────────────────────────────────────────
const BUDGET_PATTERNS = [
  /₹\s*([\d,]+)/g,
  /(\d{3,6})\s*(rupees|rs|inr)/gi,
  /budget\s*(?:is|of|around|about)?\s*₹?\s*([\d,]+)/gi,
];

/**
 * Compute a lead score for a conversation.
 * Uses conversation metadata + summary to derive a 0-100 score.
 */
export async function scoreConversation(conversationId) {
  if (!supabase || !conversationId) return null;

  try {
    // Fetch conversation + summary + messages in parallel
    const [convResult, summaryResult, messagesResult] = await Promise.all([
      supabase.from('conversations')
        .select('urgency, customer_name, status')
        .eq('id', conversationId).single(),
      supabase.from('conversation_summaries')
        .select('summary_text')
        .eq('conversation_id', conversationId).single(),
      supabase.from('messages')
        .select('role, content, metadata')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
    ]);

    const conv = convResult.data;
    const summary = summaryResult.data?.summary_text || '';
    const messages = messagesResult.data || [];

    if (!conv) return null;

    let score = 0;
    let budgetDetected = null;
    let needsSummary = '';
    let nextAction = '';

    // 1. Urgency score
    score += SCORING_RULES.urgency[conv.urgency] || 5;

    // 2. Buyer intent — check the latest customer messages
    const customerMessages = messages.filter(m => m.role === 'customer');
    const latestIntent = customerMessages.length > 0
      ? (customerMessages[customerMessages.length - 1]?.metadata?.buyerIntent || 'browse')
      : 'browse';
    score += SCORING_RULES.intent[latestIntent] || 8;

    // 3. Engagement
    if (conv.customer_name && conv.customer_name !== 'Visitor') {
      score += SCORING_RULES.engagement.hasName;
    }
    // Check if phone was shared (in any customer message)
    const allCustomerText = customerMessages.map(m => m.content).join(' ');
    const phonePattern = /(\d{10}|\d{5}\s?\d{5}|\+\d{12})/;
    if (phonePattern.test(allCustomerText)) {
      score += SCORING_RULES.engagement.hasPhone;
    }
    if (customerMessages.length >= 3) {
      score += SCORING_RULES.engagement.multipleMessages;
    }

    // 4. Budget detection
    const combinedText = allCustomerText + ' ' + summary;
    for (const pattern of BUDGET_PATTERNS) {
      const match = pattern.exec(combinedText);
      if (match) {
        const amount = parseInt(match[1]?.replace(/,/g, '') || '0');
        if (amount > 0) {
          budgetDetected = `₹${amount.toLocaleString('en-IN')}`;
          score += amount > 5000 ? SCORING_RULES.budget.highValue : SCORING_RULES.budget.mentioned;
          break;
        }
      }
    }

    // Cap at 100
    score = Math.min(score, 100);

    // 5. Extract needs summary from conversation summary
    needsSummary = summary
      ? summary.split('\n')[0].slice(0, 200)  // First line of summary
      : (customerMessages.length > 0
          ? customerMessages[customerMessages.length - 1].content.slice(0, 200)
          : 'No interactions yet');

    // 6. Suggest next action
    if (score >= 70) {
      nextAction = 'Hot lead — follow up immediately with a quote or booking confirmation';
    } else if (score >= 40) {
      nextAction = 'Warm lead — send personalized product recommendations or catalog link';
    } else if (score >= 20) {
      nextAction = 'Browsing — add to nurture list, send offers when available';
    } else {
      nextAction = 'Cold — no immediate action needed';
    }

    // 7. Upsert into lead_scores
    const { data: upserted } = await supabase
      .from('lead_scores')
      .upsert({
        conversation_id: conversationId,
        score,
        budget_detected: budgetDetected,
        urgency_detected: conv.urgency,
        needs_summary: needsSummary,
        next_action: nextAction,
        last_updated_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id' })
      .select()
      .single();

    console.log(`🎯 Lead score: ${score}/100 for conv ${conversationId.slice(0, 8)}`);

    // ── TRIGGER: Notify business owner for hot leads (first-time only) ────
    if (score >= 70 && upserted) {
      // Get business ID from conversation
      const { data: convForBiz } = await supabase
        .from('conversations')
        .select('business_id')
        .eq('id', conversationId)
        .single();

      if (convForBiz?.business_id) {
        notifyOwnerHotLead(convForBiz.business_id, conversationId, {
          score,
          budget_detected: budgetDetected,
          needs_summary: needsSummary,
          urgency_detected: conv.urgency,
          next_action: nextAction,
        }).catch(err => console.warn('Non-critical: owner notification failed:', err.message));
      }
    }

    return upserted;
  } catch (err) {
    console.warn('Lead scoring failed:', err.message);
    return null;
  }
}

/**
 * Get all lead scores for a business, sorted by score (hottest first).
 */
export async function getBusinessLeadScores(businessId) {
  if (!supabase || !businessId) return [];

  const { data, error } = await supabase
    .from('lead_scores')
    .select(`
      *,
      conversations!inner (
        id,
        customer_name,
        urgency,
        channel,
        updated_at,
        business_id
      )
    `)
    .eq('conversations.business_id', businessId)
    .order('score', { ascending: false })
    .limit(30);

  if (error) { console.warn('Get lead scores error:', error.message); return []; }
  return data || [];
}

/**
 * Get a lead score label for UI display.
 */
export function getLeadLabel(score) {
  if (score >= 70) return { label: '🔥 Hot', color: '#dc2626', bg: '#fef2f2' };
  if (score >= 40) return { label: '🟡 Warm', color: '#d97706', bg: '#fffbeb' };
  if (score >= 20) return { label: '🟢 Cool', color: '#059669', bg: '#ecfdf5' };
  return { label: '❄️ Cold', color: '#6b7280', bg: '#f3f4f6' };
}
