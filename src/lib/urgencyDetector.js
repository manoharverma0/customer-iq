// ─────────────────────────────────────────────────────────────────────────────
// URGENCY DETECTOR — v2
// Classifies customer messages as HIGH / MEDIUM / LOW
// Also detects BUYER INTENT for the sales engine
// ─────────────────────────────────────────────────────────────────────────────

// ── HIGH urgency signals (need immediate response) ───────────────────────────
const HIGH_URGENCY_PATTERNS = [
  // Complaints / escalation
  /(urgent|asap|immediately|emergency|right now|abhi|abhi chahiye|fast)/i,
  /(refund|cancel|complain|unacceptable|terrible|worst|horrible|cheated|scam|fraud)/i,
  /(competitor|never again|review|consumer forum|police)/i,
  // Strong buying signals (hot lead)
  /(order now|place order|buy now|book now|confirm order|finalize)/i,
  /(i want to buy|i want to order|i'll take it|done deal|pack it|send it)/i,
  /(payment|pay now|upi|card details|how to pay|gpay|paytm|phonepe|qr code|scanner)/i,
  // Time pressure
  /(today only|last day|tonight|tomorrow|event|function|wedding|party)/i,
  /!{2,}/,  // Multiple exclamation marks
];

// ── MEDIUM urgency signals (active shopping, follow up soon) ─────────────────
const MEDIUM_URGENCY_PATTERNS = [
  /(price|cost|how much|kitna|budget|rate|affordable|cheap|expensive)/i,
  /(available|stock|in stock|size|color|colour|variant|design|pattern)/i,
  /(delivery|shipping|deliver|dispatch|track|when|kitne din|kab tak)/i,
  /(interested|want to|looking for|need|require|searching|chahiye|dekhna)/i,
  /(compare|alternative|option|recommend|suggest|best|which one)/i,
  /(discount|offer|coupon|sale|deal|combo|gift|occasion)/i,
  /(can i|do you have|kya hai|milega|milta hai|hai kya|bhejo)/i,
  /\?/,  // Any question = engagement
];

// ── BUYER INTENT detection (for sales pitch mode) ────────────────────────────
const STRONG_BUY_PATTERNS = [
  /(order now|buy now|book now|confirm|finalize|i'll take|let's go|pack it)/i,
  /(want to buy|want to order|mujhe lena hai|order karna hai|book karna hai)/i,
  /(payment|pay|upi|card|gpay|paytm|phonepe|how to pay|checkout|qr code)/i,
  /(my address|deliver to|shipping address|pin code|pincode)/i,
  /(size available|which size|do you have in|stock hai|available hai|bhejna)/i,
];

const SOFT_BUY_PATTERNS = [
  /(interested|looking for|need|want|searching|dekhna|chahiye)/i,
  /(price|how much|kitna|rate|cost|budget)/i,
  /(wedding|function|occasion|party|festival|gift)/i,
  /(recommend|suggest|which one|best|popular|trending|bestseller|dikhao)/i,
  /(show me|tell me about|details|more info|aur batao|photo bhejo|pics)/i,
];

/**
 * Detect urgency level: 'high' | 'medium' | 'low'
 */
export function detectUrgency(message) {
  if (!message || typeof message !== 'string') return 'low';
  const text = message.trim();

  for (const pattern of HIGH_URGENCY_PATTERNS) {
    if (pattern.test(text)) return 'high';
  }

  let mediumMatches = 0;
  for (const pattern of MEDIUM_URGENCY_PATTERNS) {
    if (pattern.test(text)) mediumMatches++;
  }

  // Lower threshold — 1 match is enough for a conversational message
  if (mediumMatches >= 1) return 'medium';
  // Very short messages that ask something are still medium
  if (text.endsWith('?')) return 'medium';

  return 'low';
}

/**
 * Detect buyer intent: 'strong_buy' | 'soft_buy' | 'browse' | 'support'
 * Used by the AI to switch into sales pitch mode.
 */
export function detectBuyerIntent(message) {
  if (!message || typeof message !== 'string') return 'browse';
  const text = message.trim();

  for (const pattern of STRONG_BUY_PATTERNS) {
    if (pattern.test(text)) return 'strong_buy';
  }

  let softMatches = 0;
  for (const pattern of SOFT_BUY_PATTERNS) {
    if (pattern.test(text)) softMatches++;
  }

  if (softMatches >= 2) return 'soft_buy';
  if (softMatches === 1) return 'browse';

  // Support triggers
  if (/\b(return|refund|complaint|problem|issue|broken|damage|wrong|missing)\b/i.test(text)) {
    return 'support';
  }

  return 'browse';
}

export function getUrgencyConfig(urgency) {
  const configs = {
    high: {
      label: 'High Priority',
      emoji: '🔴',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      description: 'Immediate attention required',
    },
    medium: {
      label: 'Medium Priority',
      emoji: '🟡',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      description: 'Follow up within 1 hour',
    },
    low: {
      label: 'Low Priority',
      emoji: '🟢',
      color: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.12)',
      borderColor: 'rgba(34, 197, 94, 0.3)',
      description: 'Standard response time',
    },
  };
  return configs[urgency] || configs.low;
}
