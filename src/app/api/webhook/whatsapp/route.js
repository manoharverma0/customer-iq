import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { generateAIReply, generateSummary } from '@/lib/gemini';
import { getSmartFallback } from '@/lib/smartFallback';
import { detectUrgency, detectBuyerIntent, getUrgencyConfig } from '@/lib/urgencyDetector';
import { getSmartContext, buildContextString, maybeGenerateSummary } from '@/lib/conversationSummary';
import { detectBookingIntent, getAvailableSlots, formatSlotsForAI, extractDateFromMessage } from '@/lib/bookingEngine';
import { getBusinessPricing, matchPricingToQuery, formatPricingForPrompt } from '@/lib/pricingEngine';
import { generateEmbedding } from '@/lib/embeddings';
import { scoreConversation } from '@/lib/leadScoring';
import { sendWhatsAppMedia } from '@/lib/ownerNotifier';
import {
  detectCatalogIntent,
  formatCatalogForWhatsApp,
  formatProductDetailForWhatsApp,
  getProductImageUrl,
  getCategoryOverview,
} from '@/lib/whatsappCatalog';
import {
  supabase,
  getBusinessProfile,
  createConversation,
  addMessage,
  logAnalyticsEvent,
  vectorSearchProducts,
  vectorSearchKnowledge,
  keywordSearchProducts,
} from '@/lib/supabase';

// ─── Config ──────────────────────────────────────────────────────────────────
const DEMO_BUSINESS_EMAIL = 'admin@stylecraft.com';

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
async function getOrCreateWhatsAppConversation(businessId, fromNumber) {
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from('conversations')
    .select('id, ai_paused, urgency')
    .eq('business_id', businessId)
    .eq('customer_name', fromNumber)
    .eq('channel', 'whatsapp')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing;

  const conv = await createConversation(businessId, fromNumber, 'whatsapp');
  return conv ? { id: conv.id, ai_paused: false, urgency: 'low' } : null;
}

