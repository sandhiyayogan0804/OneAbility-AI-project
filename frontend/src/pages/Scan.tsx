import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { api } from '../services/api';
import type { QRParsedData, PaymentResultResponse, DashboardHomeData, PaymentSafetyCheckResponse } from '../types';
import PaymentSafetyCard from '../components/PaymentSafetyCard';

type ScanStage = 'CAMERA' | 'AMOUNT' | 'REVIEW' | 'PROCESSING' | 'RESULT';

const SAMPLE_QRS = [
  {
    title: 'Grocery Store (With ₹350 Amount)',
    subtitle: 'Fresh Mart (freshmart@okaxis)',
    qr: 'upi://pay?pa=freshmart@okaxis&pn=Fresh%20Mart&am=350.00&cu=INR&tn=Groceries',
    icon: '🛒',
  },
  {
    title: 'Personal QR (Without Amount)',
    subtitle: 'Priya Sharma (priya@okaxis)',
    qr: 'upi://pay?pa=priya@okaxis&pn=Priya%20Sharma',
    icon: '👤',
  },
  {
    title: 'Direct VPA Handle QR',
    subtitle: 'City Bookstore (bookstore@okhdfcbank)',
    qr: 'bookstore@okhdfcbank',
    icon: '📚',
  },
  {
    title: 'Unsupported QR (Generic Website URL)',
    subtitle: 'https://oneability.ai (Should decline)',
    qr: 'https://oneability.ai',
    icon: '🌐',
  },
  {
    title: 'Invalid QR (Missing Payee)',
    subtitle: 'Malformed UPI code',
    qr: 'upi://pay?pn=Unknown&am=100',
    icon: '⚠️',
  },
];

