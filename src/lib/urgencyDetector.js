// Urgency detection utility
// Classifies customer messages as HIGH / MEDIUM / LOW urgency

const HIGH_URGENCY_PATTERNS = [
  /\b(urgent|asap|immediately|emergency|right now|today)\b/i,
  /\b(refund|cancel|complain|unacceptable|terrible|worst)\b/i,
  /\b(going elsewhere|competitor|never again|posting review|legal)\b/i,
  /\b(need it|must have|can't wait|deadline|tomorrow)\b/i,
  /\b(angry|furious|disgusted|disappointed|frustrated)\b/i,
  /!{2,}/,  // Multiple exclamation marks
];

const MEDIUM_URGENCY_PATTERNS = [
  /\b(price|cost|how much|discount|offer|deal)\b/i,
  /\b(available|stock|size|color|variant)\b/i,
  /\b(when|delivery|shipping|arrive|track)\b/i,
  /\b(interested|want to|looking for|need|require)\b/i,
  /\b(compare|alternative|option|recommend)\b/i,
  /\?/, // Questions indicate engagement
];

export function detectUrgency(message) {
  if (!message || typeof message !== 'string') return 'low';

  const text = message.trim();

  // Check high urgency first
  for (const pattern of HIGH_URGENCY_PATTERNS) {
    if (pattern.test(text)) {
      return 'high';
    }
  }

  // Check medium urgency
  let mediumMatches = 0;
  for (const pattern of MEDIUM_URGENCY_PATTERNS) {
    if (pattern.test(text)) {
      mediumMatches++;
    }
  }

  if (mediumMatches >= 2) {
    return 'medium';
  }

  if (mediumMatches === 1 && text.length > 50) {
    return 'medium';
  }

  return 'low';
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
