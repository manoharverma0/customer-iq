import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/pricing?businessId=xxx — List all pricing for a business
// POST /api/pricing — Add/update pricing entries

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId || !supabase) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pricing')
      .select('*')
      .eq('business_id', businessId)
      .order('service_type');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pricing: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, serviceType, priceMin, priceMax, unit, conditions } = body;

    if (!businessId || !serviceType || priceMin === undefined || priceMax === undefined || !supabase) {
      return NextResponse.json({ error: 'businessId, serviceType, priceMin, priceMax required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pricing')
      .upsert({
        business_id: businessId,
        service_type: serviceType,
        price_min: priceMin,
        price_max: priceMax,
        unit: unit || 'per item',
        conditions: conditions || null,
      }, { onConflict: 'business_id,service_type' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
