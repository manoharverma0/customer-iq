import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { generateAIReply } from '@/lib/gemini';
import { getSmartFallback } from '@/lib/smartFallback';
import { detectUrgency, detectBuyerIntent, getUrgencyConfig } from '@/lib/urgencyDetector';
import {
  supabase,
  getBusinessProfile,
  createConversation,
  addMessage,
  logAnalyticsEvent,
} from '@/lib/supabase';

// ─── Config ──────────────────────────────────────────────────────────────────
// The demo business — StyleCraft India (single-business mode)
const DEMO_BUSINESS_EMAIL = 'admin@stylecraft.com';

/**
 * Load the demo business from Supabase once per cold start.
 * We cache the result in module scope to avoid re-fetching on every message.
 */
let _cachedBusiness = null;
async function getDemoBusiness() {
  if (_cachedBusiness) return _cachedBusiness;
  if (!supabase) return null;
  const { data } = await supabase
    .from('businesses')
    .select('id, name, system_prompt')
    .eq('owner_email', DEMO_BUSINESS_EMAIL)
    .single();
  _cachedBusiness = data || null;
  return _cachedBusiness;
}

// ─── Session management ───────────────────────────────────────────────────────
/**
 * Get or create a conversation for this WhatsApp sender.
 * Uses the conversations table, keyed on customer_name (phone) + channel.
 */
async function getOrCreateWhatsAppConversation(businessId, fromNumber) {
  if (!supabase) return null;

  // Look for an existing open conversation for this sender
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, ai_paused')
    .eq('business_id', businessId)
    .eq('customer_name', fromNumber)
    .eq('channel', 'whatsapp')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing;

  // Create a new one
  const conv = await createConversation(businessId, fromNumber, 'whatsapp');
  return conv ? { id: conv.id, ai_paused: false } : null;
}

/**
 * Load last 15 messages for conversation context (true stateful).
 */
async function loadHistory(conversationId) {
  if (!supabase || !conversationId) return [];
  const { data } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(15);
  // Map to AI format and reverse to chronological
  return (data || []).reverse().map(m => ({
    role: m.role === 'customer' ? 'user' : 'assistant',
    content: m.content,
  }));
}

// ─── TwiML helper ─────────────────────────────────────────────────────────────
/**
 * Build a TwiML XML response Twilio can parse.
 * @param {string} message - The text to send back to WhatsApp
 */
function twimlResponse(message) {
  if (!message) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  }

  // Sanitize any XML-breaking characters
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

// ─── Signature validation ─────────────────────────────────────────────────────
/**
 * Validate Twilio's X-Twilio-Signature header to ensure the request
 * genuinely came from Twilio (not a random POST).
 * Skipped in development if TWILIO_AUTH_TOKEN is not set.
 */
