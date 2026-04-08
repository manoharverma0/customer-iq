'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import styles from '../chat.module.css';

export default function ChatPage() {
  const params = useParams();
  const businessId = params.businessId;

  const [activeConv, setActiveConv] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [businessInfo, setBusinessInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // 1. Fetch business welcome info
    if (businessId) {
      fetch(`/api/businesses?id=${businessId}`)
        .then(res => res.json())
        .then(data => {
          setBusinessInfo(data);
          
          // Seed a fake conversation if this is a fresh setup
          const initialConv = {
            id: 'temp_1',
            customerName: 'You',
            channel: 'website',
            status: 'active',
            urgency: 'low',
            revenue: 0,
            messages: [
              {
                id: 'm_welcome',
                role: 'ai',
                content: data.welcome_message || `Hi there! Welcome to ${data.name}. How can I assist you today?`,
                timestamp: new Date().toISOString()
              }
            ]
          };
          setConversations([initialConv]);
          setActiveConv(initialConv);
        });
    }
  }, [businessId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConv?.messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = {
      id: `m_${Date.now()}`,
      role: 'customer',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add user message
    const updatedMessages = [...(activeConv?.messages || []), userMessage];
    const updatedConv = { ...activeConv, messages: updatedMessages };
    setActiveConv(updatedConv);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          message: userMessage.content,
          conversationHistory: updatedMessages,
          conversationId: activeConv.id.startsWith('temp') ? null : activeConv.id
        }),
      });

      const data = await res.json();

      const aiMessage = {
        id: `m_${Date.now()}_ai`,
        role: 'ai',
        content: data.reply,
        timestamp: new Date().toISOString(),
        urgencyDetected: data.urgency,
      };

      const withAi = { ...updatedConv, messages: [...updatedMessages, aiMessage], urgency: data.urgency };
      setActiveConv(withAi);

      // Update conversations list
      setConversations(prev =>
        prev.map(c => c.id === withAi.id ? withAi : c)
      );
    } catch {
      console.error('Failed to get AI reply');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getUrgencyStyle = (urgency) => {
    const uMap = {
      high: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: '🔴 High' },
      medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '🟡 Medium' },
      low: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: '🟢 Low' },
    };
    return uMap[urgency] || uMap.low;
  };

  const formatTime = (ts) => {
    try {
      return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  };

  return (
    <div className={styles.page}>
      {/* Sidebar — Conversation List */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>{businessInfo?.name || 'Loading...'}</h2>
          <span className={styles.convCount}>{conversations.length}</span>
        </div>
        <div className={styles.convList}>
          {conversations.map((conv) => {
            const urgStyle = getUrgencyStyle(conv.urgency);
            const lastMsg = conv.messages[conv.messages.length - 1];
            return (
              <button
                key={conv.id}
                className={`${styles.convItem} ${activeConv?.id === conv.id ? styles.convActive : ''}`}
                onClick={() => setActiveConv(conv)}
              >
                <div className={styles.convAvatar}>
                  {conv.customerName.charAt(0)}
                </div>
                <div className={styles.convInfo}>
                  <div className={styles.convTop}>
                     <span className={styles.convName}>{conv.customerName}</span>
                     <span className={styles.convTime}>{formatTime(lastMsg?.timestamp)}</span>
                  </div>
                  <p className={styles.convPreview}>{lastMsg?.content?.slice(0, 60)}...</p>
                  <div className={styles.convMeta}>
                    <span
                      className={styles.urgBadge}
                      style={{ color: urgStyle.color, background: urgStyle.bg }}
                    >
                      {urgStyle.label}
                    </span>
                    <span className={styles.channelBadge}>{conv.channel}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat Area */}
      <main className={styles.chatArea}>
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className={styles.chatHeader}>
              <div className={styles.chatHeaderLeft}>
                <div className={styles.chatAvatar}>
                  {activeConv.customerName.charAt(0)}
                </div>
                <div>
                  <h3 className={styles.chatName}>{activeConv.customerName}</h3>
                  <span className={styles.chatChannel}>{activeConv.channel} • {activeConv.status}</span>
                </div>
              </div>
              <div className={styles.chatHeaderRight}>
                <span className={styles.urgBadgeLg} style={{ color: getUrgencyStyle(activeConv.urgency).color, background: getUrgencyStyle(activeConv.urgency).bg, borderColor: getUrgencyStyle(activeConv.urgency).color }}>
                  {getUrgencyStyle(activeConv.urgency).label} Priority
                </span>
                {activeConv.revenue > 0 && (
                  <span className={styles.revBadge}>💰 ₹{activeConv.revenue.toLocaleString()}</span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className={styles.messages}>
              {activeConv.messages.map((msg, i) => (
                <div
                  key={msg.id}
                  className={`${styles.msg} ${msg.role === 'ai' ? styles.msgAi : styles.msgCustomer}`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {msg.role === 'ai' && <span className={styles.aiLabel}>🤖 {businessInfo?.name || 'AI Assistant'}</span>}
                  {msg.role === 'customer' && <span className={styles.custLabel}>{activeConv.customerName}</span>}
                  <p className={styles.msgText}>{msg.content}</p>
                  <div className={styles.msgFooter}>
                    <span className={styles.msgTime}>{formatTime(msg.timestamp)}</span>
                    {msg.urgencyDetected && (
                      <span
                        className={styles.msgUrgency}
                        style={{
                          color: getUrgencyStyle(msg.urgencyDetected).color,
                          background: getUrgencyStyle(msg.urgencyDetected).bg,
                        }}
                      >
                        {getUrgencyStyle(msg.urgencyDetected).label}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className={`${styles.msg} ${styles.msgAi}`}>
                  <span className={styles.aiLabel}>🤖 {businessInfo?.name || 'AI Assistant'}</span>
                  <div className={styles.typingDots}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={styles.inputArea}>
              <div className={styles.inputWrap}>
                <textarea
                  ref={inputRef}
                  className={styles.input}
                  placeholder={`Send a message to ${businessInfo?.name || 'the AI'}...`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping}
                >
                  ⬆
                </button>
              </div>
              <p className={styles.inputHint}>
                {businessId ? `You are chatting with the ${businessInfo?.name} AI agent.` : 'Test chat.'}
              </p>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
             <span className={styles.emptyIcon}>💬</span>
             <h3>Loading Chat</h3>
          </div>
        )}
      </main>
    </div>
  );
}
