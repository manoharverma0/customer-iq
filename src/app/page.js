'use client';

import Link from 'next/link';
import ChatWidget from '@/components/ChatWidget';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      {/* ── HERO ──────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <span className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              AI-Powered Business Assistant
            </span>

            <h1 className={styles.heroTitle}>
              Turn Every Conversation<br />
              Into a <span className={styles.accent}>Sale</span>
            </h1>

            <p className={styles.heroDesc}>
              CustomerIQ gives your business a 24/7 AI sales assistant that understands your products,
              pitches intelligently, and classifies leads by urgency — all in real time.
            </p>

            <div className={styles.heroCTA}>
              <Link href="/dashboard" className={styles.btnPrimary}>
                View Dashboard →
              </Link>
              <Link href="/catalog" className={styles.btnOutline}>
                Browse Catalog
              </Link>
            </div>

            {/* Stats row */}
            <div className={styles.statsRow}>
              {[
                { value: '< 2s',   label: 'Avg AI Response' },
                { value: '24/7',   label: 'Always Available' },
                { value: '99.8%',  label: 'Uptime' },
              ].map(s => (
                <div key={s.label} className={styles.statItem}>
                  <span className={styles.statVal}>{s.value}</span>
                  <span className={styles.statLbl}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feature card */}
          <div className={styles.heroRight}>
            <div className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <div className={styles.featureCardDots}>
                  <span /><span /><span />
                </div>
                <span className={styles.featureCardTitle}>CustomerIQ · Live Dashboard</span>
              </div>

              <div className={styles.featureMetrics}>
                {[
                  { icon: '💬', label: 'Conversations', value: '2,847', up: true },
                  { icon: '🎯', label: 'Hot Leads', value: '143', up: true },
                  { icon: '⚡', label: 'AI Handled', value: '98.6%', up: false },
                ].map(m => (
                  <div key={m.label} className={styles.metric}>
                    <span className={styles.metricIcon}>{m.icon}</span>
                    <div>
                      <div className={styles.metricValue}>{m.value}</div>
                      <div className={styles.metricLabel}>{m.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.liveConv}>
                <div className={styles.liveConvHeader}>
                  <span className={styles.liveTag}><span className={styles.liveDot} />LIVE</span>
                  <span className={styles.liveSubtitle}>Priya Sharma · WhatsApp</span>
                </div>
                <div className={styles.bubble} data-role="customer">"I need a saree for my sister's wedding, budget ₹5000"</div>
                <div className={styles.bubble} data-role="ai">"Perfect! Our Emerald Silk Saree at ₹4,499 would be stunning for a wedding — 31% off today! Want me to book it? 😊"</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className={styles.howSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>How It Works</div>
          <h2 className={styles.sectionTitle}>Intelligent by Design</h2>
          <p className={styles.sectionDesc}>A 5-step AI pipeline that goes from message to sale in under 2 seconds.</p>

          <div className={styles.stepsGrid}>
            {[
              { num: '01', icon: '📩', title: 'Message Received', desc: 'Customer sends a message via website chat or WhatsApp. Instantly captured.' },
              { num: '02', icon: '🎯', title: 'Intent Detected', desc: 'AI classifies: Is this a hot lead, browser, or support case? Urgency is automatically scored.' },
              { num: '03', icon: '🔍', title: 'Vector Product Search', desc: 'pgvector finds the 3 most semantically relevant products for the customer\'s exact query.' },
              { num: '04', icon: '🧠', title: 'Sales AI Responds', desc: 'Context-aware reply using the customer\'s history, matched products, and intent mode.' },
              { num: '05', icon: '📊', title: 'You See Everything', desc: 'Dashboard updates in real time. Take over any conversation with one click.' },
            ].map(step => (
              <div key={step.num} className={styles.step}>
                <div className={styles.stepNum}>{step.num}</div>
                <div className={styles.stepIcon}>{step.icon}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section className={styles.featSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Platform Features</div>
          <h2 className={styles.sectionTitle}>Everything Your Business Needs</h2>

          <div className={styles.featGrid}>
            {[
              { icon: '🤝', title: 'Human-in-the-Loop', desc: 'Take over any AI conversation with one click. Auto-releases back to AI after 5 minutes of inactivity.' },
              { icon: '🧠', title: 'Vector Semantic Search', desc: 'pgvector + HuggingFace embeddings match products to customer intent with 90%+ accuracy.' },
              { icon: '💾', title: 'Stateful Memory', desc: 'Full conversation history saved to Supabase. AI remembers context across sessions and page refreshes.' },
              { icon: '📱', title: 'WhatsApp + Web', desc: 'One AI brain, two channels. Works on your website and Twilio WhatsApp simultaneously.' },
              { icon: '📊', title: 'Live Analytics', desc: 'Urgency, intent, channel, and conversion data updated in real time on your dashboard.' },
              { icon: '🏆', title: 'Sales Playbooks', desc: '4 AI modes: Closer, Consultant, Guide, Support — each with expert sales psychology built in.' },
            ].map(feat => (
              <div key={feat.title} className={styles.feat}>
                <div className={styles.featIcon}>{feat.icon}</div>
                <h3 className={styles.featTitle}>{feat.title}</h3>
                <p className={styles.featDesc}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ───────────────────────────────────── */}
      <section className={styles.techSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Tech Stack</div>
          <h2 className={styles.sectionTitle}>Built on Proven Infrastructure</h2>
          <div className={styles.techGrid}>
            {[
              { name: 'Next.js 14',           role: 'App Framework',        logo: '⚡' },
              { name: 'Supabase',             role: 'Database + Auth',      logo: '🗄️' },
              { name: 'pgvector',             role: 'Semantic Search',      logo: '🔍' },
              { name: 'HuggingFace',          role: 'AI Embeddings & LLM',  logo: '🤗' },
              { name: 'Twilio',               role: 'WhatsApp Channel',     logo: '📱' },
              { name: 'Vercel',               role: 'Edge Deployment',      logo: '▲' },
            ].map(t => (
              <div key={t.name} className={styles.techCard}>
                <span className={styles.techLogo}>{t.logo}</span>
                <div>
                  <div className={styles.techName}>{t.name}</div>
                  <div className={styles.techRole}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <span className={styles.footerLogoMark}>⚡</span>
            <span className={styles.footerLogoText}>CustomerIQ</span>
          </div>
          <p className={styles.footerDesc}>AI Customer Intelligence for Indian Businesses</p>
          <div className={styles.footerLinks}>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/customers">Customers</Link>
            <Link href="/live">Live Chat</Link>
            <Link href="/catalog">Catalog</Link>
          </div>
        </div>
      </footer>

      {/* ── Chat Widget ──────────────────────────────────── */}
      <ChatWidget />
    </div>
  );
}
