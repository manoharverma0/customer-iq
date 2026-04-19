'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './catalog.module.css';

const PRODUCTS = [
  {
    id: 'p1',
    name: 'Banarasi Silk Saree',
    subtitle: 'Deep Maroon with Gold Zari',
    category: 'saree',
    categoryLabel: '👗 Saree',
    price: 5299,
    originalPrice: 7999,
    discount: 34,
    image: '/products/saree-maroon.png',
    rating: 4.8,
    reviews: 412,
    badge: '🔥 Bestseller',
    badgeColor: '#ef4444',
    tags: ['Silk', 'Wedding', 'Zari Border', 'Blouse Included'],
    sizes: ['Free Size (5.5m)'],
    description: 'Pure Banarasi silk with real gold zari weave. Perfect for weddings and festive occasions. Comes with matching blouse piece.',
    chatMsg: 'I want to order the Banarasi Silk Saree in Maroon',
  },
  {
    id: 'p2',
    name: 'Emerald Silk Saree',
    subtitle: 'Emerald Green with Temple Border',
    category: 'saree',
    categoryLabel: '👗 Saree',
    price: 4499,
    originalPrice: 6499,
    discount: 31,
    image: '/products/saree-green.png',
    rating: 4.7,
    reviews: 298,
    badge: '✨ New Arrival',
    badgeColor: '#6366f1',
    tags: ['Silk', 'Festival', 'Peacock Motif', 'Temple Border'],
    sizes: ['Free Size (5.5m)'],
    description: 'Stunning emerald green silk with intricate peacock motifs and golden temple border. A showstopper for any occasion.',
    chatMsg: 'I want to order the Emerald Silk Saree in Green',
  },
  {
    id: 'p3',
    name: 'Royal Designer Kurta',
    subtitle: 'Royal Blue with Embroidered Collar',
    category: 'kurta',
    categoryLabel: '👔 Kurta',
    price: 1499,
    originalPrice: 2299,
    discount: 35,
    image: '/products/kurta-blue.png',
    rating: 4.6,
    reviews: 521,
    badge: '💙 Top Rated',
    badgeColor: '#3b82f6',
    tags: ['Cotton-Silk', 'Festive', 'Ethnic', 'Churidar Set'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    description: 'Elegant royal blue kurta with hand-embroidered collar and cuffs. Complete set with matching churidar. Ideal for pujas, weddings & events.',
    chatMsg: 'I want to order the Royal Designer Kurta in Blue',
  },
  {
    id: 'p4',
    name: 'Bridal Lehenga Choli',
    subtitle: 'Blush Pink with Zardozi Work',
    category: 'lehenga',
    categoryLabel: '💃 Lehenga',
    price: 8999,
    originalPrice: 15999,
    discount: 44,
    image: '/products/lehenga-pink.png',
    rating: 4.9,
    reviews: 187,
    badge: '👑 Premium',
    badgeColor: '#a855f7',
    tags: ['Bridal', 'Zardozi', 'Mirror Work', 'Dupatta Included'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'Custom'],
    description: 'Breathtaking bridal lehenga in blush pink with heavy zardozi and mirror embroidery. Comes with matching choli and dupatta. Custom sizing available.',
    chatMsg: 'I want to order the Bridal Lehenga Choli in Pink',
  },
  {
    id: 'p5',
    name: 'Kundan Jewelry Set',
    subtitle: 'Polki & Gemstone Necklace Set',
    category: 'jewelry',
    categoryLabel: '💎 Jewelry',
    price: 3199,
    originalPrice: 5499,
    discount: 42,
    image: '/products/jewelry-kundan.png',
    rating: 4.7,
    reviews: 334,
    badge: '💍 Grand',
    badgeColor: '#f59e0b',
    tags: ['Kundan', 'Polki', 'Bridal Set', 'Earrings + Maang Tikka'],
    sizes: ['One Size'],
    description: 'Exquisite full bridal set with Kundan necklace, matching earrings, and maang tikka. Set with colorful gemstones. Complements any bridal look.',
    chatMsg: 'I want to order the Kundan Jewelry Set',
  },
  {
    id: 'p6',
    name: 'Premium Linen Shirt',
    subtitle: 'Off-White Cream Slim Fit',
    category: 'shirt',
    categoryLabel: '👕 Shirt',
    price: 899,
    originalPrice: 1499,
    discount: 40,
    image: '/products/shirt-cream.png',
    rating: 4.5,
    reviews: 643,
    badge: '🌿 Eco Fabric',
    badgeColor: '#22c55e',
    tags: ['Linen', 'Casual', 'Breathable', 'Summer'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    description: 'Premium pure linen shirt in off-white cream. Ultra breathable and perfect for summer. Minimal design with premium mother-of-pearl buttons.',
    chatMsg: 'I want to order the Premium Linen Shirt in Cream',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Collection' },
  { id: 'saree', label: '👗 Sarees' },
  { id: 'kurta', label: '👔 Kurtas' },
  { id: 'lehenga', label: '💃 Lehengas' },
  { id: 'jewelry', label: '💎 Jewelry' },
  { id: 'shirt', label: '👕 Shirts' },
];

export default function CatalogPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [chatOpened, setChatOpened] = useState(false);

  const filtered = activeCategory === 'all'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === activeCategory);

  const openOrder = (product) => {
    // Navigate to chat with pre-filled order message
    const businessId = process.env.NEXT_PUBLIC_BUSINESS_ID || '';
    const chatUrl = `/chat/${businessId}?order=${encodeURIComponent(product.chatMsg)}`;
    window.open(chatUrl, '_blank');
  };

  const whatsappOrder = (product) => {
    const msg = `Hi StyleCraft India! I'd like to order:\n\n*${product.name}* - ${product.subtitle}\nPrice: ₹${product.price.toLocaleString('en-IN')}\n\nPlease confirm availability and delivery.\n\nThank you! 🙏`;
    window.open(`https://wa.me/917000000000?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroTag}>✨ StyleCraft India</span>
          <h1 className={styles.heroTitle}>Ethnic Wear Collection</h1>
          <p className={styles.heroSub}>
            Handpicked sarees, lehengas, kurtas & jewelry — crafted for every occasion.
            <br />Order via chat or WhatsApp — delivered across India in 3–5 days.
          </p>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}><span>6</span> Products</div>
            <div className={styles.heroStat}><span>★ 4.7</span> Avg Rating</div>
            <div className={styles.heroStat}><span>2,395</span> Happy Customers</div>
            <div className={styles.heroStat}><span>3–5</span> Days Delivery</div>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className={styles.filterBar}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`${styles.filterBtn} ${activeCategory === cat.id ? styles.filterActive : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className={styles.container}>
        <div className={styles.grid}>
          {filtered.map((product, i) => (
            <div
              key={product.id}
              className={styles.card}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              {/* Image */}
              <div className={styles.imgWrap} onClick={() => setSelectedProduct(product)}>
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className={styles.img}
                  sizes="(max-width: 768px) 100vw, 350px"
                />
                <div className={styles.imgOverlay}>
                  <span className={styles.viewBtn}>👁 View Details</span>
                </div>
                <span
                  className={styles.badge}
                  style={{ background: product.badgeColor }}
                >
                  {product.badge}
                </span>
                {product.discount > 0 && (
                  <span className={styles.discountBadge}>
                    -{product.discount}%
                  </span>
                )}
              </div>

              {/* Info — clean, no description */}
              <div className={styles.info}>
                <span className={styles.categoryTag}>{product.categoryLabel}</span>
                <h3 className={styles.name}>{product.name}</h3>
                <p className={styles.subtitle}>{product.subtitle}</p>

                {/* Rating */}
                <div className={styles.rating}>
                  <span className={styles.stars}>{'★'.repeat(5)}</span>
                  <span className={styles.ratingVal}>{product.rating}</span>
                  <span className={styles.reviewCount}>({product.reviews})</span>
                </div>

                {/* Price */}
                <div className={styles.pricing}>
                  <span className={styles.price}>₹{product.price.toLocaleString('en-IN')}</span>
                  {product.originalPrice && (
                    <span className={styles.originalPrice}>₹{product.originalPrice.toLocaleString('en-IN')}</span>
                  )}
                </div>

                {/* Tags — max 3 */}
                <div className={styles.tags}>
                  {product.tags.slice(0, 3).map(t => (
                    <span key={t} className={styles.tag}>{t}</span>
                  ))}
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                  <button className={styles.chatBtn} onClick={() => openOrder(product)}>💬 Order via Chat</button>
                  <button className={styles.waBtn} onClick={() => whatsappOrder(product)}>📱 WA</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Modal */}
      {selectedProduct && (
        <div className={styles.modalOverlay} onClick={() => setSelectedProduct(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedProduct(null)}>✕</button>

            <div className={styles.modalGrid}>
              {/* Image side */}
              <div className={styles.modalImgWrap}>
                <Image
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  fill
                  className={styles.modalImg}
                  sizes="500px"
                />
                <span
                  className={styles.badge}
                  style={{ background: selectedProduct.badgeColor, position: 'absolute', top: 16, left: 16 }}
                >
                  {selectedProduct.badge}
                </span>
              </div>

              {/* Detail side */}
              <div className={styles.modalDetail}>
                <span className={styles.categoryTag}>{selectedProduct.categoryLabel}</span>
                <h2 className={styles.modalName}>{selectedProduct.name}</h2>
                <p className={styles.modalSubtitle}>{selectedProduct.subtitle}</p>

                <div className={styles.rating} style={{ margin: '12px 0' }}>
                  <span className={styles.stars}>{'★'.repeat(5)}</span>
                  <span className={styles.ratingVal}>{selectedProduct.rating}</span>
                  <span className={styles.reviewCount}>({selectedProduct.reviews} reviews)</span>
                </div>

                <div className={styles.pricing} style={{ margin: '12px 0' }}>
                  <span className={styles.price} style={{ fontSize: '1.8rem' }}>
                    ₹{selectedProduct.price.toLocaleString('en-IN')}
                  </span>
                  {selectedProduct.originalPrice && (
                    <span className={styles.originalPrice}>
                      ₹{selectedProduct.originalPrice.toLocaleString('en-IN')}
                    </span>
                  )}
                  <span style={{
                    background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                    padding: '2px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700
                  }}>
                    {selectedProduct.discount}% OFF
                  </span>
                </div>

                <p className={styles.modalDesc}>{selectedProduct.description}</p>

                {/* Sizes */}
                <div className={styles.sizesWrap}>
                  <span className={styles.sizeLabel}>Available Sizes:</span>
                  <div className={styles.sizes}>
                    {selectedProduct.sizes.map(s => (
                      <span key={s} className={styles.sizeChip}>{s}</span>
                    ))}
                  </div>
                </div>

                {/* All Tags */}
                <div className={styles.tags} style={{ margin: '12px 0' }}>
                  {selectedProduct.tags.map(t => (
                    <span key={t} className={styles.tag}>{t}</span>
                  ))}
                </div>

                <div className={styles.actions} style={{ flexDirection: 'column', gap: '10px' }}>
                  <button
                    className={styles.chatBtn}
                    style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                    onClick={() => openOrder(selectedProduct)}
                  >
                    💬 Order via AI Chat
                  </button>
                  <button
                    className={styles.waBtn}
                    style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                    onClick={() => whatsappOrder(selectedProduct)}
                  >
                    📱 Order on WhatsApp
                  </button>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '12px', textAlign: 'center' }}>
                  🚚 Free delivery on orders above ₹999 &nbsp;|&nbsp; 🔄 Easy 7-day returns
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
