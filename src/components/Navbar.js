'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/onboarding', label: 'Get Started', icon: '🚀' },
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/customers', label: 'Customers', icon: '👥' },
    { href: '/admin', label: 'Admin', icon: '🛡️' },
  ];

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>⚡</span>
          <span className={styles.logoText}>
            Customer<span className={styles.logoAccent}>IQ</span>
          </span>
        </Link>

        <div className={`${styles.links} ${mobileOpen ? styles.open : ''}`}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.link} ${pathname === link.href ? styles.active : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className={styles.linkIcon}>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>

        <div className={styles.actions}>
          <div className={styles.statusDot} />
          <span className={styles.statusText}>AI Active</span>
        </div>

        <button
          className={styles.hamburger}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
          <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
          <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
        </button>
      </div>
    </nav>
  );
}
