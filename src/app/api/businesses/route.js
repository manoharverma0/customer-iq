import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateAIReply } from '@/lib/gemini';

export async function POST(request) {
  try {
    const data = await request.json();
    const action = data.action;

    if (action === 'check') {
      const { email } = data;
      const { data: profile, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_email', email)
        .single();
        
      if (error || !profile) {
        return NextResponse.json({ found: false }, { status: 200 });
      }
      return NextResponse.json({ found: true, business: profile });
    }

    if (action === 'register') {
      const { name, industry, owner_name, owner_email, owner_phone } = data;
      if (!name || !owner_email) {
        return NextResponse.json({ error: 'Name and Email are required' }, { status: 400 });
      }

      const { data: newBusiness, error } = await supabase
        .from('businesses')
        .insert({
          name,
          industry,
          owner_name,
          owner_email,
          owner_phone,
          status: 'pending',
          welcome_message: `Hi there! Welcome to ${name}. How can I assist you today?`,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ business: newBusiness });
    }

    if (action === 'generate_ai') {
      const { businessId, tone, products, policies } = data;
      if (!businessId) {
        return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
      }

      // Fetch existing business
      const { data: business } = await supabase.from('businesses').select('*').eq('id', businessId).single();
      if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

      // Generate a custom System Prompt using Gemma 4
      const promptEngineeringRequest = `
        You are an expert AI Prompt Engineer. 
        Write a highly detailed "System Prompt" for a customer service AI assistant based on the following business profile:
        
        Business Name: ${business.name}
        Industry: ${business.industry}
        Tone of Voice: ${tone || 'Professional and helpful'}
        Products/Services: ${products || 'General items'}
        Policies (Returns/Shipping): ${policies || 'Standard shipping.'}

        The output should ONLY be the prompt itself, nothing else. Use markdown lists for clarity.
      `;

      let systemPrompt = '';
      try {
        systemPrompt = await generateAIReply(promptEngineeringRequest, [], '');
      } catch (err) {
        console.warn("Failed to auto-generate prompt, using fallback", err);
        systemPrompt = `You are an AI customer support assistant for "${business.name}", a ${business.industry} brand.\n\nKeep your tone ${tone || 'helpful'}.\nYou sell: ${products}\nPolicies: ${policies}`;
      }

      // Update Supabase
      const { data: updatedBusiness, error } = await supabase
        .from('businesses')
        .update({
          system_prompt: systemPrompt,
          products_summary: JSON.stringify(products ? products.split(',') : []),
          status: 'active'
        })
        .eq('id', businessId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ business: updatedBusiness });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Business onboarding error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.from('businesses').select('id, name, industry').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
