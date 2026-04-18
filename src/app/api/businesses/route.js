import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateAIReply } from '@/lib/gemini';

export async function POST(request) {
  try {
    const data = await request.json();
    const action = data.action;

    // LOGIN — email + password verification
    if (action === 'login') {
      const { email, password } = data;
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
      }
      const { data: profile, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_email', email)
        .single();

      if (error || !profile) {
        return NextResponse.json({ error: 'No account found with this email' }, { status: 401 });
      }
      if (profile.password !== password) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
      }
      return NextResponse.json({ business: profile });
    }

    // CHECK — email-only lookup (for internal use, e.g. interview page)
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
      const { name, industry, owner_name, owner_email, owner_phone, password } = data;
      if (!name || !owner_email || !password) {
        return NextResponse.json({ error: 'Name, Email and Password are required' }, { status: 400 });
      }

      const { data: newBusiness, error } = await supabase
        .from('businesses')
        .insert({
          name,
          industry,
          owner_name,
          owner_email,
          owner_phone,
          password,                        // stored as plaintext (upgrade to hash for production)
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

    if (action === 'interview_complete') {
      const { businessId, interviewAnswers } = data;
      if (!businessId || !interviewAnswers?.length) {
        return NextResponse.json({ error: 'businessId and interviewAnswers are required' }, { status: 400 });
      }

      const { data: business } = await supabase.from('businesses').select('*').eq('id', businessId).single();
      if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

      // Build a structured transcript from the interview
      const transcript = interviewAnswers.map((a, i) => {
        const labels = [
          'Business Identity & Target Customers',
          'Products & Services (with prices)',
          'Customer Journey & Common Requests',
          'Frequently Asked Questions',
          'Policies (Shipping, Returns, Payment)',
          'Brand Voice & Personality',
        ];
        return `[${labels[i] || `Question ${i+1}`}]\n${a.answer}`;
      }).join('\n\n');

      const promptRequest = `You are an expert AI Prompt Engineer specializing in customer service bots.

A business owner just completed an onboarding interview. Based on their responses, write a comprehensive, production-ready SYSTEM PROMPT for their AI customer service agent.

BUSINESS: ${business.name}
INDUSTRY: ${business.industry}
OWNER'S INTERVIEW TRANSCRIPT:
${transcript}

INSTRUCTIONS:
- Write ONLY the system prompt, nothing else — no intro, no explanation
- Make it rich and specific — include actual products, prices, policies from the interview
- Define the AI's personality clearly using the owner's described brand voice
- Include specific instructions on how to handle common questions from the FAQ section
- Include clear rules about what to say and what NOT to say
- End with instructions to always keep conversations open with a follow-up question or CTA
- Format cleanly with sections and bullet points where helpful`;

      let systemPrompt = '';
      try {
        systemPrompt = await generateAIReply(promptRequest, [], '');
      } catch (err) {
        console.warn('AI generation failed, using structured fallback:', err.message);
        systemPrompt = `You are the AI customer service assistant for "${business.name}", a ${business.industry} business.

ABOUT THIS BUSINESS:
${interviewAnswers[0]?.answer || 'A customer-focused business.'}

PRODUCTS & SERVICES:
${interviewAnswers[1]?.answer || 'Various products and services.'}

HOW TO HANDLE CUSTOMERS:
${interviewAnswers[2]?.answer || 'Be helpful and professional.'}

COMMON QUESTIONS TO HANDLE:
${interviewAnswers[3]?.answer || 'Answer customer queries helpfully.'}

POLICIES:
${interviewAnswers[4]?.answer || 'Standard policies apply.'}

BRAND VOICE:
${interviewAnswers[5]?.answer || 'Professional and friendly.'}

Always end your response with a question or next step to keep the conversation going.`;
      }

      const { data: updatedBusiness, error: updateError } = await supabase
        .from('businesses')
        .update({ system_prompt: systemPrompt, status: 'active' })
        .eq('id', businessId)
        .select()
        .single();

      if (updateError) throw updateError;
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
  const email = searchParams.get('email');

  if (id) {
    const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  if (email) {
    const { data, error } = await supabase.from('businesses').select('*').eq('owner_email', email).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.from('businesses').select('id, name, industry').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
