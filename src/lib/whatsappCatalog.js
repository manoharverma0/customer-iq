// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP CATALOG — Product catalog formatter for WhatsApp messages
// Formats products as readable text + handles product image delivery
// ─────────────────────────────────────────────────────────────────────────────

// Base URL for product images (served from Vercel /public/products/)
const BASE_URL = 'https://customer-iq-nine.vercel.app';

// Product image map — maps product names/categories to image filenames
const PRODUCT_IMAGES = {
  'royal banarasi silk saree': '/products/saree-maroon.png',
  'banarasi silk saree': '/products/saree-maroon.png',
  'kanchipuram silk saree': '/products/saree-maroon.png',
  'emerald silk saree': '/products/saree-green.png',
  'cotton chanderi saree': '/products/saree-green.png',
  'designer printed saree': '/products/saree-green.png',
  'embroidered georgette saree': '/products/saree-green.png',
  'classic cotton kurta': '/products/kurta-blue.png',
  'designer silk kurta': '/products/kurta-blue.png',
  'embroidered nehru jacket': '/products/kurta-blue.png',
  'royal designer kurta': '/products/kurta-blue.png',
  'bridal lehenga': '/products/lehenga-pink.png',
  'bridal lehenga choli': '/products/lehenga-pink.png',
  'party lehenga': '/products/lehenga-pink.png',
  'kundan jewelry': '/products/jewelry-kundan.png',
  'kundan jewelry set': '/products/jewelry-kundan.png',
  'polki necklace': '/products/jewelry-kundan.png',
  'pearl earrings': '/products/jewelry-kundan.png',
  'premium linen shirt': '/products/shirt-cream.png',
  'linen shirt': '/products/shirt-cream.png',
  'formal shirt': '/products/shirt-cream.png',
};

// Category → default image mapping
const CATEGORY_IMAGES = {
  saree: '/products/saree-maroon.png',
  kurta: '/products/kurta-blue.png',
  lehenga: '/products/lehenga-pink.png',
  jewelry: '/products/jewelry-kundan.png',
  shirt: '/products/shirt-cream.png',
};

// Category emoji map
const CATEGORY_EMOJI = {
  saree: '👗',
  kurta: '👔',
  lehenga: '💃',
  jewelry: '💎',
  shirt: '👕',
};

/**
 * Detect if the customer is asking to see products/catalog.
 */
export function detectCatalogIntent(message) {
  const lower = (message || '').toLowerCase().trim();

  // Direct catalog requests
  if (/\b(catalog|catalogue|collection|products|menu|items|what do you have|kya hai|dikhao|dikha do)\b/i.test(lower)) {
    return { isCatalog: true, type: 'browse' };
  }

  // Category-specific browsing
  if (/\b(show|see|browse|dekho|dekhna)\b/i.test(lower)) {
    return { isCatalog: true, type: 'browse' };
  }

  // Numbered product selection (customer replying "1", "2", etc.)
  if (/^[1-6]$/.test(lower.trim())) {
    return { isCatalog: true, type: 'select', selection: parseInt(lower.trim()) };
  }

  return { isCatalog: false, type: null };
}

/**
 * Format a list of products as a WhatsApp-friendly text catalog.
 * Returns formatted string ready to send via WhatsApp.
 */
export function formatCatalogForWhatsApp(products, category = null) {
  if (!products || products.length === 0) {
    return null;
  }

  const emoji = category ? (CATEGORY_EMOJI[category] || '🛍️') : '🛍️';
  const categoryLabel = category
    ? (category === 'saree' ? 'Sarees' : category.charAt(0).toUpperCase() + category.slice(1) + 's')
    : 'Products';

  let text = `${emoji} *Our ${categoryLabel}:*\n\n`;

  products.forEach((p, i) => {
    const discount = p.original_price
      ? Math.round((1 - p.price / p.original_price) * 100)
      : (p.discount || 0);

    text += `*${i + 1}.* ${p.name}\n`;
    text += `   ₹${p.price?.toLocaleString('en-IN')}`;

    if (p.original_price && p.original_price > p.price) {
      text += ` ~~₹${p.original_price.toLocaleString('en-IN')}~~`;
    }
    if (discount > 0) {
      text += ` — *${discount}% OFF*`;
    }
    text += '\n';

    // Add category tag if mixed products
    if (!category && p.category) {
      text += `   ${CATEGORY_EMOJI[p.category] || '📦'} ${p.category}\n`;
    }

    text += '\n';
  });

  text += `Reply with a *number* (1-${products.length}) to see photos and details!\n`;
  text += `📱 Full catalog: ${BASE_URL}/catalog`;

  return text;
}

/**
 * Format a single product as a detailed WhatsApp message.
 * Designed to be sent WITH a product image.
 */
export function formatProductDetailForWhatsApp(product) {
  if (!product) return null;

  const discount = product.original_price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : (product.discount || 0);

  let text = `*${product.name}*\n`;

  if (product.category) {
    text += `${CATEGORY_EMOJI[product.category] || '📦'} ${product.category}\n`;
  }

  text += `\n💰 *₹${product.price?.toLocaleString('en-IN')}*`;
  if (product.original_price && product.original_price > product.price) {
    text += ` ~~₹${product.original_price.toLocaleString('en-IN')}~~`;
  }
  if (discount > 0) {
    text += ` — *${discount}% OFF* ✨`;
  }
  text += '\n';

  if (product.description) {
    text += `\n${product.description.slice(0, 200)}\n`;
  }

  // Features
  text += '\n';
  text += '✅ Free shipping above ₹999\n';
  text += '✅ COD available\n';
  text += '✅ 7-day easy returns\n';

  if (product.sizes && product.sizes.length > 0) {
    text += `\n📏 Sizes: ${product.sizes.join(', ')}\n`;
  }

  text += '\n🛍️ *Want to order?* Share your size, color, and delivery pincode!';

  return text;
}

/**
 * Get the public image URL for a product.
 * Used to send product images via Twilio media messages.
 */
export function getProductImageUrl(product) {
  if (!product) return null;

  // Try exact name match first
  const nameLower = (product.name || '').toLowerCase();
  for (const [key, path] of Object.entries(PRODUCT_IMAGES)) {
    if (nameLower.includes(key)) {
      return `${BASE_URL}${path}`;
    }
  }

  // Fallback to category image
  if (product.category && CATEGORY_IMAGES[product.category]) {
    return `${BASE_URL}${CATEGORY_IMAGES[product.category]}`;
  }

  return null;
}

/**
 * Get all category overview for WhatsApp (when customer asks "what do you have")
 */
export function getCategoryOverview() {
  return [
    `🛍️ *StyleCraft India — Our Collection*`,
    ``,
    `👗 *Sarees* — ₹1,999 to ₹8,999`,
    `   Banarasi, Kanchipuram, Chanderi, Georgette`,
    ``,
    `👔 *Kurtas* — ₹899 to ₹2,999`,
    `   Cotton-Silk, Embroidered, Nehru Jacket Sets`,
    ``,
    `💃 *Lehengas* — ₹5,999 to ₹15,999`,
    `   Bridal, Party, Festive with Dupatta`,
    ``,
    `💎 *Jewelry* — ₹1,499 to ₹5,999`,
    `   Kundan, Polki, Pearl, Bridal Sets`,
    ``,
    `👕 *Shirts* — ₹699 to ₹1,999`,
    `   Linen, Cotton, Formal, Casual`,
    ``,
    `Reply with a category name to see products!`,
    `Example: "show me sarees" or "kurtas"`,
    ``,
    `📱 Full catalog: ${BASE_URL}/catalog`,
  ].join('\n');
}
