import { NextResponse } from 'next/server';
import { generateAIReply } from '@/lib/gemini';
import { generateEmbedding } from '@/lib/embeddings';
import { detectUrgency, detectBuyerIntent, getUrgencyConfig } from '@/lib/urgencyDetector';
import { getSmartFallback } from '@/lib/smartFallback';
import {
  createConversation,
  addMessage,
  logAnalyticsEvent,
  supabase,
  vectorSearchProducts,
  getConversationHistory,
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

    // ── STEP 1: Load business from DB (not hardcoded) ──────────────────────
    // businessId from URL param takes priority; fallback to demo business
    let business = null;
    if (businessId && supabase) {
      const { data } = await supabase
        .from('businesses')
        .select('id, name, system_prompt, welcome_message')
        .eq('id', businessId)
        .single();
      business = data;
    }
    // Always fall back to demo business if not found
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

    // Save customer message to DB immediately
    if (convId) {
      addMessage(convId, 'customer', message, urgency, {
        detectedIntents: detectIntents(message),
        buyerIntent,
      }).catch(() => {});

      // ✔ Persist urgency to conversations table so dashboard shows it correctly
      supabase?.from('conversations')
        .update({ urgency, updated_at: new Date().toISOString() })
        .eq('id', convId)
        .then(() => {})
        .catch(() => {});
    }

    // ── STEP 3: Check if human has taken over ─────────────────────────────
    if (convId && supabase) {
      const { data: convState } = await supabase
        .from('conversations')
        .select('ai_paused, human_last_replied_at')
        .eq('id', convId)
        .single();

      if (convState?.ai_paused) {
        const lastReply = convState.human_last_replied_at
          ? new Date(convState.human_last_replied_at).getTime()
          : 0;
        if (Date.now() - lastReply > 5 * 60 * 1000) {
          // Auto-release
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

    // ── STEP 4: Vector Search — find semantically relevant products ────────
    let retrievedProducts = [];
    if (effectiveBusinessId) {
      try {
        // Run embedding generation and DB history load in parallel
        const [queryEmbedding, dbHistory] = await Promise.all([
          generateEmbedding(message),
          convId ? getConversationHistory(convId, 20) : Promise.resolve([]),
        ]);

        // Vector search with the embedding
        if (queryEmbedding) {
          retrievedProducts = await vectorSearchProducts(queryEmbedding, effectiveBusinessId, 3);
        }

        // ── STEP 5: Generate AI reply with full context ──────────────────
        // Use DB history (true stateful) — fall back to frontend-provided history
        const history = dbHistory.length > 0 ? dbHistory : (frontendHistory || []);

        let reply;
        let responseType = 'text';
        let aiProvider = 'hf';
        let requestStored = false;
        let products = retrievedProducts; // Show matched products in UI

        try {
          reply = await generateAIReply(
            message,
            history,
            business?.system_prompt || null,
            retrievedProducts,
            business?.name || 'StyleCraft India',
            buyerIntent   // 🔑 sales mode: strong_buy | soft_buy | browse | support
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

        // Save AI reply to DB (non-blocking)
        if (convId) {
          addMessage(convId, 'ai', reply, null, {
            urgency, aiProvider,
            vectorHits: retrievedProducts.length,
            topProduct: retrievedProducts[0]?.name || null,
          }).catch(() => {});
        }

        logAnalyticsEvent('chat_message', {
          urgency, aiProvider, responseType,
          messageLength: message.length, conversationId: convId,
          productsShown: products.length, requestStored,
          vectorHits: retrievedProducts.length,
          usedDbHistory: dbHistory.length > 0,
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
            vectorHits: retrievedProducts.length,
            historyLoaded: dbHistory.length,
            businessFromDb: !!business,
          },
        });

      } catch (innerErr) {
        console.error('Vector/history pipeline error:', innerErr);
        // Fall through to basic fallback below
      }
    }

    // ── FALLBACK: No business in DB — basic AI call ───────────────────────
    const history = frontendHistory || [];
    let reply, products = [], responseType = 'text', aiProvider = 'hf', requestStored = false;

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
      addMessage(convId, 'ai', reply, null, { urgency, aiProvider }).catch(() => {});
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
  return intents.length > 0 ? intents : ['general'];
}
