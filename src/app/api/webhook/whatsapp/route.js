import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { generateAIReply } from '@/lib/gemini';
import { getSmartFallback } from '@/lib/smartFallback';
import { detectUrgency, getUrgencyConfig } from '@/lib/urgencyDetector';
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
    .select('id')
    .eq('business_id', businessId)
    .eq('customer_name', fromNumber)
    .eq('channel', 'whatsapp')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create a new one
  const conv = await createConversation(businessId, fromNumber, 'whatsapp');
  return conv?.id || null;
}

/**
 * Load last 6 messages for conversation context.
 */
async function loadHistory(conversationId) {
  if (!supabase || !conversationId) return [];
  const { data } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(6);
  return (data || []).reverse(); // chronological order
}

// ─── TwiML helper ─────────────────────────────────────────────────────────────
/**
 * Build a TwiML XML response Twilio can parse.
 * @param {string} message - The text to send back to WhatsApp
 */
function twimlResponse(message) {
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
function validateTwilioSignature(request, body) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn('⚠️  TWILIO_AUTH_TOKEN not set — skipping signature validation (dev mode)');
    return true;
  }

  const signature = request.headers.get('x-twilio-signature') || '';
  const url = process.env.TWILIO_WEBHOOK_URL || request.url;

  // Convert URLSearchParams to plain object for Twilio validator
  const params = Object.fromEntries(body.entries());

  return twilio.validateRequest(authToken, signature, url, params);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    // Twilio sends form-encoded data, not JSON
    const formData = await request.formData();
    const rawBody = formData; // keep for signature check

    // Validate signature
    if (!validateTwilioSignature(request, formData)) {
      console.warn('❌ Twilio webhook: invalid signature — rejected');
      return new Response('Forbidden', { status: 403 });
    }

    const message  = (formData.get('Body') || '').trim();
    const from     = formData.get('From') || '';          // e.g. "whatsapp:+919876543210"
    const fromNum  = from.replace('whatsapp:', '');       // "+919876543210"

    if (!message) {
      console.warn('⚠️  Empty WhatsApp message received — ignoring');
      return twimlResponse('Sorry, I didn\'t receive any text. Please try again!');
    }

    console.log(`📨 WhatsApp inbound | from: ${fromNum} | msg: "${message.slice(0, 60)}"`);

    // ── 1. Load business + detect urgency (parallel) ──────────────────────────
    const [business, urgency] = await Promise.all([
      getDemoBusiness(),
      Promise.resolve(detectUrgency(message)),
    ]);
    const businessId   = business?.id || null;
    const systemPrompt = business?.system_prompt || null;

    // ── 2. Get/create conversation + load history (parallel) ──────────────────
    const [conversationId, history] = await Promise.all([
      businessId ? getOrCreateWhatsAppConversation(businessId, fromNum) : Promise.resolve(null),
      Promise.resolve([]), // will load after we have conversationId
    ]);

    // Load history if we have a conversation
    const contextHistory = conversationId ? await loadHistory(conversationId) : [];

    // ── 3. Save incoming message (non-blocking) ────────────────────────────────
    const saveIncoming = conversationId
      ? addMessage(conversationId, 'customer', message, urgency, {
          channel: 'whatsapp',
          from: fromNum,
          urgency,
        }).catch(e => console.warn('⚠️  Save incoming failed:', e.message))
      : Promise.resolve();

    // ── 4. Generate AI reply ──────────────────────────────────────────────────
    let reply = '';
    let aiProvider = 'huggingface';

    try {
      reply = await generateAIReply(message, contextHistory, systemPrompt);
      console.log(`✅ AI replied via HuggingFace (${reply.length} chars)`);
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
    '<?xml version="1.0" encoding="UTF-8"?><Response><Message>CustomerIQ WhatsApp webhook is live ✅</Message></Response>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}
