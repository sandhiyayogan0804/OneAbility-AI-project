import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { TransactionSummary, TransactionDetail } from '../types';

const History: React.FC = () => {
  const { isAuthenticated, demoLogin } = useAuth();

  // State
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SENT' | 'RECEIVED'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Transaction Detail Modal
  const [selectedTx, setSelectedTx] = useState<TransactionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  // Load transactions with active filters
  const loadTransactions = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTransactions({
        search: search.trim() || undefined,
        status: statusFilter,
        type: typeFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 50,
      });
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load transaction history.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, search, statusFilter, typeFilter, startDate, endDate]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTransactions();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, loadTransactions]);

  // Open Transaction Detail
  const handleOpenDetail = async (refOrId: string) => {
    setLoadingDetail(true);
    setDetailError(null);
    setCopiedRef(false);
    try {
      const detail = await api.getTransactionDetail(refOrId);
      setSelectedTx(detail);
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load transaction receipt.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCopyRef = (refId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(refId);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  if (!isAuthenticated) {
    return (
      <section className="dashboard-space" aria-label="Sign in required">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🕒</div>
          <h2>Transaction History</h2>
          <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>
            Sign in to view your complete transaction ledger, search past payments, and inspect receipts.
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
    <div className="dashboard-space" role="region" aria-label="Transaction Management">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.4rem' }}>Transaction History</h2>
          <p className="text-secondary text-xs">Search, filter, and inspect detailed payment receipts</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => loadTransactions()}
            className="btn btn-secondary"
            title="Refresh transactions"
            aria-label="Refresh transactions"
            style={{ minHeight: '38px', padding: '0 12px', fontSize: '0.85rem' }}
          >
            🔄 Refresh
          </button>
          <Link
            to="/pay"
            className="btn btn-primary"
            style={{ minHeight: '38px', padding: '0 14px', fontSize: 'var(--font-size-xs)' }}
          >
            + Pay
          </Link>
        </div>
      </div>

      {/* 1. Search Bar */}
      <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="search-bar-wrap">
          <input
            type="search"
            className="form-input"
            placeholder="🔍 Search by reference ID, note, or recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search transactions by reference ID, description, or recipient"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="search-clear-btn"
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 2. Type Filters (All / Sent / Received) */}
      <div className="history-filters" role="tablist" aria-label="Filter by transaction type">
        <button
          className={`filter-pill ${typeFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setTypeFilter('ALL')}
          role="tab"
          aria-selected={typeFilter === 'ALL'}
        >
          All Types
        </button>
        <button
          className={`filter-pill ${typeFilter === 'SENT' ? 'active' : ''}`}
          onClick={() => setTypeFilter('SENT')}
          role="tab"
          aria-selected={typeFilter === 'SENT'}
        >
          ↗️ Sent (Debit)
        </button>
        <button
          className={`filter-pill ${typeFilter === 'RECEIVED' ? 'active' : ''}`}
          onClick={() => setTypeFilter('RECEIVED')}
          role="tab"
          aria-selected={typeFilter === 'RECEIVED'}
        >
          ↙️ Received (Credit)
        </button>
      </div>

      {/* 3. Status Filters (All / Success / Failed) */}
      <div className="history-filters" role="tablist" aria-label="Filter by status">
        <button
          className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
          role="tab"
          aria-selected={statusFilter === 'ALL'}
        >
          All Statuses
        </button>
        <button
          className={`filter-pill ${statusFilter === 'SUCCESS' ? 'active' : ''}`}
          onClick={() => setStatusFilter('SUCCESS')}
          role="tab"
          aria-selected={statusFilter === 'SUCCESS'}
        >
          ✓ Successful
        </button>
        <button
          className={`filter-pill ${statusFilter === 'FAILED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('FAILED')}
          role="tab"
          aria-selected={statusFilter === 'FAILED'}
        >
          ✕ Declined / Failed
        </button>
      </div>

      {/* 4. Date Range Pickers */}
      <div className="filter-controls-row">
        <div className="date-input-chip">
          <label htmlFor="startDate" className="text-secondary" style={{ fontSize: '0.7rem' }}>From:</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Filter start date"
          />
        </div>

        <div className="date-input-chip">
          <label htmlFor="endDate" className="text-secondary" style={{ fontSize: '0.7rem' }}>To:</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Filter end date"
          />
        </div>

        {(startDate || endDate) && (
          <button
            onClick={clearDates}
            className="btn-text text-xs font-semibold"
            style={{ padding: '0 4px', minHeight: 'auto' }}
          >
            Clear Dates ✕
          </button>
        )}
      </div>

      {/* Transaction List / Loading / Empty / Error */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }} aria-busy="true">
          <p className="text-secondary text-sm">Loading transaction history...</p>
        </div>
      ) : error ? (
        <div className="alert alert-error" role="alert">
          <span>⚠️ {error}</span>
          <button onClick={() => loadTransactions()} className="btn btn-secondary" style={{ minHeight: '32px', marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      ) : transactions.length > 0 ? (
        <div className="transaction-list" role="list">
          {transactions.map((t) => {
            const isDebit = t.transaction_type === 'DEBIT';
            const isSuccess = t.status === 'SUCCESS';
            const dateStr = new Date(t.created_at).toLocaleString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <button
                key={t.id}
                className="transaction-row"
                onClick={() => handleOpenDetail(t.reference_id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '6px',
                }}
                role="listitem"
                aria-label={`View receipt for ${t.party_name}, ${t.formatted_amount}, status ${t.status}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="transaction-left">
                    <div className={`transaction-icon-box ${isDebit ? 'debit' : 'credit'}`} aria-hidden="true">
                      {isDebit ? '↗️' : '↙️'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.party_name}</p>
                      <p className="text-secondary text-xs">{dateStr} • {t.payment_method}</p>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className={isDebit ? 'transaction-amount-debit' : 'transaction-amount-credit'}>
                      {t.formatted_amount}
                    </div>
                    <span
                      className="badge-tag"
                      style={{
                        fontSize: '0.65rem',
                        backgroundColor: isSuccess ? 'var(--color-success-alpha)' : 'var(--color-error-alpha)',
                        color: isSuccess ? 'var(--color-success)' : 'var(--color-error)',
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '6px',
                    fontSize: '0.7rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span className="font-mono">Ref: {t.reference_id}</span>
                  <span className="text-primary font-semibold">View Receipt ➔</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🔍</div>
          <p className="font-semibold text-sm">No transactions match your filters</p>
          <p className="text-secondary text-xs" style={{ marginTop: '4px' }}>
            Try clearing your search query or adjusting the type, status, or date range.
          </p>
          {(search || statusFilter !== 'ALL' || typeFilter !== 'ALL' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                clearDates();
              }}
              className="btn btn-secondary"
              style={{ marginTop: 'var(--space-3)', minHeight: '36px', fontSize: 'var(--font-size-xs)' }}
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}

      {/* ========================================================
          TRANSACTION DETAIL / RECEIPT MODAL
         ======================================================== */}
      {(selectedTx || loadingDetail || detailError) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSelectedTx(null);
            setDetailError(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="receiptModalTitle"
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                <div className="spinner-circle" aria-hidden="true" />
                <p className="text-secondary text-sm">Retrieving full transaction receipt...</p>
              </div>
            ) : detailError ? (
              <div>
                <div className="alert alert-error" role="alert">
                  <span>⚠️ {detailError}</span>
                </div>
                <button
                  onClick={() => setDetailError(null)}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 'var(--space-3)' }}
                >
                  Close
                </button>
              </div>
            ) : selectedTx ? (
              <div>
                {/* Modal Header */}
                <div className="modal-header">
                  <h3 id="receiptModalTitle" style={{ fontSize: '1.1rem', margin: 0 }}>
                    Transaction Receipt
                  </h3>
                  <button
                    onClick={() => setSelectedTx(null)}
                    className="btn-icon"
                    aria-label="Close transaction receipt"
                    style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Status & Amount Display */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                  <div
                    className={`result-icon-box ${selectedTx.status === 'SUCCESS' ? 'success' : 'failed'}`}
                    style={{ width: '56px', height: '56px', fontSize: '1.8rem' }}
                    aria-hidden="true"
                  >
                    {selectedTx.status === 'SUCCESS' ? '✓' : '✕'}
                  </div>

                  <span
                    className="badge-tag"
                    style={{
                      backgroundColor: selectedTx.status === 'SUCCESS' ? 'var(--color-success-alpha)' : 'var(--color-error-alpha)',
                      color: selectedTx.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-error)',
                      marginBottom: '6px',
                    }}
                  >
                    {selectedTx.status === 'SUCCESS' ? 'Payment Completed' : 'Payment Failed / Declined'}
                  </span>

                  <div style={{ fontSize: '2.4rem', fontWeight: 800, margin: 'var(--space-1) 0' }}>
                    {selectedTx.formatted_amount}
                  </div>

                  <p className="text-secondary text-xs">
                    {selectedTx.party_name}
                  </p>
                </div>

                {/* Reference ID Box */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                  <div className="reference-id-pill">
                    <span>Ref: {selectedTx.reference_id}</span>
                    <button
                      onClick={() => handleCopyRef(selectedTx.reference_id)}
                      className="upi-copy-btn"
                      aria-label="Copy reference ID to clipboard"
                      title="Copy Reference ID"
                    >
                      {copiedRef ? '✅' : '📋'}
                    </button>
                  </div>
                </div>

                {/* Full Breakdown Metadata Table */}
                <div className="receipt-meta-box">
                  <div className="review-row">
                    <span className="text-secondary">Type:</span>
                    <span className="font-semibold">
                      {selectedTx.transaction_type === 'DEBIT' ? 'Outgoing Payment (Debit)' : 'Incoming Payment (Credit)'}
                    </span>
                  </div>

                  <div className="review-row">
                    <span className="text-secondary">Payment Mode:</span>
                    <span className="badge-tag badge-primary">{selectedTx.payment_method}</span>
                  </div>

                  <div className="review-row">
                    <span className="text-secondary">Sender:</span>
                    <span className="font-medium">{selectedTx.sender_name}</span>
                  </div>

                  {selectedTx.sender_bank_name && (
                    <div className="review-row">
                      <span className="text-secondary">Debited Bank:</span>
                      <span>🏛️ {selectedTx.sender_bank_name} ({selectedTx.sender_account_masked})</span>
                    </div>
                  )}

                  {selectedTx.receiver_name && (
                    <div className="review-row">
                      <span className="text-secondary">Recipient:</span>
                      <span className="font-medium">{selectedTx.receiver_name}</span>
                    </div>
                  )}

                  <div className="review-row">
                    <span className="text-secondary">Date & Time:</span>
                    <span>{new Date(selectedTx.created_at).toLocaleString('en-IN')}</span>
                  </div>

                  {selectedTx.description && (
                    <div className="review-row" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
                      <span className="text-secondary">Remarks / Note:</span>
                      <span className="font-medium">{selectedTx.description}</span>
                    </div>
                  )}
                </div>

                {/* Done Button */}
                <button
                  onClick={() => setSelectedTx(null)}
                  className="btn btn-primary"
                  style={{ width: '100%', minHeight: '48px' }}
                >
                  Close Receipt
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
