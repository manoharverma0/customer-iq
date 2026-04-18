import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const HUMAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ─── GET: all conversations with messages + handoff state ────────────────────
export async function GET() {
  try {
    if (!supabase) return NextResponse.json({ conversations: [] });

    // Auto-release any conversations where human timed out:
    // - human_last_replied_at < 5 min ago, OR
    // - human_last_replied_at IS NULL (took over but never replied — still release after timeout)
    const timeout = new Date(Date.now() - HUMAN_TIMEOUT_MS).toISOString();
    await supabase
      .from('conversations')
      .update({ ai_paused: false, taken_over_by: null })
      .eq('ai_paused', true)
      .or(`human_last_replied_at.is.null,human_last_replied_at.lt.${timeout}`);

    // Fetch all recent conversations
    const { data, error } = await supabase
      .from('conversations')
      .select('*, messages(*)')
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    // Sort messages within each conversation
    const conversations = (data || []).map(conv => ({
      ...conv,
      messages: (conv.messages || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      ),
    }));

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error('Live API GET error:', err);
    return NextResponse.json({ conversations: [] });
  }
}

// ─── POST: takeover / release / send-reply ────────────────────────────────────
export async function POST(request) {
  try {
    if (!supabase) return NextResponse.json({ error: 'DB not connected' }, { status: 503 });

    const { action, conversationId, message, agentName } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    // ── TAKE OVER ─────────────────────────────────────────────────────────────
    if (action === 'takeover') {
      await supabase
        .from('conversations')
        .update({
          ai_paused: true,
          taken_over_by: agentName || 'Owner',
          human_last_replied_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      // Insert a system message so the customer knows a human is now helping
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'ai',
        content: '👤 You are now connected with a StyleCraft India team member! How can we help you? 😊',
        metadata: { isHandoff: true, agentName: agentName || 'Owner' },
      });

      return NextResponse.json({ ok: true, mode: 'human' });
    }

    // ── RELEASE back to AI ────────────────────────────────────────────────────
    if (action === 'release') {
      await supabase
        .from('conversations')
        .update({
          ai_paused: false,
          taken_over_by: null,
          human_last_replied_at: null,
        })
        .eq('id', conversationId);

      // Insert a system message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'ai',
        content: '🤖 You are now back with StyleCraft India\'s AI assistant! What else can I help you with? 😊',
        metadata: { isHandoff: true, isRelease: true },
      });

      return NextResponse.json({ ok: true, mode: 'ai' });
    }

    // ── SEND HUMAN REPLY ──────────────────────────────────────────────────────
    if (action === 'reply') {
      if (!message?.trim()) {
        return NextResponse.json({ error: 'message required' }, { status: 400 });
      }

      // Save the human reply as 'ai' role (so it shows on customer's side as the assistant)
      const { data: msg } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'ai',
        content: message.trim(),
        metadata: { isHuman: true, agentName: agentName || 'Owner' },
      }).select().single();

      // Reset 5-min timer
      await supabase
        .from('conversations')
        .update({
          human_last_replied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      return NextResponse.json({ ok: true, message: msg });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Live API POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
