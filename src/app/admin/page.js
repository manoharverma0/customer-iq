'use client';

import { useState, useEffect } from 'react';
import styles from './admin.module.css';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin', {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (!res.ok) throw new Error('Invalid Password');
      
      const data = await res.json();
      setPendingRequests(data);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (businessId, action) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({ action, businessId })
      });
      if (!res.ok) throw new Error('Action failed');
      
      // Remove from list
      setPendingRequests(prev => prev.filter(req => req.id !== businessId));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.page}>
        <div className={styles.loginContainer}>
          <h1>Admin Portal</h1>
          <p>Restricted access. Please log in.</p>
          <form onSubmit={login} className={styles.form}>
            <input 
              type="password" 
              placeholder="Enter Master Password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={styles.input}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitBtn} disabled={loading || !password}>
              {loading ? 'Authenticating...' : 'Unlock'}
            </button>
          </form>
          <p className={styles.hint}>Default demo password: <code>admin123</code></p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <h1>Vendor Approvals</h1>
          <button className={styles.logoutBtn} onClick={() => { setIsAuthenticated(false); setPassword(''); }}>
            Lock Dashboard
          </button>
        </div>

        <div className={styles.tableContainer}>
          {pendingRequests.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>✅</div>
              <h3>All caught up!</h3>
              <p>No pending vendor registrations to review.</p>
              <button 
                className={styles.refreshBtn} 
                onClick={() => login({preventDefault: () => {}})}
              >
                Refresh List
              </button>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Business Name</th>
                  <th>Owner</th>
                  <th>Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map(req => (
                  <tr key={req.id}>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td><strong>{req.name}</strong></td>
                    <td>{req.owner_name}</td>
                    <td>
                      <div>{req.owner_email}</div>
                      <div className={styles.phoneText}>{req.owner_phone}</div>
                    </td>
                    <td>
                      <div className={styles.actionGroup}>
                        <button 
                          className={styles.approveBtn} 
                          onClick={() => handleAction(req.id, 'approve')}
                        >
                          Approve
                        </button>
                        <button 
                          className={styles.rejectBtn}
                          onClick={() => {
                            if (confirm(`Are you sure you want to REJECT and delete ${req.name}?`)) {
                              handleAction(req.id, 'reject');
                            }
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
