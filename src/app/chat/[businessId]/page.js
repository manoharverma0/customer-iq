'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import styles from '../chat.module.css';

export default function ChatPage() {
  const params = useParams();
  const businessId = params.businessId;

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [nameStep, setNameStep] = useState('name'); // 'name' | 'phone' | 'done'
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load business info on mount
  useEffect(() => {
    if (businessId) {
      fetch(`/api/businesses?id=${businessId}`)
        .then(res => res.json())
        .then(data => {
          setBusinessInfo(data);
          setMessages([{
            id: 'm_welcome',
            role: 'ai',
            content: `Namaste! 🙏 Welcome to ${data.name || 'our store'}!\n\nBefore we start, may I know your name? 😊`,
            timestamp: new Date().toISOString(),
          }]);
        });
    }
  }, [businessId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input
  useEffect(() => {
    if (inputRef.current && nameStep !== 'loading') {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages.length, nameStep]);

  const formatTime = (ts) => {
    try {
      return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getUrgencyStyle = (urgency) => {
    const map = {
      high: { color: '#dc2626', bg: '#fef2f2', label: '🔴 High' },
      medium: { color: '#d97706', bg: '#fffbeb', label: '🟡 Medium' },
      low: { color: '#059669', bg: '#ecfdf5', label: '🟢 Low' },
    };
    return map[urgency] || map.low;
  };

  const addMsg = (role, content, extra = {}) => {
    const msg = { id: `m_${Date.now()}_${role}`, role, content, timestamp: new Date().toISOString(), ...extra };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    const text = inputValue.trim();
    setInputValue('');

    // ── Name collection ──
    if (nameStep === 'name') {
      setCustomerName(text);
      addMsg('customer', text);
      setTimeout(() => {
        addMsg('ai', `Nice to meet you, ${text}! 😊\n\nCould you share your phone number so we can follow up if needed?`);
      }, 400);
      setNameStep('phone');
      return;
    }

    if (nameStep === 'phone') {
      setCustomerPhone(text);
      setNameStep('done');
      addMsg('customer', text);
      setTimeout(() => {
        addMsg('ai', `Perfect! Got it 📝\n\nHi ${customerName}, I'm your AI shopping assistant! I can help you with our sarees, kurtas, lehengas, jewelry, and shirts.\n\n👗 What are you looking for today?`);
      }, 400);
      return;
    }

    // ── Normal chat ──
    addMsg('customer', text);
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          message: text,
          customerName: customerName || 'Visitor',
          customerPhone: customerPhone || '',
          conversationHistory: messages.filter(m => m.id !== 'm_welcome').map(m => ({
            role: m.role,
            content: m.content,
          })),
          conversationId: conversationId,
        }),
      });

      const data = await res.json();
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      addMsg('ai', data.reply || 'Sorry, I couldn\'t process that. Please try again!', {
        urgencyDetected: data.urgency,
      });
    } catch {
      addMsg('ai', 'Oops! Something went wrong. Please try again. 🙏');
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

  const handleQuickAction = (text) => {
    setInputValue(text);
    setTimeout(() => handleSend(), 100);
  };

  const storeName = businessInfo?.name || 'Loading...';
  const storeInitial = storeName.charAt(0).toUpperCase();

  return (
    <div className={styles.page}>
      {/* ── Brand Header ── */}
      <div className={styles.brandBar}>
        <div className={styles.brandLeft}>
          <div className={styles.brandLogo}>{storeInitial}</div>
          <div>
            <div className={styles.brandName}>{storeName}</div>
            <div className={styles.brandStatus}>
              <span className={styles.brandStatusDot} />
              AI Agent Online
            </div>
          </div>
        </div>
        <div className={styles.brandRight}>
          <span className={styles.brandBadge}>🤖 AI Powered</span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className={styles.messagesArea}>
        {messages.map((msg, i) => {
          const isAi = msg.role === 'ai';
          return (
            <div
              key={msg.id}
              className={`${styles.msgRow} ${isAi ? styles.msgRowAi : styles.msgRowUser}`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className={`${styles.msgAvatar} ${isAi ? styles.msgAvatarAi : styles.msgAvatarUser}`}>
                {isAi ? '🤖' : (customerName?.charAt(0)?.toUpperCase() || '👤')}
              </div>
              <div className={`${styles.msgBubble} ${isAi ? styles.msgBubbleAi : styles.msgBubbleUser}`}>
                <span className={`${styles.msgLabel} ${isAi ? styles.msgLabelAi : styles.msgLabelUser}`}>
                  {isAi ? storeName : (customerName || 'You')}
                </span>
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
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className={`${styles.msgRow} ${styles.msgRowAi}`}>
            <div className={`${styles.msgAvatar} ${styles.msgAvatarAi}`}>🤖</div>
            <div className={`${styles.msgBubble} ${styles.msgBubbleAi}`}>
              <span className={`${styles.msgLabel} ${styles.msgLabelAi}`}>{storeName}</span>
              <div className={styles.typingDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Suggestions (shown after onboarding) ── */}
      {nameStep === 'done' && messages.length < 6 && (
        <div className={styles.quickActions}>
          {['Show me sarees', 'What lehengas do you have?', 'Prices & offers', 'Shipping info'].map(q => (
            <button key={q} className={styles.quickBtn} onClick={() => { setInputValue(q); }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Input Area ── */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrap}>
          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder={
              nameStep === 'name' ? 'Enter your name...' :
              nameStep === 'phone' ? 'Enter your phone number...' :
              `Ask ${storeName} anything...`
            }
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
            ↑
          </button>
        </div>
        <p className={styles.inputHint}>
          Powered by Bizz Assist AI · Responses may take a few seconds
        </p>
      </div>
    </div>
  );
}
