'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './signup.module.css';

const INDUSTRIES = [
  'Fashion & Apparel', 'Electronics & Tech', 'Food & Beverages',
  'Health & Wellness', 'Home & Furniture', 'Jewellery & Accessories',
  'Education & Coaching', 'Real Estate', 'Automotive',
  'Travel & Tourism', 'Beauty & Salon', 'E-Commerce',
  'SaaS & Software', 'Professional Services', 'Other'
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: form, 2: success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '', industry: '', owner_name: '',
    owner_email: '', owner_phone: '', password: '', confirmPassword: ''
  });
  const [submittedBiz, setSubmittedBiz] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...form })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('owner_email', form.owner_email);
      localStorage.setItem('active_business_id', data.business.id);
      setSubmittedBiz(data.business);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successIcon}>🎉</div>
          <h1>Application Submitted!</h1>
          <p>Your business <strong>{submittedBiz?.name}</strong> has been registered.</p>
          <p className={styles.hint}>
            We'll review your application and reach out to <strong>{submittedBiz?.owner_email}</strong>.
            Once approved, you can log in to set up your AI agent.
          </p>
          <div className={styles.steps}>
            <div className={styles.step}><span className={styles.stepDone}>✓</span> Application submitted</div>
            <div className={styles.step}><span className={styles.stepPending}>⋯</span> Admin review (1-2 days)</div>
            <div className={styles.step}><span className={styles.stepLocked}>🔒</span> Set up your AI agent</div>
            <div className={styles.step}><span className={styles.stepLocked}>🚀</span> Go live!</div>
          </div>
          <Link href="/login" className={styles.submitBtn} style={{display:'block', textAlign:'center', textDecoration:'none', marginTop:'24px'}}>
            Check Application Status
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link href="/" className={styles.logo}>⚡ CustomerIQ</Link>
        <h1>Register Your Business</h1>
        <p className={styles.subtitle}>Join the waitlist. We'll onboard you personally after reviewing.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>Business Name <span>*</span></label>
              <input
                required name="name" type="text"
                value={form.name} onChange={handleChange}
                placeholder="StyleCraft India"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Industry <span>*</span></label>
              <select required name="industry" value={form.industry} onChange={handleChange}>
                <option value="">Select...</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Your Name (Owner) <span>*</span></label>
            <input
              required name="owner_name" type="text"
              value={form.owner_name} onChange={handleChange}
              placeholder="Nikhil Sharma"
            />
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>Email Address <span>*</span></label>
              <input
                required name="owner_email" type="email"
                value={form.owner_email} onChange={handleChange}
                placeholder="owner@business.com"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Phone Number</label>
              <input
                name="owner_phone" type="tel"
                value={form.owner_phone} onChange={handleChange}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>Password <span>*</span></label>
              <div className={styles.passwordWrap}>
                <input
                  required name="password" type={showPassword ? 'text' : 'password'}
                  value={form.password} onChange={handleChange}
                  placeholder="Min 6 characters"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(s => !s)} tabIndex={-1}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>Confirm Password <span>*</span></label>
              <input
                required name="confirmPassword" type="password"
                value={form.confirmPassword} onChange={handleChange}
                placeholder="Repeat password"
              />
            </div>
          </div>

          {error && <p className={styles.error}>⚠ {error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Submitting Application...' : 'Apply for Access →'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Already registered? <Link href="/login">Log in here</Link>
        </p>
      </div>
    </div>
  );
}
