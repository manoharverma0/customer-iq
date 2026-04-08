import { NextResponse } from 'next/server';
import { generateAIReply } from '@/lib/gemini';
import { detectUrgency, getUrgencyConfig } from '@/lib/urgencyDetector';
import { getSmartFallback } from '@/lib/smartFallback';
import { createConversation, addMessage, getConversation, logAnalyticsEvent, getBusinessProfile } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { message, conversationId, conversationHistory, businessId } = await request.json();

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
          const conv = await createConversation(businessId, 'Visitor', 'website');
          convId = conv?.id || null;
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

    // 4. Start AI generation immediately
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

    // 5. Wait for DB write to complete, then log analytics (non-blocking)
    dbPromise.then(async () => {
      try {
        if (convId) {
          await addMessage(convId, 'ai', reply, null, { urgency, aiProvider, hasProducts: products.length > 0 });
        }
        await logAnalyticsEvent('chat_message', {
          urgency, aiProvider, responseType,
          messageLength: message.length, conversationId: convId,
          productsShown: products.length, requestStored,
        });
      } catch { /* non-critical */ }
    });

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
