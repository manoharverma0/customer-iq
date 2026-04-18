import { NextResponse } from 'next/server';
import { generateAIReply } from '@/lib/gemini';
import { detectUrgency, getUrgencyConfig } from '@/lib/urgencyDetector';
import { getSmartFallback } from '@/lib/smartFallback';
import { createConversation, addMessage, getConversation, logAnalyticsEvent, getBusinessProfile, supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { message, conversationId, conversationHistory, businessId, customerName, customerPhone } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Run urgency detection and business profile fetch in PARALLEL
    const [systemPromptResult, urgency] = await Promise.all([
      businessId ? getBusinessProfile(businessId).then(p => p?.system_prompt || null).catch(() => null) : Promise.resolve(null),
      Promise.resolve(detectUrgency(message)),
    ]);
    const systemPrompt = systemPromptResult;
    const urgencyConfig = getUrgencyConfig(urgency);

    // 2. DB writes are fully non-blocking — fire and forget
    //    We do NOT await these so the AI call starts immediately
    let convId = conversationId;
    const dbPromise = (async () => {
      try {
        if (!convId) {
          const conv = await createConversation(
            businessId,
            customerName || 'Visitor',
            'website'
          );
          convId = conv?.id || null;
          // Save phone number to conversation metadata if provided
          if (convId && customerPhone) {
            await supabase?.from('conversations').update({ customer_phone: customerPhone }).eq('id', convId).catch(() => {});
          }
        }
        if (convId) {
          await addMessage(convId, 'customer', message, urgency, {
            detectedIntents: detectIntents(message),
          });
        }
      } catch (dbError) {
        console.warn('Supabase write failed:', dbError.message);
      }
    })();

    // 3. Use frontend-provided history (avoids extra DB round-trip)
    const history = conversationHistory || [];

    // 4. Check if a human has taken over this conversation
    //    We await dbPromise first so convId is set
    await dbPromise;
    let isHumanMode = false;
    if (convId && supabase) {
      const { data: convState } = await supabase
        .from('conversations')
        .select('ai_paused, human_last_replied_at')
        .eq('id', convId)
        .single();

      if (convState?.ai_paused) {
        // Auto-release if human hasn't replied in 5 min
        const lastReply = convState.human_last_replied_at
          ? new Date(convState.human_last_replied_at).getTime()
          : 0;
        const elapsed = Date.now() - lastReply;
        if (elapsed > 5 * 60 * 1000) {
          // Timeout expired — release back to AI automatically
          await supabase.from('conversations')
            .update({ ai_paused: false, taken_over_by: null })
            .eq('id', convId);
        } else {
          isHumanMode = true;
        }
      }
    }

    // If human mode is ON, skip AI — reply with a holding message
    if (isHumanMode) {
      const holdingReply = '⏳ Our team has seen your message and will reply shortly! Please hold on. 🙏';
      // Log analytics non-blocking
      logAnalyticsEvent('chat_message', {
        urgency, aiProvider: 'human-mode', messageLength: message.length, conversationId: convId,
      }).catch(() => {});
      return NextResponse.json({
        reply: holdingReply,
        urgency,
        urgencyConfig,
        conversationId: convId,
        products: [],
        responseType: 'text',
        aiProvider: 'human-mode',
        metadata: { processedAt: new Date().toISOString(), aiProvider: 'human-mode', messageLength: message.length },
      });
    }

    // 5. Start AI generation
    let reply;
    let products = [];
    let responseType = 'text';
    let aiProvider = 'gemma';
    let requestStored = false;

    try {
      reply = await generateAIReply(message, history, systemPrompt);
    } catch (aiError) {
      console.warn('Gemma AI unavailable, using smart fallback:', aiError.message?.slice(0, 80));
      const fallback = await getSmartFallback(message, convId);
      reply = fallback.text;
      products = fallback.products;
      responseType = fallback.type;
      requestStored = fallback.requestStored;
      aiProvider = 'smart-fallback';
    }

    // 6. Save AI reply + log analytics (non-blocking)
    supabase && addMessage(convId, 'ai', reply, null, { urgency, aiProvider, hasProducts: products.length > 0 }).catch(() => {});
    logAnalyticsEvent('chat_message', {
      urgency, aiProvider, responseType,
      messageLength: message.length, conversationId: convId,
      productsShown: products.length, requestStored,
    }).catch(() => {});

    return NextResponse.json({
      reply,
      urgency,
      urgencyConfig,
      conversationId: convId,
      products,
      responseType,
      requestStored,
      metadata: {
        processedAt: new Date().toISOString(),
        aiProvider,
        messageLength: message.length,
      },
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
  return intents.length > 0 ? intents : ['general'];
}
