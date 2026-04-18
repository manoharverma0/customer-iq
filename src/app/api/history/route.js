import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/history?id={conversationId}
// Returns the message history for a conversation so the chat widget can restore it on reload
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ messages: [] });
    if (!supabase) return NextResponse.json({ messages: [] });

    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at, metadata')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(30);

    if (error) {
      console.error('History fetch error:', error);
      return NextResponse.json({ messages: [] });
    }

    // Format for the chat widget
    const messages = (data || []).map(m => ({
      id: m.id,
      role: m.role === 'customer' ? 'customer' : 'ai',
      content: m.content,
      timestamp: m.created_at,
      isHuman: m.metadata?.isHuman || false,
    }));

    return NextResponse.json({ messages, total: messages.length });
  } catch (err) {
    console.error('History API error:', err);
    return NextResponse.json({ messages: [] });
  }
}
