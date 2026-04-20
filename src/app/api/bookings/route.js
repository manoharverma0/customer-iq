import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/bookings?businessId=xxx — List all bookings for a business
// POST /api/bookings — Create a booking manually
// PATCH /api/bookings — Update booking status

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const status = searchParams.get('status');

    if (!businessId || !supabase) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    let query = supabase
      .from('bookings')
      .select('*')
      .eq('business_id', businessId)
      .order('slot_datetime', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query.limit(50);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, customerName, customerPhone, serviceType, slotDatetime, notes } = body;

    if (!businessId || !serviceType || !supabase) {
      return NextResponse.json({ error: 'businessId and serviceType required' }, { status: 400 });
    }

    // Mark slot as booked if it exists
    if (slotDatetime) {
      await supabase
        .from('available_slots')
        .update({ is_booked: true })
        .eq('business_id', businessId)
        .eq('slot_datetime', slotDatetime);
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        business_id: businessId,
        customer_name: customerName || 'Customer',
        customer_phone: customerPhone || null,
        service_type: serviceType,
        slot_datetime: slotDatetime || null,
        status: 'pending',
        notes: notes || null,
      })
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

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { bookingId, status } = body;

    if (!bookingId || !status || !supabase) {
      return NextResponse.json({ error: 'bookingId and status required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If cancelled, free up the slot
    if (status === 'cancelled' && data.slot_datetime) {
      await supabase
        .from('available_slots')
        .update({ is_booked: false })
        .eq('business_id', data.business_id)
        .eq('slot_datetime', data.slot_datetime);
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