const Scan: React.FC = () => {
  const { isAuthenticated, demoLogin } = useAuth();
  const { speak, triggerHaptic, announce } = useAccessibility();

  // State
  const [stage, setStage] = useState<ScanStage>('CAMERA');
  const [cameraState, setCameraState] = useState<'IDLE' | 'ACTIVE' | 'DENIED' | 'UNSUPPORTED'>('IDLE');
  const [manualInput, setManualInput] = useState<string>('');
  const [parsing, setParsing] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Parsed QR data
  const [parsedData, setParsedData] = useState<QRParsedData | null>(null);

  // Amount & Note
  const [amount, setAmount] = useState<string>('350');
  const [description, setDescription] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);

  // Safety & AI Risk States
  const [safetyData, setSafetyData] = useState<PaymentSafetyCheckResponse | null>(null);
  const [loadingSafety, setLoadingSafety] = useState<boolean>(false);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState<boolean>(false);

  // Balance & Bank Details
  const [availableBalance, setAvailableBalance] = useState<number>(25480);
  const [primaryBank, setPrimaryBank] = useState<string>('State Bank of India (•••• 4821)');

  // Payment Execution & Result
  const [paymentResult, setPaymentResult] = useState<PaymentResultResponse | null>(null);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadBalance();
      if (stage === 'CAMERA') {
        startCamera();
      }
    }
    return () => {
      stopCamera();
    };
  }, [isAuthenticated, stage]);

  const loadBalance = async () => {
    try {
      const dash: DashboardHomeData = await api.getDashboardHome();
      setAvailableBalance(dash.balance.total_balance);
      if (dash.primary_account) {
        setPrimaryBank(`${dash.primary_account.bank_name} (${dash.primary_account.account_number_masked})`);
      }
    } catch (err) {
      console.error('Failed to load bank balance:', err);
    }
  };

  const startCamera = async () => {
    setCameraState('IDLE');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('UNSUPPORTED');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraState('ACTIVE');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('DENIED');
      } else {
        setCameraState('UNSUPPORTED');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const runSafetyCheck = async (amt: number, qrObj: QRParsedData | null) => {
    if (!qrObj || !qrObj.upi_id) return;
    setLoadingSafety(true);
    setHasAcknowledgedRisk(false);
    try {
      const res = await api.checkPaymentSafety({
        recipient_type: 'QR',
        recipient_identifier: qrObj.upi_id,
        recipient_name: qrObj.recipient_name || qrObj.upi_id,
        amount: amt,
        source: 'QR',
        description: description.trim() || qrObj.transaction_note || undefined,
      });
      setSafetyData(res);
    } catch (err) {
      console.error('Safety check failed on QR:', err);
    } finally {
      setLoadingSafety(false);
    }
  };

  // Process a scanned or selected QR code string
  const handleProcessQR = async (qrString: string) => {
    triggerHaptic(40);
    setParsing(true);
    setQrError(null);
    try {
      const res = await api.parseQR(qrString.trim());
      if (!res.is_valid_upi) {
        triggerHaptic(60);
        setQrError(res.error_message || 'The scanned QR code is not a valid UPI payment QR.');
        speak('Invalid QR code scanned.');
        announce('Error: The scanned QR code is not a valid UPI payment QR.');
        setParsing(false);
        return;
      }

      setParsedData(res);
      if (res.amount && res.amount > 0) {
        setAmount(res.amount.toString());
      } else {
        setAmount('100');
      }
      if (res.transaction_note) {
        setDescription(res.transaction_note);
      }

      stopCamera();
      triggerHaptic([60, 40, 60]);

      // If QR already contains amount, jump straight to REVIEW; otherwise prompt for AMOUNT
      if (res.amount && res.amount > 0) {
        setStage('REVIEW');
        speak(`Scanned QR for ${res.recipient_name || res.upi_id}. Amount ₹${res.amount}. Please review.`);
        announce(`Scanned QR for ${res.recipient_name || res.upi_id}.`);
        runSafetyCheck(res.amount, res);
      } else {
        setStage('AMOUNT');
        speak(`Scanned QR for ${res.recipient_name || res.upi_id}. Please enter amount.`);
        announce(`Scanned QR for ${res.recipient_name || res.upi_id}.`);
      }
    } catch (err: any) {
      triggerHaptic(60);
      setQrError(err.message || 'Failed to parse QR code.');
      announce('Failed to parse QR code.');
    } finally {
      setParsing(false);
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
    setStage('REVIEW');
    speak(`Review QR payment of ₹${num} to ${parsedData?.recipient_name || parsedData?.upi_id}`);
    announce(`Review QR payment of ₹${num}`);
    runSafetyCheck(num, parsedData);
  };

  const handleExecutePayment = async () => {
    if (!parsedData) return;
    triggerHaptic(40);
    setStage('PROCESSING');
    announce('Processing QR payment transfer...');

    setTimeout(async () => {
      try {
        const result = await api.executePayment({
          recipient_type: 'UPI_ID',
          recipient_name: parsedData.recipient_name || 'Merchant',
          recipient_identifier: parsedData.upi_id || 'unknown@upi',
          amount: parseFloat(amount),
          description: description.trim() ? `QR Pay: ${description.trim()}` : 'QR Payment',
          simulate_failure: false,
        });
        setPaymentResult(result);
        setStage('RESULT');
        triggerHaptic([80, 50, 160]);
        speak(`Payment of ₹${amount} to ${parsedData.recipient_name || 'Merchant'} was successful.`);
        announce('QR payment completed successfully.');
      } catch (err: any) {
        setPaymentResult({
          status: 'FAILED',
          reference_id: `TXN_QR_ERR_${Date.now()}`,
          amount: parseFloat(amount),
          formatted_amount: `₹${parseFloat(amount).toLocaleString('en-IN')}`,
          currency: 'INR',
          payment_method: 'QR',
          recipient_name: parsedData.recipient_name || 'Merchant',
          recipient_identifier: parsedData.upi_id || 'unknown@upi',
          sender_bank: primaryBank,
          sender_account_masked: '•••• ••••',
          created_at: new Date().toISOString(),
          message: err.message || 'QR payment processing failed.',
          remaining_balance: availableBalance,
        });
        setStage('RESULT');
        triggerHaptic([200, 80, 200]);
        speak(`Payment failed: ${err.message || 'QR payment processing failed.'}`);
        announce('QR payment failed.');
      }
    }, 1500);
  };

  const handleResetScanner = () => {
    setStage('CAMERA');
    setParsedData(null);
    setQrError(null);
    setPaymentResult(null);
    setManualInput('');
    loadBalance();
  };

  const handleCopyRef = (refId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(refId);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  // Auth gate
  if (!isAuthenticated) {
    return (
      <section className="dashboard-space" aria-label="Sign in required">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>📷</div>
          <h2>Sign In to Scan & Pay</h2>
          <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>
            Authentication is required to scan UPI QR codes and initiate payments.
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

  return (
    <div className="dashboard-space" role="region" aria-label="QR Scan and Pay Flow">
      {/* ========================================================
          STAGE 1: CAMERA SCANNER & QR DETECTOR
         ======================================================== */}
      {stage === 'CAMERA' && (
        <section aria-label="Camera QR Scanner">
          <div className="section-header">
            <h2 className="section-title" style={{ fontSize: '1.3rem' }}>Scan & Pay</h2>
            <Link to="/pay" className="btn-text text-xs font-semibold">
              Enter UPI Manually ➔
            </Link>
          </div>

          {/* Camera Viewfinder Box */}
          <div className="qr-scanner-box">
            <video ref={videoRef} className="qr-video-feed" playsInline muted />
            <div className="qr-viewfinder-overlay">
              <div className="qr-target-frame">
                <div className="qr-laser-line" />
              </div>
            </div>

            {cameraState === 'IDLE' && (
              <p className="text-secondary text-xs" style={{ position: 'absolute', color: '#fff' }}>
                Connecting camera...
              </p>
            )}

            {(cameraState === 'DENIED' || cameraState === 'UNSUPPORTED') && (
              <div style={{ position: 'absolute', padding: 'var(--space-4)', textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: '2rem', marginBottom: '4px' }}>📷</div>
                <p className="font-semibold text-xs">Camera Access Not Available</p>
                <p style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>
                  {cameraState === 'DENIED'
                    ? 'Permission was denied. Use test QRs or enter code below.'
                    : 'Camera is not available on this device.'}
                </p>
              </div>
            )}
          </div>

          {/* QR Error Alert */}
          {qrError && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }} role="alert">
              <span>⚠️</span>
              <div style={{ flex: 1 }}>
                <p className="font-bold text-xs">Invalid or Unsupported QR</p>
                <p className="text-xs">{qrError}</p>
              </div>
              <button
                onClick={() => setQrError(null)}
                className="btn btn-secondary"
                style={{ minHeight: '32px', padding: '0 8px', fontSize: '0.75rem' }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Manual QR Input Form */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <h3 className="text-sm font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
              Scan / Enter QR Payload
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualInput.trim()) handleProcessQR(manualInput);
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                className="form-input"
                placeholder="Paste upi://pay?... or recipient@bank"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                style={{ flex: 1 }}
                aria-label="Direct QR payload input"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!manualInput.trim() || parsing}
                style={{ padding: '0 16px', minHeight: '48px' }}
              >
                {parsing ? '...' : 'Parse'}
              </button>
            </form>
          </div>

          {/* Sample QRs for Instant 1-Click Verification */}
          <div className="card">
            <h3 className="text-sm font-semibold" style={{ marginBottom: '4px' }}>
              Instant Test QR Scenarios
            </h3>
            <p className="text-secondary text-xs" style={{ marginBottom: 'var(--space-3)' }}>
              Click any scenario below to simulate scanning live QR codes:
            </p>

            <div className="sample-qr-grid" role="group" aria-label="Sample QR Testing Buttons">
              {SAMPLE_QRS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="sample-qr-btn"
                  onClick={() => handleProcessQR(item.qr)}
                  aria-label={`Test ${item.title}`}
                >
                  <span style={{ fontSize: '1.3rem' }} aria-hidden="true">{item.icon}</span>
                  <div>
                    <strong className="text-xs font-bold" style={{ display: 'block' }}>{item.title}</strong>
                    <span className="text-secondary text-xs" style={{ fontSize: '0.7rem' }}>{item.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          STAGE 2: ENTER AMOUNT (WHEN NOT PRESET IN QR)
         ======================================================== */}
      {stage === 'AMOUNT' && parsedData && (
        <section aria-label="Enter QR Amount">
          <div className="section-header">
            <h2 className="section-title" style={{ fontSize: '1.25rem' }}>Enter Amount</h2>
            <button onClick={handleResetScanner} className="btn-text text-xs font-semibold">
              Scan Another 📷
            </button>
          </div>

          {/* Verified Recipient Card */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div className="beneficiary-avatar">{parsedData.recipient_name ? parsedData.recipient_name[0].toUpperCase() : 'QR'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="font-bold text-sm">{parsedData.recipient_name}</span>
                <span className="badge-tag badge-success">QR Verified</span>
              </div>
              <p className="text-secondary text-xs">{parsedData.upi_id}</p>
            </div>
          </div>

          {/* Available Balance Pill */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
            <span className="text-xs text-secondary">
              Available in {primaryBank.split('(')[0]}: <strong>₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>

          {/* Big Amount Form */}
          <form onSubmit={handleAmountSubmit}>
            <div className="amount-input-box" role="group" aria-label="Payment amount">
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

            {/* Quick Chips */}
            <div className="amount-chips-grid">
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
                >
                  +{val}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="qrNote">Add Note (Optional)</label>
              <input
                id="qrNote"
                className="form-input"
                placeholder="e.g. Groceries, Coffee"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                onClick={handleResetScanner}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
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
          STAGE 3: REVIEW & EXPLICIT CONFIRMATION
         ======================================================== */}
      {stage === 'REVIEW' && parsedData && (
        <section aria-label="Review QR Payment">
          <div className="section-header">
            <h2 className="section-title" style={{ fontSize: '1.25rem' }}>Confirm QR Payment</h2>
            <button onClick={handleResetScanner} className="btn-text text-xs font-semibold">
              Cancel
            </button>
          </div>

          <div className="review-card">
            {/* Amount Box */}
            <div className="review-amount-box">
              <span className="text-xs text-secondary font-semibold" style={{ letterSpacing: '0.05em' }}>
                PAYING VIA QR CODE
              </span>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                ₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              {parsedData.amount && (
                <span className="badge-tag badge-primary" style={{ marginTop: '4px' }}>
                  Preset by Merchant QR
                </span>
              )}
              {description && (
                <p className="text-xs text-secondary" style={{ marginTop: '4px' }}>
                  Note: "{description}"
                </p>
              )}
            </div>

            {/* Recipient Details */}
            <div className="review-row">
              <span className="text-secondary">Payee:</span>
              <span className="font-bold">{parsedData.recipient_name}</span>
            </div>

            <div className="review-row">
              <span className="text-secondary">UPI ID:</span>
              <span className="font-mono text-xs">{parsedData.upi_id}</span>
            </div>

            <div className="review-row">
              <span className="text-secondary">Paying From:</span>
              <span className="font-medium text-xs">🏛️ {primaryBank}</span>
            </div>

            <div className="review-row">
              <span className="text-secondary">Payment Method:</span>
              <span className="badge-tag badge-primary">QR Scan & Pay</span>
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
                recipientName={parsedData.recipient_name || 'Merchant'}
                recipientIdentifier={parsedData.upi_id || ''}
                amount={parseFloat(amount) || 0}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
              {!parsedData.amount && (
                <button
                  type="button"
                  onClick={() => setStage('AMOUNT')}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Edit Amount
                </button>
              )}
              <button
                type="button"
                onClick={handleExecutePayment}
                className="btn btn-primary"
                style={{
                  flex: 2,
                  minHeight: '52px',
                  fontSize: '1.05rem',
                  opacity: (loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)) ? 0.6 : 1,
                  cursor: (loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)) ? 'not-allowed' : 'pointer',
                }}
                disabled={loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)}
                aria-label={`Confirm and pay ${amount} rupees to ${parsedData.recipient_name}`}
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
          STAGE 4: PROCESSING
         ======================================================== */}
      {stage === 'PROCESSING' && (
        <section className="card simulator-box" aria-busy="true" aria-live="assertive">
          <div className="spinner-circle" aria-hidden="true" />
          <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-2)' }}>Processing QR Payment</h3>
          <p className="text-secondary text-sm font-medium">Validating QR token with simulated banking network...</p>
        </section>
      )}

      {/* ========================================================
          STAGE 5: RESULT RECEIPT (SUCCESS / FAILURE)
         ======================================================== */}
      {stage === 'RESULT' && paymentResult && (
        <section aria-label="QR Payment Result" aria-live="polite">
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
            {paymentResult.status === 'SUCCESS' ? (
              <>
                <div className="result-icon-box success" aria-hidden="true">✓</div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--color-success)', marginBottom: 'var(--space-1)' }}>
                  QR Payment Successful!
                </h2>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: 'var(--space-2) 0' }}>
                  {paymentResult.formatted_amount}
                </div>
                <p className="text-secondary text-sm font-medium">
                  Paid to <strong>{paymentResult.recipient_name}</strong> ({paymentResult.recipient_identifier})
                </p>

                {/* Reference ID Pill */}
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

                {/* Receipt Details Box */}
                <div style={{ textAlign: 'left', background: 'var(--color-surface-muted)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', margin: 'var(--space-3) 0 var(--space-5)' }}>
                  <div className="review-row">
                    <span className="text-secondary">Source:</span>
                    <span className="font-semibold">QR Code Scan</span>
                  </div>
                  <div className="review-row">
                    <span className="text-secondary">Debited Bank:</span>
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
                  QR Payment Failed
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
              </>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={handleResetScanner}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Scan Another QR
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

export default Scan;
