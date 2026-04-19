import { NextResponse } from 'next/server';
import { getAllConversations } from '@/lib/supabase';
import { customers as seedCustomers, conversations as seedConversations } from '@/data/seedData';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Get real conversations from Supabase
    const realConversations = await getAllConversations();

    // Convert real conversations to customer-like objects
    const realCustomers = realConversations.map((conv, i) => ({
      id: conv.id,
      name: conv.customer_name || 'Visitor',
      email: conv.customer_email || '',
      phone: '',
      avatar: null,
      channel: conv.channel || 'website',
      status: conv.status || 'active',
      totalSpent: Number(conv.revenue) || 0,
      conversations: conv.messages?.length || 0,
      lastActive: conv.updated_at || conv.created_at,
      sentiment: 0.7,
      leadScore: Math.min(100, (conv.messages?.length || 0) * 15 + 20),
      tags: [conv.channel || 'website', conv.urgency || 'low'].filter(Boolean),
      isReal: true,
    }));

    // Combine seed + real customers
    const allCustomers = [...realCustomers];

    if (id) {
      // Check real customers
      const realCustomer = realCustomers.find(c => c.id === id);
      if (realCustomer) {
        const conv = realConversations.find(c => c.id === id);
        return NextResponse.json({
          ...realCustomer,
          conversations: conv ? [{
            id: conv.id,
            channel: conv.channel,
            urgency: conv.urgency,
            messages: conv.messages || [],
            revenue: Number(conv.revenue) || 0,
          }] : [],
        });
      }

      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ customers: allCustomers, total: allCustomers.length });
  } catch (error) {
    console.error('Customers API error:', error);
    return NextResponse.json({ customers: [], total: 0 });
  }
}
