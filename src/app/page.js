import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.landing}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            AI-Powered Customer Intelligence
          </div>
          <h1 className={styles.headline}>
            Turn Every<br />
            <span className={styles.headlineGradient}>Conversation</span><br />
            Into Revenue
          </h1>
          <p className={styles.subtitle}>
            Stop losing ₹15,000/month from missed messages. Our AI chatbot detects urgency,
            generates smart replies, and tracks every conversation-to-revenue pipeline in real-time.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/onboarding" className="btn-primary">
              🚀 Get Started Free
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              📊 View Dashboard
            </Link>
          </div>

          {/* Stats Row */}
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>85%</span>
              <span className={styles.statLabel}>Fewer Missed Messages</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>₹2.8L</span>
              <span className={styles.statLabel}>Revenue Tracked</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>1.2 min</span>
              <span className={styles.statLabel}>Avg Response Time</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>32%</span>
              <span className={styles.statLabel}>Conversion Rate</span>
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className={styles.heroVisual}>
          <div className={styles.chatPreview}>
            <div className={styles.chatHeader}>
              <div className={styles.chatHeaderDot} style={{ background: '#ef4444' }} />
              <div className={styles.chatHeaderDot} style={{ background: '#f59e0b' }} />
              <div className={styles.chatHeaderDot} style={{ background: '#22c55e' }} />
              <span className={styles.chatHeaderTitle}>AI Chat Console</span>
            </div>
            <div className={styles.chatMessages}>
              <div className={`${styles.chatMsg} ${styles.incoming}`}>
                <div className={styles.urgencyDot} style={{ background: '#ef4444' }} />
                <div>
                  <span className={styles.msgName}>Priya Sharma</span>
                  <p>I need the silk saree delivered by tomorrow! It&apos;s urgent!! 🙏</p>
                </div>
              </div>
              <div className={`${styles.chatMsg} ${styles.outgoing}`}>
                <p>Hi Priya! I understand the urgency 🚀 Express delivery available — next-morning arrival at ₹299. Shall I upgrade your order?</p>
                <span className={styles.aiTag}>🤖 AI Reply</span>
              </div>
              <div className={`${styles.chatMsg} ${styles.incoming}`}>
                <div className={styles.urgencyDot} style={{ background: '#22c55e' }} />
                <div>
                  <span className={styles.msgName}>Arjun Kapoor</span>
                  <p>Just browsing, do you have casual shirts?</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>
            The Problem: <span className={styles.headlineGradient}>₹1.8 Lakh/Year Lost</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Small businesses miss 40-60% of customer messages daily. Each missed message costs ₹500 in lost revenue.
          </p>

          <div className={styles.problemGrid}>
            <div className={styles.problemCard}>
              <span className={styles.problemIcon}>📱</span>
              <h3>40-60% Messages Missed</h3>
              <p>Busy owners can&apos;t respond to every WhatsApp, Instagram, and email message in time.</p>
            </div>
            <div className={styles.problemCard}>
              <span className={styles.problemIcon}>💸</span>
              <h3>₹500 Per Missed Message</h3>
              <p>Each unanswered customer inquiry is a lost sale opportunity worth ₹500+.</p>
            </div>
            <div className={styles.problemCard}>
              <span className={styles.problemIcon}>⏰</span>
              <h3>Slow Response = Lost Customer</h3>
              <p>82% of customers expect a response within 10 minutes. Delays = competitors win.</p>
            </div>
            <div className={styles.problemCard}>
              <span className={styles.problemIcon}>📉</span>
              <h3>No Revenue Tracking</h3>
              <p>Zero visibility into which conversations lead to sales and which channels perform best.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>
            Our <span className={styles.headlineGradient}>Solution</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            AI-powered intelligence that turns every conversation into a revenue opportunity.
          </p>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔴🟡🟢</div>
              <h3>Urgency Detection AI</h3>
              <p>Automatically classifies every message as High, Medium, or Low priority so you never miss an urgent customer again.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🤖</div>
              <h3>Smart AI Replies</h3>
              <p>Context-aware responses that match your brand voice, suggest upsells, and handle complaints with empathy.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Revenue Dashboard</h3>
              <p>Real-time analytics tracking conversations → conversions → revenue with beautiful visualizations.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🧠</div>
              <h3>Customer Intelligence</h3>
              <p>AI-scored leads, sentiment analysis, and complete interaction history for every customer.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>💰</div>
              <h3>Revenue Attribution</h3>
              <p>Know exactly which channels, products, and conversations drive the most revenue for your business.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⚡</div>
              <h3>Instant Response</h3>
              <p>1.2 minute average response time. Customers get help immediately, even when you&apos;re busy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>
            Power Your Business With AI
          </h2>
          <p className={styles.ctaSubtitle}>
            Register your store, get a unique AI chat link, and start turning conversations into revenue — in minutes.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/onboarding" className="btn-primary">
              🚀 Register Your Store
            </Link>
            <Link href="/admin" className="btn-secondary">
              🛡️ Admin Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerLogo}>⚡ CustomerIQ</span>
          <span className={styles.footerText}>AI Customer Intelligence System — Hackathon 2026</span>
        </div>
      </footer>
    </div>
  );
}
