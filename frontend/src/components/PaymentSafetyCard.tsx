import React, { useEffect } from 'react';
import type { PaymentSafetyCheckResponse } from '../types';

interface PaymentSafetyCardProps {
  safetyData: PaymentSafetyCheckResponse | null;
  loading: boolean;
  hasAcknowledgedRisk: boolean;
  onToggleAcknowledge: (acknowledged: boolean) => void;
  recipientName: string;
  recipientIdentifier: string;
  amount: number;
}

export const PaymentSafetyCard: React.FC<PaymentSafetyCardProps> = ({
  safetyData,
  loading,
  hasAcknowledgedRisk,
  onToggleAcknowledge,
  recipientName,
  recipientIdentifier,
  amount,
}) => {
  // Haptic feedback for warnings
  useEffect(() => {
    if (safetyData) {
      if (safetyData.risk_level === 'CRITICAL' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([150, 100, 150, 100, 200]);
        } catch {}
      } else if (safetyData.requires_strong_confirmation && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {}
      }
    }
  }, [safetyData]);

  if (loading) {
    return (
      <div
        className="card"
        style={{
          padding: '1.25rem',
          marginBottom: '1rem',
          background: 'var(--color-bg-secondary, #f8fafc)',
          border: '1.5px dashed var(--color-primary, #6366f1)',
          textAlign: 'center',
        }}
        aria-live="polite"
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '18px',
              height: '18px',
              border: '2px solid #6366f1',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>
            OneAbility AI is running safety & fraud checks...
          </span>
        </div>
      </div>
    );
  }

  if (!safetyData) return null;

  const isBlocked = safetyData.recommended_action === 'BLOCK';
  const isHighRisk = safetyData.risk_level === 'HIGH';
  const isMediumRisk = safetyData.risk_level === 'MEDIUM';

  // Badge theme
  const getBadgeStyle = () => {
    if (isBlocked) {
      return {
        bg: '#fee2e2',
        border: '#ef4444',
        text: '#b91c1c',
        icon: '🛑',
        label: 'Transfer Blocked',
      };
    }
    if (isHighRisk) {
      return {
        bg: '#ffedd5',
        border: '#f97316',
        text: '#c2410c',
        icon: '⚠️',
        label: 'High Risk Alert',
      };
    }
    if (isMediumRisk) {
      return {
        bg: '#fef3c7',
        border: '#f59e0b',
        text: '#b45309',
        icon: '⚡',
        label: 'Caution Advised',
      };
    }
    return {
      bg: '#dcfce7',
      border: '#10b981',
      text: '#15803d',
      icon: '🛡️',
      label: 'Verified Low Risk',
    };
  };

  const badge = getBadgeStyle();

  return (
    <div
      className="payment-safety-card"
      style={{
        border: `2px solid ${badge.border}`,
        backgroundColor: badge.bg,
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.25rem',
        boxShadow: isHighRisk || isBlocked ? '0 4px 16px rgba(239, 68, 68, 0.15)' : 'none',
        transition: 'all 0.3s ease',
      }}
      role="region"
      aria-label="Payment AI Safety Assessment"
    >
      {/* Risk Badge Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.3rem' }}>{badge.icon}</span>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: badge.text }}>
            AI Safety Shield: {badge.label}
          </span>
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            background: '#ffffff',
            padding: '2px 8px',
            borderRadius: '12px',
            border: `1px solid ${badge.border}`,
            color: badge.text,
          }}
        >
          Score: {Math.round(safetyData.risk_score * 100)}/100
        </span>
      </div>

      {/* Warning Title and Message */}
      {safetyData.warning_title && (
        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 800, color: badge.text }}>
          {safetyData.warning_title}
        </h4>
      )}

      {safetyData.warning_message && (
        <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#374151', lineHeight: 1.4 }}>
          {safetyData.warning_message}
        </p>
      )}

      {/* Risk Flags Display */}
      {safetyData.risk_flags && safetyData.risk_flags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {safetyData.risk_flags.map((flag) => {
            const formatted = flag.replace(/_/g, ' ');
            return (
              <span
                key={flag}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: `1px solid ${badge.border}`,
                  color: badge.text,
                  textTransform: 'capitalize',
                }}
              >
                • {formatted}
              </span>
            );
          })}
        </div>
      )}

      {/* Actionable Security Tips */}
      {safetyData.safety_tips && safetyData.safety_tips.length > 0 && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: safetyData.requires_strong_confirmation ? '12px' : '4px',
            fontSize: '0.8rem',
            color: '#4b5563',
          }}
        >
          <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: badge.text }}>
            Safety Guidance:
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {safetyData.safety_tips.map((tip, idx) => (
              <li key={idx} style={{ marginBottom: '2px' }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocked Transfer Notice */}
      {isBlocked && (
        <div
          style={{
            marginTop: '8px',
            padding: '10px',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1.5px solid #ef4444',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: '#b91c1c', fontSize: '0.9rem' }}>
            ⛔ This transfer cannot be authorized due to safety policy restrictions.
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
            Please correct the amount or recipient details to continue.
          </p>
        </div>
      )}

      {/* Strong Confirmation Requirement Checkbox */}
      {safetyData.requires_strong_confirmation && !isBlocked && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1.5px dashed #f59e0b',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#1f2937',
            }}
          >
            <input
              type="checkbox"
              checked={hasAcknowledgedRisk}
              onChange={(e) => onToggleAcknowledge(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                marginTop: '2px',
                accentColor: 'var(--color-primary, #6366f1)',
                cursor: 'pointer',
              }}
            />
            <span>
              I have verified the recipient <strong>{recipientName || recipientIdentifier}</strong> and amount (₹{amount.toLocaleString('en-IN')}), and I accept the risk to proceed.
            </span>
          </label>
        </div>
      )}
    </div>
  );
};

export default PaymentSafetyCard;
