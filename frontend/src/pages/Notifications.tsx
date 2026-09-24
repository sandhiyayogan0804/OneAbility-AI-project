import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { api } from '../services/api';
import type { NotificationItem } from '../types';

type FilterTab = 'ALL' | 'UNREAD' | 'PAYMENTS' | 'SECURITY' | 'SYSTEM';

export const Notifications: React.FC = () => {
  const { isAuthenticated, demoLogin } = useAuth();
  const { speak, triggerHaptic, announce } = useAccessibility();

  // State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [readingId, setReadingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState<boolean>(false);

  // Load notifications
  const loadNotifications = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const data = await api.getNotifications({ limit: 50 });
      setNotifications(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications. Please try again.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
    }
  }, [isAuthenticated, loadNotifications]);

  // Derived unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // Filtered notifications based on active tab
  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'UNREAD':
        return notifications.filter((n) => !n.is_read);
      case 'PAYMENTS':
        return notifications.filter((n) =>
          ['TRANSACTION', 'BILL_PAYMENT'].includes(n.notification_type)
        );
      case 'SECURITY':
        return notifications.filter((n) =>
          ['SECURITY', 'SAFETY_WARNING'].includes(n.notification_type)
        );
      case 'SYSTEM':
        return notifications.filter((n) =>
          ['SYSTEM', 'INFO'].includes(n.notification_type)
        );
      case 'ALL':
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  // Handle Mark as Read for a single item
  const handleMarkAsRead = async (item: NotificationItem) => {
    if (item.is_read) return;
    triggerHaptic(40);

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
    );

    try {
      await api.markNotificationAsRead(item.id);
      announce(`Notification '${item.title}' marked as read.`);
    } catch (err: any) {
      // Rollback on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: false } : n))
      );
      announce('Failed to mark notification as read');
    }
  };

  // Handle Mark All as Read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    triggerHaptic([50, 40, 50]);
    setMarkingAll(true);

    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      const res = await api.markAllNotificationsAsRead();
      announce(res.message || 'All notifications marked as read.');
    } catch (err: any) {
      // Reload on failure
      loadNotifications(true);
      announce('Failed to mark all as read. Please try again.');
    } finally {
      setMarkingAll(false);
    }
  };

  // Handle Text-To-Speech read aloud
  const handleSpeakNotification = (item: NotificationItem) => {
    triggerHaptic(30);
    setReadingId(item.id);
    const textToSpeak = `${item.title}. ${item.message}. Received ${item.formatted_time || 'recently'}.`;
    speak(textToSpeak);
    setTimeout(() => setReadingId(null), 3500);
  };

  // Notification type visual helpers
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'TRANSACTION':
        return {
          label: 'Payment',
          color: 'var(--color-success, #10b981)',
          bg: 'rgba(16, 185, 129, 0.12)',
          icon: '💸',
        };
      case 'BILL_PAYMENT':
        return {
          label: 'Bill / Recharge',
          color: 'var(--color-primary, #6366f1)',
          bg: 'rgba(99, 102, 241, 0.12)',
          icon: '🧾',
        };
      case 'SECURITY':
        return {
          label: 'Security',
          color: '#8b5cf6',
          bg: 'rgba(139, 92, 246, 0.12)',
          icon: '🛡️',
        };
      case 'SAFETY_WARNING':
        return {
          label: 'AI Safety Alert',
          color: 'var(--color-warning, #f59e0b)',
          bg: 'rgba(245, 158, 11, 0.14)',
          icon: '⚠️',
        };
      case 'SYSTEM':
        return {
          label: 'System',
          color: '#06b6d4',
          bg: 'rgba(6, 182, 212, 0.12)',
          icon: '♿',
        };
      default:
        return {
          label: 'Notice',
          color: 'var(--color-text-secondary)',
          bg: 'var(--color-surface-hover)',
          icon: 'ℹ️',
        };
    }
  };

  // Get deep-link route for contextual action
  const getActionLink = (item: NotificationItem) => {
    switch (item.notification_type) {
      case 'TRANSACTION':
        return { label: 'View Receipt / History', to: '/history' };
      case 'BILL_PAYMENT':
        return { label: 'Go to Bills', to: '/bills' };
      case 'SECURITY':
        return { label: 'Review Settings', to: '/settings' };
      case 'SAFETY_WARNING':
        return { label: 'Payment Center', to: '/pay' };
      default:
        return null;
    }
  };

  // If unauthenticated
  if (!isAuthenticated) {
    return (
      <section className="dashboard-space" aria-label="Notifications Sign In">
        <div className="card text-center" style={{ padding: 'var(--space-6) var(--space-4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🔔</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>OneAbility Notifications</h2>
          <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-5)' }}>
            Sign in to check your payment alerts, AI risk warnings, and account security notifications.
          </p>
          <button
            onClick={() => demoLogin()}
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '50px' }}
          >
            ⚡ One-Click Demo Sign In
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-space" aria-label="Notification Center">
      {/* Screen Reader Live Announcements */}
      <div className="sr-only" aria-live="polite">
        {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All notifications read'}
      </div>

      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            to="/"
            className="btn-icon"
            style={{
              background: 'var(--color-surface)',
              border: 'var(--border-subtle)',
              textDecoration: 'none',
              width: '40px',
              height: '40px',
              fontSize: '1.1rem',
            }}
            aria-label="Back to Home Dashboard"
          >
            ←
          </Link>
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🔔</span> Notifications
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: 'var(--color-primary)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                  aria-label={`${unreadCount} unread`}
                >
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-secondary text-xs" style={{ margin: 0 }}>
              Live alerts, payment updates, and AI safety warnings
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="btn btn-secondary"
              style={{
                minHeight: '38px',
                padding: '0 12px',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              aria-label="Mark all notifications as read"
            >
              <span>✓✓</span> {markingAll ? 'Updating...' : 'Mark All Read'}
            </button>
          )}

          <button
            onClick={() => {
              triggerHaptic(30);
              loadNotifications();
              announce('Refreshing notifications');
            }}
            className="btn-icon"
            style={{
              background: 'var(--color-surface)',
              border: 'var(--border-subtle)',
              width: '38px',
              height: '38px',
              fontSize: '1rem',
            }}
            title="Refresh notifications"
            aria-label="Refresh notifications"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Notification category filters"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: 'var(--space-4)',
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'ALL'}
          onClick={() => {
            setActiveTab('ALL');
            triggerHaptic(30);
          }}
          className={`btn ${activeTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            minHeight: '36px',
            padding: '0 14px',
            fontSize: 'var(--font-size-xs)',
            whiteSpace: 'nowrap',
            borderRadius: '20px',
          }}
        >
          All ({notifications.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'UNREAD'}
          onClick={() => {
            setActiveTab('UNREAD');
            triggerHaptic(30);
          }}
          className={`btn ${activeTab === 'UNREAD' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            minHeight: '36px',
            padding: '0 14px',
            fontSize: 'var(--font-size-xs)',
            whiteSpace: 'nowrap',
            borderRadius: '20px',
          }}
        >
          Unread ({unreadCount})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'PAYMENTS'}
          onClick={() => {
            setActiveTab('PAYMENTS');
            triggerHaptic(30);
          }}
          className={`btn ${activeTab === 'PAYMENTS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            minHeight: '36px',
            padding: '0 14px',
            fontSize: 'var(--font-size-xs)',
            whiteSpace: 'nowrap',
            borderRadius: '20px',
          }}
        >
          💸 Payments & Bills
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'SECURITY'}
          onClick={() => {
            setActiveTab('SECURITY');
            triggerHaptic(30);
          }}
          className={`btn ${activeTab === 'SECURITY' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            minHeight: '36px',
            padding: '0 14px',
            fontSize: 'var(--font-size-xs)',
            whiteSpace: 'nowrap',
            borderRadius: '20px',
          }}
        >
          🛡️ Security & AI
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'SYSTEM'}
          onClick={() => {
            setActiveTab('SYSTEM');
            triggerHaptic(30);
          }}
          className={`btn ${activeTab === 'SYSTEM' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            minHeight: '36px',
            padding: '0 14px',
            fontSize: 'var(--font-size-xs)',
            whiteSpace: 'nowrap',
            borderRadius: '20px',
          }}
        >
          ♿ System
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="card"
              style={{
                height: '90px',
                opacity: 0.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="text-secondary text-sm">Loading notifications...</span>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          className="card"
          style={{
            borderColor: 'var(--color-danger, #ef4444)',
            background: 'rgba(239, 68, 68, 0.08)',
            textAlign: 'center',
            padding: 'var(--space-5)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
          <p style={{ color: 'var(--color-danger, #ef4444)', marginBottom: '12px' }}>{error}</p>
          <button
            onClick={() => loadNotifications()}
            className="btn btn-primary"
            style={{ minHeight: '40px', padding: '0 16px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredNotifications.length === 0 && (
        <div
          className="card text-center"
          style={{
            padding: 'var(--space-8) var(--space-4)',
            borderStyle: 'dashed',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>
            {activeTab === 'UNREAD' ? '🎉' : '📬'}
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
            {activeTab === 'UNREAD'
              ? 'Zero Unread Notifications!'
              : 'No Notifications in this Category'}
          </h3>
          <p className="text-secondary text-sm" style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
            {activeTab === 'UNREAD'
              ? 'You are all caught up. New transaction alerts and AI security warnings will appear here.'
              : 'There are no notifications matching your current filter tab.'}
          </p>
          {activeTab !== 'ALL' && (
            <button
              onClick={() => setActiveTab('ALL')}
              className="btn btn-secondary"
              style={{ minHeight: '38px', padding: '0 16px' }}
            >
              View All Notifications
            </button>
          )}
        </div>
      )}

      {/* Notifications List */}
      {!loading && !error && filteredNotifications.length > 0 && (
        <div
          role="feed"
          aria-label="Notification list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {filteredNotifications.map((notif) => {
            const badge = getTypeBadge(notif.notification_type);
            const action = getActionLink(notif);
            const isSpeaking = readingId === notif.id;

            return (
              <article
                key={notif.id}
                className="card"
                style={{
                  padding: 'var(--space-4)',
                  position: 'relative',
                  borderLeft: notif.is_read
                    ? '1px solid var(--border-subtle)'
                    : `4px solid ${badge.color}`,
                  background: notif.is_read
                    ? 'var(--color-surface)'
                    : 'var(--color-surface-hover, rgba(99, 102, 241, 0.04))',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
                aria-label={`${badge.label}: ${notif.title}. ${notif.is_read ? 'Read' : 'Unread'}`}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  {/* Category Icon */}
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: badge.bg,
                      color: badge.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    {badge.icon}
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: badge.color,
                            background: badge.bg,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {badge.label}
                        </span>

                        {!notif.is_read && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'var(--color-primary, #6366f1)',
                            }}
                            title="Unread notification"
                            aria-label="Unread indicator"
                          />
                        )}
                      </div>

                      <span className="text-secondary text-xs" style={{ whiteSpace: 'nowrap' }}>
                        {notif.formatted_time || 'Just now'}
                      </span>
                    </div>

                    <h2
                      style={{
                        fontSize: '1rem',
                        fontWeight: notif.is_read ? 600 : 700,
                        margin: '0 0 6px',
                        color: 'var(--color-text)',
                      }}
                    >
                      {notif.title}
                    </h2>

                    <p
                      className="text-secondary text-sm"
                      style={{
                        margin: '0 0 12px',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}
                    >
                      {notif.message}
                    </p>

                    {/* Interactive Action Bar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '6px',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Audio Readout */}
                        <button
                          onClick={() => handleSpeakNotification(notif)}
                          className="btn btn-secondary"
                          style={{
                            minHeight: '32px',
                            padding: '0 10px',
                            fontSize: 'var(--font-size-xs)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: isSpeaking ? 'var(--color-primary)' : undefined,
                            color: isSpeaking ? '#ffffff' : undefined,
                          }}
                          aria-label={`Listen to notification: ${notif.title}`}
                        >
                          <span>{isSpeaking ? '🔊' : '🔈'}</span>
                          <span>{isSpeaking ? 'Reading...' : 'Listen'}</span>
                        </button>

                        {/* Mark As Read */}
                        {!notif.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notif)}
                            className="btn btn-secondary"
                            style={{
                              minHeight: '32px',
                              padding: '0 10px',
                              fontSize: 'var(--font-size-xs)',
                            }}
                            aria-label={`Mark '${notif.title}' as read`}
                          >
                            ✓ Mark as Read
                          </button>
                        )}
                      </div>

                      {/* Deep-link action button */}
                      {action && (
                        <Link
                          to={action.to}
                          className="btn btn-primary"
                          style={{
                            minHeight: '32px',
                            padding: '0 12px',
                            fontSize: 'var(--font-size-xs)',
                            textDecoration: 'none',
                          }}
                        >
                          {action.label} ➔
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default Notifications;
