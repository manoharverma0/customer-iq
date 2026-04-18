'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './live.module.css';

const POLL_INTERVAL = 3000; // 3 seconds
const HUMAN_TIMEOUT = 5 * 60; // 5 minutes in seconds

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

  // ── Poll conversations every 3s ────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/live');
      const data = await res.json();
      setConversations(data.conversations || []);

      // Update selected conversation with latest data
      setSelected(prev => {
        if (!prev) return null;
        const updated = (data.conversations || []).find(c => c.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      console.error('Poll error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // ── Auto-scroll messages ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages?.length]);

  // ── Countdown timer when in human mode ────────────────────────────────────
  useEffect(() => {
    if (!selected?.ai_paused) {
      setCountdown(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    const lastReply = selected.human_last_replied_at
      ? new Date(selected.human_last_replied_at).getTime()
      : Date.now();

    const tick = () => {
      const elapsed = Math.floor((Date.now() - lastReply) / 1000);
      const remaining = Math.max(0, HUMAN_TIMEOUT - elapsed);
      setCountdown(remaining);
      if (remaining === 0) {
        clearInterval(countdownRef.current);
        fetchConversations(); // Refresh to pick up auto-release
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [selected?.ai_paused, selected?.human_last_replied_at, fetchConversations]);

  // ── Take Over ──────────────────────────────────────────────────────────────
  const handleTakeOver = async () => {
    if (!selected) return;
    setSending(true);
    await fetch('/api/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'takeover', conversationId: selected.id, agentName: 'Owner' }),
    });
    await fetchConversations();
    setSending(false);
    setTimeout(() => replyRef.current?.focus(), 200);
  };

  // ── Release to AI ──────────────────────────────────────────────────────────
  const handleRelease = async () => {
    if (!selected) return;
    setSending(true);
    await fetch('/api/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'release', conversationId: selected.id }),
    });
    await fetchConversations();
    setSending(false);
  };

  // ── Send Human Reply ───────────────────────────────────────────────────────
  const handleSendReply = async () => {
    if (!replyText.trim() || !selected || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText('');

    await fetch('/api/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reply', conversationId: selected.id, message: text, agentName: 'Owner' }),
    });
    await fetchConversations();
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  // Helpers
  const formatTime = ts => {
    try { return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const formatCountdown = secs => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const getUrgencyColor = u =>
    u === 'high' ? '#ef4444' : u === 'medium' ? '#f59e0b' : '#22c55e';

  const activeConvs = conversations.filter(c => c.status !== 'completed');
  const humanConvs = conversations.filter(c => c.ai_paused);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Connecting to live conversations…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.topIcon}>🎛️</span>
          <div>
            <h1 className={styles.topTitle}>Live Conversations</h1>
            <span className={styles.topSub}>Monitor & intervene in real-time</span>
          </div>
        </div>
        <div className={styles.topStats}>
          <div className={styles.topStat}>
            <span className={styles.statDot} style={{ background: '#22c55e' }} />
            <span>{activeConvs.length} Active</span>
          </div>
          <div className={styles.topStat}>
            <span className={styles.statDot} style={{ background: '#a855f7' }} />
            <span>{humanConvs.length} Human Mode</span>
          </div>
          <div className={styles.topStat}>
            <span className={styles.statDot} style={{ background: '#6366f1' }} />
            <span>Polling every 3s</span>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* ── Sidebar: Conv List ─────────────────────────────────────────── */}
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
                  {/* Mode indicator */}
                  <div className={styles.convAvatar}>
                    {conv.customer_name?.[0]?.toUpperCase() || 'V'}
                    <span
                      className={styles.modeDot}
                      style={{ background: conv.ai_paused ? '#a855f7' : '#22c55e' }}
                      title={conv.ai_paused ? 'Human mode' : 'AI mode'}
                    />
                  </div>

                  <div className={styles.convInfo}>
                    <div className={styles.convTop}>
                      <span className={styles.convName}>{conv.customer_name || 'Visitor'}</span>
                      <span className={styles.convTime}>{formatTime(conv.updated_at)}</span>
                    </div>
                    <p className={styles.convPreview}>
                      {lastMsg?.content?.slice(0, 55) || 'No messages'}…
                    </p>
                    <div className={styles.convMeta}>
                      <span className={styles.modeBadge} style={{
                        background: conv.ai_paused ? 'rgba(168,85,247,0.15)' : 'rgba(34,197,94,0.12)',
                        color: conv.ai_paused ? '#c084fc' : '#4ade80',
                        border: `1px solid ${conv.ai_paused ? 'rgba(168,85,247,0.3)' : 'rgba(34,197,94,0.25)'}`,
                      }}>
                        {conv.ai_paused ? '👤 Human' : '🤖 AI'}
                      </span>
                      <span className={styles.urgBadge} style={{ color: getUrgencyColor(conv.urgency) }}>
                        {conv.urgency === 'high' ? '🔴' : conv.urgency === 'medium' ? '🟡' : '🟢'}
                      </span>
                      <span className={styles.channelBadge}>{conv.channel}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Main: Chat View ────────────────────────────────────────────── */}
        <main className={styles.main}>
          {!selected ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>💬</span>
              <h2>Select a conversation</h2>
              <p>Click any conversation on the left to view it and optionally take over.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className={styles.chatHeader}>
                <div className={styles.chatHeaderLeft}>
                  <div className={styles.chatAvatar}>{selected.customer_name?.[0]?.toUpperCase() || 'V'}</div>
                  <div>
                    <h3 className={styles.chatName}>{selected.customer_name || 'Visitor'}</h3>
                    <span className={styles.chatMeta}>
                      {selected.channel} · {selected.messages?.length || 0} messages
                      {selected.revenue > 0 && ` · 💰 ₹${Number(selected.revenue).toLocaleString()}`}
                    </span>
                  </div>
                </div>

                <div className={styles.chatControls}>
                  {/* Countdown when in human mode */}
                  {selected.ai_paused && countdown !== null && (
                    <div className={`${styles.countdown} ${countdown < 60 ? styles.countdownWarn : ''}`}>
                      <span>⏱</span>
                      <span>AI resumes in {formatCountdown(countdown)}</span>
                    </div>
                  )}

                  {selected.ai_paused ? (
                    <button
                      className={styles.releaseBtn}
                      onClick={handleRelease}
                      disabled={sending}
                    >
                      🤖 Release to AI
                    </button>
                  ) : (
                    <button
                      className={styles.takeoverBtn}
                      onClick={handleTakeOver}
                      disabled={sending}
                    >
                      👤 Take Over
                    </button>
                  )}
                </div>
              </div>

              {/* Mode Banner */}
              <div className={`${styles.modeBanner} ${selected.ai_paused ? styles.humanBanner : styles.aiBanner}`}>
                {selected.ai_paused ? (
                  <>
                    <span>👤</span>
                    <span><strong>Human Mode</strong> — You are replying. AI is paused. Auto-resumes in {formatCountdown(countdown ?? 0)}.</span>
                  </>
                ) : (
                  <>
                    <span>🤖</span>
                    <span><strong>AI Mode</strong> — AI is handling this conversation. Click "Take Over" to intervene.</span>
                  </>
                )}
              </div>

              {/* Messages thread */}
              <div className={styles.messages}>
                {(selected.messages || []).map((msg, i) => {
                  const isAi = msg.role === 'ai';
                  const isHuman = msg.metadata?.isHuman;
                  const isHandoff = msg.metadata?.isHandoff;
                  return (
                    <div key={msg.id || i} className={`${styles.msgRow} ${isAi ? styles.msgAiRow : styles.msgCustRow}`}>
                      {isAi && (
                        <div className={styles.msgLabel}>
                          {isHuman ? '👤 Owner' : isHandoff ? '⚡ System' : '🤖 AI'}
                        </div>
                      )}
                      {!isAi && (
                        <div className={styles.msgLabel} style={{ color: '#94a3b8' }}>
                          👤 {selected.customer_name || 'Customer'}
                        </div>
                      )}
                      <div className={`${styles.bubble} ${isAi ? styles.bubbleAi : styles.bubbleCust} ${isHandoff ? styles.bubbleHandoff : ''} ${isHuman ? styles.bubbleHuman : ''}`}>
                        <p className={styles.bubbleText}>{msg.content}</p>
                        <span className={styles.bubbleTime}>{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input (only in human mode) */}
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
                    <button
                      className={styles.sendBtn}
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sending}
                    >
                      {sending ? '…' : '⬆'}
                    </button>
                  </div>
                  <p className={styles.replyHint}>
                    ⌨ Enter to send · Shift+Enter for new line · AI auto-resumes after 5 minutes of inactivity
                  </p>
                </div>
              ) : (
                <div className={styles.aiFooter}>
                  <span>🤖 AI is replying automatically. Click <strong>Take Over</strong> to respond manually.</span>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
