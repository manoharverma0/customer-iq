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

function formatSlot(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return '—'; }
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

function LeadBadge({ score }) {
  let label, color, bg;
  if (score >= 70) { label = '🔥 Hot'; color = '#dc2626'; bg = '#fef2f2'; }
  else if (score >= 40) { label = '🟡 Warm'; color = '#d97706'; bg = '#fffbeb'; }
  else if (score >= 20) { label = '🟢 Cool'; color = '#059669'; bg = '#ecfdf5'; }
  else { label = '❄️ Cold'; color = '#6b7280'; bg = '#f3f4f6'; }
  return <span style={{ color, background: bg, padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>{label} {score}</span>;
}

function StatusBadge({ status }) {
  const map = {
    pending:   { bg: '#fffbeb', color: '#d97706', label: '⏳ Pending' },
    confirmed: { bg: '#ecfdf5', color: '#059669', label: '✅ Confirmed' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: '❌ Cancelled' },
    completed: { bg: '#eff6ff', color: '#2563eb', label: '✓ Completed' },
  };
  const s = map[status] || map.pending;
  return <span style={{ color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600 }}>{s.label}</span>;
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [businessId, setBusinessId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview | leads | bookings

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);

    fetch(`/api/businesses?email=${DEMO_BUSINESS_EMAIL}`)
      .then(r => r.ok ? r.json() : null)
      .then(biz => {
        if (biz?.id) {
          setBusinessId(biz.id);
          return Promise.all([
            fetch(`/api/analytics?businessId=${biz.id}`).then(r => r.ok ? r.json() : {}).catch(() => ({})),
            fetch(`/api/customers?businessId=${biz.id}`).then(r => r.ok ? r.json() : { customers: [] }).catch(() => ({ customers: [] })),
            fetch(`/api/lead-scores?businessId=${biz.id}`).then(r => r.ok ? r.json() : { leads: [] }).catch(() => ({ leads: [] })),
            fetch(`/api/bookings?businessId=${biz.id}`).then(r => r.ok ? r.json() : { bookings: [] }).catch(() => ({ bookings: [] })),
          ]);
        }
        return Promise.all([
          fetch('/api/analytics').then(r => r.ok ? r.json() : {}).catch(() => ({})),
          fetch('/api/customers').then(r => r.ok ? r.json() : { customers: [] }).catch(() => ({ customers: [] })),
          Promise.resolve({ leads: [] }),
          Promise.resolve({ bookings: [] }),
        ]);
      })
      .then(([analyticsData, customersData, leadsData, bookingsData]) => {
        setAnalytics(analyticsData);
        setConversations(customersData?.customers || []);
        setLeads(leadsData?.leads || []);
        setBookings(bookingsData?.bookings || []);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => clearTimeout(timeout);
  }, []);

  const handleBookingAction = async (bookingId, status) => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status }),
      });
      if (res.ok) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.headerLeft}>
              <div style={{ height: 28, width: 240, borderRadius: 8, background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
              <div style={{ height: 16, width: 200, marginTop: 8, borderRadius: 6, background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
            </div>
          </div>
        </div>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        <div className={styles.statsGrid}>
          {[1,2,3,4].map(i => (
            <div key={i} className={styles.statCard}>
              <div style={{ height: 14, width: '50%', borderRadius: 6, background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', marginBottom: 16 }} />
              <div style={{ height: 36, width: '70%', borderRadius: 6, background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', marginBottom: 10 }} />
              <div style={{ height: 12, width: '40%', borderRadius: 6, background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalConversations = analytics?.totalConversations ?? conversations.length;
  const totalRevenue = analytics?.totalRevenue ?? 0;
  const highUrgency = analytics?.urgencyBreakdown?.high ?? conversations.filter(c => c.urgency === 'high').length;
  const mediumUrgency = analytics?.urgencyBreakdown?.medium ?? conversations.filter(c => c.urgency === 'medium').length;
  const lowUrgency = analytics?.urgencyBreakdown?.low ?? conversations.filter(c => c.urgency === 'low').length;
  const hotLeads = leads.filter(l => l.score >= 70).length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;

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
            <span className={styles.statLabel}>Hot Leads</span>
            <div className={`${styles.statIcon} ${styles.statIconAmber}`}>🔥</div>
          </div>
          <div className={styles.statValue} style={{ color: '#dc2626' }}>{hotLeads}</div>
          <div className={`${styles.statChange} ${styles.statUp}`}>↑ AI-scored</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Pending Bookings</span>
            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>📅</div>
          </div>
          <div className={styles.statValue} style={{ color: '#d97706' }}>{pendingBookings}</div>
          <div className={`${styles.statChange} ${styles.statNeutral}`}>Need confirmation</div>
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

      {/* ── Tab Switcher ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px', marginBottom: 16 }}>
        {[
          { key: 'overview', label: '💬 Conversations' },
          { key: 'leads', label: '🎯 Lead Scoreboard' },
          { key: 'bookings', label: '📅 Bookings' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: activeTab === tab.key ? 'var(--brand)' : 'var(--bg-card)',
              color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className={styles.contentGrid}>

        {/* ── TAB: Conversations ─── */}
        {activeTab === 'overview' && (
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
        )}

        {/* ── TAB: Lead Scoreboard ─── */}
        {activeTab === 'leads' && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}><span>🎯</span> Lead Scoreboard</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>AI-scored from conversations</span>
            </div>
            {leads.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>🎯</span>
                <p className={styles.emptyText}>No lead scores yet. Scores are generated after 5+ messages per conversation.</p>
              </div>
            ) : (
              <div style={{ padding: '0 12px 12px' }}>
                {leads.map(lead => (
                  <div key={lead.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 8px',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg-hover)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', flexShrink: 0,
                    }}>
                      {(lead.conversations?.customer_name || 'V')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {lead.conversations?.customer_name || 'Visitor'}
                        </span>
                        <LeadBadge score={lead.score} />
                      </div>
                      {lead.needs_summary && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0', lineHeight: 1.4 }}>
                          📋 {lead.needs_summary.slice(0, 120)}
                        </p>
                      )}
                      {lead.budget_detected && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--brand)', fontWeight: 600 }}>
                          💰 Budget: {lead.budget_detected}
                        </span>
                      )}
                      {lead.next_action && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '2px 0', fontStyle: 'italic' }}>
                          → {lead.next_action}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {timeAgo(lead.last_updated_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Bookings ─── */}
        {activeTab === 'bookings' && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}><span>📅</span> Bookings & Appointments</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{bookings.length} total</span>
            </div>
            {bookings.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>📅</span>
                <p className={styles.emptyText}>No bookings yet. Bookings are auto-created when customers schedule via chat.</p>
              </div>
            ) : (
              <div style={{ padding: '0 12px 12px' }}>
                {bookings.map(booking => (
                  <div key={booking.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg-hover)', fontSize: '1.1rem', flexShrink: 0,
                    }}>
                      📅
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {booking.customer_name}
                        </span>
                        <StatusBadge status={booking.status} />
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {booking.service_type} · {formatSlot(booking.slot_datetime)}
                      </p>
                      {booking.customer_phone && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>📞 {booking.customer_phone}</span>
                      )}
                    </div>
                    {booking.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => handleBookingAction(booking.id, 'confirmed')}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: '#059669', color: '#fff', fontSize: '0.72rem', fontWeight: 600,
                          }}
                        >
                          ✓ Confirm
                        </button>
                        <button
                          onClick={() => handleBookingAction(booking.id, 'cancelled')}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                            background: 'transparent', color: '#dc2626', fontSize: '0.72rem', fontWeight: 600,
                          }}
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Urgency Breakdown — always visible */}
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
              { label: 'Token Savings', value: '~80%', color: 'var(--success)' },
              { label: 'Vector Search', value: 'pgvector', color: 'var(--brand)' },
              { label: 'Lead Scoring', value: 'Active', color: 'var(--success)' },
              { label: 'Booking System', value: 'Active', color: 'var(--success)' },
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
