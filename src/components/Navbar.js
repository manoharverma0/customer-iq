'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

const navItems = [
  { href: '/dashboard', label: 'Dashboard',   icon: NavDashIcon },
  { href: '/customers', label: 'Customers',   icon: NavCustomerIcon },
  { href: '/live',      label: 'Live Chat',   icon: NavLiveIcon,  badge: 'LIVE' },
  { href: '/catalog',   label: 'Catalog',     icon: NavCatalogIcon },
];

export default function Navbar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Don't show sidebar on chat embed pages
  if (pathname?.startsWith('/chat/')) return null;

  return (
    <>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!collapsed && (
            <div className={styles.logoText}>
              <span className={styles.logoName}>Bizz Assist</span>
              <span className={styles.logoPlan}>StyleCraft India</span>
            </div>
          )}
          <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className={styles.nav}>
          <div className={styles.navGroup}>
            {!collapsed && <span className={styles.navGroupLabel}>MAIN MENU</span>}
            {navItems.map(item => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} className={`${styles.navItem} ${active ? styles.active : ''}`}>
                  <span className={styles.navIcon}><Icon /></span>
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className={styles.liveBadge}>{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className={styles.navGroup}>
            {!collapsed && <span className={styles.navGroupLabel}>SHOP</span>}
            <Link href="/" className={`${styles.navItem} ${pathname === '/' ? styles.active : ''}`}>
              <span className={styles.navIcon}><NavHomeIcon /></span>
              {!collapsed && <span className={styles.navLabel}>Home / Demo</span>}
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <div className={styles.statusRow}>
            <span className={styles.statusDot} />
            {!collapsed && <span className={styles.statusLabel}>AI Online</span>}
          </div>
        </div>
      </aside>

      {/* Spacer to push main content right */}
      <div className={`${styles.sidebarSpacer} ${collapsed ? styles.spacerCollapsed : ''}`} />
    </>
  );
}

/* ── Inline SVG Icons ─────────────────────────────────────── */
function NavDashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></svg>;
}
function NavCustomerIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
function NavLiveIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function NavCatalogIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
function NavHomeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
