'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingBusiness, setPendingBusiness] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // If already logged in, redirect
    const id = localStorage.getItem('active_business_id');
    if (id) router.push('/dashboard');
  }, []);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    setPendingBusiness(null);

    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      const biz = data.business;
      localStorage.setItem('owner_email', biz.owner_email);
      localStorage.setItem('active_business_id', biz.id);
      localStorage.setItem('business_name', biz.name);

      if (biz.status === 'pending') {
        setPendingBusiness(biz);
      } else if (biz.status === 'approved') {
        router.push('/onboarding/interview');
      } else if (biz.status === 'active') {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (pendingBusiness) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.pendingIcon}>⏳</div>
          <h1>Under Review</h1>
          <p>
            <strong>{pendingBusiness.name}</strong> is pending admin approval.
            We'll contact <strong>{pendingBusiness.owner_email}</strong> once approved.
          </p>
          <p className={styles.hint}>
            Typically takes 1–2 business days. Check back here anytime.
          </p>
          <button
            className={styles.outlineBtn}
            onClick={() => {
              localStorage.clear();
              setPendingBusiness(null);
              setEmail('');
              setPassword('');
            }}
          >
            Use a different account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link href="/" className={styles.logo}>⚡ Bizz Assist</Link>
        <h1>Business Login</h1>
        <p className={styles.subtitle}>Sign in to manage your AI agent and view analytics.</p>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Business Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="owner@yourbusiness.com"
              autoFocus
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Password</label>
            <div className={styles.passwordWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword(s => !s)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && <p className={styles.error}>⚠ {error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading || !email || !password}>
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <p className={styles.switchLink}>
          New business? <Link href="/signup">Apply for access</Link>
        </p>
      </div>
    </div>
  );
}
