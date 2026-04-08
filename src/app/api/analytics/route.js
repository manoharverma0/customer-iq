import { NextResponse } from 'next/server';
import { getAnalyticsSummary } from '@/lib/supabase';
import { analyticsData as seedData } from '@/data/seedData';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    // Get real data from Supabase, scoped to the business
    const realData = await getAnalyticsSummary(businessId);

    // Merge real data with seed data for demo
    const merged = { ...seedData };

    if (realData) {
      // Add real conversation count to seed data
      merged.overview = {
        ...seedData.overview,
        totalConversations: seedData.overview.totalConversations + realData.totalConversations,
        activeConversations: (seedData.overview.activeConversations || 0) + realData.totalConversations,
        totalRevenue: seedData.overview.totalRevenue + realData.totalRevenue,
      };

      // Add real urgency data
      if (realData.urgencyBreakdown) {
        merged.realUrgency = realData.urgencyBreakdown;
      }

      merged.realStats = {
        liveConversations: realData.totalConversations,
        liveMessages: realData.totalMessages,
        liveRevenue: realData.totalRevenue,
      };
    }

    return NextResponse.json(merged);
  } catch (error) {
    console.error('Analytics API error:', error);
    // Fallback to seed data
    return NextResponse.json(seedData);
  }
}
