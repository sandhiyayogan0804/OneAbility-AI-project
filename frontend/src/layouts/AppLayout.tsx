import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const AppLayout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      if (!isAuthenticated) {
        setUnreadCount(0);
        return;
      }
      try {
        const res = await api.getUnreadNotificationCount();
        if (isMounted) {
          setUnreadCount(res.unread_count);
        }
      } catch {
        // Silently ignore background polling failure
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const getInitials = (name: string) => {
    return name
      ? name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'U';
  };

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      {/* Skip to Main Content Link for Keyboard & Screen Reader Users */}
      <a href="#main-content" className="skip-link">
        Skip to main content ➔
      </a>

      <header
        role="banner"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingTop: '0.5rem',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none' }} aria-label="OneAbility AI Home">
          <h1
            className="text-primary"
            style={{
              margin: 0,
              fontSize: '1.4rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span aria-hidden="true">♿</span> OneAbility AI
          </h1>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Notification Center Bell Link */}
              <Link
                to="/notifications"
                className="btn-icon"
                title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                aria-label={`Notifications, ${unreadCount} unread`}
                style={{
                  position: 'relative',
                  background: 'var(--color-surface)',
                  border: 'var(--border-subtle)',
                  cursor: 'pointer',
                  width: '38px',
                  height: '38px',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span aria-hidden="true">🔔</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '9px',
                      background: 'var(--color-primary, #6366f1)',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      border: '2px solid var(--color-background)',
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                to="/profile"
                className="profile-chip"
                aria-label={`View profile for ${user.full_name}`}
              >
                <span className="avatar-circle">{getInitials(user.full_name)}</span>
                <span className="text-xs font-semibold" style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.full_name.split(' ')[0]}
                </span>
              </Link>
              <button
                onClick={logout}
                className="btn-icon"
                title="Log out"
                aria-label="Log out"
                style={{
                  background: 'var(--color-surface)',
                  border: 'var(--border-subtle)',
                  cursor: 'pointer',
                  width: '38px',
                  height: '38px',
                  fontSize: '0.9rem',
                }}
              >
                🚪
              </button>
            </div>
          ) : (
            <Link
              to="/"
              className="btn btn-secondary"
              style={{ minHeight: '36px', padding: '0 12px', fontSize: 'var(--font-size-xs)' }}
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main id="main-content" role="main" tabIndex={-1} style={{ outline: 'none' }}>
        <Outlet />
      </main>

      <nav className="bottom-nav" role="navigation" aria-label="Main Navigation">
        <NavLink
          to="/"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          end
          style={{ textDecoration: 'none' }}
        >
          <span aria-hidden="true" style={{ fontSize: '1.4rem', marginBottom: '2px' }}>
            🏠
          </span>
          <span className="text-xs">Home</span>
        </NavLink>
        <NavLink
          to="/pay"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <span aria-hidden="true" style={{ fontSize: '1.4rem', marginBottom: '2px' }}>
            💸
          </span>
          <span className="text-xs">Pay</span>
        </NavLink>
        <NavLink
          to="/voice"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <span aria-hidden="true" style={{ fontSize: '1.4rem', marginBottom: '2px' }}>
            🎙️
          </span>
          <span className="text-xs">Voice</span>
        </NavLink>
        <NavLink
          to="/scan"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <span aria-hidden="true" style={{ fontSize: '1.4rem', marginBottom: '2px' }}>
            📷
          </span>
          <span className="text-xs">Scan</span>
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <span aria-hidden="true" style={{ fontSize: '1.4rem', marginBottom: '2px' }}>
            🕒
          </span>
          <span className="text-xs">History</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
          aria-label="Accessibility and Settings"
        >
          <span aria-hidden="true" style={{ fontSize: '1.4rem', marginBottom: '2px' }}>
            ⚙️
          </span>
          <span className="text-xs">Access</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default AppLayout;
