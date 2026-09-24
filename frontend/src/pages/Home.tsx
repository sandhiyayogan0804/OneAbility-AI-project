import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { DashboardHomeData } from '../types';

const Home: React.FC = () => {
  const { user, isAuthenticated, demoLogin, login, register, error: authError, clearError } = useAuth();
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardHomeData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // UI state
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Auth form state for unauthenticated users
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('9876543210');
  const [password, setPassword] = useState('SecurePassword@123');
  const [fullName, setFullName] = useState('Alex Johnson');
  const [phone, setPhone] = useState('9876543210');
  const [email, setEmail] = useState('alex@oneability.ai');

  // Load dashboard data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
    }
  }, [isAuthenticated]);

  const loadDashboard = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await api.getDashboardHome();
      setDashboardData(data);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUpi = (upiId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      if (authMode === 'login') {
        await login(identifier, password);
      } else {
        await register({
          full_name: fullName,
          phone_number: phone,
          password: password,
          email: email || undefined,
        });
      }
    } catch {
      // Error handled by AuthContext
    }
  };

  // If not authenticated, render the accessible onboarding / sign-in screen
  if (!isAuthenticated) {
    return (
      <section className="dashboard-space" aria-label="Sign In to OneAbility AI">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>♿</div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>Welcome to OneAbility AI</h2>
          <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-5)' }}>
            Accessible, voice-first & high-contrast digital payments for everyone.
          </p>

          {/* Quick Demo Login Button */}
          <button
            onClick={() => demoLogin()}
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 'var(--space-4)', fontSize: '1rem', minHeight: '52px' }}
            aria-label="One-Click Demo Sign In as Alex Johnson"
          >
            ⚡ One-Click Demo Sign In (Live API)
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 'var(--space-4) 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
            <span className="text-xs text-secondary">OR SIGN IN WITH ACCOUNT</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
          </div>

          {(authError || fetchError) && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }} role="alert">
              <span>⚠️</span>
              <span>{authError || fetchError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ textAlign: 'left' }}>
            {authMode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">Full Name</label>
                  <input
                    id="fullName"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Enter your name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email (Optional)</label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              </>
            )}

            {authMode === 'login' && (
              <div className="form-group">
                <label className="form-label" htmlFor="identifier">Mobile Number or Email</label>
                <input
                  id="identifier"
                  className="form-input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="9876543210 or email"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: 'var(--space-3)' }}
            >
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <button
            type="button"
            className="btn btn-text text-sm"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign In'}
          </button>
        </div>
      </section>
    );
  }

  // Loading State
  if (loading && !dashboardData) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }} aria-busy="true">
        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>⏳</div>
        <p className="text-secondary font-medium">Loading your accessible dashboard...</p>
      </div>
    );
  }

  // Error State with retry
  if (fetchError && !dashboardData) {
    return (
      <div className="alert alert-error" role="alert">
        <span>⚠️</span>
        <div style={{ flex: 1 }}>
          <p className="font-semibold">Unable to load dashboard</p>
          <p className="text-xs">{fetchError}</p>
        </div>
        <button onClick={loadDashboard} className="btn btn-secondary" style={{ minHeight: '36px', padding: '0 12px' }}>
          Retry
        </button>
      </div>
    );
  }

  const d = dashboardData;
  const upiId = d?.user.upi_id || `${user?.phone_number}@oneability`;

  return (
    <div className="dashboard-space" role="region" aria-label="OneAbility Home Dashboard">
      {/* 1. User Greeting & Profile Shortcut Header */}
      <section className="dashboard-greeting" aria-label="User greeting">
        <div>
          <h2>{d?.greeting || `Hello, ${user?.full_name?.split(' ')[0] || 'User'}`} 👋</h2>
          <p>Welcome back to OneAbility AI</p>
        </div>
        <Link
          to="/profile"
          className="profile-chip"
          aria-label="Go to user profile"
          title="Open Profile"
        >
          <span className="avatar-circle">
            {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
          </span>
          <span className="text-xs font-semibold">Profile ➔</span>
        </Link>
      </section>

      {/* 2. Balance Card with Privacy Toggle & UPI ID */}
      <section
        className="balance-card"
        aria-label="Account Balance and UPI Details"
        aria-live="polite"
      >
        <div className="balance-header">
          <span className="balance-label">Total Accessible Balance</span>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="balance-visibility-btn"
            aria-label={showBalance ? 'Hide account balance for privacy' : 'Show account balance'}
            title={showBalance ? 'Hide balance' : 'Show balance'}
          >
            <span>{showBalance ? '👁️' : '🙈'}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {showBalance ? 'Hide' : 'Show'}
            </span>
          </button>
        </div>

        <div className="balance-amount">
          {showBalance ? (
            <span>{d?.balance.formatted_balance || '₹25,480.00'}</span>
          ) : (
            <span style={{ letterSpacing: '0.2em' }}>••••••••</span>
          )}
        </div>

        <div className="balance-meta">
          <div className="upi-badge" title="Your Primary UPI ID">
            <span>⚡ UPI:</span>
            <span style={{ userSelect: 'all' }}>{upiId}</span>
            <button
              onClick={() => handleCopyUpi(upiId)}
              className="upi-copy-btn"
              aria-label={`Copy UPI ID ${upiId}`}
              title="Copy UPI ID"
            >
              {copiedUpi ? '✅' : '📋'}
            </button>
          </div>

          {d?.primary_account && (
            <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
              🏛️ {d.primary_account.bank_name} ({d.primary_account.account_number_masked})
            </span>
          )}
        </div>
      </section>

      {/* 3. Quick Actions Grid (WCAG >= 48px touch targets) */}
      <section aria-label="Quick Actions">
        <div className="section-header">
          <h3 className="section-title">Quick Actions</h3>
        </div>
        <div className="quick-actions-grid" role="group" aria-label="Primary Payment Shortcuts">
          <Link
            to="/voice"
            className="quick-action-card"
            style={{ border: '2px solid rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.05)' }}
            aria-label="Voice Pay using natural Tamil or English speech"
          >
            <div className="quick-action-icon" aria-hidden="true" style={{ fontSize: '1.75rem' }}>🎙️</div>
            <div className="quick-action-text">
              <span className="quick-action-title" style={{ color: 'var(--color-primary, #6366f1)', fontWeight: 800 }}>Voice Pay</span>
              <span className="quick-action-desc">Tamil / Tanglish / English</span>
            </div>
          </Link>

          <Link
            to="/bills"
            className="quick-action-card"
            style={{ border: '2px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.05)' }}
            aria-label="Pay bills and mobile recharge across 10 categories"
          >
            <div className="quick-action-icon" aria-hidden="true" style={{ fontSize: '1.75rem' }}>🧾</div>
            <div className="quick-action-text">
              <span className="quick-action-title" style={{ color: 'var(--color-success, #10b981)', fontWeight: 800 }}>Bills & Recharge</span>
              <span className="quick-action-desc">Mobile, Electricity, DTH</span>
            </div>
          </Link>

          <Link
            to="/scan"
            className="quick-action-card"
            aria-label="Scan and Pay using camera QR code"
          >
            <div className="quick-action-icon" aria-hidden="true">📷</div>
            <div className="quick-action-text">
              <span className="quick-action-title">Scan & Pay</span>
              <span className="quick-action-desc">Any QR code</span>
            </div>
          </Link>

          <Link
            to="/pay"
            className="quick-action-card"
            aria-label="Pay a saved contact or mobile number"
          >
            <div className="quick-action-icon" aria-hidden="true">👤</div>
            <div className="quick-action-text">
              <span className="quick-action-title">Pay Contact</span>
              <span className="quick-action-desc">To phone contact</span>
            </div>
          </Link>

          <Link
            to="/pay"
            className="quick-action-card"
            aria-label="Pay to any UPI VPA ID handle"
          >
            <div className="quick-action-icon" aria-hidden="true">⚡</div>
            <div className="quick-action-text">
              <span className="quick-action-title">Pay UPI ID</span>
              <span className="quick-action-desc">Direct VPA handle</span>
            </div>
          </Link>

          <Link
            to="/pay"
            className="quick-action-card"
            aria-label="Request money from a friend or contact"
          >
            <div className="quick-action-icon" aria-hidden="true">📥</div>
            <div className="quick-action-text">
              <span className="quick-action-title">Request Money</span>
              <span className="quick-action-desc">Collect payment</span>
            </div>
          </Link>
        </div>
      </section>

      {/* 4. Linked Bank Account Summary */}
      {d?.primary_account && (
        <section aria-label="Linked Bank Account">
          <div className="section-header">
            <h3 className="section-title">Linked Bank Account</h3>
            <span className="text-xs text-secondary">
              {d.linked_accounts_count} {d.linked_accounts_count === 1 ? 'account' : 'accounts'} linked
            </span>
          </div>

          <div className="bank-summary-card">
            <div className="bank-info">
              <div className="bank-icon" aria-hidden="true">🏛️</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="font-bold text-sm">{d.primary_account.bank_name}</span>
                  {d.primary_account.is_primary && (
                    <span className="badge-tag badge-primary">Primary</span>
                  )}
                </div>
                <p className="text-secondary text-xs">
                  {d.primary_account.account_type} • {d.primary_account.account_number_masked}
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="badge-tag badge-success">Active</span>
              <p className="text-secondary text-xs" style={{ marginTop: '2px' }}>
                IFSC: {d.primary_account.ifsc_code}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 5. Recent Transactions */}
      <section aria-label="Recent Transactions">
        <div className="section-header">
          <h3 className="section-title">Recent Transactions</h3>
          <Link
            to="/history"
            className="btn-text text-sm font-semibold"
            aria-label="View all past transaction history"
          >
            View All ➔
          </Link>
        </div>

        {d?.recent_transactions && d.recent_transactions.length > 0 ? (
          <div className="transaction-list" role="list">
            {d.recent_transactions.map((tx) => {
              const isDebit = tx.transaction_type === 'DEBIT';
              const formattedDate = new Date(tx.created_at).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={tx.id}
                  className="transaction-row"
                  role="listitem"
                  aria-label={`${isDebit ? 'Sent' : 'Received'} ${tx.formatted_amount} to ${tx.party_name}`}
                >
                  <div className="transaction-left">
                    <div
                      className={`transaction-icon-box ${isDebit ? 'debit' : 'credit'}`}
                      aria-hidden="true"
                    >
                      {isDebit ? '↗️' : '↙️'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{tx.party_name}</p>
                      <p className="text-secondary text-xs">
                        {tx.payment_method} • {formattedDate}
                      </p>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      className={isDebit ? 'transaction-amount-debit' : 'transaction-amount-credit'}
                    >
                      {tx.formatted_amount}
                    </span>
                    <p className="text-xs text-secondary" style={{ fontSize: '0.7rem' }}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <p className="text-secondary text-sm">No recent transactions yet.</p>
          </div>
        )}
      </section>

      {/* 6. Notifications & Alerts */}
      {d?.notifications && d.notifications.length > 0 && (
        <section aria-label="Notifications and Alerts">
          <div className="section-header">
            <h3 className="section-title">
              🔔 Notifications
              {d.unread_notifications_count > 0 && (
                <span
                  className="badge-tag badge-primary"
                  style={{ marginLeft: '8px', fontSize: '0.7rem' }}
                >
                  {d.unread_notifications_count} New
                </span>
              )}
            </h3>
            <Link
              to="/notifications"
              className="btn-text text-sm font-semibold"
              aria-label="View all notifications in Notification Center"
            >
              View All ➔
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {d.notifications.map((n) => (
              <Link
                key={n.id}
                to="/notifications"
                className="notification-card"
                role="article"
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '10px' }}
                aria-label={`${n.title}: ${n.message}`}
              >
                {!n.is_read && <span className="unread-dot" aria-label="Unread notification" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 className="text-sm font-semibold" style={{ marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{n.title}</span>
                    <span className="text-secondary text-xs" style={{ fontWeight: 'normal' }}>➔</span>
                  </h4>
                  <p className="text-xs text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.message}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 7. Profile & Settings Shortcut Footer Banner */}
      <section className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 className="text-sm font-semibold">Accessibility & Preferences</h4>
          <p className="text-xs text-secondary">
            Voice guidance: {d?.accessibility.voice_guidance ? 'Enabled' : 'Disabled'} • Language: {d?.accessibility.preferred_language.toUpperCase()}
          </p>
        </div>
        <Link to="/settings" className="btn btn-secondary" style={{ minHeight: '36px', padding: '0 14px', fontSize: 'var(--font-size-xs)' }}>
          Settings ⚙️
        </Link>
      </section>
    </div>
  );
};

export default Home;
