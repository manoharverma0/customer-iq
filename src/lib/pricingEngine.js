// ─────────────────────────────────────────────────────────────────────────────
// PRICING ENGINE — Anti-hallucination price range system
// AI gives ranges from DB, never invents exact quotes.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

/**
 * Fetch all pricing entries for a business.
 */
export async function getBusinessPricing(businessId) {
  if (!supabase || !businessId) return [];

  const { data, error } = await supabase
    .from('pricing')
    .select('*')
    .eq('business_id', businessId)
    .order('service_type');

  if (error) { console.warn('Get pricing error:', error.message); return []; }
  return data || [];
}

/**
 * Find pricing entries relevant to the customer's message.
 * Uses simple keyword matching against service_type.
 */
export function matchPricingToQuery(pricingRows, message) {
  if (!pricingRows || pricingRows.length === 0 || !message) return [];
  const lower = message.toLowerCase();

  return pricingRows.filter(p => {
    const serviceWords = p.service_type.toLowerCase().split(/\s+/);
    return serviceWords.some(word => word.length > 2 && lower.includes(word));
  });
}

/**
 * Format pricing entries into a compact prompt injection string.
 * Example: "Silk Saree: ₹2,999 - ₹15,999 per piece. Price varies by fabric."
 */
export function formatPricingForPrompt(pricingRows) {
  if (!pricingRows || pricingRows.length === 0) return '';

  let result = 'PRICE RANGES (always give a range, never an exact quote):\n';
  for (const p of pricingRows) {
    const min = `₹${p.price_min.toLocaleString('en-IN')}`;
    const max = `₹${p.price_max.toLocaleString('en-IN')}`;
    const range = p.price_min === p.price_max
      ? (p.price_min === 0 ? 'Free' : min)
      : `${min} – ${max}`;
    result += `• ${p.service_type}: ${range} ${p.unit}`;
    if (p.conditions) result += ` (${p.conditions})`;
    result += '\n';
  }
  return result.trim();
}

/**
 * Validate that prices in an AI response fall within known ranges.
 * Returns { valid: boolean, invalidPrices: number[] }
 */
export function validatePricesInResponse(responseText, pricingRows) {
  if (!responseText || !pricingRows || pricingRows.length === 0) {
    return { valid: true, invalidPrices: [] };
  }

  // Extract all ₹ prices from the response
  const priceMatches = responseText.match(/₹\s*([\d,]+)/g) || [];
  const invalidPrices = [];

  // Build a set of all valid price points (min and max for each service)
  const validRanges = pricingRows.map(p => ({
    min: p.price_min,
    max: p.price_max,
  }));

  for (const match of priceMatches) {
    const num = parseInt(match.replace(/[₹,\s]/g, ''));
    if (num <= 0 || isNaN(num)) continue;

    // Check if this price falls within ANY known range
    const isValid = validRanges.some(r =>
      num >= r.min * 0.8 && num <= r.max * 1.2 // Allow 20% tolerance
    );

    if (!isValid && num > 50) { // Ignore very small numbers
      invalidPrices.push(num);
    }
  }

  return {
    valid: invalidPrices.length === 0,
    invalidPrices,
  };
}
