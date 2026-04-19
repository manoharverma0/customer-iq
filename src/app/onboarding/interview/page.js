'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './interview.module.css';

// The 6 questions that give the AI maximum business context
const QUESTIONS = [
  {
    id: 'identity',
    text: "🎉 Your account has been approved! I'm your AI setup assistant.\n\nI'll ask you 6 quick questions to build a deep understanding of your business — so your AI agent can genuinely represent you.\n\nLet's start: **Describe your business in your own words.** What do you do, what do you sell or offer, and who are your ideal customers?",
  },
  {
    id: 'products',
    text: "Perfect! Now tell me about your **main products or services**.\n\nInclude: names, price ranges, what makes each one special, and which ones are your bestsellers. The more detail, the better your AI will be.",
  },
  {
    id: 'customer_journey',
    text: "Great context! Now help me understand the **typical customer experience**.\n\nHow do customers usually find you? What do they ask first? What's the usual path from first message to purchase? Any common hesitations or objections they have?",
  },
  {
    id: 'faqs',
    text: "This is really helpful! What are the **most common questions customers ask you** again and again?\n\nThink about: pricing questions, availability, delivery time, customization options, comparisons with competitors, or anything else that comes up frequently.",
  },
  {
    id: 'policies',
    text: "Almost there! Tell me your **key business policies**:\n\n• Shipping / delivery (times, costs, areas you cover)\n• Returns & refunds policy\n• Payment methods you accept\n• Any guarantees or warranties\n• Any exceptions or special terms",
  },
  {
    id: 'brand_voice',
    text: "Last question! **How should your AI speak to customers?**\n\nDescribe your brand personality. Are you formal or casual? Luxury or budget-friendly? Expert or friendly neighbour? Any specific language your customers respond well to? Any phrases to avoid?\n\nThis shapes how your AI will talk — so be specific!",
  },
];

export default function InterviewPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const id = localStorage.getItem('active_business_id');
    const email = localStorage.getItem('owner_email');
    if (!id) { router.push('/login'); return; }
    setBusinessId(id);

    // Fetch business name
    fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', email })
    })
    .then(r => r.json())
    .then(d => {
      if (d.found) {
        setBusinessName(d.business.name);
        if (d.business.status === 'active') { router.push('/dashboard'); return; }
        if (d.business.status === 'pending') { router.push('/login'); return; }
      }
    });

    // Show first AI question
    setTimeout(() => {
      setMessages([{ role: 'ai', text: QUESTIONS[0].text }]);
      inputRef.current?.focus();
    }, 400);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendAnswer = async () => {
    if (!input.trim() || generating) return;

    const userAnswer = input.trim();
    setInput('');

    // Add user message
    const newMessages = [...messages, { role: 'user', text: userAnswer }];
    const newAnswers = [...answers, { question: QUESTIONS[currentQ].id, answer: userAnswer }];
    setAnswers(newAnswers);

    const nextQ = currentQ + 1;

    if (nextQ < QUESTIONS.length) {
      // Show next question with slight delay for feel
      setMessages([...newMessages, { role: 'ai', text: '...', typing: true }]);
      setTimeout(() => {
        setMessages([...newMessages, { role: 'ai', text: QUESTIONS[nextQ].text }]);
        setCurrentQ(nextQ);
        inputRef.current?.focus();
      }, 800);
    } else {
      // All questions answered — generate AI agent
      setMessages([...newMessages, {
        role: 'ai',
        text: `🧠 Excellent! I now have a comprehensive understanding of **${businessName || 'your business'}**.\n\nI'm generating your custom AI agent now — this takes about 15 seconds. Your agent will know your products, pricing, policies, and brand voice inside out.`,
      }]);
      setCurrentQ(nextQ);
      setGenerating(true);

      try {
        const res = await fetch('/api/businesses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'interview_complete',
            businessId,
            interviewAnswers: newAnswers,
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setMessages(prev => [...prev, {
          role: 'ai',
          text: `✅ Your AI agent is live! It knows everything about your business and is ready to serve your customers.\n\nRedirecting you to your dashboard...`,
        }]);

        setTimeout(() => router.push('/dashboard'), 2500);
      } catch (err) {
        setMessages(prev => [...prev, {
          role: 'ai',
          text: `⚠ There was an issue generating your agent. Please try again or contact support.\n\nError: ${err.message}`,
        }]);
        setGenerating(false);
      }
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAnswer();
    }
  };

  const progress = Math.min((currentQ / QUESTIONS.length) * 100, 100);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>⚡ Bizz Assist</span>
          <span className={styles.headerTitle}>AI Setup Interview</span>
        </div>
        <div className={styles.progressWrap}>
          <span className={styles.progressLabel}>
            {generating ? 'Generating...' : `Question ${Math.min(currentQ + 1, QUESTIONS.length)} of ${QUESTIONS.length}`}
          </span>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className={styles.chatArea}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.msgWrap} ${msg.role === 'user' ? styles.userWrap : styles.aiWrap}`}>
            {msg.role === 'ai' && (
              <div className={styles.avatar}>🤖</div>
            )}
            <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble} ${msg.typing ? styles.typing : ''}`}>
              {msg.typing ? (
                <span className={styles.dots}><span/><span/><span/></span>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
              )}
            </div>
            {msg.role === 'user' && (
              <div className={styles.userAvatar}>👤</div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className={styles.inputArea}>
        {generating ? (
          <div className={styles.generatingBar}>
            <div className={styles.spinner} />
            <span>Generating your AI agent... please wait</span>
          </div>
        ) : currentQ < QUESTIONS.length ? (
          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
              rows={3}
              disabled={generating}
            />
            <button
              className={styles.sendBtn}
              onClick={sendAnswer}
              disabled={!input.trim() || generating}
            >
              Send →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
