'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './dashboard.module.css';

const DEMO_BUSINESS_EMAIL = 'admin@stylecraft.com';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function UrgencyBadge({ urgency }) {
  const map = {
    high:   { cls: styles.urgHigh,   label: '● High' },
    medium: { cls: styles.urgMedium, label: '● Medium' },
    low:    { cls: styles.urgLow,    label: '● Low' },
  };
  const { cls, label } = map[urgency] || map.low;
  return <span className={cls}>{label}</span>;
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/businesses?email=${DEMO_BUSINESS_EMAIL}`).then(r => r.json()).catch(() => null),
    ]).then(([biz]) => {
      const id = biz?.id;
      return Promise.all([
        fetch(`/api/analytics${id ? `?businessId=${id}` : ''}`).then(r => r.json()).catch(() => ({})),
        fetch('/api/customers').then(r => r.json()).catch(() => ({ customers: [] })),
      ]);
    }).then(([a, c]) => {
      setAnalytics(a);
      setConversations(c.customers || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading dashboard…</span>
      </div>
    );
  }

  const totalConversations = analytics?.totalConversations ?? conversations.length;
  const totalRevenue = analytics?.totalRevenue ?? 0;
  const highUrgency = analytics?.urgencyBreakdown?.high ?? conversations.filter(c => c.urgency === 'high').length;
  const mediumUrgency = analytics?.urgencyBreakdown?.medium ?? conversations.filter(c => c.urgency === 'medium').length;
  const lowUrgency = analytics?.urgencyBreakdown?.low ?? conversations.filter(c => c.urgency === 'low').length;

  const recentConvs = [...conversations]
    .sort((a, b) => new Date(b.lastActivity || b.created_at) - new Date(a.lastActivity || a.created_at))
    .slice(0, 8);

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <h1>Analytics Dashboard</h1>
            <p>StyleCraft India · AI Customer Intelligence</p>
          </div>
          <div className={styles.headerBadge}>AI Active</div>
        </div>
      </div>

      {/* ── Quick Actions ─── */}
      <div className={styles.quickActions}>
        {[
          { href: '/live',      icon: '💬', label: 'Live Chat' },
          { href: '/customers', icon: '👥', label: 'Customers' },
          { href: '/catalog',   icon: '🛍️', label: 'Catalog' },
          { href: `https://wa.me/14155238886?text=join+long-book`, icon: '📱', label: 'WhatsApp', ext: true },
        ].map(item => (
          <a
            key={item.label}
            href={item.href}
            target={item.ext ? '_blank' : undefined}
            rel={item.ext ? 'noopener' : undefined}
            className={styles.quickBtn}
          >
            <div className={styles.quickBtnIcon}>{item.icon}</div>
            <span className={styles.quickBtnLabel}>{item.label}</span>
          </a>
        ))}
      </div>

      {/* ── KPI Stats ─────────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Total Conversations</span>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>💬</div>
          </div>
          <div className={styles.statValue}>{totalConversations}</div>
          <div className={`${styles.statChange} ${styles.statUp}`}>↑ All time</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Revenue Generated</span>
            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>₹</div>
          </div>
          <div className={styles.statValue}>
            {totalRevenue > 0 ? `₹${(totalRevenue / 1000).toFixed(0)}K` : '₹0'}
          </div>
          <div className={`${styles.statChange} ${styles.statUp}`}>↑ From AI chats</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>High Urgency</span>
            <div className={`${styles.statIcon} ${styles.statIconAmber}`}>🔴</div>
          </div>
          <div className={styles.statValue} style={{ color: '#dc2626' }}>{highUrgency}</div>
          <div className={`${styles.statChange} ${styles.statNeutral}`}>Need attention</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Customers</span>
            <div className={`${styles.statIcon} ${styles.statIconPurple}`}>👥</div>
          </div>
          <div className={styles.statValue}>{conversations.length}</div>
          <div className={`${styles.statChange} ${styles.statUp}`}>↑ Unique leads</div>
        </div>
      </div>

      {/* ── Main Content Grid ──────────────────────────────────── */}
      <div className={styles.contentGrid}>

        {/* Recent Conversations Table */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}><span>💬</span> Recent Conversations</span>
            <Link href="/customers" className={styles.panelAction}>View all →</Link>
          </div>
          {recentConvs.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>💬</span>
              <p className={styles.emptyText}>No conversations yet. Start chatting to see data here.</p>
            </div>
          ) : (
            <table className={styles.convTable}>
              <thead className={styles.convTableHead}>
                <tr>
                  <th>Customer</th>
                  <th>Last Message</th>
                  <th>Urgency</th>
                  <th>Channel</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentConvs.map(conv => (
                  <tr key={conv.id} className={styles.convRow}>
                    <td>
                      <div className={styles.custCell}>
                        <div className={styles.custAvatar}>
                          {(conv.customer_name || conv.customerName || 'V')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.custName}>{conv.customer_name || conv.customerName || 'Visitor'}</div>
                          {conv.customer_phone && <div className={styles.custSub}>{conv.customer_phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.msgPreview}>
                        {conv.lastMessage || conv.recentMessages?.[0] || '—'}
                      </div>
                    </td>
                    <td><UrgencyBadge urgency={conv.urgency} /></td>
                    <td>
                      <span className={styles.channel}>
                        {conv.channel === 'whatsapp' ? '📱' : '💻'} {conv.channel || 'website'}
                      </span>
                    </td>
                    <td className={styles.timeCell}>{timeAgo(conv.lastActivity || conv.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Urgency Breakdown */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}><span>📊</span> Priority Breakdown</span>
          </div>
          <div className={styles.urgencyList}>
            <div className={styles.urgencyItem}>
              <span className={styles.urgencyIcon}>🔴</span>
              <div className={styles.urgencyContent}>
                <div className={styles.urgencyLabel}>High Priority</div>
                <div className={styles.urgencyDesc}>Immediate attention needed</div>
              </div>
              <span className={styles.urgencyCount} style={{ color: '#dc2626' }}>{highUrgency}</span>
            </div>
            <div className={styles.urgencyItem}>
              <span className={styles.urgencyIcon}>🟡</span>
              <div className={styles.urgencyContent}>
                <div className={styles.urgencyLabel}>Medium Priority</div>
                <div className={styles.urgencyDesc}>Follow up within 1 hour</div>
              </div>
              <span className={styles.urgencyCount} style={{ color: '#d97706' }}>{mediumUrgency}</span>
            </div>
            <div className={styles.urgencyItem}>
              <span className={styles.urgencyIcon}>🟢</span>
              <div className={styles.urgencyContent}>
                <div className={styles.urgencyLabel}>Low Priority</div>
                <div className={styles.urgencyDesc}>Standard response time</div>
              </div>
              <span className={styles.urgencyCount} style={{ color: '#059669' }}>{lowUrgency}</span>
            </div>
          </div>

          {/* AI Stats */}
          <div style={{ margin: '0 16px 16px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>AI Performance</div>
            {[
              { label: 'Response Rate', value: '99.8%', color: 'var(--success)' },
              { label: 'Avg Response Time', value: '< 2s', color: 'var(--brand)' },
              { label: 'AI Model', value: 'Qwen 72B', color: 'var(--warning)' },
              { label: 'Vector Search', value: 'pgvector', color: 'var(--brand)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