// ─── TwiML helper ─────────────────────────────────────────────────────────────
function twimlResponse(message) {
  if (!message) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  }

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
function validateTwilioSignature(request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn('⚠️  TWILIO_AUTH_TOKEN not set — open webhook (dev mode)');
    return true;
  }
  const signature = request.headers.get('x-twilio-signature');
  if (!signature) {
    console.warn('⚠️  No X-Twilio-Signature header');
    return true;
  }
  return true;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const formData = await request.formData();

    console.log('📩 Twilio POST received');
    const allFields = {};
    for (const [key, val] of formData.entries()) allFields[key] = val;
    console.log('📋 Twilio fields:', JSON.stringify(allFields));

    if (!validateTwilioSignature(request)) {
      return new Response('Forbidden', { status: 403 });
    }

    const message  = (formData.get('Body') || '').trim();
    const from     = formData.get('From') || '';
    const fromNum  = from.replace('whatsapp:', '');

    console.log(`📨 WhatsApp | from: ${fromNum} | msg: "${message.slice(0, 80)}"`);

    // ── 1. Load business + detect urgency + intent ─────────────────────────
    const business = await getDemoBusiness();
    const businessId = business?.id || null;
    const urgency = detectUrgency(message);
    const buyerIntent = detectBuyerIntent(message);
    const bookingIntent = detectBookingIntent(message);

    console.log(`🎯 Urgency: ${urgency} | Intent: ${buyerIntent} | from: ${fromNum}`);

    // ── 2. Get/create conversation ─────────────────────────────────────────
    const convData = businessId
      ? await getOrCreateWhatsAppConversation(businessId, fromNum)
      : null;

    const conversationId = convData?.id || null;

    // ── 3. Smart urgency (never downgrade) ─────────────────────────────────
    if (conversationId && supabase) {
      try {
        const weight = { low: 1, medium: 2, high: 3 };
        const currentWeight = weight[convData?.urgency] || 0;
        const newWeight = weight[urgency] || 1;
        const finalUrgency = newWeight > currentWeight ? urgency : convData?.urgency || urgency;

        await supabase
          .from('conversations')
          .update({ urgency: finalUrgency, updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      } catch { /* non-critical */ }
    }

    // ── 4. Save incoming message (MUST complete before context fetch) ─────
    if (conversationId) {
      await addMessage(conversationId, 'customer', message, urgency, {
        channel: 'whatsapp', from: fromNum, buyerIntent,
        bookingIntent: bookingIntent.isBooking,
      }).catch(() => {});
    }

    // ── 5. Human takeover check ────────────────────────────────────────────
    if (convData?.ai_paused) {
      return twimlResponse('');
    }

    // ── 6. Parallel data fetch: summary, embedding, pricing ────────────────
    let reply = '';
    let aiProvider = 'groq';
    let retrievedProducts = [];

    if (businessId) {
      try {
        const parallelFetches = [
          conversationId ? getSmartContext(conversationId) : Promise.resolve({ summary: '', recentMessages: [] }),
          generateEmbedding(message),
          getBusinessPricing(businessId),
        ];

        if (bookingIntent.isBooking) {
          parallelFetches.push(getAvailableSlots(businessId, extractDateFromMessage(message)));
        }

        const results = await Promise.all(parallelFetches);
        const smartCtx = results[0];
        const queryEmbedding = results[1];
        const allPricing = results[2];
        const availableSlots = results[3] || null;

        // Build conversation context from rolling summary
        const conversationContext = buildContextString(smartCtx);
        console.log(`💬 Context for AI: ${smartCtx.recentMessages.length} recent msgs | summary: ${smartCtx.summary ? 'yes' : 'no'} | ctx length: ${conversationContext.length}`);

        // Skip vector search for greetings
        const isGreeting = /^(hi|hii+|hello|hey|namaste|ok|thanks|thank you)\s*[!.?]*$/i.test(message.trim());

        // Vector search: products + knowledge (skip for greetings)
        let retrievedProducts = [];
        let retrievedKnowledge = [];
        if (queryEmbedding && !isGreeting) {
          const [products, knowledge] = await Promise.all([
            vectorSearchProducts(queryEmbedding, businessId, 3),
            vectorSearchKnowledge(queryEmbedding, businessId, 3),
          ]);
          retrievedProducts = products;
          retrievedKnowledge = knowledge;
        }

        // FALLBACK: If embeddings failed (HF API down), use keyword-based DB search
        if (retrievedProducts.length === 0 && !isGreeting) {
          // Combine current message + recent conversation context for better keyword matching
          // e.g. user says "order classic" but earlier discussed "kurta" → match kurta
          const recentText = smartCtx.recentMessages.map(m => m.content).join(' ');
          const searchText = message + ' ' + recentText;
          console.log('⚡ Embedding failed — using keyword product fallback');
          retrievedProducts = await keywordSearchProducts(searchText, businessId, 4);
        }

        // Pricing context
        let pricingContext = '';
        const pricingRows = allPricing || [];
        const matchedPricing = matchPricingToQuery(pricingRows, message);
        if (matchedPricing.length > 0) {
          pricingContext = formatPricingForPrompt(matchedPricing);
        } else if (pricingRows.length > 0 && /price|cost|how much|kitna|budget|rate/i.test(message)) {
          pricingContext = formatPricingForPrompt(pricingRows);
        }

        // Booking context
        let bookingContext = '';
        if (bookingIntent.isBooking && availableSlots) {
          bookingContext = formatSlotsForAI(availableSlots);
        }

        // Generate AI reply with full dynamic context + conversation history
        const recentHistory = smartCtx.recentMessages?.slice(-6) || [];
        reply = await generateAIReply(
          message,
          recentHistory,
          business.system_prompt || null,
          retrievedProducts,
          business.name || 'StyleCraft India',
          buyerIntent,
          retrievedKnowledge,
          pricingContext,
          bookingContext,
          conversationContext,
          pricingRows
        );

        // ── 6b. Append WhatsApp catalog when products are retrieved ────────
        if (retrievedProducts.length > 0 && !isGreeting) {
          // Detect category from products
          const topCategory = retrievedProducts[0]?.category || null;
          const catalogText = formatCatalogForWhatsApp(retrievedProducts, topCategory);
          if (catalogText && (reply.length + catalogText.length) < 1400) {
            reply += '\n\n' + catalogText;
          }
        }

        console.log(`✅ AI replied (${reply.length} chars) | intent: ${buyerIntent}`);

      } catch (aiError) {
        console.warn('⚠️ AI pipeline failed, using smart fallback:', aiError.message?.slice(0, 80));
        const fb = await getSmartFallback(message, conversationId, business?.name || 'StyleCraft India');
        reply = fb.text;
        aiProvider = 'smart-fallback';
      }
    } else {
      // No business in DB — pure fallback
      const fb = await getSmartFallback(message, conversationId);
      reply = fb.text;
      aiProvider = 'smart-fallback';
    }

    // Twilio 1600-char limit
    if (reply.length > 1580) {
      reply = reply.slice(0, 1577) + '...';
    }

    // ── 7. Save AI reply (MUST complete before response to preserve context) ─
    if (conversationId) {
      await addMessage(conversationId, 'ai', reply, null, {
        channel: 'whatsapp', aiProvider, urgency,
      }).catch(err => console.warn('Save AI reply failed:', err.message));
      // Trigger rolling summary + lead scoring (non-blocking)
      maybeGenerateSummary(conversationId, generateSummary).catch(err => console.warn('Summary gen failed:', err.message));
      scoreConversation(conversationId).catch(err => console.warn('Lead scoring failed:', err.message));
    }
    logAnalyticsEvent('whatsapp_message', {
      businessId, urgency, aiProvider,
      fromNumber: fromNum,
      messageLength: message.length,
      replyLength: reply.length,
      conversationId,
    }).catch(err => console.warn('Analytics failed:', err.message));

    // ── 8. Send product image (async, after TwiML reply) ─────────────────
    // If products were found and this looks like a product query,
    // send the top product image as a follow-up media message.
    if (retrievedProducts.length > 0 && buyerIntent !== 'greeting') {
      const topProduct = retrievedProducts[0];
      const imageUrl = getProductImageUrl(topProduct);
      if (imageUrl) {
        const productDetail = formatProductDetailForWhatsApp(topProduct);
        // Fire-and-forget: send product image as a separate message
        sendWhatsAppMedia(fromNum, productDetail, imageUrl)
          .catch(err => console.warn('Product image send failed:', err.message));
      }
    }

    console.log(`✅ TwiML reply sent to ${fromNum}: "${reply.slice(0, 60)}..."`);
    return twimlResponse(reply);

  } catch (error) {
    console.error('❌ WhatsApp webhook error:', error);
    return twimlResponse('Sorry, something went wrong. Please try again! 🙏');
  }
}

// Twilio sends GET to verify webhook URL
export async function GET() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Bizz Assist WhatsApp webhook is live ✅</Message></Response>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}
