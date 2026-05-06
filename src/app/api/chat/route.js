import { NextResponse } from 'next/server';
import { generateAIReply, generateSummary } from '@/lib/gemini';
import { generateEmbedding } from '@/lib/embeddings';
import { detectUrgency, detectBuyerIntent, getUrgencyConfig } from '@/lib/urgencyDetector';
import { getSmartFallback } from '@/lib/smartFallback';
import { getSmartContext, buildContextString, maybeGenerateSummary } from '@/lib/conversationSummary';
import { detectBookingIntent, getAvailableSlots, createBooking, formatSlotsForAI, extractDateFromMessage } from '@/lib/bookingEngine';
import { getBusinessPricing, matchPricingToQuery, formatPricingForPrompt } from '@/lib/pricingEngine';
import { scoreConversation } from '@/lib/leadScoring';
import {
  createConversation,
  addMessage,
  logAnalyticsEvent,
  supabase,
  vectorSearchProducts,
  vectorSearchKnowledge,
  keywordSearchProducts,
  getDemoBusiness,
} from '@/lib/supabase';

export async function POST(request) {
  try {
    const {
      message,
      conversationId,
      conversationHistory: frontendHistory,
      businessId,
      customerName,
      customerPhone,
    } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const urgency = detectUrgency(message);
    const urgencyConfig = getUrgencyConfig(urgency);
    const buyerIntent = detectBuyerIntent(message);
    const bookingIntent = detectBookingIntent(message);

    // ── STEP 1: Load business from DB ──────────────────────────────────────
    let business = null;
    if (businessId && supabase) {
      const { data } = await supabase
        .from('businesses')
        .select('id, name, system_prompt, welcome_message')
        .eq('id', businessId)
        .single();
      business = data;
    }
    if (!business) {
      business = await getDemoBusiness();
    }

    const effectiveBusinessId = business?.id || businessId || null;

    // ── STEP 2: Ensure conversation exists in DB ───────────────────────────
    let convId = conversationId && !String(conversationId).startsWith('temp')
      ? conversationId
      : null;

    if (!convId) {
      const conv = await createConversation(
        effectiveBusinessId,
        customerName || 'Visitor',
        'website'
      );
      convId = conv?.id || null;
      if (convId && customerPhone) {
        supabase?.from('conversations')
          .update({ customer_phone: customerPhone })
          .eq('id', convId)
          .then(() => {});
      }
    }

    // ── STEP 3: Smart Urgency Upgrade & Human Takeover Check ───────────────
    if (convId && supabase) {
      const { data: convState } = await supabase
        .from('conversations')
        .select('urgency, ai_paused, human_last_replied_at')
        .eq('id', convId)
        .single();

      // Smart Urgency logic: never downgrade urgency, only escalate
      const weight = { low: 1, medium: 2, high: 3 };
      const currentWeight = weight[convState?.urgency] || 0;
      const newWeight = weight[urgency] || 1;
      const finalUrgency = newWeight > currentWeight ? urgency : convState?.urgency || urgency;

      // Save customer message to DB immediately
      addMessage(convId, 'customer', message, urgency, {
        detectedIntents: detectIntents(message),
        buyerIntent,
        bookingIntent: bookingIntent.isBooking,
      }).catch(err => console.warn('Non-critical: save customer message failed:', err.message));

      // Persist the MAX urgency to the overall conversation
      await supabase.from('conversations')
        .update({ urgency: finalUrgency, updated_at: new Date().toISOString() })
        .eq('id', convId);

      if (convState?.ai_paused) {
        const lastReply = convState.human_last_replied_at
          ? new Date(convState.human_last_replied_at).getTime()
          : 0;
        if (Date.now() - lastReply > 5 * 60 * 1000) {
          await supabase.from('conversations')
            .update({ ai_paused: false, taken_over_by: null })
            .eq('id', convId);
        } else {
          return NextResponse.json({
            reply: '⏳ Our team has seen your message and will reply shortly! Please hold on. 🙏',
            urgency, urgencyConfig, conversationId: convId,
            products: [], responseType: 'text', aiProvider: 'human-mode',
            metadata: { processedAt: new Date().toISOString(), aiProvider: 'human-mode' },
          });
        }
      }
    }

    // ── STEP 4: Parallel Data Fetch ────────────────────────────────────────
    // Fetch embedding, context summary, pricing, and booking slots in parallel
    let retrievedProducts = [];
    let retrievedKnowledge = [];
    let pricingRows = [];
    let pricingContext = '';
    let bookingContext = '';
    let conversationContext = '';

    if (effectiveBusinessId) {
      try {
        const parallelFetches = [
          generateEmbedding(message),
          convId ? getSmartContext(convId) : Promise.resolve({ summary: '', recentMessages: [] }),
          getBusinessPricing(effectiveBusinessId),
        ];

        if (bookingIntent.isBooking) {
          parallelFetches.push(getAvailableSlots(effectiveBusinessId, extractDateFromMessage(message)));
        }

        const parallelResults = await Promise.all(parallelFetches);
        const queryEmbedding = parallelResults[0];
        const smartCtx = parallelResults[1];
        const allPricing = parallelResults[2];
        const availableSlots = parallelResults[3] || null;

        // Build conversation context from rolling summary (not raw history)
        conversationContext = buildContextString(smartCtx);

        // Skip vector search for greetings — don't fetch random products for "hi"
        const isGreeting = /^(hi|hii+|hello|hey|namaste|ok|thanks|thank you)\s*[!.?]*$/i.test(message.trim());

        // Vector search: products + knowledge in parallel (skip for greetings)
        if (queryEmbedding && !isGreeting) {
          const [products, knowledge] = await Promise.all([
            vectorSearchProducts(queryEmbedding, effectiveBusinessId, 3),
            vectorSearchKnowledge(queryEmbedding, effectiveBusinessId, 3),
          ]);
          retrievedProducts = products;
          retrievedKnowledge = knowledge;
        }

        // FALLBACK: If embeddings failed (HF API down), use keyword-based DB search
        if (retrievedProducts.length === 0 && !isGreeting) {
          const recentText = smartCtx.recentMessages.map(m => m.content).join(' ');
          const searchText = message + ' ' + recentText;
          console.log('⚡ Embedding failed — using keyword product fallback');
          retrievedProducts = await keywordSearchProducts(searchText, effectiveBusinessId, 4);
        }

        // Pricing context — match relevant pricing to customer's query
        pricingRows = allPricing || [];
        const matchedPricing = matchPricingToQuery(pricingRows, message);
        if (matchedPricing.length > 0) {
          pricingContext = formatPricingForPrompt(matchedPricing);
        } else if (pricingRows.length > 0 && /price|cost|how much|kitna|budget|rate/i.test(message.toLowerCase())) {
          // If asking about price but no specific match, show all pricing
          pricingContext = formatPricingForPrompt(pricingRows);
        }

        // Booking context — show available slots if booking intent detected
        if (bookingIntent.isBooking) {
          const slots = availableSlots || await getAvailableSlots(effectiveBusinessId, extractDateFromMessage(message));
          bookingContext = formatSlotsForAI(slots);
        }

        // ── STEP 5: Generate AI reply with full dynamic context ──────────
        let reply;
        let responseType = 'text';
        let aiProvider = 'groq';
        let requestStored = false;
        let products = retrievedProducts;
        let bookingCreated = null;

        // Pass recent messages so the LLM has actual conversation memory
        const recentHistory = smartCtx.recentMessages?.slice(-6) || [];

        try {
          reply = await generateAIReply(
            message,
            recentHistory,  // Actual recent messages for multi-turn context
            business?.system_prompt || null,
            retrievedProducts,
            business?.name || 'StyleCraft India',
            buyerIntent,
            // New production params:
            retrievedKnowledge,
            pricingContext,
            bookingContext,
            conversationContext,
            pricingRows
          );
        } catch (aiError) {
          console.warn('AI unavailable, using smart fallback:', aiError.message?.slice(0, 80));
          const fallback = await getSmartFallback(message, convId);
          reply = fallback.text;
          products = fallback.products || retrievedProducts;
          responseType = fallback.type;
          requestStored = fallback.requestStored;
          aiProvider = 'smart-fallback';
        }

        // ── STEP 6: Agentic Action — Auto-create booking if confirmed ────
        if (bookingIntent.isBooking && convId && buyerIntent === 'strong_buy') {
          const targetDate = extractDateFromMessage(message);
          if (targetDate) {
            bookingCreated = await createBooking(
              effectiveBusinessId,
              convId,
              customerName || 'Customer',
              customerPhone || null,
              'General Inquiry', // Will be refined by AI context later
              targetDate.toISOString(),
              `Auto-booked via AI chat. Message: ${message.slice(0, 100)}`
            );
            if (bookingCreated) {
              responseType = 'booking';
            }
          }
        }

        // Save AI reply to DB (non-blocking)
        if (convId) {
          addMessage(convId, 'ai', reply, null, {
            urgency, aiProvider,
            vectorHits: retrievedProducts.length,
            knowledgeHits: retrievedKnowledge.length,
            topProduct: retrievedProducts[0]?.name || null,
            bookingCreated: !!bookingCreated,
            usedSummary: !!smartCtx.summary,
          }).catch(err => console.warn('Non-critical: save AI reply failed:', err.message));
        }

        // ── STEP 7: Trigger rolling summary + lead scoring (non-blocking) ─
        if (convId) {
          // Summary: compresses every 5 messages
          maybeGenerateSummary(convId, generateSummary).catch(err => console.warn('Non-critical: summary generation failed:', err.message));
          // Lead scoring: runs after summary generation
          scoreConversation(convId).catch(err => console.warn('Non-critical: lead scoring failed:', err.message));
        }

        logAnalyticsEvent('chat_message', {
          urgency, aiProvider, responseType,
          messageLength: message.length, conversationId: convId,
          productsShown: products.length, requestStored,
          vectorHits: retrievedProducts.length,
          knowledgeHits: retrievedKnowledge.length,
          usedSummary: !!smartCtx.summary,
          bookingCreated: !!bookingCreated,
          bookingIntentDetected: bookingIntent.isBooking,
        }).catch(err => console.warn('Non-critical: analytics event failed:', err.message));

        return NextResponse.json({
          reply,
          urgency,
          urgencyConfig,
          conversationId: convId,
          products,
          responseType,
          requestStored,
          bookingCreated: bookingCreated ? {
            id: bookingCreated.id,
            slotDatetime: bookingCreated.slot_datetime,
            status: bookingCreated.status,
          } : null,
          metadata: {
            processedAt: new Date().toISOString(),
            aiProvider,
            messageLength: message.length,
            vectorHits: retrievedProducts.length,
            knowledgeHits: retrievedKnowledge.length,
            usedSummary: !!smartCtx.summary,
            summaryTokens: conversationContext.length,
            businessFromDb: !!business,
          },
        });

      } catch (innerErr) {
        console.error('Production pipeline error:', innerErr);
        // Fall through to basic fallback below
      }
    }

    // ── FALLBACK: No business in DB — basic AI call ───────────────────────
    const history = frontendHistory || [];
    let reply, products = [], responseType = 'text', aiProvider = 'groq', requestStored = false;

    try {
      reply = await generateAIReply(message, history, null, [], 'StyleCraft India');
    } catch {
      const fallback = await getSmartFallback(message, convId);
      reply = fallback.text;
      products = fallback.products;
      responseType = fallback.type;
      requestStored = fallback.requestStored;
      aiProvider = 'smart-fallback';
    }

    if (convId) {
      addMessage(convId, 'ai', reply, null, { urgency, aiProvider }).catch(err => console.warn('Non-critical: save fallback reply failed:', err.message));
    }

    return NextResponse.json({
      reply, urgency, urgencyConfig, conversationId: convId,
      products, responseType, requestStored,
      metadata: { processedAt: new Date().toISOString(), aiProvider, messageLength: message.length },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    );
  }
}

function detectIntents(message) {
  const intents = [];
  const lower = message.toLowerCase();
  if (lower.includes('price') || lower.includes('cost') || lower.includes('budget')) intents.push('pricing');
  if (lower.includes('order') || lower.includes('buy') || lower.includes('purchase')) intents.push('purchase');
  if (lower.includes('refund') || lower.includes('return') || lower.includes('cancel')) intents.push('refund');
  if (lower.includes('delivery') || lower.includes('ship') || lower.includes('track')) intents.push('delivery');
  if (lower.includes('size') || lower.includes('fit')) intents.push('size');
  if (lower.includes('discount') || lower.includes('offer') || lower.includes('sale')) intents.push('discount');
  if (lower.includes('book') || lower.includes('appointment') || lower.includes('slot')) intents.push('booking');
  return intents.length > 0 ? intents : ['general'];
}
