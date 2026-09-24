import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { api } from '../services/api';
import type {
  BillCategory,
  BillerOption,
  BillFetchResponse,
  BillPaymentResponse,
  PaymentSafetyCheckResponse,
} from '../types';
import PaymentSafetyCard from '../components/PaymentSafetyCard';

type BillStage = 'CATEGORIES' | 'BILLERS' | 'INPUT' | 'REVIEW' | 'PROCESSING' | 'RESULT' | 'HISTORY';

export const Bills: React.FC = () => {
  const { isAuthenticated, demoLogin } = useAuth();
  const { speak, triggerHaptic, announce } = useAccessibility();
  const [searchParams] = useSearchParams();

  // State
  const [stage, setStage] = useState<BillStage>('CATEGORIES');
  const [categories, setCategories] = useState<BillCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<BillCategory | null>(null);
  const [selectedBiller, setSelectedBiller] = useState<BillerOption | null>(null);

  // Form Inputs
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [fetchingBill, setFetchingBill] = useState<boolean>(false);
  const [fetchedDetails, setFetchedDetails] = useState<BillFetchResponse | null>(null);

  // Search filter
  const [searchFilter, setSearchFilter] = useState<string>('');

  // AI Safety & Risk Check States
  const [safetyData, setSafetyData] = useState<PaymentSafetyCheckResponse | null>(null);
  const [loadingSafety, setLoadingSafety] = useState<boolean>(false);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState<boolean>(false);

  // Balance & Bank Details
  const [availableBalance, setAvailableBalance] = useState<number>(25480);
  const [primaryBank, setPrimaryBank] = useState<string>('State Bank of India (•••• 4821)');

  // Payment Execution & Simulation
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('Processing simulated bill payment...');
  const [paymentResult, setPaymentResult] = useState<BillPaymentResponse | null>(null);
  const [billHistory, setBillHistory] = useState<BillPaymentResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  // Load initial data
  useEffect(() => {
    if (isAuthenticated) {
      loadCategories();
      loadBalance();
    }
  }, [isAuthenticated]);

  // Check URL query param for category (e.g. /bills?cat=MOBILE_RECHARGE)
  useEffect(() => {
    const catQuery = searchParams.get('cat');
    if (catQuery && categories.length > 0) {
      const matched = categories.find((c) => c.id === catQuery);
      if (matched) {
        handleSelectCategory(matched);
      }
    }
  }, [searchParams, categories]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const data = await api.getBillCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load bill categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadBalance = async () => {
    try {
      const dash = await api.getDashboardHome();
      setAvailableBalance(dash.balance.total_balance);
      if (dash.primary_account) {
        setPrimaryBank(`${dash.primary_account.bank_name} (${dash.primary_account.account_number_masked})`);
      }
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await api.getBillHistory();
      setBillHistory(data);
    } catch (err) {
      console.error('Failed to load bill history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Stage Transitions & Handlers
  const handleSelectCategory = (cat: BillCategory) => {
    triggerHaptic(40);
    setSelectedCategory(cat);
    setSelectedBiller(null);
    setAccountNumber('');
    setAmount('');
    setInputError(null);
    setFetchedDetails(null);
    setStage('BILLERS');
    speak(`Selected ${cat.name}. Choose your service provider.`);
    announce(`Selected category ${cat.name}.`);
  };

  const handleSelectBiller = (biller: BillerOption) => {
    triggerHaptic(40);
    setSelectedBiller(biller);
    setAccountNumber('');
    setAmount(biller.quick_amounts.length > 0 ? biller.quick_amounts[0].toString() : '');
    setInputError(null);
    setFetchedDetails(null);
    setStage('INPUT');
    speak(`Selected ${biller.name}. Enter your ${biller.input_label}.`);
    announce(`Selected ${biller.name}`);
  };

  const handleFetchOrContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !selectedBiller) return;

    const trimmedAcc = accountNumber.trim();
    if (!trimmedAcc) {
      triggerHaptic(60);
      setInputError(`Please enter your ${selectedBiller.input_label}`);
      announce(`Error: Please enter your ${selectedBiller.input_label}`);
      return;
    }

    // Regex check if present
    if (selectedBiller.regex_pattern) {
      const reg = new RegExp(selectedBiller.regex_pattern, 'i');
      if (!reg.test(trimmedAcc)) {
        triggerHaptic(60);
        const errText = selectedBiller.validation_hint || `Invalid format for ${selectedBiller.input_label}`;
        setInputError(errText);
        speak(errText);
        announce(`Validation error: ${errText}`);
        return;
      }
    }

    setInputError(null);
    setFetchingBill(true);
    triggerHaptic(40);

    try {
      const fetched = await api.fetchBillDetails({
        category: selectedCategory.id,
        biller_id: selectedBiller.id,
        account_number: trimmedAcc,
      });
      setFetchedDetails(fetched);
      if (fetched.bill_amount) {
        setAmount(fetched.bill_amount.toString());
      }
      setStage('REVIEW');
      const amtText = fetched.bill_amount ? `Bill amount is ₹${fetched.bill_amount}.` : 'Please verify amount.';
      speak(`Bill details found for ${fetched.consumer_name}. ${amtText} Review your payment.`);
      announce(`Bill fetched for ${fetched.consumer_name}.`);

      // Run Safety Check
      runSafetyCheck(fetched.bill_amount || parseFloat(amount) || 299, selectedBiller);
    } catch (err: any) {
      triggerHaptic(60);
      const msg = err.message || 'Failed to fetch bill details. Please check your account number.';
      setInputError(msg);
      speak(msg);
      announce(`Error: ${msg}`);
    } finally {
      setFetchingBill(false);
    }
  };

  const runSafetyCheck = async (amt: number, biller: BillerOption) => {
    setLoadingSafety(true);
    setHasAcknowledgedRisk(false);
    try {
      const res = await api.checkPaymentSafety({
        recipient_type: 'UPI_ID',
        recipient_identifier: `${biller.id}@billpay`,
        recipient_name: biller.name,
        amount: amt,
        source: 'MANUAL',
        description: `Bill Payment: ${biller.name}`,
      });
      setSafetyData(res);
    } catch (err) {
      console.error('Safety check failed on bill payment:', err);
    } finally {
      setLoadingSafety(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!selectedCategory || !selectedBiller) return;
    const finalAmount = parseFloat(amount);

    if (isNaN(finalAmount) || finalAmount <= 0) {
      triggerHaptic(60);
      setInputError('Please enter a valid amount greater than ₹0');
      return;
    }

    triggerHaptic(40);
    setStage('PROCESSING');
    announce('Processing bill payment...');
    setProcessingMessage(`Connecting to ${selectedBiller.name} billing gateway...`);

    setTimeout(() => {
      setProcessingMessage('Debiting primary bank account and updating NPCI rails...');
    }, 700);

    setTimeout(async () => {
      try {
        const result = await api.executeBillPayment({
          category: selectedCategory.id,
          biller_id: selectedBiller.id,
          biller_name: selectedBiller.name,
          account_number: accountNumber.trim(),
          consumer_name: fetchedDetails?.consumer_name,
          amount: finalAmount,
          convenience_fee: 0.0,
          simulate_failure: simulateFailure,
          payment_method: 'UPI',
          bill_metadata: {
            due_date: fetchedDetails?.due_date,
            bill_period: fetchedDetails?.bill_period,
          },
        });
        setPaymentResult(result);
        setStage('RESULT');
        if (result.status === 'SUCCESS') {
          triggerHaptic([80, 50, 160]);
          speak(`Bill payment of ₹${result.total_amount} to ${result.biller_name} was successful.`);
          announce(`Bill payment of ₹${result.total_amount} to ${result.biller_name} was successful.`);
        } else {
          triggerHaptic([200, 80, 200]);
          speak(`Bill payment failed: ${result.message}`);
          announce(`Bill payment failed: ${result.message}`);
        }
        loadBalance();
      } catch (err: any) {
        setPaymentResult({
          id: 0,
          reference_id: `ERR_BILL_${Date.now()}`,
          category: selectedCategory.id,
          biller_id: selectedBiller.id,
          biller_name: selectedBiller.name,
          account_number: accountNumber.trim(),
          consumer_name: fetchedDetails?.consumer_name,
          amount: finalAmount,
          convenience_fee: 0.0,
          total_amount: finalAmount,
          formatted_total: `₹${finalAmount.toLocaleString('en-IN')}`,
          status: 'FAILED',
          message: err.message || 'Payment execution failed.',
          debit_bank: primaryBank,
          debit_account_masked: '•••• ••••',
          remaining_balance: availableBalance,
          created_at: new Date().toISOString(),
        });
        setStage('RESULT');
        triggerHaptic([200, 80, 200]);
        speak(`Payment failed: ${err.message || 'Payment execution failed'}`);
        announce('Payment failed.');
      }
    }, 1500);
  };

  const handleReset = () => {
    setStage('CATEGORIES');
    setSelectedCategory(null);
    setSelectedBiller(null);
    setAccountNumber('');
    setAmount('');
    setInputError(null);
    setFetchedDetails(null);
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

  // If not authenticated, prompt sign-in
  if (!isAuthenticated) {
    return (
      <section className="dashboard-space" aria-label="Sign in required">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🔒</div>
          <h2>Sign In to Pay Bills & Recharges</h2>
          <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>
            Authentication is required to securely pay electricity, mobile, water, DTH, and utility bills.
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

  // Filter categories or billers
  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.billers.some((b) => b.name.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="dashboard-space" role="region" aria-label="Bills and Recharge Management">
      {/* 1. Header */}
      <section className="dashboard-greeting" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>🧾 Bills & Recharge</h2>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Simulated BBPS
            </span>
          </div>
          <p className="text-secondary text-sm" style={{ marginTop: '4px' }}>
            Pay mobile top-ups, electricity, water, gas, FASTag & 10 utility categories instantly.
          </p>
        </div>

        {/* View History Toggle Button */}
        <button
          onClick={() => {
            triggerHaptic(40);
            if (stage === 'HISTORY') {
              setStage('CATEGORIES');
            } else {
              setStage('HISTORY');
              loadHistory();
              speak('Viewing your recent bill payment history.');
            }
          }}
          className="btn btn-secondary"
          style={{
            minHeight: '44px',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
          }}
          aria-label={stage === 'HISTORY' ? 'Back to categories' : 'View bill payment history'}
        >
          <span>{stage === 'HISTORY' ? '⬅️ Categories' : '🕒 Bill History'}</span>
        </button>
      </section>

      {/* Primary Account Balance Preview */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(99, 102, 241, 0.05)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}
        aria-label="Account balance status"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🏛️</span>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Primary Debit Account
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{primaryBank}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            Available Balance
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-primary)' }}>
            ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* STAGE 1: CATEGORIES CATALOG                                    */}
      {/* ============================================================== */}
      {stage === 'CATEGORIES' && (
        <section aria-label="Bill Categories">
          {/* Search Bar */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="bill-search" className="sr-only">
              Search bills or service providers
            </label>
            <input
              id="bill-search"
              type="text"
              className="input-field"
              placeholder="🔍 Search category or provider (e.g. Jio, BESCOM, FASTag)..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ minHeight: '48px' }}
            />
          </div>

          {loadingCategories ? (
            <div style={{ textAlign: 'center', padding: '2rem' }} aria-live="polite">
              <span className="spinner" style={{ display: 'inline-block', marginBottom: '8px' }}>🔄</span>
              <p className="text-secondary">Loading bill categories...</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '12px',
              }}
              role="grid"
              aria-label="Bill Categories Grid"
            >
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '1.25rem 0.75rem',
                    cursor: 'pointer',
                    minHeight: '120px',
                    border: '1.5px solid var(--border-subtle)',
                    transition: 'all 0.2s ease',
                    background: 'var(--color-surface)',
                  }}
                  aria-label={`${cat.name}: ${cat.description}`}
                >
                  <span style={{ fontSize: '2.2rem', marginBottom: '8px' }} aria-hidden="true">
                    {cat.icon}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                    {cat.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--color-text-secondary)',
                      marginTop: '4px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {cat.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* STAGE 2: BILLER / PROVIDER SELECTION                           */}
      {/* ============================================================== */}
      {stage === 'BILLERS' && selectedCategory && (
        <section aria-label={`Select ${selectedCategory.name} Provider`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <button
              onClick={() => {
                triggerHaptic(40);
                setStage('CATEGORIES');
              }}
              className="btn btn-secondary"
              style={{ minHeight: '44px', padding: '0 12px' }}
              aria-label="Back to all bill categories"
            >
              ⬅️ Back
            </button>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              {selectedCategory.icon} {selectedCategory.name} Providers
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            {selectedCategory.billers.map((biller) => (
              <button
                key={biller.id}
                onClick={() => handleSelectBiller(biller)}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '1rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: '1.5px solid var(--border-subtle)',
                  minHeight: '64px',
                  background: 'var(--color-surface)',
                }}
                aria-label={`Select ${biller.name}`}
              >
                <span style={{ fontSize: '1.8rem' }} aria-hidden="true">
                  {biller.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{biller.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Requires: {biller.input_label}
                  </div>
                </div>
                <span style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>➔</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* STAGE 3: ACCOUNT NUMBER & AMOUNT INPUT                         */}
      {/* ============================================================== */}
      {stage === 'INPUT' && selectedCategory && selectedBiller && (
        <section aria-label={`Enter details for ${selectedBiller.name}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <button
              onClick={() => {
                triggerHaptic(40);
                setStage('BILLERS');
              }}
              className="btn btn-secondary"
              style={{ minHeight: '44px', padding: '0 12px' }}
              aria-label="Back to providers list"
            >
              ⬅️ Back
            </button>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              {selectedBiller.icon} {selectedBiller.name}
            </h3>
          </div>

          <form onSubmit={handleFetchOrContinue} className="card" style={{ padding: '1.5rem' }}>
            {/* Account / Identifier Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="bill-account-input"
                style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}
              >
                {selectedBiller.input_label} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="bill-account-input"
                type="text"
                className="input-field"
                placeholder={selectedBiller.input_placeholder}
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value);
                  setInputError(null);
                }}
                autoFocus
                style={{ minHeight: '52px', fontSize: '1.05rem', fontWeight: 600 }}
                aria-required="true"
                aria-describedby="biller-hint"
              />
              {selectedBiller.validation_hint && (
                <p id="biller-hint" style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  ℹ️ {selectedBiller.validation_hint}
                </p>
              )}
            </div>

            {/* Quick Amount Pills */}
            {selectedBiller.quick_amounts && selectedBiller.quick_amounts.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                  ⚡ Popular Recharge / Bill Plans:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedBiller.quick_amounts.map((qAmt) => (
                    <button
                      key={qAmt}
                      type="button"
                      onClick={() => {
                        triggerHaptic(30);
                        setAmount(qAmt.toString());
                        speak(`Selected plan ₹${qAmt}`);
                      }}
                      className={`btn ${amount === qAmt.toString() ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        minHeight: '42px',
                        padding: '0 14px',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                      }}
                      aria-label={`Select plan ₹${qAmt}`}
                    >
                      ₹{qAmt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="bill-amount-input"
                style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}
              >
                Payment Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: 'var(--color-text-secondary)',
                  }}
                  aria-hidden="true"
                >
                  ₹
                </span>
                <input
                  id="bill-amount-input"
                  type="number"
                  step="any"
                  min="1"
                  className="input-field"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ paddingLeft: '36px', minHeight: '52px', fontSize: '1.1rem', fontWeight: 700 }}
                  aria-required="true"
                />
              </div>
            </div>

            {/* Error Message */}
            {inputError && (
              <div className="alert alert-error" style={{ marginBottom: '1.25rem' }} role="alert">
                <span>⚠️</span>
                <span>{inputError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={fetchingBill}
              className="btn btn-primary"
              style={{ width: '100%', minHeight: '52px', fontSize: '1rem', fontWeight: 700 }}
            >
              {fetchingBill ? '🔄 Validating & Fetching Bill...' : 'Continue to Review ➔'}
            </button>
          </form>
        </section>
      )}

      {/* ============================================================== */}
      {/* STAGE 4: REVIEW & CONFIRMATION                                 */}
      {/* ============================================================== */}
      {stage === 'REVIEW' && selectedCategory && selectedBiller && (
        <section aria-label="Review Bill Payment">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <button
              onClick={() => {
                triggerHaptic(40);
                setStage('INPUT');
              }}
              className="btn btn-secondary"
              style={{ minHeight: '44px', padding: '0 12px' }}
              aria-label="Back to edit bill details"
            >
              ⬅️ Edit
            </button>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              Review Bill Payment
            </h3>
          </div>

          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            {/* Header with Biller Icon & Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '2.5rem' }} aria-hidden="true">
                {selectedBiller.icon}
              </span>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{selectedBiller.name}</h4>
                <p className="text-secondary text-xs" style={{ margin: 0 }}>
                  Category: {selectedCategory.name}
                </p>
              </div>
            </div>

            {/* Details Table */}
            <div
              style={{
                background: 'var(--color-bg-secondary, rgba(0,0,0,0.03))',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-secondary text-sm">{selectedBiller.input_label}:</span>
                <span className="font-semibold text-sm">{accountNumber}</span>
              </div>

              {fetchedDetails?.consumer_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="text-secondary text-sm">Consumer Name:</span>
                  <span className="font-semibold text-sm">{fetchedDetails.consumer_name}</span>
                </div>
              )}

              {fetchedDetails?.due_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="text-secondary text-sm">Due Date:</span>
                  <span className="font-semibold text-sm">{fetchedDetails.due_date}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-secondary text-sm">Debit Account:</span>
                <span className="font-semibold text-sm">{primaryBank}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-secondary text-sm">Convenience Fee:</span>
                <span className="text-sm font-semibold" style={{ color: '#10b981' }}>
                  ₹0.00 (FREE)
                </span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>Total Payable:</span>
                <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-primary)' }}>
                  ₹{parseFloat(amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* AI Payment Safety Card Integration */}
            <PaymentSafetyCard
              safetyData={safetyData}
              loading={loadingSafety}
              hasAcknowledgedRisk={hasAcknowledgedRisk}
              onToggleAcknowledge={(ack) => setHasAcknowledgedRisk(ack)}
              recipientName={selectedBiller.name}
              recipientIdentifier={accountNumber}
              amount={parseFloat(amount || '0')}
            />

            {/* Simulation Options */}
            <div
              style={{
                marginTop: '1rem',
                marginBottom: '1.25rem',
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px dashed rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <label
                htmlFor="simulate-fail-checkbox"
                style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', cursor: 'pointer' }}
              >
                🧪 Simulate Bank Failure (For testing)
              </label>
              <input
                id="simulate-fail-checkbox"
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
            </div>

            {/* Explicit Confirm & Pay Button */}
            <button
              onClick={handleExecutePayment}
              disabled={safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)}
              className="btn btn-primary"
              style={{
                width: '100%',
                minHeight: '54px',
                fontSize: '1.1rem',
                fontWeight: 800,
                opacity:
                  safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)
                    ? 0.5
                    : 1,
              }}
              aria-label={`Confirm and pay ₹${amount} to ${selectedBiller.name}`}
            >
              🔒 Confirm & Pay ₹{parseFloat(amount || '0').toLocaleString('en-IN')}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              🛡️ Payment Simulator: Instant balance deduction with full transaction receipt. No PIN required for demo.
            </p>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* STAGE 5: PROCESSING SCREEN                                     */}
      {/* ============================================================== */}
      {stage === 'PROCESSING' && (
        <section aria-label="Processing Bill Payment" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              border: '4px solid var(--color-primary)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem auto',
            }}
          />
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>Processing Bill Payment</h3>
          <p className="text-secondary" style={{ fontSize: '0.95rem' }}>
            {processingMessage}
          </p>
        </section>
      )}

      {/* ============================================================== */}
      {/* STAGE 6: RESULT / RECEIPT SCREEN                               */}
      {/* ============================================================== */}
      {stage === 'RESULT' && paymentResult && (
        <section aria-label="Bill Payment Result">
          <div
            className="card"
            style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              borderTop: `6px solid ${paymentResult.status === 'SUCCESS' ? '#10b981' : '#ef4444'}`,
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>
              {paymentResult.status === 'SUCCESS' ? '✅' : '❌'}
            </div>

            <h3
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: paymentResult.status === 'SUCCESS' ? '#10b981' : '#ef4444',
                margin: 0,
              }}
            >
              {paymentResult.status === 'SUCCESS' ? 'Bill Payment Successful!' : 'Bill Payment Failed'}
            </h3>

            <p className="text-secondary text-sm" style={{ margin: '6px 0 1.25rem 0' }}>
              {paymentResult.message}
            </p>

            <div
              style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: 'var(--color-text-primary)',
                marginBottom: '1.25rem',
              }}
            >
              {paymentResult.formatted_total}
            </div>

            {/* Receipt Summary Card */}
            <div
              style={{
                background: 'var(--color-bg-secondary, rgba(0,0,0,0.03))',
                borderRadius: '12px',
                padding: '14px',
                textAlign: 'left',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-secondary text-sm">Reference ID:</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <code style={{ fontSize: '0.85rem', fontWeight: 700 }}>{paymentResult.reference_id}</code>
                  <button
                    onClick={() => handleCopyRef(paymentResult.reference_id)}
                    className="upi-copy-btn"
                    title="Copy Reference ID"
                    aria-label="Copy Reference ID"
                  >
                    {copiedRef ? '✅' : '📋'}
                  </button>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-secondary text-sm">Provider / Biller:</span>
                <span className="font-semibold text-sm">{paymentResult.biller_name}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-secondary text-sm">Account Number:</span>
                <span className="font-semibold text-sm">{paymentResult.account_number}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-secondary text-sm">Debit Bank:</span>
                <span className="font-semibold text-sm">{paymentResult.debit_bank}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-secondary text-sm">Remaining Balance:</span>
                <span className="font-semibold text-sm" style={{ color: 'var(--color-primary)' }}>
                  ₹{paymentResult.remaining_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary text-sm">Date & Time:</span>
                <span className="font-semibold text-sm">
                  {new Date(paymentResult.created_at).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleReset}
                className="btn btn-primary"
                style={{ width: '100%', minHeight: '50px', fontWeight: 700 }}
              >
                🧾 Pay Another Bill / Recharge
              </button>

              <Link
                to="/history"
                className="btn btn-secondary"
                style={{ width: '100%', minHeight: '48px', textDecoration: 'none' }}
              >
                🕒 View in Transaction History
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* STAGE 7: BILL PAYMENT HISTORY                                  */}
      {/* ============================================================== */}
      {stage === 'HISTORY' && (
        <section aria-label="Recent Bill Payments History">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🕒 Recent Bill & Recharge Payments</h3>
            <button
              onClick={() => {
                triggerHaptic(40);
                loadHistory();
              }}
              className="btn btn-secondary"
              style={{ minHeight: '38px', padding: '0 10px', fontSize: '0.8rem' }}
            >
              🔄 Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '2rem' }} aria-live="polite">
              <span className="spinner" style={{ display: 'inline-block', marginBottom: '8px' }}>🔄</span>
              <p className="text-secondary">Loading bill history...</p>
            </div>
          ) : billHistory.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>🧾</span>
              <p className="font-semibold" style={{ margin: '0 0 4px 0' }}>No bill payments yet</p>
              <p className="text-secondary text-xs" style={{ margin: 0 }}>
                Payments you make for mobile, DTH, electricity or utilities will be recorded here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {billHistory.map((item) => (
                <div
                  key={item.reference_id}
                  className="card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.8rem' }} aria-hidden="true">
                      {item.status === 'SUCCESS' ? '🧾' : '⚠️'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.biller_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {item.account_number} • {new Date(item.created_at).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{item.formatted_total}</div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: item.status === 'SUCCESS' ? '#10b981' : '#ef4444',
                        background: item.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        display: 'inline-block',
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Bills;
