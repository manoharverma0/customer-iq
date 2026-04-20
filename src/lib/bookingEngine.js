// ─────────────────────────────────────────────────────────────────────────────
// BOOKING ENGINE — Agentic booking system
// AI detects booking intent → checks available slots → books → confirms
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

// ── Booking intent detection ─────────────────────────────────────────────────
const BOOKING_PATTERNS = [
  /(book|booking|appointment|schedule|slot|reserve)/i,
  /(available|availability|free time|kab aa sakte|kab milega)/i,
  /(visit|consultation|meeting|demo|trial|try on)/i,
  /(come to|walk.?in|store visit|shop visit|showroom)/i,
  /(tomorrow|today|this week|next week|kal|aaj|weekend)/i,
];

/**
 * Detect if the customer wants to book something.
 * Returns { isBooking: boolean, confidence: number }
 */
export function detectBookingIntent(message) {
  if (!message) return { isBooking: false, confidence: 0 };
  const text = message.toLowerCase();

  let matches = 0;
  for (const pattern of BOOKING_PATTERNS) {
    if (pattern.test(text)) matches++;
  }

  // Need at least 1 strong signal (book/appointment/schedule) or 2+ weak signals
  const hasStrongSignal = /(book|appointment|schedule|reserve|slot)/i.test(text);

  return {
    isBooking: hasStrongSignal || matches >= 2,
    confidence: Math.min(matches / BOOKING_PATTERNS.length, 1),
  };
}

/**
 * Get available (unbooked) slots for a business on a given date range.
 * Defaults to next 3 days if no specific date is detected.
 */
export async function getAvailableSlots(businessId, fromDate = null, days = 3) {
  if (!supabase || !businessId) return [];

  const start = fromDate || new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  const { data, error } = await supabase
    .from('available_slots')
    .select('id, slot_datetime, is_booked')
    .eq('business_id', businessId)
    .eq('is_booked', false)
    .gte('slot_datetime', start.toISOString())
    .lte('slot_datetime', end.toISOString())
    .order('slot_datetime', { ascending: true })
    .limit(10);

  if (error) {
    console.warn('Get slots error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Format available slots into a compact string for the AI prompt.
 */
export function formatSlotsForAI(slots) {
  if (!slots || slots.length === 0) {
    return 'No available slots found for the requested period.';
  }

  const grouped = {};
  for (const slot of slots) {
    const dt = new Date(slot.slot_datetime);
    const dayKey = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push(dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
  }

  let result = 'AVAILABLE SLOTS:\n';
  for (const [day, times] of Object.entries(grouped)) {
    result += `📅 ${day}: ${times.join(', ')}\n`;
  }
  return result.trim();
}

/**
 * Create a booking and mark the slot as booked.
 * Returns the booking record or null on failure.
 */
export async function createBooking(businessId, conversationId, customerName, customerPhone, serviceType, slotDatetime, notes = '') {
  if (!supabase || !businessId) return null;

  try {
    // 1. Mark the slot as booked (if a matching slot exists)
    if (slotDatetime) {
      await supabase
        .from('available_slots')
        .update({ is_booked: true })
        .eq('business_id', businessId)
        .eq('slot_datetime', slotDatetime);
    }

    // 2. Create the booking record
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        business_id: businessId,
        conversation_id: conversationId,
        customer_name: customerName || 'Customer',
        customer_phone: customerPhone || null,
        service_type: serviceType || 'General Inquiry',
        slot_datetime: slotDatetime || null,
        status: 'pending',
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.warn('Create booking error:', error.message);
      return null;
    }

    console.log(`📅 Booking created: ${data.id.slice(0, 8)} for ${customerName}`);
    return data;
  } catch (err) {
    console.warn('Booking creation failed:', err.message);
    return null;
  }
}

/**
 * Detect a specific date/time from the customer's message.
 * Returns a Date object or null.
 */
export function extractDateFromMessage(message) {
  const lower = message.toLowerCase();
  const now = new Date();

  if (/\b(today|aaj)\b/i.test(lower)) {
    return now;
  }
  if (/\b(tomorrow|kal)\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (/\b(day after|parson)\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d;
  }

  // Try to match "10 AM", "2 PM", "morning", "evening" etc.
  const timeMatch = lower.match(/(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    if (timeMatch[2].toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (timeMatch[2].toLowerCase() === 'am' && hour === 12) hour = 0;
    const d = new Date(now);
    d.setHours(hour, 0, 0, 0);
    if (d < now) d.setDate(d.getDate() + 1); // If the time has passed, use tomorrow
    return d;
  }

  return null;
}

/**
 * Get all bookings for a business (for dashboard display).
 */
export async function getBusinessBookings(businessId, status = null) {
  if (!supabase || !businessId) return [];

  let query = supabase
    .from('bookings')
    .select('*')
    .eq('business_id', businessId)
    .order('slot_datetime', { ascending: true });

  if (status) query = query.eq('status', status);

  const { data, error } = await query.limit(50);
  if (error) { console.warn('Get bookings error:', error.message); return []; }
  return data || [];
}
