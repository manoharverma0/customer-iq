'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('login'); // login, register, pending, config, active
  const [currentBusiness, setCurrentBusiness] = useState(null);

  // Form states
  const [emailInput, setEmailInput] = useState('');
  
  const [regData, setRegData] = useState({
    name: '',
    industry: '',
    owner_name: '',
    owner_email: '',
    owner_phone: ''
  });

  const [aiData, setAiData] = useState({
    tone: 'Professional, friendly, and helpful',
    products: '',
    policies: 'Standard shipping and 30-day returns'
  });

  // Check state on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('owner_email');
    if (savedEmail) {
      setEmailInput(savedEmail);
      checkStatus(savedEmail);
    }
  }, []);

  const routeByStatus = (business) => {
    setCurrentBusiness(business);
    localStorage.setItem('owner_email', business.owner_email);
    localStorage.setItem('active_business_id', business.id);

    if (business.status === 'pending') {
      setView('pending');
    } else if (business.status === 'approved') {
      setView('config');
    } else if (business.status === 'active') {
      setView('active');
    }
  };

  const handleRegChange = (e) => setRegData({ ...regData, [e.target.name]: e.target.value });
  const handleAiChange = (e) => setAiData({ ...aiData, [e.target.name]: e.target.value });

  const checkStatus = async (emailToUse) => {
    const mail = typeof emailToUse === 'string' ? emailToUse : emailInput;
    if (!mail) return;
    setLoading(true);
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', email: mail })
      });
      const data = await res.json();
      if (data.found) {
        routeByStatus(data.business);
      } else {
        alert("Email not found. Please register.");
        setView('register');
        setRegData(prev => ({ ...prev, owner_email: mail }));
      }
    } catch (e) {
      alert("Error checking status");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...regData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      routeByStatus(data.business);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'generate_ai', 
          businessId: currentBusiness.id,
          ...aiData 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      routeByStatus(data.business);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('owner_email');
    localStorage.removeItem('active_business_id');
    setCurrentBusiness(null);
    setEmailInput('');
    setView('login');
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        
        {/* LOGIN VIEW */}
        {view === 'login' && (
          <>
            <div className={styles.header}>
              <h1>Welcome Back</h1>
              <p>Enter your email to check your application status or access your AI Agent.</p>
            </div>
            <div className={`${styles.form} glass-card`}>
              <div className={styles.inputGroup}>
                <label>Admin Email</label>
                <input 
                  type="email" 
                  value={emailInput} 
                  onChange={(e) => setEmailInput(e.target.value)} 
                  placeholder="owner@store.com"
                />
              </div>
              <button 
                className={styles.submitBtn} 
                onClick={checkStatus} 
                disabled={loading || !emailInput}
              >
                {loading ? 'Checking...' : 'Check Status'}
              </button>
              <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)' }}>
                New business? <a href="#" onClick={(e) => { e.preventDefault(); setView('register'); }} style={{color: 'var(--accent-primary)'}}>Apply here</a>
              </p>
            </div>
          </>
        )}

        {/* REGISTER VIEW */}
        {view === 'register' && (
          <>
            <div className={styles.header}>
              <h1>Vendor Application</h1>
              <p>Register your business for AI Customer Intelligence context access.</p>
            </div>
            <form className={`${styles.form} glass-card`} onSubmit={handleRegister}>
              <div className={styles.inputGroup}>
                <label>Business Name <span>*</span></label>
                <input required type="text" name="name" value={regData.name} onChange={handleRegChange} placeholder="TechHaven Electronics" />
              </div>
              <div className={styles.inputGroup}>
                <label>Industry <span>*</span></label>
                <select required name="industry" value={regData.industry} onChange={handleRegChange}>
                  <option value="">Select industry...</option>
                  <option value="E-Commerce">E-Commerce</option>
                  <option value="SaaS">SaaS & Software</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label>Owner Name <span>*</span></label>
                <input required type="text" name="owner_name" value={regData.owner_name} onChange={handleRegChange} />
              </div>
              <div className={styles.inputGroup}>
                <label>Owner Email <span>*</span></label>
                <input required type="email" name="owner_email" value={regData.owner_email} onChange={handleRegChange} />
              </div>
              <div className={styles.inputGroup}>
                <label>Phone Number</label>
                <input type="text" name="owner_phone" value={regData.owner_phone} onChange={handleRegChange} />
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Submitting...' : 'Apply for Access'}
              </button>
              <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)' }}>
                Already applied? <a href="#" onClick={(e) => { e.preventDefault(); setView('login'); }} style={{color: 'var(--accent-primary)'}}>Check Status</a>
              </p>
            </form>
          </>
        )}

        {/* PENDING VIEW */}
        {view === 'pending' && (
          <div className={`${styles.successCard} glass-card`}>
            <div className={styles.successIcon}>⏳</div>
            <h1>Application Under Review</h1>
            <p>Thank you for registering <strong>{currentBusiness?.name}</strong>. An admin will verify your account shortly.</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '10px' }}>
              Check back here later or wait for an email.
            </p>
            <div className={styles.actions} style={{ marginTop: '30px' }}>
              <button className={styles.secondaryBtn} onClick={logout}>Sign Out</button>
            </div>
          </div>
        )}

        {/* CONFIG AI VIEW */}
        {view === 'config' && (
          <>
            <div className={styles.header}>
              <h1>Application Approved! 🎉</h1>
              <p>Configure your AI personality below. Our Engine will generate your unique System Prompt.</p>
            </div>
            <form className={`${styles.form} glass-card`} onSubmit={handleGenerateAI}>
              <div className={styles.inputGroup}>
                <label>Primary Products / Services summary</label>
                <textarea name="products" value={aiData.products} onChange={handleAiChange} rows={3} placeholder="Laptops, PCs, Accessories"/>
              </div>
              <div className={styles.inputGroup}>
                <label>Tone of Voice</label>
                <input type="text" name="tone" value={aiData.tone} onChange={handleAiChange} />
              </div>
              <div className={styles.inputGroup}>
                <label>Key Policies (Shipping, Returns)</label>
                <textarea name="policies" value={aiData.policies} onChange={handleAiChange} rows={3} />
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Programming Agent (this takes 10s)...' : 'Generate AI Agent'}
              </button>
            </form>
          </>
        )}

        {/* ACTIVE VIEW */}
        {view === 'active' && currentBusiness && (
          <div className={`${styles.successCard} glass-card`}>
            <div className={styles.successIcon}>✨</div>
            <h1>Your AI is Live!</h1>
            <p><strong>{currentBusiness.name}</strong> is fully configured and ready to sell.</p>
            
            <div className={styles.linkBox}>
              <label>Share this link with your customers:</label>
              <input type="text" readOnly value={`${window.location.origin}/chat/${currentBusiness.id}`} onClick={e => e.target.select()} />
              <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(`${window.location.origin}/chat/${currentBusiness.id}`)}>
                Copy Link
              </button>
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={() => router.push(`/chat/${currentBusiness.id}`)}>
                Test AI Chat
              </button>
              <button className={styles.secondaryBtn} onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </button>
              <button className={styles.secondaryBtn} onClick={logout} style={{marginTop: '20px', border: 'none', color: 'var(--danger)'}}>
                Sign Out
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
