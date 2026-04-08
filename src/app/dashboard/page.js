'use client';

import { useState, useEffect } from 'react';
import styles from './dashboard.module.css';
import MetricCard from '@/components/MetricCard';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        {payload.map((item, i) => (
          <p key={i} style={{ color: item.color }} className={styles.tooltipValue}>
            {item.name}: {typeof item.value === 'number' && item.value > 1000
              ? `₹${(item.value / 1000).toFixed(0)}K`
              : item.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For demo purposes, we retrieve the active business from local storage
    const activeBusinessId = localStorage.getItem('active_business_id');
    const url = activeBusinessId ? `/api/analytics?businessId=${activeBusinessId}` : '/api/analytics';

    fetch(url)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (!data) return null;

  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b'];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Business Dashboard</h1>
            <p className={styles.subtitle}>Real-time analytics & revenue intelligence</p>
          </div>
          <div className={styles.headerBadge}>
            <span className={styles.liveDot} />
            Live Data
          </div>
        </div>

        {/* Metric Cards */}
        <div className={styles.metricsGrid}>
          <MetricCard
            icon="💬"
            label="Total Conversations"
            value={data.overview.totalConversations.toLocaleString()}
            growth={12}
            growthLabel="vs last month"
            delay={0}
          />
          <MetricCard
            icon="💰"
            label="Revenue Generated"
            value={`₹${(data.overview.totalRevenue / 1000).toFixed(1)}K`}
            growth={data.overview.revenueGrowth}
            growthLabel="vs last month"
            delay={100}
          />
          <MetricCard
            icon="🎯"
            label="Conversion Rate"
            value={data.overview.conversionRate}
            suffix="%"
            growth={data.overview.conversionGrowth}
            growthLabel="vs last month"
            delay={200}
          />
          <MetricCard
            icon="⚡"
            label="Avg Response Time"
            value={data.overview.avgResponseTime}
            growth={data.overview.responseImprovement}
            growthLabel="faster than before"
            delay={300}
          />
          <MetricCard
            icon="📵"
            label="Missed Messages"
            value={data.overview.missedMessages}
            growth={-data.overview.missedReduction}
            growthLabel="reduction achieved"
            delay={400}
          />
          <MetricCard
            icon="⭐"
            label="Customer Satisfaction"
            value={data.overview.customerSatisfaction}
            suffix="/5"
            growth={data.overview.satisfactionGrowth}
            growthLabel="improvement"
            delay={500}
          />
        </div>

        {/* Charts Row */}
        <div className={styles.chartsRow}>
          {/* Revenue Chart */}
          <div className={`${styles.chartCard} glass-card`}>
            <h3 className={styles.chartTitle}>📈 Revenue & Conversations Trend</h3>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.revenueByMonth}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${v / 1000}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="conversations"
                    name="Conversations"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorConv)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Urgency Distribution */}
          <div className={`${styles.chartCard} ${styles.chartSmall} glass-card`}>
            <h3 className={styles.chartTitle}>🚨 Urgency Distribution</h3>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.urgencyDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {data.urgencyDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Second Charts Row */}
        <div className={styles.chartsRow}>
          {/* Channel Performance */}
          <div className={`${styles.chartCard} glass-card`}>
            <h3 className={styles.chartTitle}>📱 Channel Performance</h3>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.channelPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="channel" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="conversations" name="Conversations" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversion" name="Conversion %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hourly Activity */}
          <div className={`${styles.chartCard} glass-card`}>
            <h3 className={styles.chartTitle}>🕐 Hourly Activity</h3>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="messages" name="Messages" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                    {data.hourlyActivity.map((entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Cards Row */}
        <div className={styles.bottomRow}>
          {/* Top Products */}
          <div className={`${styles.tableCard} glass-card`}>
            <h3 className={styles.chartTitle}>🏆 Top Products</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Mentions</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((product, i) => (
                  <tr key={i}>
                    <td>
                      <div className={styles.productName}>
                        <span className={styles.rank}>#{i + 1}</span>
                        {product.name}
                      </div>
                    </td>
                    <td>{product.mentions}</td>
                    <td className={styles.revenueCell}>₹{(product.revenue / 1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Revenue Attribution */}
          <div className={`${styles.tableCard} glass-card`}>
            <h3 className={styles.chartTitle}>💎 Revenue Attribution</h3>
            <div className={styles.attrGrid}>
              <div className={styles.attrItem}>
                <span className={styles.attrLabel}>Direct Sales</span>
                <span className={styles.attrValue}>₹{(data.revenueAttribution.directSales / 1000).toFixed(0)}K</span>
              </div>
              <div className={styles.attrItem}>
                <span className={styles.attrLabel}>Upsells</span>
                <span className={styles.attrValue}>₹{(data.revenueAttribution.upsells / 1000).toFixed(0)}K</span>
              </div>
              <div className={styles.attrItem}>
                <span className={styles.attrLabel}>Cross-sells</span>
                <span className={styles.attrValue}>₹{(data.revenueAttribution.crossSells / 1000).toFixed(0)}K</span>
              </div>
              <div className={`${styles.attrItem} ${styles.attrHighlight}`}>
                <span className={styles.attrLabel}>ROI</span>
                <span className={styles.attrValue}>{data.revenueAttribution.roi}%</span>
              </div>
              <div className={styles.attrItem}>
                <span className={styles.attrLabel}>Customer Acq. Cost</span>
                <span className={styles.attrValue}>₹{data.revenueAttribution.cac}</span>
              </div>
              <div className={styles.attrItem}>
                <span className={styles.attrLabel}>Lifetime Value</span>
                <span className={styles.attrValue}>₹{(data.revenueAttribution.ltv / 1000).toFixed(1)}K</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
