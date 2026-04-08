'use client';

import { useState, useEffect } from 'react';
import styles from './customers.module.css';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        setCustomers(data.customers || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchCustomerDetail = async (id) => {
    try {
      const res = await fetch(`/api/customers?id=${id}`);
      const data = await res.json();
      setSelectedCustomer(data);
    } catch (err) {
      console.error('Failed to fetch customer', err);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      'hot-lead': { label: '🔥 Hot Lead', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
      'warm-lead': { label: '🌟 Warm Lead', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
      'active': { label: '✅ Active', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
      'new': { label: '🆕 New', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
      'at-risk': { label: '⚠️ At Risk', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    };
    return configs[status] || configs.active;
  };

  const getSentimentBar = (score) => {
    let color = '#22c55e';
    if (score < 0.5) color = '#ef4444';
    else if (score < 0.7) color = '#f59e0b';
    return { width: `${score * 100}%`, background: color };
  };

  const filteredCustomers = filter === 'all'
    ? customers
    : customers.filter(c => c.status === filter);

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'hot-lead', label: '🔥 Hot' },
    { value: 'active', label: '✅ Active' },
    { value: 'warm-lead', label: '🌟 Warm' },
    { value: 'at-risk', label: '⚠️ At Risk' },
    { value: 'new', label: '🆕 New' },
  ];

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading customers...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Customer Intelligence</h1>
            <p className={styles.subtitle}>AI-scored leads, sentiment analysis & interaction history</p>
          </div>
          <div className={styles.headerStats}>
            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>{customers.length}</span>
              <span className={styles.miniStatLabel}>Total</span>
            </div>
            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>{customers.filter(c => c.status === 'hot-lead').length}</span>
              <span className={styles.miniStatLabel}>Hot Leads</span>
            </div>
            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>₹{(customers.reduce((s, c) => s + c.totalSpent, 0) / 1000).toFixed(0)}K</span>
              <span className={styles.miniStatLabel}>Total Revenue</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              className={`${styles.filterBtn} ${filter === opt.value ? styles.filterActive : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className={styles.content}>
          {/* Customer Grid */}
          <div className={styles.grid}>
            {filteredCustomers.map((customer, i) => {
              const statusConf = getStatusConfig(customer.status);
              return (
                <button
                  key={customer.id}
                  className={`${styles.card} ${selectedCustomer?.id === customer.id ? styles.cardActive : ''}`}
                  onClick={() => fetchCustomerDetail(customer.id)}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.avatar}>
                      {customer.name.charAt(0)}
                    </div>
                    <span
                      className={styles.statusBadge}
                      style={{ color: statusConf.color, background: statusConf.bg }}
                    >
                      {statusConf.label}
                    </span>
                  </div>

                  <h3 className={styles.cardName}>{customer.name}</h3>
                  <p className={styles.cardChannel}>{customer.channel} • {customer.conversations} conversations</p>

                  <div className={styles.cardMetrics}>
                    <div className={styles.cardMetric}>
                      <span className={styles.metricLabel}>Revenue</span>
                      <span className={styles.metricValue}>₹{customer.totalSpent.toLocaleString()}</span>
                    </div>
                    <div className={styles.cardMetric}>
                      <span className={styles.metricLabel}>Lead Score</span>
                      <span className={styles.metricValue}>{customer.leadScore}/100</span>
                    </div>
                  </div>

                  <div className={styles.sentimentRow}>
                    <span className={styles.sentimentLabel}>Sentiment</span>
                    <div className={styles.sentimentBar}>
                      <div className={styles.sentimentFill} style={getSentimentBar(customer.sentiment)} />
                    </div>
                    <span className={styles.sentimentScore}>{(customer.sentiment * 100).toFixed(0)}%</span>
                  </div>

                  <div className={styles.tags}>
                    {customer.tags.slice(0, 3).map(tag => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Customer Detail Sidebar */}
          {selectedCustomer && (
            <aside className={styles.detail}>
              <div className={styles.detailHeader}>
                <div className={styles.detailAvatar}>
                  {selectedCustomer.name.charAt(0)}
                </div>
                <h3>{selectedCustomer.name}</h3>
                <p className={styles.detailEmail}>{selectedCustomer.email}</p>
                <p className={styles.detailPhone}>{selectedCustomer.phone}</p>
              </div>

              <div className={styles.detailSection}>
                <h4>Key Metrics</h4>
                <div className={styles.detailMetrics}>
                  <div className={styles.detailMetric}>
                    <span className={styles.dmLabel}>Total Spent</span>
                    <span className={styles.dmValue}>₹{selectedCustomer.totalSpent.toLocaleString()}</span>
                  </div>
                  <div className={styles.detailMetric}>
                    <span className={styles.dmLabel}>Lead Score</span>
                    <span className={styles.dmValue}>{selectedCustomer.leadScore}/100</span>
                  </div>
                  <div className={styles.detailMetric}>
                    <span className={styles.dmLabel}>Sentiment</span>
                    <span className={styles.dmValue}>{(selectedCustomer.sentiment * 100).toFixed(0)}%</span>
                  </div>
                  <div className={styles.detailMetric}>
                    <span className={styles.dmLabel}>Conversations</span>
                    <span className={styles.dmValue}>{selectedCustomer.conversations?.length || selectedCustomer.conversationCount || 0}</span>
                  </div>
                </div>
              </div>

              {selectedCustomer.conversations && selectedCustomer.conversations.length > 0 && (
                <div className={styles.detailSection}>
                  <h4>Recent Conversations</h4>
                  <div className={styles.convHistory}>
                    {selectedCustomer.conversations.map(conv => (
                      <div key={conv.id} className={styles.convHistItem}>
                        <div className={styles.convHistHeader}>
                          <span className={styles.convHistChannel}>{conv.channel}</span>
                          <span className={styles.convHistUrgency} style={{
                            color: conv.urgency === 'high' ? '#ef4444' : conv.urgency === 'medium' ? '#f59e0b' : '#22c55e',
                          }}>
                            {conv.urgency === 'high' ? '🔴' : conv.urgency === 'medium' ? '🟡' : '🟢'} {conv.urgency}
                          </span>
                        </div>
                        <p className={styles.convHistMsg}>
                          {conv.messages[0]?.content?.slice(0, 100)}...
                        </p>
                        {conv.revenue !== 0 && (
                          <span className={styles.convHistRev}>
                            {conv.revenue > 0 ? `+₹${conv.revenue}` : `-₹${Math.abs(conv.revenue)}`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.detailSection}>
                <h4>Tags</h4>
                <div className={styles.tags}>
                  {selectedCustomer.tags?.map(tag => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <button
                className={styles.closeDetail}
                onClick={() => setSelectedCustomer(null)}
              >
                ✕ Close
              </button>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
