'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './customers.module.css';

const URGENCY_CONFIG = {
  high:   { label: 'High Priority',   bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dot: '🔴', desc: 'Needs immediate attention — hot lead or complaint' },
  medium: { label: 'Medium Priority', bg: '#fffbeb', color: '#d97706', border: '#fde68a', dot: '🟡', desc: 'Follow up within 1 hour — warm interest or question' },
  low:    { label: 'Low Priority',    bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', dot: '🟢', desc: 'Standard response time — browsing or general inquiry' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ name, size = 36 }) {
  const initials = (name || 'V').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#4f46e5','#0284c7','#059669','#d97706','#dc2626','#7c3aed','#0891b2'];
  const color = colors[(name || 'V').charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, minWidth: size,
      borderRadius: '50%', background: color,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);
    fetch('/api/customers')
      .then(r => r.json())
      .then(d => { setCustomers(d.customers || []); })
      .catch(() => {})
      .finally(() => { clearTimeout(timeout); setLoading(false); });
    return () => clearTimeout(timeout);
  }, []);

  const filtered = filter === 'all' ? customers : customers.filter(c => (c.urgency || 'low') === filter);

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Customers</h1>
          <p className={styles.subtitle}>Customer profiles with AI conversation urgency</p>
        </div>
        <Link href="/live" className={styles.liveLink}>
          <span className={styles.liveDot} />
          Watch Live Conversations →
        </Link>
      </div>

      {/* ── Urgency Summary ─────────────────────────────── */}
      <div className={styles.urgencySummary}>
        {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => {
          const count = customers.filter(c => (c.urgency || 'low') === key).length;
          return (
            <button
              key={key}
              className={`${styles.urgCard} ${filter === key ? styles.urgCardActive : ''}`}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              style={filter === key ? { borderColor: cfg.color, background: cfg.bg } : {}}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem' }}>{cfg.dot}</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: cfg.color }}>{count}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 700, fontSize: '0.855rem', color: cfg.color }}>{cfg.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{cfg.desc}</div>
              </div>
            </button>
          );
        })}
        <button
          className={`${styles.urgCard} ${filter === 'all' ? styles.urgCardActive : ''}`}
          onClick={() => setFilter('all')}
          style={filter === 'all' ? { borderColor: 'var(--brand)', background: 'var(--brand-50)' } : {}}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.4rem' }}>👥</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand)' }}>{customers.length}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.855rem', color: 'var(--brand)' }}>All Customers</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 3 }}>Click to reset filter</div>
          </div>
        </button>
      </div>

      {/* ── Customer Table ───────────────────────────────── */}
      <div className={styles.tableWrap}>
        {loading ? (
          /* Skeleton */
          <div className={styles.skeleton}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className={styles.skelRow}>
                <div className={styles.skelAvatar} />
                <div style={{ flex: 1 }}>
                  <div className={styles.skelLine} style={{ width: '35%', marginBottom: 6 }} />
                  <div className={styles.skelLine} style={{ width: '60%' }} />
                </div>
                <div className={styles.skelLine} style={{ width: 80 }} />
                <div className={styles.skelLine} style={{ width: 60 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>👥</span>
            <p>No customers yet. Start a chat to see customers here.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Last Message</th>
                <th>Urgency</th>
                <th>Channel</th>
                <th>Last Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const urgency = c.urgency || 'low';
                const cfg = URGENCY_CONFIG[urgency];
                return (
                  <tr
                    key={c.id}
                    className={styles.tableRow}
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  >
                    {/* Customer name + avatar */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={c.customer_name || c.customerName} />
                        <div>
                          <div className={styles.custName}>{c.customer_name || c.customerName || 'Visitor'}</div>
                          {c.customer_phone && <div className={styles.custSub}>{c.customer_phone}</div>}
                        </div>
                      </div>
                    </td>
                    {/* Last message preview */}
                    <td>
                      <div className={styles.msgPreview}>
                        {c.lastMessage || c.recentMessages?.[0] || '—'}
                      </div>
                    </td>
                    {/* Urgency badge */}
                    <td>
                      <span className={styles.urgBadge} style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                        {cfg.dot} {cfg.label}
                      </span>
                    </td>
                    {/* Channel */}
                    <td>
                      <span className={styles.channelBadge}>
                        {c.channel === 'whatsapp' ? '📱' : '💻'} {c.channel || 'website'}
                      </span>
                    </td>
                    {/* Time */}
                    <td className={styles.timeCell}>{timeAgo(c.lastActivity || c.updated_at)}</td>
                    {/* Action */}
                    <td>
                      <Link href="/live" className={styles.viewBtn} onClick={e => e.stopPropagation()}>
                        View Chat →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Expanded urgency detail (below selected row) ── */}
      {selected && (() => {
        const urgency = selected.urgency || 'low';
        const cfg = URGENCY_CONFIG[urgency];
        return (
          <div className={styles.detailPanel} style={{ borderColor: cfg.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Avatar name={selected.customer_name || selected.customerName} size={48} />
                <div>
                  <h3 className={styles.detailName}>{selected.customer_name || selected.customerName || 'Visitor'}</h3>
                  {selected.customer_phone && <div className={styles.detailSub}>{selected.customer_phone}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className={styles.urgBadge} style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                      {cfg.dot} {cfg.label}
                    </span>
                    <span className={styles.detailDesc}>{cfg.desc}</span>
                  </div>
                </div>
              </div>
              <Link href="/live" className={styles.liveBtn}>
                💬 Open in Live Chat →
              </Link>
            </div>
            {selected.recentMessages?.length > 0 && (
              <div className={styles.recentMsgs}>
                <div className={styles.recentLabel}>Recent messages</div>
                {selected.recentMessages.slice(0, 3).map((m, i) => (
                  <div key={i} className={styles.recentMsg}>{m}</div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
