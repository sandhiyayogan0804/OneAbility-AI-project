import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { api } from '../services/api';
import type { Beneficiary, PaymentResultResponse, DashboardHomeData, PaymentSafetyCheckResponse } from '../types';
import PaymentSafetyCard from '../components/PaymentSafetyCard';

type PaymentStep = 'RECIPIENT' | 'AMOUNT' | 'REVIEW' | 'PROCESSING' | 'RESULT';

interface SelectedRecipient {
  type: 'CONTACT' | 'UPI_ID' | 'BENEFICIARY';
  name: string;
  identifier: string;
  avatarText?: string;
}

const Pay: React.FC = () => {
  const { isAuthenticated, demoLogin } = useAuth();
  const { speak, triggerHaptic, announce } = useAccessibility();
  const [searchParams] = useSearchParams();

  // Current Step
  const [step, setStep] = useState<PaymentStep>('RECIPIENT');

  // Recipient Tab: 'CONTACT' | 'UPI_ID'
  const initialTab = searchParams.get('tab') === 'upi' ? 'UPI_ID' : 'CONTACT';
  const [activeTab, setActiveTab] = useState<'CONTACT' | 'UPI_ID'>(initialTab);

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Recipient
  const [recipient, setRecipient] = useState<SelectedRecipient | null>(null);

  // Direct UPI Form
  const [customUpi, setCustomUpi] = useState('');
  const [customName, setCustomName] = useState('');

  // Amount State
  const [amount, setAmount] = useState<string>('500');
  const [description, setDescription] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);

  // AI Safety & Risk Check States
  const [safetyData, setSafetyData] = useState<PaymentSafetyCheckResponse | null>(null);
  const [loadingSafety, setLoadingSafety] = useState<boolean>(false);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState<boolean>(false);

  // Dashboard Balance for validation
  const [availableBalance, setAvailableBalance] = useState<number>(25480);
  const [primaryBank, setPrimaryBank] = useState<string>('State Bank of India •••• 4821');

  // Review & Simulation Flags
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResultResponse | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>('Processing secure simulated transfer...');
  const [copiedRef, setCopiedRef] = useState(false);

  // Load Beneficiaries and Balance when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadBeneficiaries();
      loadBalance();
    }
  }, [isAuthenticated]);

  const loadBeneficiaries = async () => {
    setLoadingBeneficiaries(true);
    try {
      const list = await api.getBeneficiaries();
      setBeneficiaries(list);
    } catch (err) {
      console.error('Failed to load beneficiaries:', err);
    } finally {
      setLoadingBeneficiaries(false);
    }
  };

  const loadBalance = async () => {
    try {
      const dash: DashboardHomeData = await api.getDashboardHome();
      setAvailableBalance(dash.balance.total_balance);
      if (dash.primary_account) {
        setPrimaryBank(`${dash.primary_account.bank_name} (${dash.primary_account.account_number_masked})`);
      }
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
  };

  const handleSelectBeneficiary = (b: Beneficiary) => {
    triggerHaptic(40);
    const ident = b.upi_id || b.phone_number || '';
    setRecipient({
      type: 'BENEFICIARY',
      name: b.name,
      identifier: ident,
      avatarText: b.name[0].toUpperCase(),
    });
    setStep('AMOUNT');
    speak(`Selected recipient ${b.name}. Please enter transfer amount.`);
    announce(`Selected ${b.name}`);
  };

  const handleVerifyDirectUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUpi.trim()) return;
    triggerHaptic(40);
    try {
      const verified = await api.verifyRecipient(customUpi.trim(), 'UPI_ID');
      setRecipient({
        type: 'UPI_ID',
        name: customName.trim() || verified.name,
        identifier: customUpi.trim(),
        avatarText: (customName || verified.name)[0]?.toUpperCase() || 'U',
      });
      setStep('AMOUNT');
      speak(`Verified ${customName.trim() || verified.name}. Enter amount.`);
    } catch {
      setRecipient({
        type: 'UPI_ID',
        name: customName.trim() || customUpi.split('@')[0],
        identifier: customUpi.trim(),
        avatarText: 'U',
      });
      setStep('AMOUNT');
    }
  };

  const runSafetyCheck = async (amt: number, recip = recipient) => {
    if (!recip) return;
    setLoadingSafety(true);
    try {
      const result = await api.checkPaymentSafety({
        recipient_type: recip.type,
        recipient_identifier: recip.identifier,
        recipient_name: recip.name,
        amount: amt,
        source: 'MANUAL',
        description: description.trim() || undefined,
      });
      setSafetyData(result);
    } catch (err) {
      console.error('Safety check failed:', err);
    } finally {
      setLoadingSafety(false);
    }
  };

  const handleAmountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      triggerHaptic(60);
      setAmountError('Please enter an amount greater than ₹0');
      announce('Error: Please enter an amount greater than 0');
      return;
    }
    triggerHaptic(40);
    setAmountError(null);
    setHasAcknowledgedRisk(false);
    setStep('REVIEW');
    speak(`Review your transfer of ₹${num} to ${recipient?.name}`);
    announce(`Review payment of ₹${num}`);
    runSafetyCheck(num);
  };

  const handleExecutePayment = async () => {
    if (!recipient) return;
    triggerHaptic(40);
    setStep('PROCESSING');
    announce('Processing simulated payment transfer...');
    setProcessingMessage('Connecting to UPI Simulator network...');

    setTimeout(() => {
      setProcessingMessage('Debiting primary bank account...');
    }, 800);

    setTimeout(async () => {
      try {
        const result = await api.executePayment({
          recipient_type: recipient.type,
          recipient_name: recipient.name,
          recipient_identifier: recipient.identifier,
          amount: parseFloat(amount),
          description: description.trim() || undefined,
          simulate_failure: simulateFailure,
        });
        setPaymentResult(result);
        setStep('RESULT');
        triggerHaptic([80, 50, 160]);
        speak(`Payment of ₹${amount} to ${recipient.name} was successful.`);
        announce(`Payment transfer completed successfully.`);
      } catch (err: any) {
        setPaymentResult({
          status: 'FAILED',
          reference_id: `TXN_ERR_${Date.now()}`,
          amount: parseFloat(amount),
          formatted_amount: `₹${parseFloat(amount).toLocaleString('en-IN')}`,
          currency: 'INR',
          payment_method: 'UPI',
          recipient_name: recipient.name,
          recipient_identifier: recipient.identifier,
          sender_bank: primaryBank,
          sender_account_masked: '•••• ••••',
          created_at: new Date().toISOString(),
          message: err.message || 'Payment processing failed.',
          remaining_balance: availableBalance,
        });
        setStep('RESULT');
        triggerHaptic([200, 80, 200]);
        speak(`Payment failed: ${err.message || 'Payment processing failed.'}`);
        announce(`Payment failed.`);
      }
    }, 1600);
  };

  const handleResetFlow = () => {
    setStep('RECIPIENT');
    setRecipient(null);
    setAmount('500');
    setDescription('');
    setPaymentResult(null);
    setSimulateFailure(false);
    loadBalance();
  };

  const handleCopyRef = (refId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(refId);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  // If user not authenticated, show sign-in prompt
  if (!isAuthenticated) {
    return (
      <section className="dashboard-space" aria-label="Sign in required">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🔒</div>
          <h2>Sign In to Make Payments</h2>
          <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>
            Authentication is required to initiate secure UPI and contact payments.
          </p>
          <button
            onClick={() => demoLogin()}
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '52px' }}
          >
            ⚡ One-Click Demo Sign In (Live API)
          </button>
        </div>
      </section>
    );
  }

  const filteredBeneficiaries = beneficiaries.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.upi_id && b.upi_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.phone_number && b.phone_number.includes(searchQuery))
  );

  return (
    <div className="dashboard-space" role="region" aria-label="Core Payment Flow">
      {/* 1. Accessible Stepper Indicator */}
      <nav className="payment-stepper" aria-label="Payment Steps">
        <div className={`step-item ${step === 'RECIPIENT' ? 'active' : 'completed'}`}>
          <div className="step-circle">{step === 'RECIPIENT' ? '1' : '✓'}</div>
          <span className="step-label">Recipient</span>
        </div>
        <div style={{ flex: 1, height: '2px', background: step !== 'RECIPIENT' ? 'var(--color-success)' : 'var(--border-subtle)', margin: '0 8px' }} />
        <div className={`step-item ${step === 'AMOUNT' ? 'active' : (step === 'REVIEW' || step === 'PROCESSING' || step === 'RESULT') ? 'completed' : ''}`}>
          <div className="step-circle">{(step === 'REVIEW' || step === 'PROCESSING' || step === 'RESULT') ? '✓' : '2'}</div>
          <span className="step-label">Amount</span>
        </div>
        <div style={{ flex: 1, height: '2px', background: (step === 'REVIEW' || step === 'PROCESSING' || step === 'RESULT') ? 'var(--color-success)' : 'var(--border-subtle)', margin: '0 8px' }} />
        <div className={`step-item ${step === 'REVIEW' ? 'active' : (step === 'PROCESSING' || step === 'RESULT') ? 'completed' : ''}`}>
          <div className="step-circle">{(step === 'PROCESSING' || step === 'RESULT') ? '✓' : '3'}</div>
          <span className="step-label">Review</span>
        </div>
        <div style={{ flex: 1, height: '2px', background: step === 'RESULT' ? 'var(--color-success)' : 'var(--border-subtle)', margin: '0 8px' }} />
        <div className={`step-item ${step === 'RESULT' ? 'active' : ''}`}>
          <div className="step-circle">4</div>
          <span className="step-label">Result</span>
        </div>
      </nav>

      {/* ========================================================
          STEP 1: SELECT RECIPIENT
         ======================================================== */}
      {step === 'RECIPIENT' && (
        <section aria-label="Step 1: Select Recipient">
          <div className="section-header">
            <h2 className="section-title" style={{ fontSize: '1.25rem' }}>Select Recipient</h2>
            <span className="text-xs text-secondary">Step 1 of 3</span>
          </div>

          {/* Voice AI Prompt Banner */}
          <Link
            to="/voice"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(6, 182, 212, 0.08))',
              border: '1.5px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '1rem',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.5rem' }}>🎙️</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>
                  Pay using Voice Assistant
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Speak in Tamil, English, or Tanglish (e.g. "Kumar-ku 500 rooba anuppu")
                </p>
              </div>
            </div>
            <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.85rem' }}>
              Open Voice ➔
            </span>
          </Link>

          {/* Recipient Mode Tabs */}
          <div className="payment-tabs" role="tablist">
            <button
              className={`payment-tab-btn ${activeTab === 'CONTACT' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'CONTACT'}
              onClick={() => setActiveTab('CONTACT')}
            >
              <span>👤</span> Saved Contacts
            </button>
            <button
              className={`payment-tab-btn ${activeTab === 'UPI_ID' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'UPI_ID'}
              onClick={() => setActiveTab('UPI_ID')}
            >
              <span>⚡</span> Pay UPI ID
            </button>
          </div>

          {/* TAB A: SAVED CONTACTS / BENEFICIARIES */}
          {activeTab === 'CONTACT' && (
            <div>
              <div className="form-group">
                <input
                  type="search"
                  className="form-input"
                  placeholder="🔍 Search contact name, phone or UPI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search saved contacts"
                />
              </div>

              {loadingBeneficiaries ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-5)' }}>
                  <p className="text-secondary text-sm">Loading contacts...</p>
                </div>
              ) : filteredBeneficiaries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} role="list">
                  {filteredBeneficiaries.map((b) => (
                    <button
                      key={b.id}
                      className="beneficiary-card"
                      onClick={() => handleSelectBeneficiary(b)}
                      role="listitem"
                      aria-label={`Pay ${b.name}, ${b.upi_id || b.phone_number}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="beneficiary-avatar">{b.name[0].toUpperCase()}</div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="font-bold text-sm">{b.name}</span>
                            {b.is_favorite && <span style={{ fontSize: '0.85rem' }} title="Favorite contact">⭐</span>}
                          </div>
                          <p className="text-secondary text-xs">{b.upi_id || b.phone_number}</p>
                        </div>
                      </div>
                      <span className="text-primary font-bold" style={{ fontSize: '1.2rem' }}>➔</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-5)' }}>
                  <p className="text-secondary text-sm">No contacts found matching "{searchQuery}".</p>
                </div>
              )}
            </div>
          )}

          {/* TAB B: DIRECT UPI ID */}
          {activeTab === 'UPI_ID' && (
            <div className="card">
              <form onSubmit={handleVerifyDirectUpi}>
                <div className="form-group">
                  <label className="form-label" htmlFor="customUpi">
                    UPI VPA Handle <span style={{ color: 'var(--color-primary)' }}>*</span>
                  </label>
                  <input
                    id="customUpi"
                    className="form-input"
                    placeholder="e.g. friend@okhdfcbank or merchant@paytm"
                    value={customUpi}
                    onChange={(e) => setCustomUpi(e.target.value)}
                    required
                    autoFocus
                  />
                  <span className="text-xs text-secondary" style={{ marginTop: '4px', display: 'block' }}>
                    Standard UPI handles format: username@bank
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="customName">Recipient Name (Optional)</label>
                  <input
                    id="customName"
                    className="form-input"
                    placeholder="e.g. Ravi or Bookstore"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 'var(--space-2)' }}
                  disabled={!customUpi.trim()}
                >
                  Proceed to Enter Amount ➔
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          STEP 2: ENTER AMOUNT
         ======================================================== */}
      {step === 'AMOUNT' && recipient && (
        <section aria-label="Step 2: Enter Amount">
          <div className="section-header">
            <h2 className="section-title" style={{ fontSize: '1.25rem' }}>Enter Amount</h2>
            <button
              onClick={() => setStep('RECIPIENT')}
              className="btn-text text-xs font-semibold"
            >
              Change Recipient ✎
            </button>
          </div>

          {/* Selected Recipient Card */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div className="beneficiary-avatar">{recipient.avatarText || '👤'}</div>
            <div style={{ flex: 1 }}>
              <span className="font-bold text-sm">{recipient.name}</span>
              <p className="text-secondary text-xs">{recipient.identifier}</p>
            </div>
            <span className="badge-tag badge-primary">{recipient.type}</span>
          </div>

          {/* Available Balance Pill */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
            <span className="text-xs text-secondary">
              Available in {primaryBank.split('(')[0]}: <strong>₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>

          {/* Big Amount Input Form */}
          <form onSubmit={handleAmountSubmit}>
            <div className="amount-input-box" role="group" aria-label="Amount in Indian Rupees">
              <span className="currency-symbol-big">₹</span>
              <input
                type="number"
                step="any"
                min="1"
                className="amount-input-big"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountError(null);
                }}
                required
                autoFocus
                placeholder="0"
                aria-label="Payment amount in rupees"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="amount-chips-grid" aria-label="Quick amount shortcuts">
              {[100, 500, 1000, 2000].map((val) => (
                <button
                  key={val}
                  type="button"
                  className="amount-chip"
                  onClick={() => {
                    const current = parseFloat(amount) || 0;
                    setAmount((current + val).toString());
                    setAmountError(null);
                  }}
                  aria-label={`Add ${val} rupees`}
                >
                  +{val}
                </button>
              ))}
            </div>

            {/* Note / Purpose */}
            <div className="form-group">
              <label className="form-label" htmlFor="description">Add a Note (Optional)</label>
              <input
                id="description"
                className="form-input"
                placeholder="e.g. Dinner split, Rent, Books"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={50}
              />
            </div>

            {amountError && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }} role="alert">
                <span>⚠️</span>
                <span>{amountError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              <button
                type="button"
                onClick={() => setStep('RECIPIENT')}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                Review Payment ➔
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ========================================================
          STEP 3: REVIEW & EXPLICIT CONFIRMATION
         ======================================================== */}
      {step === 'REVIEW' && recipient && (
        <section aria-label="Step 3: Review and Confirm Payment">
          <div className="section-header">
            <h2 className="section-title" style={{ fontSize: '1.25rem' }}>Review Transfer</h2>
            <span className="text-xs text-secondary">Step 3 of 3</span>
          </div>

          <div className="review-card">
            {/* Amount Box */}
            <div className="review-amount-box">
              <span className="text-xs text-secondary font-semibold" style={{ letterSpacing: '0.05em' }}>
                PAYING AMOUNT
              </span>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                ₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              {description && (
                <p className="text-xs text-secondary" style={{ marginTop: '4px' }}>
                  Note: "{description}"
                </p>
              )}
            </div>

            {/* Recipient Details */}
            <div className="review-row">
              <span className="text-secondary">To Recipient:</span>
              <span className="font-bold">{recipient.name}</span>
            </div>

            <div className="review-row">
              <span className="text-secondary">Identifier:</span>
              <span className="font-mono text-xs">{recipient.identifier}</span>
            </div>

            <div className="review-row">
              <span className="text-secondary">Paying From:</span>
              <span className="font-medium text-xs">🏛️ {primaryBank}</span>
            </div>

            <div className="review-row">
              <span className="text-secondary">Payment Mode:</span>
              <span className="badge-tag badge-primary">UPI Simulator</span>
            </div>

            <div className="review-row" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
              <span className="text-secondary">Est. Remaining Balance:</span>
              <span className="font-semibold text-xs">
                ₹{(availableBalance - parseFloat(amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* AI Risk & Payment Safety Shield */}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <PaymentSafetyCard
                safetyData={safetyData}
                loading={loadingSafety}
                hasAcknowledgedRisk={hasAcknowledgedRisk}
                onToggleAcknowledge={setHasAcknowledgedRisk}
                recipientName={recipient.name}
                recipientIdentifier={recipient.identifier}
                amount={parseFloat(amount) || 0}
              />
            </div>

            {/* Simulation Options for Testing */}
            <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                />
                <span className="font-medium">Simulate Payment Failure (Testing decline scenario)</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
              <button
                type="button"
                onClick={() => setStep('AMOUNT')}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleExecutePayment}
                className="btn btn-primary"
                style={{
                  flex: 2,
                  minHeight: '52px',
                  fontSize: '1.05rem',
                  opacity: (loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)) ? 0.6 : 1,
                  cursor: (loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)) ? 'not-allowed' : 'pointer'
                }}
                disabled={loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)}
                aria-label={`Confirm and pay ${amount} rupees to ${recipient.name}`}
              >
                {loadingSafety
                  ? 'Checking Safety...'
                  : safetyData?.recommended_action === 'BLOCK'
                  ? '⛔ Transfer Blocked'
                  : `Confirm & Pay ₹${parseFloat(amount).toLocaleString('en-IN')} 🔒`}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          STEP 4: SIMULATOR PROCESSING SCREEN
         ======================================================== */}
      {step === 'PROCESSING' && (
        <section className="card simulator-box" aria-busy="true" aria-live="assertive">
          <div className="spinner-circle" aria-hidden="true" />
          <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-2)' }}>Processing Payment</h3>
          <p className="text-secondary text-sm font-medium">{processingMessage}</p>
          <div style={{ marginTop: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            <span>🔒</span> End-to-end simulated encryption active
          </div>
        </section>
      )}

      {/* ========================================================
          STEP 5: RESULT SCREEN (SUCCESS / FAILURE)
         ======================================================== */}
      {step === 'RESULT' && paymentResult && (
        <section aria-label="Payment Result" aria-live="polite">
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
            {paymentResult.status === 'SUCCESS' ? (
              <>
                <div className="result-icon-box success" aria-hidden="true">✓</div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--color-success)', marginBottom: 'var(--space-1)' }}>
                  Payment Successful!
                </h2>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: 'var(--space-2) 0' }}>
                  {paymentResult.formatted_amount}
                </div>
                <p className="text-secondary text-sm font-medium">
                  Sent to <strong>{paymentResult.recipient_name}</strong> ({paymentResult.recipient_identifier})
                </p>

                {/* Reference ID Pill */}
                <div>
                  <div className="reference-id-pill">
                    <span>Ref: {paymentResult.reference_id}</span>
                    <button
                      onClick={() => handleCopyRef(paymentResult.reference_id)}
                      className="upi-copy-btn"
                      aria-label="Copy reference ID"
                    >
                      {copiedRef ? '✅' : '📋'}
                    </button>
                  </div>
                </div>

                {/* Receipt Details Box */}
                <div style={{ textAlign: 'left', background: 'var(--color-surface-muted)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', margin: 'var(--space-3) 0 var(--space-5)' }}>
                  <div className="review-row">
                    <span className="text-secondary">Debited From:</span>
                    <span className="font-semibold">{paymentResult.sender_bank} ({paymentResult.sender_account_masked})</span>
                  </div>
                  <div className="review-row">
                    <span className="text-secondary">Date & Time:</span>
                    <span>{new Date(paymentResult.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="review-row">
                    <span className="text-secondary">Remaining Balance:</span>
                    <span className="font-bold text-success">
                      ₹{paymentResult.remaining_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="result-icon-box failed" aria-hidden="true">✕</div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--color-error)', marginBottom: 'var(--space-1)' }}>
                  Payment Declined
                </h2>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, margin: 'var(--space-2) 0' }}>
                  {paymentResult.formatted_amount}
                </div>
                <p className="text-error text-sm font-medium" style={{ margin: 'var(--space-2) 0' }}>
                  {paymentResult.message}
                </p>

                <div className="reference-id-pill">
                  <span>Ref: {paymentResult.reference_id}</span>
                </div>

                <div style={{ textAlign: 'left', background: 'var(--color-surface-muted)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', margin: 'var(--space-3) 0 var(--space-5)' }}>
                  <div className="review-row">
                    <span className="text-secondary">Account:</span>
                    <span>{paymentResult.sender_bank}</span>
                  </div>
                  <div className="review-row">
                    <span className="text-secondary">Status:</span>
                    <span className="badge-tag badge-primary" style={{ background: 'var(--color-error-alpha)', color: 'var(--color-error)' }}>
                      Failed
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={handleResetFlow}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Pay Another
              </button>
              <Link
                to="/"
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Done (Home)
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Pay;