function validateTwilioSignature(request) {
  // For the hackathon demo we skip HMAC validation.
  // In production: re-enable twilio.validateRequest with the correct public URL.
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn('⚠️  TWILIO_AUTH_TOKEN not set — open webhook (dev mode)');
    return true;
  }
  // Token is set → Twilio will include X-Twilio-Signature on real requests.
  // We just verify the header exists (not the full HMAC) to avoid URL mismatch bugs.
  const signature = request.headers.get('x-twilio-signature');
  if (!signature) {
    console.warn('⚠️  No X-Twilio-Signature header — possible non-Twilio request');
    // Still allow through for sandbox testing (Twilio sandbox sometimes omits it)
    return true;
  }
  return true; // Full HMAC re-enable: twilio.validateRequest(authToken, signature, TWILIO_WEBHOOK_URL, params)
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    // Twilio sends form-encoded data, not JSON
    const formData = await request.formData();

    // Log ALL incoming fields for debugging in Vercel logs
    console.log('📩 Twilio POST received');
    const allFields = {};
    for (const [key, val] of formData.entries()) allFields[key] = val;
    console.log('📋 Twilio fields:', JSON.stringify(allFields));

    // Validate (relaxed for demo)
    if (!validateTwilioSignature(request)) {
      console.warn('❌ Twilio webhook: rejected');
      return new Response('Forbidden', { status: 403 });
    }

    const message  = (formData.get('Body') || '').trim();
    const from     = formData.get('From') || '';      // "whatsapp:+919876543210"
    const fromNum  = from.replace('whatsapp:', '');   // "+919876543210"

    console.log(`📨 WhatsApp inbound | from: ${fromNum} | msg: "${message.slice(0, 80)}"`);

    // ── 1. Load business + detect urgency + detect buyer intent (parallel) ─────
    const [business, urgency, buyerIntent] = await Promise.all([
      getDemoBusiness(),
      Promise.resolve(detectUrgency(message)),
      Promise.resolve(detectBuyerIntent(message)),
    ]);
    const businessId   = business?.id || null;
    const systemPrompt = business?.system_prompt || null;

    console.log(`🎯 Urgency: ${urgency} | Intent: ${buyerIntent} | from: ${fromNum}`);

    // ── 2. Get/create conversation + load history (parallel) ──────────────────
    const [convData, history] = await Promise.all([
      businessId ? getOrCreateWhatsAppConversation(businessId, fromNum) : Promise.resolve(null),
      Promise.resolve([]), // will load after we have conversationId
    ]);
    
    const conversationId = convData?.id || null;
    const ai_paused = convData?.ai_paused || false;

    // Load history if we have a conversation
    const contextHistory = conversationId ? await loadHistory(conversationId) : [];

    // ── 3. Update conversation urgency in DB ──────────────────────────────────
    // ── 3. Update conversation urgency in DB ──────────────────────────────────
    // Smart Urgency logic: never downgrade urgency, only escalate
    if (conversationId && supabase) {
      const weight = { low: 1, medium: 2, high: 3 };
      const currentWeight = weight[convData?.urgency] || 0;
      const newWeight = weight[urgency] || 1;
      const finalUrgency = newWeight > currentWeight ? urgency : convData?.urgency || urgency;

      await supabase
        .from('conversations')
        .update({
          urgency: finalUrgency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .then(() => console.log(`✅ Urgency escalated to '${finalUrgency}' saved to conversation ${conversationId}`))
        .catch(e => console.warn('⚠️ Could not update urgency:', e.message));
    }

    // ── 4. Save incoming message (non-blocking) ────────────────────────────────
    const saveIncoming = conversationId
      ? addMessage(conversationId, 'customer', message, urgency, {
          channel: 'whatsapp',
          from: fromNum,
          urgency,
          buyerIntent,
        }).catch(e => console.warn('⚠️  Save incoming failed:', e.message))
      : Promise.resolve();

    // ── 5. Generate AI reply (with buyer intent for sales mode) ───────────────
    let reply = '';
    let aiProvider = 'huggingface';

    if (ai_paused) {
      console.log(`⏸️ AI is paused (human takeover) for ${fromNum}. Skipping AI generation.`);
      await saveIncoming; // Ensure incoming is saved before we return
      return twimlResponse(''); // Return empty so Twilio sends nothing
    }

    try {
      reply = await generateAIReply(
        message,
        contextHistory,
        systemPrompt,
        [],              // no vector search on WhatsApp for now (no embedding step)
        business?.name || 'StyleCraft India',
        buyerIntent      // 🔑 sales mode trigger
      );
      console.log(`✅ AI replied via HuggingFace (${reply.length} chars) | intent: ${buyerIntent}`);
    } catch (aiError) {
      console.warn('⚠️  HuggingFace unavailable, using smart fallback:', aiError.message?.slice(0, 80));
      const fb = await getSmartFallback(message, conversationId);
      reply = fb.text;
      aiProvider = 'keyword-fallback';
    }

    // Twilio has a 1600-char limit per WhatsApp message
    if (reply.length > 1580) {
      reply = reply.slice(0, 1577) + '...';
    }

    // ── 5. Save AI reply + analytics (non-blocking) ───────────────────────────
    saveIncoming.then(async () => {
      try {
        if (conversationId) {
          await addMessage(conversationId, 'ai', reply, null, {
            channel: 'whatsapp',
            aiProvider,
            urgency,
          });
        }
        await logAnalyticsEvent('whatsapp_message', {
          businessId,
          urgency,
          aiProvider,
          fromNumber: fromNum,
          messageLength: message.length,
          replyLength: reply.length,
          conversationId,
        });
      } catch { /* non-critical */ }
    });

    console.log(`✅ TwiML reply sent to ${fromNum}: "${reply.slice(0, 60)}..."`);

    // ── 6. Return TwiML — Twilio sends this back to the WhatsApp user ─────────
    return twimlResponse(reply);

  } catch (error) {
    console.error('❌ WhatsApp webhook error:', error);
    // Always return a valid TwiML response so Twilio doesn't retry endlessly
    return twimlResponse('Sorry, I\'m having trouble responding right now. Please try again in a moment! 🙏');
  }
}

// Twilio also sends GET requests to verify the webhook URL is reachable
export async function GET() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Bizz Assist WhatsApp webhook is live ✅</Message></Response>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}
