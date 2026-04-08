import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to check standard password
const checkAuth = (req) => {
  const authHeader = req.headers.get('authorization');
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  return authHeader === `Bearer ${password}`;
};

export async function GET(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, owner_name, owner_email, owner_phone, created_at, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, businessId } = await request.json();

    if (!businessId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (action === 'approve') {
      const { data, error } = await supabase
        .from('businesses')
        .update({ status: 'approved' })
        .eq('id', businessId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, business: data });
    } 
    
    if (action === 'reject') {
      // Physically delete the rejected garbage requests to keep DB clean
      const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', businessId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

  } catch (error) {
    console.error('Admin Action Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
