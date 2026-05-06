// ─────────────────────────────────────────────────────────────────────────────
// OWNER NOTIFIER — WhatsApp alerts for hot leads
// When lead score >= 70, sends a WhatsApp message to the business owner
// with customer details, needs, budget, and a dashboard link.
// Rate-limited: max 1 alert per conversation (first-time only).
// ─────────────────────────────────────────────────────────────────────────────

import twilio from 'twilio';
import { supabase } from './supabase';

const DASHBOARD_URL = 'https://customer-iq-nine.vercel.app';
const HOT_LEAD_THRESHOLD = 70;

/**
 * Send a WhatsApp alert to the business owner when a hot lead is detected.
 * Only sends ONCE per conversation (tracks via lead_scores.owner_notified).
 *
 * @param {string} businessId - The business ID
 * @param {string} conversationId - The conversation ID
 * @param {object} leadData - Lead score data { score, budget_detected, needs_summary, urgency_detected }
 */
export async function notifyOwnerHotLead(businessId, conversationId, leadData) {
  if (!supabase || !businessId || !conversationId) return null;
  if (!leadData || leadData.score < HOT_LEAD_THRESHOLD) return null;

  try {
    // 1. Check if we already notified for this conversation
    const { data: existing } = await supabase
      .from('lead_scores')
      .select('owner_notified')
      .eq('conversation_id', conversationId)
      .single();

    if (existing?.owner_notified) {
      console.log(`📱 Owner already notified for conv ${conversationId.slice(0, 8)}`);
      return null;
    }

    // 2. Get business owner's phone number
    const { data: business } = await supabase
      .from('businesses')
      .select('name, owner_phone, owner_name')
      .eq('id', businessId)
      .single();

    // Use owner_phone from DB, fallback to env variable
    const ownerPhone = business?.owner_phone || process.env.OWNER_WHATSAPP_NUMBER;
    if (!ownerPhone) {
      console.warn('⚠️ No owner phone number configured — skipping notification');
      return null;
    }

    // 3. Get customer info from conversation
    const { data: conv } = await supabase
      .from('conversations')
      .select('customer_name, channel, urgency')
      .eq('id', conversationId)
      .single();

    const customerName = conv?.customer_name || 'Unknown';
    const channel = conv?.channel || 'website';

    // 4. Build the alert message
    const urgencyEmoji = {
      high: '🚨 HIGH',
      medium: '⚠️ MEDIUM',
      low: '🟢 LOW',
    }[leadData.urgency_detected] || '🟢 LOW';

    const alertMessage = [
      `🔥 *HOT LEAD ALERT* — ${business?.name || 'Your Business'}`,
      ``,
      `👤 Customer: ${customerName}`,
      `📱 Channel: ${channel}`,
      `💬 Wants: ${leadData.needs_summary?.slice(0, 150) || 'Not specified'}`,
      leadData.budget_detected ? `💰 Budget: ${leadData.budget_detected}` : null,
      `${urgencyEmoji}`,
      `📊 Lead Score: ${leadData.score}/100`,
      ``,
      `📌 *Action: Follow up immediately!*`,
      `🔗 Dashboard: ${DASHBOARD_URL}/live`,
      ``,
      channel === 'whatsapp'
        ? `Reply to ${customerName} on WhatsApp to take over the conversation.`
        : `Check the live dashboard to respond.`,
    ].filter(Boolean).join('\n');

    // 5. Send via Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !twilioFrom) {
      console.warn('⚠️ Twilio credentials not configured — skipping WhatsApp notification');
      return null;
    }

    const client = twilio(accountSid, authToken);

    // Format owner's phone for WhatsApp
    const formattedPhone = ownerPhone.startsWith('+')
      ? ownerPhone
      : `+91${ownerPhone.replace(/\D/g, '').slice(-10)}`;

    const msg = await client.messages.create({
      from: twilioFrom,
      to: `whatsapp:${formattedPhone}`,
      body: alertMessage,
    });

    console.log(`📱 Owner notified via WhatsApp: ${msg.sid} → ${formattedPhone}`);

    // 6. Mark as notified (prevent duplicates)
    await supabase
      .from('lead_scores')
      .update({ owner_notified: true })
      .eq('conversation_id', conversationId);

    return { messageSid: msg.sid, sentTo: formattedPhone };

  } catch (err) {
    console.warn('Owner notification failed:', err.message?.slice(0, 100));
    return null;
  }
}

/**
 * Send a product image + details to a WhatsApp user via Twilio.
 * Used when customer requests to see a specific product.
 */
export async function sendWhatsAppMedia(toNumber, text, mediaUrl) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !twilioFrom) return null;

  try {
    const client = twilio(accountSid, authToken);

    const formattedTo = toNumber.startsWith('whatsapp:')
      ? toNumber
      : `whatsapp:${toNumber.startsWith('+') ? toNumber : '+91' + toNumber.replace(/\D/g, '').slice(-10)}`;

    const msgData = {
      from: twilioFrom,
      to: formattedTo,
      body: text,
    };

    if (mediaUrl) {
      msgData.mediaUrl = [mediaUrl];
    }

    const msg = await client.messages.create(msgData);
    console.log(`📸 WhatsApp media sent: ${msg.sid}`);
    return msg;
  } catch (err) {
    console.warn('WhatsApp media send failed:', err.message?.slice(0, 100));
    return null;
  }
}
