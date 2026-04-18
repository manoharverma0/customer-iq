'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ChatWidget.module.css';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedConvId = localStorage.getItem('ciq_conv_id');
    if (savedConvId) setConversationId(savedConvId);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'ai',
        content: 'Namaste! 🙏 Welcome to StyleCraft India!\n\nI can help you with:\n👗 Browse Collections & Prices\n📦 Shipping & Delivery Info\n🎁 Discounts & Offers\n🔄 Returns & Refunds\n\nJust tell me what you\'re looking for!',
        timestamp: new Date().toISOString(),
        products: [],
      }]);
    }
  }, [isOpen, messages.length]);

  const handleSend = async (text = null) => {
    const msgText = text || inputValue.trim();
    if (!msgText || isTyping) return;

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'customer',
      content: msgText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgText,
          conversationId,
          conversationHistory: messages.filter(m => m.id !== 'welcome').map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
        // Persist so conversation survives page refresh
        localStorage.setItem('ciq_conv_id', data.conversationId);
      }

      const aiMessage = {
        id: `ai_${Date.now()}`,
        role: 'ai',
        content: data.reply || 'Sorry, could not process that. Please try again.',
        timestamp: new Date().toISOString(),
        urgency: data.urgency,
        products: data.products || [],
        responseType: data.responseType,
        requestStored: data.requestStored,
      };

      setMessages(prev => [...prev, aiMessage]);
      if (!isOpen) setHasUnread(true);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        role: 'ai',
        content: 'Oops! Something went wrong. Please try again. 🙏',
        timestamp: new Date().toISOString(),
        products: [],
      }]);
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

  const handleQuickAction = (action) => {
    handleSend(action);
  };

  const handleOrderClick = (product) => {
    handleSend(`I want to order ${product.name}`);
  };

  const getUrgencyDot = (urgency) => {
    if (urgency === 'high') return '🔴';
    if (urgency === 'medium') return '🟡';
    if (urgency === 'low') return '🟢';
    return '';
  };

  return (
    <div className={styles.widget}>
      {/* Chat Window */}
      <div className={`${styles.window} ${isOpen ? styles.open : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerAvatar}>⚡</div>
            <div>
              <h4 className={styles.headerTitle}>StyleCraft India</h4>
              <span className={styles.headerStatus}>
                <span className={styles.onlineDot} />
                AI Shopping Assistant
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
        </div>

        {/* Messages */}
        <div className={styles.messages}>
          {messages.map((msg) => (
            <div key={msg.id}>
              <div className={`${styles.msg} ${msg.role === 'ai' ? styles.msgAi : styles.msgUser}`}>
                {msg.role === 'ai' && <div className={styles.msgAvatar}>🤖</div>}
                <div className={styles.msgBubble}>
                  <p className={styles.msgText}>{msg.content}</p>
                  {msg.requestStored && (
                    <div className={styles.requestBadge}>
                      ✅ Request logged — our team will follow up!
                    </div>
                  )}
                  <div className={styles.msgMeta}>
                    <span className={styles.msgTime}>
                      {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.urgency && <span className={styles.msgUrgency}>{getUrgencyDot(msg.urgency)}</span>}
                  </div>
                </div>
              </div>

              {/* Product Cards */}
              {msg.products && msg.products.length > 0 && (
                <div className={styles.productsGrid}>
                  {msg.products.map((product) => (
                    <div key={product.id} className={styles.productCard}>
                      <div className={styles.productHeader}>
                        <span className={styles.productCategory}>
                          {product.category === 'saree' ? '👗' : 
                           product.category === 'kurta' ? '👔' :
                           product.category === 'lehenga' ? '💃' :
                           product.category === 'jewelry' ? '💎' : '👕'}
                          {' '}{product.category.charAt(0).toUpperCase() + product.category.slice(1)}
                        </span>
                        {product.discount > 0 && (
                          <span className={styles.discountBadge}>{product.discount}% OFF</span>
                        )}
                      </div>
                      <h5 className={styles.productName}>{product.name}</h5>
                      <p className={styles.productDesc}>{product.description}</p>
                      <div className={styles.productPricing}>
                        <span className={styles.productPrice}>₹{product.price.toLocaleString('en-IN')}</span>
                        {product.originalPrice && (
                          <span className={styles.productOriginal}>₹{product.originalPrice.toLocaleString('en-IN')}</span>
                        )}
                      </div>
                      <div className={styles.productRating}>
                        ⭐ {product.rating} ({product.reviews} reviews)
                      </div>
                      {product.tags && product.tags.length > 0 && (
                        <div className={styles.productTags}>
                          {product.tags.slice(0, 3).map(tag => (
                            <span key={tag} className={styles.productTag}>{tag}</span>
                          ))}
                        </div>
                      )}
                      <button
                        className={styles.orderBtn}
                        onClick={() => handleOrderClick(product)}
                      >
                        🛒 Order Now
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className={`${styles.msg} ${styles.msgAi}`}>
              <div className={styles.msgAvatar}>🤖</div>
              <div className={styles.msgBubble}>
                <div className={styles.typingDots}><span /><span /><span /></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <div className={styles.quickActions}>
            <button onClick={() => handleQuickAction('Show me sarees')}>👗 Sarees</button>
            <button onClick={() => handleQuickAction('Show me kurtas')}>👔 Kurtas</button>
            <button onClick={() => handleQuickAction('What discounts do you have?')}>🎁 Offers</button>
            <button onClick={() => handleQuickAction('Shipping info')}>📦 Shipping</button>
          </div>
        )}

        {/* Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrap}>
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              placeholder="Ask about products, prices, orders..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className={styles.sendBtn}
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
            >
              ⬆
            </button>
          </div>
          <p className={styles.poweredBy}>Powered by AI ⚡ CustomerIQ</p>
        </div>
      </div>

      {/* Floating Button */}
      <button className={styles.fab} onClick={() => { setIsOpen(!isOpen); if (!isOpen) setHasUnread(false); }} aria-label="Chat with AI">
        {isOpen ? (
          <span className={styles.fabIcon}>✕</span>
        ) : (
          <>
            <span className={styles.fabIcon}>💬</span>
            {hasUnread && <span className={styles.unreadDot} />}
          </>
        )}
      </button>
    </div>
  );
}
