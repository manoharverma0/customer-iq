// AI Chat Engine — uses local smart reply generation
// For hackathon demo, we use a smart template-based reply system
// Can be swapped to Gemini API with an API key

import { detectUrgency, getUrgencyConfig } from './urgencyDetector';

const BUSINESS_CONTEXT = {
  name: 'StyleCraft India',
  type: 'Fashion & Ethnic Wear E-commerce',
  tone: 'warm, professional, Indian hospitality',
  offerings: [
    'Silk Sarees (₹2,999 - ₹15,999)',
    'Designer Kurtas (₹899 - ₹2,999)',
    'Lehengas (₹5,999 - ₹25,999)',
    'Jewelry Sets (₹1,499 - ₹8,999)',
    'Casual Shirts (₹699 - ₹1,999)',
  ],
};

function generateSmartReply(message, urgency, conversationHistory = []) {
  const lowerMsg = message.toLowerCase();

  // High urgency — empathetic, solution-oriented
  if (urgency === 'high') {
    if (lowerMsg.includes('refund') || lowerMsg.includes('cancel')) {
      return `I completely understand your concern and sincerely apologize for the inconvenience. 🙏 Let me look into this right away. I can offer you:\n\n1️⃣ Full refund processed within 24 hours\n2️⃣ Replacement with express shipping + ₹500 store credit\n\nWhich option would you prefer? Your satisfaction is our top priority.`;
    }
    if (lowerMsg.includes('delivery') || lowerMsg.includes('urgent') || lowerMsg.includes('tomorrow') || lowerMsg.includes('today')) {
      return `I understand the urgency! 🚀 Great news — we offer express delivery options:\n\n⚡ Same-day dispatch (order before 2PM) — ₹299\n⚡ Next-morning delivery — ₹199\n\nI'll prioritize your order right away. Shall I upgrade your delivery?`;
    }
    return `I hear you and I want to resolve this immediately. 🙏 Let me connect you with our priority support team. In the meantime, could you share your order number so I can look into this right away?`;
  }

  // Medium urgency — helpful, informative
  if (urgency === 'medium') {
    if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('how much')) {
      return `Great question! 😊 Here's our price range:\n\n👗 Silk Sarees: ₹2,999 - ₹15,999\n👔 Designer Kurtas: ₹899 - ₹2,999\n💃 Lehengas: ₹5,999 - ₹25,999\n💎 Jewelry Sets: ₹1,499 - ₹8,999\n\nWe also have a flat 15% off for first-time buyers! Would you like me to share our bestsellers in your budget?`;
    }
    if (lowerMsg.includes('size') || lowerMsg.includes('available') || lowerMsg.includes('stock')) {
      return `Let me check that for you! 📦 We have sizes XS through XXL in most styles. Our size guide is super accurate — 98% of customers say the fit is perfect!\n\nCould you tell me which item you're interested in and your usual size? I'll confirm availability right away.`;
    }
    if (lowerMsg.includes('delivery') || lowerMsg.includes('shipping')) {
      return `Here are our shipping options: 📦\n\n🟢 Standard (5-7 days): FREE on orders above ₹999\n🟡 Express (2-3 days): ₹149\n🔴 Next-Day: ₹299\n\nWe ship across India! Would you like to proceed with your order?`;
    }
    return `Thanks for reaching out! 😊 I'd love to help you find exactly what you're looking for. Could you tell me a bit more about what you need? I can share personalized recommendations based on your preferences.`;
  }

  // Low urgency — engaging, nurturing
  if (lowerMsg.includes('browsing') || lowerMsg.includes('just looking')) {
    return `Welcome! 👋 Feel free to explore! Here are our trending collections this week:\n\n🔥 Summer Linen Collection — Just launched!\n⭐ Wedding Season Specials — Up to 25% off\n💝 New Arrivals — Fresh designs daily\n\nNo pressure at all — let me know if anything catches your eye! 😊`;
  }

  return `Hi there! 👋 Thanks for reaching out to ${BUSINESS_CONTEXT.name}!\n\nI'm your AI shopping assistant and I'm here to help you find the perfect outfit. Whether you're looking for everyday wear or something special for an occasion, I've got you covered!\n\nWhat are you looking for today? 😊`;
}

export function processMessage(message, conversationHistory = []) {
  const urgency = detectUrgency(message);
  const urgencyConfig = getUrgencyConfig(urgency);
  const reply = generateSmartReply(message, urgency, conversationHistory);

  return {
    reply,
    urgency,
    urgencyConfig,
    metadata: {
      processedAt: new Date().toISOString(),
      messageLength: message.length,
      hasQuestion: message.includes('?'),
      detectedIntents: detectIntents(message),
    },
  };
}

function detectIntents(message) {
  const intents = [];
  const lower = message.toLowerCase();

  if (lower.includes('price') || lower.includes('cost') || lower.includes('budget')) intents.push('pricing_inquiry');
  if (lower.includes('order') || lower.includes('buy') || lower.includes('purchase')) intents.push('purchase_intent');
  if (lower.includes('refund') || lower.includes('return') || lower.includes('cancel')) intents.push('refund_request');
  if (lower.includes('delivery') || lower.includes('ship') || lower.includes('track')) intents.push('delivery_query');
  if (lower.includes('size') || lower.includes('fit') || lower.includes('measure')) intents.push('size_query');
  if (lower.includes('discount') || lower.includes('offer') || lower.includes('sale')) intents.push('discount_inquiry');
  if (lower.includes('complaint') || lower.includes('problem') || lower.includes('issue')) intents.push('complaint');

  return intents.length > 0 ? intents : ['general_inquiry'];
}
