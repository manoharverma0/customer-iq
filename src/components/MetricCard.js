'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './MetricCard.module.css';

export default function MetricCard({ icon, label, value, suffix = '', growth, growthLabel, delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={cardRef} className={`${styles.card} ${isVisible ? styles.visible : ''}`}>
      <div className={styles.iconWrap}>
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        <div className={styles.valueRow}>
          <span className={styles.value}>{value}{suffix}</span>
          {growth !== undefined && (
            <span className={`${styles.growth} ${growth >= 0 ? styles.positive : styles.negative}`}>
              {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}%
            </span>
          )}
        </div>
        {growthLabel && <span className={styles.growthLabel}>{growthLabel}</span>}
      </div>
      <div className={styles.glow} />
    </div>
  );
}
