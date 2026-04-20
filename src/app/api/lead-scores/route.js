import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/lead-scores?businessId=xxx — Fetch all lead scores for a business

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId || !supabase) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lead_scores')
      .select(`
        *,
        conversations!inner (
          id,
          customer_name,
          urgency,
          channel,
          updated_at,
          business_id
        )
      `)
      .eq('conversations.business_id', businessId)
      .order('score', { ascending: false })
      .limit(30);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with lead labels
    const enriched = (data || []).map(lead => {
      let label, color, bg;
      if (lead.score >= 70) { label = '🔥 Hot'; color = '#dc2626'; bg = '#fef2f2'; }
      else if (lead.score >= 40) { label = '🟡 Warm'; color = '#d97706'; bg = '#fffbeb'; }
      else if (lead.score >= 20) { label = '🟢 Cool'; color = '#059669'; bg = '#ecfdf5'; }
      else { label = '❄️ Cold'; color = '#6b7280'; bg = '#f3f4f6'; }
      return { ...lead, leadLabel: label, leadColor: color, leadBg: bg };
    });

    return NextResponse.json({ leads: enriched });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
