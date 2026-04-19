'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './live.module.css';

const POLL_INTERVAL = 3000;
const HUMAN_TIMEOUT = 5 * 60;

function Avatar({ name, size = 38 }) {
  const initials = (name || 'V').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#4f46e5','#0284c7','#059669','#d97706','#dc2626','#7c3aed','#0891b2'];
  const color = colors[(name || 'V').charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, minWidth: size,
      borderRadius: '50%',
      background: color,
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38,
      fontWeight: 700,
      letterSpacing: '-0.5px',
    }}>
      {initials}
    </div>
  );
}

function UrgencyChip({ urgency }) {
  const map = {
    high:   { label: 'High Priority',   bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'var(--danger-border)' },
    medium: { label: 'Medium Priority', bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-border)' },
    low:    { label: 'Low Priority',    bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)' },
  };
  const cfg = map[urgency] || map.low;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontSize: '0.72rem', fontWeight: 700,
    }}>
      {urgency === 'high' ? '🔴' : urgency === 'medium' ? '🟡' : '🟢'} {cfg.label}
    </span>
  );
}

export default function LivePage() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const messagesEndRef = useRef(null);
  const replyRef = useRef(null);
  const countdownRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/live');
      const data = await res.json();
      setConversations(data.conversations || []);
      setSelected(prev => {
        if (!prev) return null;
        return (data.conversations || []).find(c => c.id === prev.id) || prev;
      });
    } catch (err) { console.error('Poll error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages?.length]);

  useEffect(() => {
    if (!selected?.ai_paused) { setCountdown(null); clearInterval(countdownRef.current); return; }
    const lastReply = selected.human_last_replied_at ? new Date(selected.human_last_replied_at).getTime() : Date.now();
    const tick = () => {
      const remaining = Math.max(0, HUMAN_TIMEOUT - Math.floor((Date.now() - lastReply) / 1000));
      setCountdown(remaining);
      if (remaining === 0) { clearInterval(countdownRef.current); fetchConversations(); }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [selected?.ai_paused, selected?.human_last_replied_at, fetchConversations]);

  const handleTakeOver = async () => {
    if (!selected) return; setSending(true);
    try {
      const res = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'takeover', conversationId: selected.id, agentName: 'Owner' }) });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(`Takeover failed: ${data.error || 'Server Error'}\n\nPlease run fix-takeover.sql in Supabase to add the missing columns.`);
      }
    } catch (e) {
      console.error(e);
    }
    await fetchConversations(); setSending(false);
    setTimeout(() => replyRef.current?.focus(), 200);
  };

  const handleRelease = async () => {
    if (!selected) return; setSending(true);
    await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release', conversationId: selected.id }) });
    await fetchConversations(); setSending(false);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selected || sending) return;
    setSending(true); const text = replyText.trim(); setReplyText('');
    try {
      const res = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reply', conversationId: selected.id, message: text, agentName: 'Owner' }) });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(`Failed to send reply: ${data.error || 'Server Error'}\n\nDid you run fix-takeover.sql in Supabase?`);
      }
    } catch (e) {
      console.error(e);
      alert('Network error while sending reply.');
    }
    await fetchConversations(); setSending(false);
  };

  const handleKeyDown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } };

  const fmtTime = ts => { try { return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const fmtCountdown = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ── Loading skeleton ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.topLeft}>
            <h1 className={styles.topTitle}>Live Conversations</h1>
            <span className={styles.topSub}>Monitor &amp; intervene in real-time</span>
          </div>
        </div>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHead}>Loading… <span className={styles.pulsingDot} /></div>
            {[1,2,3].map(i => (
              <div key={i} className={styles.skelItem}>
                <div className={styles.skelAvatar} />
                <div style={{ flex: 1 }}>
                  <div className={styles.skelLine} style={{ width: '60%', marginBottom: 6 }} />
                  <div className={styles.skelLine} style={{ width: '90%' }} />
                </div>
              </div>
            ))}
          </aside>
          <main className={styles.main}>
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>💬</span>
              <h2>Connecting…</h2>
              <p>Loading live conversations</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <h1 className={styles.topTitle}>Live Conversations</h1>
          <span className={styles.topSub}>Monitor &amp; intervene in real-time · Polls every 3s</span>
        </div>
        <div className={styles.topStats}>
          <div className={styles.topStat}>
            <span className={styles.statDot} style={{ background: 'var(--success)' }} />
            <span>{conversations.length} Active</span>
          </div>
          <div className={styles.topStat}>
            <span className={styles.statDot} style={{ background: '#7c3aed' }} />
            <span>{conversations.filter(c => c.ai_paused).length} Human Mode</span>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* ── Conversation List ────────────────────────────── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            All Conversations
            <span className={styles.countBadge}>{conversations.length}</span>
          </div>

          <div className={styles.convList}>
            {conversations.length === 0 && (
              <div className={styles.emptyList}>
                <span>💬</span>
                <p>No conversations yet.<br />Start a chat to see it here!</p>
              </div>
            )}
            {conversations.map(conv => {
              const isSelected = selected?.id === conv.id;
              const lastMsg = conv.messages?.[conv.messages.length - 1];
              return (
                <button
                  key={conv.id}
                  className={`${styles.convItem} ${isSelected ? styles.convSelected : ''}`}
                  onClick={() => setSelected(conv)}
                >
                  {/* Avatar with mode dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={conv.customer_name} size={40} />
                    <span className={styles.modeDot} style={{ background: conv.ai_paused ? '#7c3aed' : 'var(--success)' }} title={conv.ai_paused ? 'Human mode' : 'AI mode'} />
                  </div>

                  <div className={styles.convInfo}>
                    <div className={styles.convTop}>
                      <span className={styles.convName}>{conv.customer_name || 'Visitor'}</span>
                      <span className={styles.convTime}>{fmtTime(conv.updated_at)}</span>
                    </div>
                    <p className={styles.convPreview}>{lastMsg?.content?.slice(0, 52) || 'No messages'}…</p>
                    <div className={styles.convMeta}>
                      <span className={styles.modeBadge} style={{
                        background: conv.ai_paused ? '#f5f3ff' : 'var(--success-bg)',
                        color: conv.ai_paused ? '#7c3aed' : 'var(--success)',
                        border: `1px solid ${conv.ai_paused ? '#ddd6fe' : 'var(--success-border)'}`,
                      }}>
                        {conv.ai_paused ? '👤 Human' : '🤖 AI'}
                      </span>
                      {/* Urgency inline in list */}
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        color: conv.urgency === 'high' ? 'var(--danger)' : conv.urgency === 'medium' ? 'var(--warning)' : 'var(--success)',
                      }}>
                        {conv.urgency === 'high' ? '🔴 High' : conv.urgency === 'medium' ? '🟡 Medium' : '🟢 Low'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Chat Panel ───────────────────────────────────── */}
        <main className={styles.main}>
          {!selected ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>💬</span>
              <h2>Select a conversation</h2>
              <p>Click any conversation on the left to view and manage it.</p>
            </div>
          ) : (
            <>
              {/* Chat Header with full avatar + name + urgency */}
              <div className={styles.chatHeader}>
                <div className={styles.chatHeaderLeft}>
                  <Avatar name={selected.customer_name} size={44} />
                  <div>
                    <h3 className={styles.chatName}>{selected.customer_name || 'Visitor'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      <span className={styles.chatMeta}>
                        {selected.channel} · {selected.messages?.length || 0} messages
                        {selected.customer_phone && ` · ${selected.customer_phone}`}
                      </span>
                      <UrgencyChip urgency={selected.urgency} />
                    </div>
                  </div>
                </div>

                <div className={styles.chatControls}>
                  {selected.ai_paused && countdown !== null && (
                    <div className={`${styles.countdown} ${countdown < 60 ? styles.countdownWarn : ''}`}>
                      ⏱ AI resumes in {fmtCountdown(countdown)}
                    </div>
                  )}
                  {selected.ai_paused ? (
                    <button className={styles.releaseBtn} onClick={handleRelease} disabled={sending}>🤖 Release to AI</button>
                  ) : (
                    <button className={styles.takeoverBtn} onClick={handleTakeOver} disabled={sending}>👤 Take Over</button>
                  )}
                </div>
              </div>

              {/* Mode Banner */}
              <div className={`${styles.modeBanner} ${selected.ai_paused ? styles.humanBanner : styles.aiBanner}`}>
                {selected.ai_paused ? (
                  <><span>👤</span><span><strong>Human Mode</strong> — You are replying. AI is paused. Auto-resumes in {fmtCountdown(countdown ?? 0)}.</span></>
                ) : (
                  <><span>🤖</span><span><strong>AI Mode</strong> — AI is handling this conversation. Click "Take Over" to intervene.</span></>
                )}
              </div>

              {/* Messages */}
              <div className={styles.messages}>
                {(selected.messages || []).map((msg, i) => {
                  const isAi = msg.role === 'ai';
                  const isHuman = msg.metadata?.isHuman;
                  return (
                    <div key={msg.id || i} className={`${styles.msgRow} ${isAi ? styles.msgAiRow : styles.msgCustRow}`}>
                      {/* Avatar per message */}
                      {isAi ? (
                        <div className={styles.msgAvatarWrap}>
                          <div className={styles.msgAvatarAI}>{isHuman ? '👤' : '🤖'}</div>
                          <span className={styles.msgLabel}>{isHuman ? 'Owner' : 'AI Priya'}</span>
                        </div>
                      ) : (
                        <div className={styles.msgAvatarWrap}>
                          <Avatar name={selected.customer_name} size={28} />
                          <span className={styles.msgLabel}>{selected.customer_name || 'Customer'}</span>
                        </div>
                      )}
                      <div className={`${styles.bubble} ${isAi ? styles.bubbleAi : styles.bubbleCust} ${isHuman ? styles.bubbleHuman : ''}`}>
                        <p className={styles.bubbleText}>{msg.content}</p>
                        <span className={styles.bubbleTime}>{fmtTime(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              {selected.ai_paused ? (
                <div className={styles.replyArea}>
                  <div className={styles.replyWrap}>
                    <textarea
                      ref={replyRef}
                      className={styles.replyInput}
                      placeholder="Type your reply as the StyleCraft owner… (Enter to send)"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={2}
                    />
                    <button className={styles.sendBtn} onClick={handleSendReply} disabled={!replyText.trim() || sending}>
                      {sending ? '…' : '↑'}
                    </button>
                  </div>
                  <p className={styles.replyHint}>Enter to send · Shift+Enter for new line · AI auto-resumes after 5 min</p>
                </div>
              ) : (
                <div className={styles.aiFooter}>
                  🤖 AI is replying automatically. Click <strong>Take Over</strong> to respond manually.
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
