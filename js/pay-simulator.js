/**
 * OneAbility AI - Accessible Smart Pay Simulator
 * Phase: Dynamic Persistence, Payee Verification & Offline Accessibility
 * 
 * Implements:
 * 1. Dynamic Transaction Persistence (localStorage, auto-updating feeds, balance deduction)
 * 2. Automated Payee Verification (Known contacts check with Wrong Receiver Warning for unknown payees)
 * 3. Voice Payment handling with strict bilingual audio feedback
 * 4. Safety Gates (Fraud guard, limits >= ₹10,000, emergency stop)
 * 5. Screen reader and accessible voice confirmations
 */

class PaySimulatorEngine {
  constructor() {
    this.currentView = 'view-home';
    this.previousView = 'view-home';

    // 1. Directory of Beneficiaries (Dynamic Persistence)
    this.beneficiaries = [];
    this.knownContacts = [];
    this.activeBeneficiaryFilter = 'all';
    this.pendingDeleteBeneficiaryId = null;

    // 2. Active Transaction State
    this.merchant = {
      name: 'Kumar Groceries',
      upiId: 'kumar.store@okhdfcbank',
      verified: true
    };
    this.amount = '500';
    this.enteredPin = '';
    this.correctPinLength = 4;
    this.isConfirmedByVoice = false;
    this.pendingPayment = null; // For unverified payees awaiting explicit confirmation
    this.isProcessingPayment = false; // Prevents concurrent / duplicate payment execution

    this.scanInterval = null;
    this.scanTimeout = null;

    // 3. Live Camera & Real QR Scanner State
    this.cameraStream = null;
    this.scanAnimationId = null;
    this.isScanning = false;
    this.lastScannedPayload = null;
    this.videoEl = null;
    this.canvasEl = null;
    this.flashActive = false;

    // 4. Guided Bank Linking & Account Management State
    this.mockBanks = this.getMockBankDirectory();
    this.linkedBanks = [];
    this.currentLinkingStep = 1;
    this.selectedBankForLinking = this.mockBanks[0];
    this.selectedDiscoveredAccount = this.mockBanks[0].mockAccounts[0];
    this.smsSimTimer = null;

    // 5. WebAuthn Platform Biometric & Demo Fallback State
    this.webAuthnStatus = 'UNSUPPORTED';
    this.registeredCredential = null;
    this.biometricSimTimer = null;
    this.loadStoredCredential();
    this.checkWebAuthnSupport();

    // 6. Dynamic Beneficiary, Balance & Bank Storage (localStorage)
    this.initBeneficiaryStorage();
    this.initStorage();
    this.initBankStorage();
    this.initViews();
  }

  // =========================================================================
  // STORAGE & DYNAMIC PERSISTENCE
  // =========================================================================
  initStorage() {
    // A. Mock Bank Balance
    const savedBalance = localStorage.getItem('oneability_balance');
    if (savedBalance !== null && !isNaN(parseFloat(savedBalance))) {
      this.balance = parseFloat(savedBalance);
    } else {
      this.balance = 24850.00;
      localStorage.setItem('oneability_balance', this.balance.toString());
    }

    // B. Mock Transaction History
    const savedTx = localStorage.getItem('oneability_transactions');
    if (savedTx) {
      try {
        this.transactions = JSON.parse(savedTx);
      } catch (e) {
        this.transactions = this.getDefaultTransactions();
      }
    } else {
      this.transactions = this.getDefaultTransactions();
      localStorage.setItem('oneability_transactions', JSON.stringify(this.transactions));
    }

    // Render stored balance, transactions and beneficiaries on load
    setTimeout(() => {
      this.updateBalanceUI(false);
      this.renderTransactions();
      this.updateHomeBankCard();
      this.renderLinkedBanksList();
      this.renderHomeQuickContacts();
      this.renderBeneficiariesList();
    }, 100);
  }

  getDefaultTransactions() {
    return [
      {
        id: 'MOCK_98127391823',
        merchant: 'Kumar Groceries',
        upiId: 'kumar.store@okhdfcbank',
        amount: 320,
        type: 'debit',
        icon: '🛒',
        displayTime: 'Today, 10:15 AM',
        displayTimeTa: 'இன்று, முற்பகல் 10:15',
        timestamp: new Date().toISOString()
      },
      {
        id: 'MOCK_84729103847',
        merchant: 'Priya Medicals',
        upiId: 'priya.pharmacy@okaxis',
        amount: 240,
        type: 'debit',
        icon: '💊',
        displayTime: 'Yesterday, 6:40 PM',
        displayTimeTa: 'நேற்று, பிற்பகல் 6:40',
        timestamp: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'MOCK_73829104829',
        merchant: 'Metro Transport',
        upiId: 'metro.ride@icici',
        amount: 50,
        type: 'debit',
        icon: '🚇',
        displayTime: '16 Sep, 8:30 AM',
        displayTimeTa: '16 செப், முற்பகல் 8:30',
        timestamp: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: 'MOCK_62910482019',
        merchant: 'Cashback Reward',
        upiId: 'rewards@oneability',
        amount: 25,
        type: 'credit',
        icon: '🎁',
        displayTime: '15 Sep, 2:10 PM',
        displayTimeTa: '15 செப், பிற்பகல் 2:10',
        timestamp: new Date(Date.now() - 259200000).toISOString()
      }
    ];
  }

  getFormattedBalance() {
    return `₹${this.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  updateBalanceUI(visible = null) {
    const balanceDisplay = document.getElementById('balance-amount-display');
    const checkBtn = document.getElementById('btn-check-balance');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    if (visible === true) {
      if (balanceDisplay) balanceDisplay.textContent = this.getFormattedBalance();
      if (checkBtn) checkBtn.textContent = isTa ? '👁️ மறைக்க' : '👁️ Hide';
    } else if (visible === false) {
      if (balanceDisplay) balanceDisplay.textContent = '₹ • • • • •';
      if (checkBtn) checkBtn.textContent = isTa ? 'இருப்பை சரிபார்க்க' : 'Check Balance';
    } else {
      // If already showing digits, refresh the digits
      if (balanceDisplay && !balanceDisplay.textContent.includes('•')) {
        balanceDisplay.textContent = this.getFormattedBalance();
      }
    }
  }

  // Deduct balance and create new transaction record
  finalizeSuccessfulPayment(txnId) {
    // 1. Prevent duplicate insertion
    if (this.transactions.some(t => t.id === txnId)) {
      console.warn('Duplicate transaction execution prevented:', txnId);
      return;
    }

    const amt = parseFloat(this.amount) || 0;

    // 2. Deduct mock balance from primary bank
    const primary = this.getPrimaryAccount();
    if (primary) {
      primary.balance = Math.max(0, primary.balance - amt);
      this.balance = primary.balance;
    } else {
      this.balance = Math.max(0, this.balance - amt);
    }
    this.saveLinkedBanks();
    localStorage.setItem('oneability_balance', this.balance.toString());
    this.updateBalanceUI(true);
    this.updateHomeBankCard();
    this.renderLinkedBanksList();

    // 3. Create persistent transaction record
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    let icon = '💳';
    const lowerName = (this.merchant.name || '').toLowerCase();
    if (lowerName.includes('kumar') || lowerName.includes('grocer')) icon = '🛒';
    else if (lowerName.includes('priya') || lowerName.includes('medic') || lowerName.includes('pharma')) icon = '💊';
    else if (lowerName.includes('metro') || lowerName.includes('ride') || lowerName.includes('transport')) icon = '🚇';
    else if (lowerName.includes('ravi') || lowerName.includes('milk')) icon = '🥛';
    else if (lowerName.includes('recharge') || lowerName.includes('mobile')) icon = '📱';
    else if (lowerName.includes('electricity')) icon = '💡';

    const newTx = {
      id: txnId,
      merchant: this.merchant.name || 'Merchant',
      upiId: this.merchant.upiId || 'merchant@upi',
      amount: amt,
      type: 'debit',
      icon: icon,
      displayTime: `Today, ${timeStr}`,
      displayTimeTa: `இன்று, ${timeStr}`,
      timestamp: now.toISOString()
    };

    // 4. Prepend to history & persist
    this.transactions.unshift(newTx);
    localStorage.setItem('oneability_transactions', JSON.stringify(this.transactions));

    // 5. Update matching beneficiary payment statistics
    if (this.beneficiaries && Array.isArray(this.beneficiaries)) {
      const matchBen = this.beneficiaries.find(b =>
        (this.merchant.name && b.name.toLowerCase() === this.merchant.name.toLowerCase()) ||
        (this.merchant.upiId && b.upiId && b.upiId.toLowerCase() === this.merchant.upiId.toLowerCase())
      );
      if (matchBen) {
        matchBen.totalMockPayments = (matchBen.totalMockPayments || 0) + 1;
        matchBen.lastPaidAt = now.toISOString();
        this.saveBeneficiaries();
        this.renderHomeQuickContacts();
        this.renderBeneficiariesList();
      }
    }

    // 6. Re-render UI feeds
    this.renderTransactions();
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  handleQRDetected() {
    return this.simulateDemoQr('kumar');
  }

  renderTransactions() {
    const homeList = document.getElementById('home-transactions-list');
    const historyList = document.getElementById('history-transactions-list');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    const renderCard = (tx) => {
      const isCredit = tx.type === 'credit';
      const safeMerchant = this.escapeHtml(tx.merchant);
      const safeId = tx.id ? this.escapeHtml(tx.id.replace('MOCK_', '')) : '';
      const amtDisplay = isCredit ? `+ ₹${tx.amount}` : `- ₹${tx.amount}`;
      const timeStr = isTa ? (tx.displayTimeTa || tx.displayTime) : tx.displayTime;
      const refStr = safeId ? ` • Ref: ${safeId}` : '';

      return `
        <div class="transaction-row-card" data-id="${tx.id || ''}" data-name="${safeMerchant}" data-amount="₹${tx.amount}" tabindex="0" role="listitem" aria-label="${safeMerchant}: ${tx.amount} rupees ${isCredit ? 'credited' : 'debited'} ${timeStr}">
          <div class="tx-left">
            <div class="tx-icon-box" style="${isCredit ? 'color: var(--accent-green);' : ''}" aria-hidden="true">${tx.icon || '💳'}</div>
            <div class="tx-details">
              <span class="tx-merchant-name">${safeMerchant}</span>
              <span class="tx-timestamp">${timeStr}${refStr}</span>
            </div>
          </div>
          <span class="tx-amount-right ${isCredit ? 'positive' : ''}">${amtDisplay}</span>
        </div>
      `;
    };

    // Render Home Feed (Top 4)
    if (homeList) {
      const topHome = this.transactions.slice(0, 4);
      homeList.innerHTML = topHome.map(renderCard).join('');
      this.attachTxClickEvents(homeList);
    }

    // Render History Feed (Full list)
    if (historyList) {
      historyList.innerHTML = this.transactions.map(renderCard).join('');
      this.attachTxClickEvents(historyList);
    }

    // Update dynamic transaction count badges if present
    document.querySelectorAll('.tx-count-badge').forEach(el => {
      el.textContent = `${this.transactions.length} ${isTa ? 'பரிவர்த்தனைகள்' : 'payments'}`;
    });
  }

  attachTxClickEvents(container) {
    if (!container) return;
    container.querySelectorAll('.transaction-row-card').forEach(card => {
      card.addEventListener('click', () => {
        const txId = card.dataset.id;
        const tx = (this.transactions || []).find(t => t.id === txId) || {
          id: txId || 'MOCK_98127391823',
          merchant: card.dataset.name || 'Merchant',
          amount: parseFloat((card.dataset.amount || '0').replace(/[^\d.]/g, '')) || 0,
          displayTime: 'Today, 10:15 AM',
          upiId: 'kumar.store@okhdfcbank',
          type: 'debit',
          icon: '🛒'
        };
        this.openTransactionDetails(tx);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  openTransactionDetails(tx) {
    if (!tx) return;
    this.activeTransactionDetails = tx;

    const modal = document.getElementById('transaction-details-modal');
    const isCredit = tx.type === 'credit';
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';
    const sign = isCredit ? '+ ' : '- ';
    const amtStr = `${sign}₹${parseFloat(tx.amount || 0).toFixed(2)}`;
    const timeStr = isTa ? (tx.displayTimeTa || tx.displayTime || 'இன்று') : (tx.displayTime || 'Today');
    const statusStr = isCredit ? (isTa ? 'வரவு வைக்கப்பட்டது' : 'Credited') : (isTa ? 'வெற்றிகரமாக செலுத்தப்பட்டது' : 'Completed');
    const primaryAcc = this.getPrimaryAccount();
    const bankStr = primaryAcc ? `${primaryAcc.bankName} (${primaryAcc.accountMask})` : 'State Bank of India (•••• 4821)';

    const iconEl = document.getElementById('tx-modal-icon');
    const amtEl = document.getElementById('tx-modal-amount');
    const statusBadgeEl = document.getElementById('tx-modal-status');
    const recipientEl = document.getElementById('tx-modal-recipient');
    const subamtEl = document.getElementById('tx-modal-subamount');
    const datetimeEl = document.getElementById('tx-modal-datetime');
    const statusTextEl = document.getElementById('tx-modal-status-text');
    const txnidEl = document.getElementById('tx-modal-txnid');
    const bankEl = document.getElementById('tx-modal-bank');
    const methodEl = document.getElementById('tx-modal-method');

    if (iconEl) iconEl.textContent = tx.icon || (isCredit ? '🎁' : '🛒');
    if (amtEl) amtEl.textContent = amtStr;
    if (statusBadgeEl) {
      statusBadgeEl.textContent = `● ${statusStr}`;
      statusBadgeEl.style.color = isCredit ? 'var(--success)' : 'var(--primary)';
    }
    if (recipientEl) recipientEl.textContent = tx.merchant || 'Merchant';
    if (subamtEl) subamtEl.textContent = `₹${parseFloat(tx.amount || 0).toFixed(2)}`;
    if (datetimeEl) datetimeEl.textContent = timeStr;
    if (statusTextEl) {
      statusTextEl.textContent = isTa ? 'வெற்றி' : 'Successful';
      statusTextEl.style.color = 'var(--success)';
    }
    if (txnidEl) txnidEl.textContent = tx.id || 'MOCK_98127391823';
    if (bankEl) bankEl.textContent = bankStr;
    if (methodEl) methodEl.textContent = isCredit ? (isTa ? 'யூபிஐ வரவு' : 'UPI Credit') : (isTa ? 'யூபிஐ நேரடி பற்று' : 'UPI Direct Debit');

    if (modal) {
      modal.classList.add('active');
    }

    window.AcousticHaptic.playClick();
    if (window.TTSVoice) {
      const spokenTa = `பரிவர்த்தனை விவரம்: ${tx.merchant} அவர்களுக்கு ₹${tx.amount} ${statusStr}.`;
      const spokenEn = `Transaction details: ₹${tx.amount} ${isCredit ? 'credited from' : 'debited to'} ${tx.merchant}. Status: ${statusStr}.`;
      window.TTSVoice.speak({ ta: spokenTa, en: spokenEn });
    }
  }

  closeTransactionDetails() {
    const modal = document.getElementById('transaction-details-modal');
    if (modal) modal.classList.remove('active');
    window.AcousticHaptic.playClick();
  }

  readActiveTransactionAloud() {
    const tx = this.activeTransactionDetails;
    if (!tx) return;
    window.AcousticHaptic.playClick();
    if (window.TTSVoice) {
      window.TTSVoice.speakReceipt(
        tx.merchant || 'Merchant',
        tx.upiId || 'merchant@okhdfcbank',
        tx.amount || '0',
        tx.id || 'MOCK_98127391823'
      );
    }
  }

  shareActiveTransactionReceipt() {
    const tx = this.activeTransactionDetails;
    if (!tx) return;
    window.AcousticHaptic.playClick();
    const userName = (window.UserManager && typeof window.UserManager.getUserName === 'function') ? window.UserManager.getUserName() : '';
    const userPrefix = userName ? ` (${userName})` : '';
    const text = `OneAbility Pay Receipt${userPrefix}: ₹${tx.amount} paid to ${tx.merchant}. Txn ID: ${tx.id}. Verified UPI transfer.`;

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    if (window.TTSVoice) {
      window.TTSVoice.speak({
        ta: 'பரிவர்த்தனை ரசீது இணைப்பு நகலெடுக்கப்பட்டது.',
        en: 'Transaction receipt link copied to clipboard.'
      });
    }

    const shareBtn = document.getElementById('btn-tx-modal-share');
    if (shareBtn) {
      const originalText = shareBtn.innerHTML;
      shareBtn.innerHTML = `<span>✓ ${isTa ? 'நகலெடுக்கப்பட்டது' : 'Copied!'}</span>`;
      setTimeout(() => {
        shareBtn.innerHTML = originalText;
      }, 2000);
    }
  }

  // =========================================================================
  // VIEW NAVIGATION & ANNOUNCEMENTS
  initViews() {
    const hashView = (typeof window !== 'undefined' && window.location.hash) ? window.location.hash.replace('#', '') : null;
    if (hashView && document.getElementById(hashView)) {
      this.switchView(hashView);
    } else {
      this.switchView('view-home');
    }
  }

  switchView(viewId) {
    if (this.currentView === 'view-scanner' && viewId !== 'view-scanner') {
      this.stopCamera();
    }
    this.previousView = this.currentView;
    this.currentView = viewId;

    document.querySelectorAll('.app-view, .sim-view').forEach(v => {
      v.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.add('active');
    }

    // Update bottom navigation active pill
    document.querySelectorAll('.nav-item-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    if (viewId === 'view-home') {
      const btn = document.getElementById('nav-btn-home');
      if (btn) btn.classList.add('active');
    } else if (viewId === 'view-scanner') {
      const btn = document.getElementById('nav-btn-scan');
      if (btn) btn.classList.add('active');
    } else if (viewId === 'view-history') {
      const btn = document.getElementById('nav-btn-history');
      if (btn) btn.classList.add('active');
    } else if (viewId === 'view-profile') {
      const btn = document.getElementById('nav-btn-profile');
      if (btn) btn.classList.add('active');
    }

    if (viewId === 'view-confirm' || viewId === 'view-profile') {
      this.updateWebAuthnUI();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.AcousticHaptic.playFocus();
    this.announceCurrentStep();
  }

  navigateBack() {
    if (this.currentView === 'view-home') {
      window.TTSVoice.speak({
        ta: 'நீங்கள் ஏற்கனவே முகப்பு பக்கத்தில் உள்ளீர்கள்.',
        en: 'Already on Home screen.'
      });
      return;
    }
    window.AcousticHaptic.playClick();
    this.switchView(this.previousView || 'view-home');
    window.TTSVoice.speak({
      ta: 'முந்தைய பக்கத்திற்குத் திரும்பினோம்.',
      en: 'Returned to previous screen.'
    });
  }

  announceCurrentStep() {
    switch (this.currentView) {
      case 'view-home':
        window.TTSVoice.speakHomeStep();
        break;
      case 'view-scanner':
        window.TTSVoice.speakQRGuidance('start');
        break;
      case 'view-contacts':
        window.TTSVoice.speakContactsStep();
        break;
      case 'view-history':
        this.speakTransactionHistoryVoice();
        break;
      case 'view-amount':
        window.TTSVoice.speakAmountStep(this.merchant.name);
        break;
      case 'view-confirm':
        window.AcousticHaptic.playConfirmPrompt();
        window.TTSVoice.speakConfirmationPrompt(this.merchant.name, this.amount);
        break;
      case 'view-pin':
        window.TTSVoice.speakPinStep();
        break;
      case 'view-success':
        const txId = this.lastTxId || 'MOCK_948201849204';
        window.AcousticHaptic.playSuccess();
        window.TTSVoice.speakSuccess(this.merchant.name, this.amount, txId);
        break;
      case 'view-profile':
        window.TTSVoice.speakProfileStep();
        break;
      case 'view-bank-linking':
        if (this.currentLinkingStep === 1) {
          window.TTSVoice.speakBankLinkingStep(1);
        }
        break;
    }
  }

  // =========================================================================
  // PAYEE VERIFICATION & WRONG RECEIVER WARNING
  // =========================================================================
  findKnownContact(name) {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    const list = (this.beneficiaries && this.beneficiaries.length > 0) ? this.beneficiaries : this.knownContacts;
    for (const contact of list) {
      if (contact.aliases && Array.isArray(contact.aliases)) {
        for (const alias of contact.aliases) {
          if (lower.includes(alias.toLowerCase())) {
            return contact;
          }
        }
      }
      if (contact.nickname && lower.includes(contact.nickname.toLowerCase())) {
        return contact;
      }
      if (contact.name.toLowerCase().includes(lower)) {
        return contact;
      }
    }
    return null;
  }

  initiateVoicePayment(recipientName, upiId, amount) {
    // 1. Verify Recipient against saved contacts directory
    const contact = this.findKnownContact(recipientName);

    if (contact && contact.verified !== false) {
      // Known verified contact -> Proceed smoothly
      this.merchant.name = contact.name;
      this.merchant.upiId = contact.upiId;
      this.merchant.verified = true;
      this.amount = amount.toString();
      this.isConfirmedByVoice = false;
      this.pendingPayment = null;

      this.updateMerchantDisplay();
      this.switchView('view-confirm');
      window.AcousticHaptic.playConfirmPrompt();
      window.TTSVoice.speakConfirmationPrompt(this.merchant.name, this.amount);
    } else if (contact && contact.verified === false) {
      // Known but Unverified Beneficiary -> Trigger Wrong Receiver Warning
      console.warn('[Payee Verification]: Unverified custom beneficiary detected:', recipientName);
      this.triggerWrongReceiverWarning(contact.name, amount, contact.upiId);
    } else {
      // Unknown / Ambiguous Payee -> Trigger Automated Wrong Receiver Warning (No fake UPI created)
      console.warn('[Payee Verification]: Unverified contact detected:', recipientName);
      this.triggerWrongReceiverWarning(recipientName, amount, null);
    }
  }

  triggerWrongReceiverWarning(recipientName, amount = '500', upiId = null) {
    window.AcousticHaptic.playWarning();

    // Store unverified intent for explicit user confirmation (NO fake UPI handle auto-created)
    this.pendingPayment = {
      recipient: recipientName,
      upiId: upiId || null,
      amount: amount.toString()
    };

    const modal = document.getElementById('fraud-guard-modal');
    const titleEl = document.getElementById('fraud-title');
    const msgEl = document.getElementById('fraud-warning-msg');
    const cancelBtn = document.getElementById('fraud-cancel-btn');
    const proceedBtn = document.getElementById('fraud-proceed-btn');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    if (titleEl) {
      titleEl.textContent = isTa ? '⚠️ புதிய பெறுநர் எச்சரிக்கை' : '⚠️ Unverified Contact Warning';
    }
    if (msgEl) {
      msgEl.textContent = isTa
        ? `கவனிக்கவும்! "${recipientName}" உங்கள் வழக்கமான தொடர்புகளில் இல்லை. நீங்கள் இவருக்கு ₹${amount} அனுப்ப விரும்புகிறீர்களா? சரிபார்த்துவிட்டு உறுதி செய்யவும்.`
        : `Attention: "${recipientName}" is not in your frequent contacts list. Do you still want to send ₹${amount}? Please verify before proceeding.`;
    }
    if (cancelBtn) {
      cancelBtn.textContent = isTa ? '❌ ரத்து செய் (Safe)' : '❌ Cancel (Safe)';
    }
    if (proceedBtn) {
      proceedBtn.textContent = isTa ? '⚠️ தொடரவும் (Proceed)' : '⚠️ Proceed Anyway';
    }

    if (modal) {
      modal.classList.add('active');
    }

    // Audible Warning in Tamil or English
    window.TTSVoice.speakWrongReceiverWarning(recipientName);
  }

  updateMerchantDisplay() {
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';
    const upiDisplay = this.merchant.upiId || (isTa ? 'சரிபார்க்கப்படாத யூபிஐ (No UPI ID)' : 'Unverified (No UPI ID)');

    document.querySelectorAll('.sim-merchant-name').forEach(el => el.textContent = this.merchant.name);
    document.querySelectorAll('.sim-merchant-upi').forEach(el => el.textContent = upiDisplay);

    const nameEl = document.getElementById('confirm-merchant-name');
    if (nameEl) nameEl.textContent = this.merchant.name;

    const upiEl = document.getElementById('confirm-upi-id');
    if (upiEl) upiEl.textContent = upiDisplay;

    const confirmAmtEl = document.getElementById('confirm-amount-display');
    if (confirmAmtEl) confirmAmtEl.textContent = `₹${this.amount}`;

    const promptTextEl = document.getElementById('confirm-prompt-text');
    if (promptTextEl) {
      if (window.TTSVoice && window.TTSVoice.currentLang === 'ta') {
        promptTextEl.textContent = `“${this.merchant.name} அவர்களுக்கு ₹${this.amount} அனுப்ப வேண்டுமா? உறுதி செய்ய 'ஆம்', ரத்து செய்ய 'வேண்டாம்' என்று சொல்லவும்.”`;
      } else {
        promptTextEl.textContent = `“You are sending ₹${this.amount} to ${this.merchant.name}. Say Yes to confirm or No to cancel.”`;
      }
    }

    const successAmt = document.getElementById('success-amount-display');
    if (successAmt) successAmt.textContent = `₹${this.amount}`;

    const successRec = document.getElementById('success-recipient-name');
    if (successRec) {
      if (window.TTSVoice && window.TTSVoice.currentLang === 'ta') {
        successRec.textContent = `${this.merchant.name} அவர்களுக்கு பணம் செலுத்தப்பட்டது`;
      } else {
        successRec.textContent = `Paid to ${this.merchant.name}`;
      }
    }

    const amountInput = document.getElementById('sim-amount-input');
    if (amountInput) amountInput.value = this.amount;
  }

  // =========================================================================
  // LIVE CAMERA ACCESS & QR VERIFICATION (Google ML Kit + ZXing + jsQR)
  // =========================================================================
  openScanner() {
    this.switchView('view-scanner');
    this.startCamera();
  }

  async startCamera() {
    this.stopCamera();
    this.lastScannedPayload = null;
    this.currentDetectedPayload = null;

    // Reset reticle and UI state
    const reticle = document.getElementById('scanner-camera-reticle');
    if (reticle) reticle.classList.remove('detected-active');
    const detectedCard = document.getElementById('scanner-detected-card');
    if (detectedCard) detectedCard.style.display = 'none';
    const bottomControls = document.getElementById('scanner-bottom-controls');
    if (bottomControls) bottomControls.style.display = 'flex';
    const laserBeam = document.getElementById('scanner-laser-beam');
    if (laserBeam) laserBeam.style.display = 'block';

    const video = document.getElementById('scanner-video-feed');
    const canvas = document.getElementById('scanner-canvas');
    const statusBox = document.getElementById('scanner-camera-status');
    if (statusBox) statusBox.style.display = 'none';

    this.videoEl = video;
    this.canvasEl = canvas;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.handleCameraUnavailable('Camera API not supported in this browser.');
      return;
    }

    try {
      let stream = null;
      // High-resolution constraint with continuous focus & environment facingMode
      const advancedConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          focusMode: { ideal: 'continuous' }
        },
        audio: false
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia(advancedConstraints);
      } catch (e1) {
        try {
          // Standard environment camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
          });
        } catch (e2) {
          // Fallback to any camera device (e.g. desktop webcam)
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      this.cameraStream = stream;
      if (this.videoEl) {
        this.videoEl.srcObject = stream;
        this.videoEl.setAttribute('playsinline', 'true');
        await this.videoEl.play();
      }

      // Initialize scanner engines (Google ML Kit BarcodeDetector + ZXing)
      this.initBarcodeEngines();

      this.isScanning = true;
      window.TTSVoice.speakQRGuidance('start');
      this.scanQrFrame();

    } catch (err) {
      console.warn('[Camera Scanner] Camera initialization error:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.handleCameraPermissionDenied();
      } else {
        this.handleCameraUnavailable(err.message);
      }
    }
  }

  stopCamera() {
    this.isScanning = false;

    if (this.scanAnimationId) {
      cancelAnimationFrame(this.scanAnimationId);
      this.scanAnimationId = null;
    }

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      this.cameraStream = null;
    }

    if (this.videoEl) {
      try {
        this.videoEl.pause();
        this.videoEl.srcObject = null;
      } catch (e) {}
    }

    const reticle = document.getElementById('scanner-camera-reticle');
    if (reticle) reticle.classList.remove('detected-active');
  }

  handleCameraPermissionDenied() {
    this.stopCamera();
    const statusBox = document.getElementById('scanner-camera-status');
    const statusMsg = document.getElementById('camera-status-msg');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    if (statusBox && statusMsg) {
      statusMsg.textContent = isTa
        ? '🚫 கேமரா அனுமதி மறுக்கப்பட்டது. அனுமதி வழங்கவும் அல்லது கீழே உள்ள டெமோ க்யூஆர் பொத்தான்களைப் பயன்படுத்தவும்.'
        : '🚫 Camera permission denied. Please allow camera access or use the Demo QR buttons below.';
      statusBox.style.display = 'block';
    }

    window.TTSVoice.speakCameraError();
  }

  handleCameraUnavailable(reason = '') {
    this.stopCamera();
    const statusBox = document.getElementById('scanner-camera-status');
    const statusMsg = document.getElementById('camera-status-msg');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    if (statusBox && statusMsg) {
      statusMsg.textContent = isTa
        ? '📷 கேமரா கிடைக்கவில்லை. கீழே உள்ள டெமோ க்யூஆர் பொத்தான்களைப் பயன்படுத்தி சோதிக்கலாம்.'
        : '📷 Camera is unavailable on this device. You can test using the Demo QR buttons below.';
      statusBox.style.display = 'block';
    }

    window.TTSVoice.speakCameraError();
  }

  initBarcodeEngines() {
    // 1. Google ML Kit / Native BarcodeDetector (Chromium / Android)
    if (!this.barcodeDetector && ('BarcodeDetector' in window)) {
      try {
        this.barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        console.log('[QR Engine] Google ML Kit BarcodeDetector initialized.');
      } catch (e) {
        console.warn('[QR Engine] BarcodeDetector init error:', e);
      }
    }

    // 2. ZXing BrowserQRCodeReader & Low-Level Decoder
    if (!this.zxingReader && window.ZXing && window.ZXing.BrowserQRCodeReader) {
      try {
        this.zxingReader = new window.ZXing.BrowserQRCodeReader();
        console.log('[QR Engine] ZXing BrowserQRCodeReader initialized.');
      } catch (e) {
        console.warn('[QR Engine] ZXing init error:', e);
      }
    }
    if (!this.zxingLowLevelReader && window.ZXing && window.ZXing.QRCodeReader) {
      try {
        this.zxingLowLevelReader = new window.ZXing.QRCodeReader();
      } catch (e) {}
    }
  }

  async decodeFromCanvasOrImageData(canvas, ctx, width, height) {
    if (!canvas || width <= 0 || height <= 0) return null;

    // --- TIER 1: Native BarcodeDetector (Google ML Kit - Hardware Accelerated) ---
    if (this.barcodeDetector) {
      try {
        const barcodes = await this.barcodeDetector.detect(canvas);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          const raw = barcodes[0].rawValue.trim();
          if (raw) return { text: raw, engine: 'Google ML Kit BarcodeDetector' };
        }
      } catch (e) {}
    }

    // --- TIER 2: ZXing (@zxing/library) ---
    if (window.ZXing) {
      // 2A. BrowserQRCodeReader decode directly on canvas
      if (this.zxingReader) {
        try {
          const zxRes = this.zxingReader.decode(canvas);
          if (zxRes) {
            const text = (zxRes.getText ? zxRes.getText() : zxRes.text) || '';
            if (text.trim()) return { text: text.trim(), engine: 'ZXing BrowserQRCodeReader' };
          }
        } catch (e) {}
      }

      // 2B. ZXing HTMLCanvasElementLuminanceSource (Normal and Inverted)
      if (window.ZXing.HTMLCanvasElementLuminanceSource && window.ZXing.BinaryBitmap && window.ZXing.HybridBinarizer && this.zxingLowLevelReader) {
        try {
          const lum = new window.ZXing.HTMLCanvasElementLuminanceSource(canvas);
          // Normal polarity
          try {
            const bmp = new window.ZXing.BinaryBitmap(new window.ZXing.HybridBinarizer(lum));
            const res = this.zxingLowLevelReader.decode(bmp);
            if (res) {
              const text = (res.getText ? res.getText() : res.text) || '';
              if (text.trim()) return { text: text.trim(), engine: 'ZXing HybridBinarizer' };
            }
          } catch (e) {}

          // Inverted polarity (for dark mode screens and inverted QR codes)
          try {
            const invBmp = new window.ZXing.BinaryBitmap(new window.ZXing.HybridBinarizer(lum.invert()));
            const resInv = this.zxingLowLevelReader.decode(invBmp);
            if (resInv) {
              const text = (resInv.getText ? resInv.getText() : resInv.text) || '';
              if (text.trim()) return { text: text.trim(), engine: 'ZXing Inverted' };
            }
          } catch (e) {}
        } catch (e) {}
      }
    }

    // --- TIER 3: jsQR with 'attemptBoth' (Inversion Attempts Supported) ---
    if (typeof window.jsQR === 'function' && ctx) {
      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const code = window.jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth'
        });
        if (code && code.data && code.data.trim()) {
          return { text: code.data.trim(), engine: 'jsQR (attemptBoth)' };
        }
      } catch (e) {}
    }

    return null;
  }

  async scanQrFrame() {
    if (!this.isScanning || !this.videoEl || !this.canvasEl) return;

    if (this.videoEl.readyState >= 2 && this.videoEl.videoWidth > 0) {
      const vw = this.videoEl.videoWidth;
      const vh = this.videoEl.videoHeight;

      this.canvasEl.width = vw;
      this.canvasEl.height = vh;

      const ctx = this.canvasEl.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(this.videoEl, 0, 0, vw, vh);

      // Pass 1: Full-frame scan (handles codes anywhere in the camera view)
      let detectedResult = await this.decodeFromCanvasOrImageData(this.canvasEl, ctx, vw, vh);

      // Pass 2: Center Region of Interest (ROI) Crop for distant / small / high-density UPI QR codes
      if (!detectedResult && vw >= 480 && vh >= 480) {
        if (!this.roiCanvas) {
          this.roiCanvas = document.createElement('canvas');
        }
        const cropW = Math.round(vw * 0.60);
        const cropH = Math.round(vh * 0.60);
        const cropX = Math.round((vw - cropW) / 2);
        const cropY = Math.round((vh - cropH) / 2);

        this.roiCanvas.width = cropW;
        this.roiCanvas.height = cropH;
        const roiCtx = this.roiCanvas.getContext('2d', { willReadFrequently: true });
        roiCtx.drawImage(this.videoEl, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        detectedResult = await this.decodeFromCanvasOrImageData(this.roiCanvas, roiCtx, cropW, cropH);
      }

      if (detectedResult && detectedResult.text) {
        const payload = detectedResult.text;
        // Debounce if same payload was just scanned
        if (payload !== this.lastScannedPayload) {
          console.log(`[QR Scanner] Successfully decoded via ${detectedResult.engine}:`, payload);
          this.onQrCodeDetected(payload);
          return;
        }
      }
    }

    if (this.isScanning) {
      this.scanAnimationId = requestAnimationFrame(() => this.scanQrFrame());
    }
  }

  onQrCodeDetected(rawPayload) {
    const payload = (rawPayload || '').trim();
    if (!payload) return;

    this.lastScannedPayload = payload;
    this.currentDetectedPayload = payload;
    this.isScanning = false;

    // 1. Immediate Haptic feedback (distinct double pulse)
    if (navigator.vibrate) {
      try {
        navigator.vibrate([150, 80, 150]);
      } catch (e) {}
    }

    // 2. Clear audio cue
    window.AcousticHaptic.playDetected();

    // 3. Parse decoded data for user review
    const parsed = this.parseDecodedPayloadForDisplay(payload);

    // 4. Voice announcement feedback
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';
    const payeeName = parsed.payeeName;
    if (isTa) {
      window.TTSVoice.speak({
        ta: `க்யூஆர் குறியீடு கண்டறியப்பட்டது. பெறுநர்: ${payeeName}. செலுத்துவதற்கு தொடரவும் அல்லது மீண்டும் ஸ்கேன் செய்யவும்.`,
        tanglish: `QR code detect aayiduchu. Payee: ${payeeName}. Pay panna continue pannunga.`,
        en: `QR code detected. Payee: ${payeeName}. Review details and tap Proceed to Pay.`
      }, true);
    } else {
      window.TTSVoice.speak({
        en: `QR code detected. Payee: ${payeeName}. Review details and tap Proceed to Pay.`,
        ta: `க்யூஆர் குறியீடு கண்டறியப்பட்டது. பெறுநர்: ${payeeName}.`
      }, true);
    }

    // 5. Update UI with decoded data: Show on-screen card immediately!
    // (Crucial: Do NOT trigger payment automatically after detection!)
    this.showScannerDetectedCard(parsed, payload);
  }

  parseDecodedPayloadForDisplay(payload) {
    const lower = (payload || '').toLowerCase().trim();

    // Check for suspicious URL
    if (
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.includes('.com') ||
      lower.includes('.xyz') ||
      lower.includes('.online')
    ) {
      return {
        payeeName: 'Suspicious Web Link',
        upiId: 'Non-UPI URL',
        amount: null,
        note: payload,
        statusType: 'suspicious',
        statusText: '⚠️ Suspicious Link - Blocked',
        icon: '🚫',
        isSuspicious: true
      };
    }

    // UPI URI format: upi://pay?...
    if (lower.startsWith('upi://pay')) {
      const parsed = this.parseUpiUri(payload);
      let payeeName = parsed.pn || 'Unknown Merchant';
      let upiId = parsed.pa || 'No UPI ID';
      let isVerified = false;

      // Match against known contacts directory
      for (const contact of this.knownContacts) {
        if (
          (parsed.pa && contact.upiId.toLowerCase() === parsed.pa.toLowerCase()) ||
          (parsed.pn && contact.name.toLowerCase().includes(parsed.pn.toLowerCase()))
        ) {
          isVerified = true;
          payeeName = contact.name;
          upiId = contact.upiId;
          break;
        }
      }

      return {
        payeeName,
        upiId,
        amount: parsed.am ? `₹${parsed.am.toFixed(2)}` : null,
        note: parsed.tn || null,
        statusType: isVerified ? 'verified' : 'unverified',
        statusText: isVerified ? '🛡️ Verified Merchant' : '⚠️ Unverified Payee',
        icon: isVerified ? '✅' : '⚠️',
        isSuspicious: false
      };
    }

    // Plain text UPI handle: user@bank
    if (payload.includes('@') && !payload.includes(' ') && payload.includes('.')) {
      let isVerified = false;
      let payeeName = 'Merchant Payee';
      for (const contact of this.knownContacts) {
        if (contact.upiId.toLowerCase() === payload.toLowerCase()) {
          isVerified = true;
          payeeName = contact.name;
          break;
        }
      }

      return {
        payeeName,
        upiId: payload,
        amount: null,
        note: null,
        statusType: isVerified ? 'verified' : 'unverified',
        statusText: isVerified ? '🛡️ Verified UPI ID' : '⚠️ Unverified UPI ID',
        icon: isVerified ? '✅' : '⚠️',
        isSuspicious: false
      };
    }

    // Generic QR code
    return {
      payeeName: 'Scanned QR Code',
      upiId: payload.slice(0, 32),
      amount: null,
      note: null,
      statusType: 'unverified',
      statusText: 'ℹ️ Non-Standard QR',
      icon: 'ℹ️',
      isSuspicious: false
    };
  }

  showScannerDetectedCard(parsed, payload) {
    const card = document.getElementById('scanner-detected-card');
    const payeeEl = document.getElementById('qr-detected-payee');
    const upiEl = document.getElementById('qr-detected-upi');
    const amtRow = document.getElementById('qr-detected-amount-row');
    const amtEl = document.getElementById('qr-detected-amount');
    const noteRow = document.getElementById('qr-detected-note-row');
    const noteEl = document.getElementById('qr-detected-note');
    const rawEl = document.getElementById('qr-detected-raw');
    const statusEl = document.getElementById('qr-detected-status');
    const iconEl = document.getElementById('qr-detected-icon');
    const reticle = document.getElementById('scanner-camera-reticle');
    const laserBeam = document.getElementById('scanner-laser-beam');
    const bottomControls = document.getElementById('scanner-bottom-controls');

    if (payeeEl) payeeEl.textContent = parsed.payeeName;
    if (upiEl) upiEl.textContent = parsed.upiId;

    if (amtRow && amtEl) {
      if (parsed.amount) {
        amtRow.style.display = 'flex';
        amtEl.textContent = parsed.amount;
      } else {
        amtRow.style.display = 'flex';
        amtEl.textContent = 'Enter in next step';
      }
    }

    if (noteRow && noteEl) {
      if (parsed.note) {
        noteRow.style.display = 'flex';
        noteEl.textContent = parsed.note;
      } else {
        noteRow.style.display = 'none';
      }
    }

    if (rawEl) rawEl.textContent = payload;

    if (statusEl) {
      statusEl.textContent = parsed.statusText;
      statusEl.className = 'detected-status-badge ' + (parsed.statusType || '');
    }

    if (iconEl) iconEl.textContent = parsed.icon || '✅';

    // Visual reticle success feedback
    if (reticle) reticle.classList.add('detected-active');
    if (laserBeam) laserBeam.style.display = 'none';
    if (bottomControls) bottomControls.style.display = 'none';

    if (card) {
      card.style.display = 'flex';
    }
  }

  rescanQr() {
    window.AcousticHaptic.playClick();
    this.lastScannedPayload = null;
    this.currentDetectedPayload = null;

    const card = document.getElementById('scanner-detected-card');
    if (card) card.style.display = 'none';

    const reticle = document.getElementById('scanner-camera-reticle');
    if (reticle) reticle.classList.remove('detected-active');

    const laserBeam = document.getElementById('scanner-laser-beam');
    if (laserBeam) laserBeam.style.display = 'block';

    const bottomControls = document.getElementById('scanner-bottom-controls');
    if (bottomControls) bottomControls.style.display = 'flex';

    window.TTSVoice.speak({
      ta: 'மீண்டும் ஸ்கேன் செய்யப்படுகிறது. க்யூஆர் குறியீட்டை திரையின் நடுவே வைக்கவும்.',
      tanglish: 'Marubadiyum scan panrom. QR code-ai screen nadula veinga.',
      en: 'Scanning resumed. Align the QR code inside the frame.'
    });

    if (!this.isScanning) {
      this.isScanning = true;
      this.scanQrFrame();
    }
  }

  proceedWithDetectedQr() {
    window.AcousticHaptic.playClick();
    const payload = this.currentDetectedPayload || this.lastScannedPayload;
    if (!payload) return;

    // Hide card and stop camera before moving to next screen
    const card = document.getElementById('scanner-detected-card');
    if (card) card.style.display = 'none';
    this.stopCamera();

    // Proceed to standard verification & confirmation flow
    this.handleDecodedQr(payload);
  }

  async decodeImageFile(file) {
    if (!file) return;
    window.AcousticHaptic.playClick();
    window.TTSVoice.speak({
      ta: 'தேர்ந்தெடுக்கப்பட்ட படம் பகுப்பாய்வு செய்யப்படுகிறது...',
      tanglish: 'Select panna photo check panrom...',
      en: 'Analyzing selected image...'
    });

    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = async () => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);

          this.initBarcodeEngines();
          let res = await this.decodeFromCanvasOrImageData(c, ctx, img.width, img.height);

          // Center crop pass if large photo
          if (!res && img.width >= 400 && img.height >= 400) {
            const cropW = Math.round(img.width * 0.7);
            const cropH = Math.round(img.height * 0.7);
            const cropX = Math.round((img.width - cropW) / 2);
            const cropY = Math.round((img.height - cropH) / 2);
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
            cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            res = await this.decodeFromCanvasOrImageData(cropCanvas, cropCtx, cropW, cropH);
          }

          if (res && res.text) {
            console.log('[Gallery QR] Successfully decoded:', res.text);
            this.onQrCodeDetected(res.text);
          } else {
            console.warn('[Gallery QR] No valid QR code detected in image.');
            window.AcousticHaptic.playWarning();
            window.TTSVoice.speak({
              ta: 'படத்திலிருந்து க்யூஆர் குறியீட்டைக் கண்டுபிடிக்க முடியவில்லை. தெளிவான படத்தை முயற்சிக்கவும்.',
              tanglish: 'Photo-la QR code theriyala. Clear photo try pannunga.',
              en: 'Could not detect a QR code in the selected image. Please try a clearer picture.'
            });
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('[Gallery QR Error]', err);
    }
  }

  toggleTorch(active) {
    if (this.cameraStream) {
      const track = this.cameraStream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          track.applyConstraints({ advanced: [{ torch: active }] }).catch(err => {
            console.warn('[Camera Torch Error]:', err);
          });
        }
      }
    }
  }

  async handleDecodedQr(rawPayload) {
    const payload = (rawPayload || '').trim();
    if (!payload) return;

    console.log('[QR Scanner] QR Decoded:', payload);
    window.AcousticHaptic.playDetected();
    window.TTSVoice.speakQRVerifying();

    // 1. Strict Security Guard: Reject arbitrary URLs and phishing links immediately
    const lower = payload.toLowerCase();
    if (
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.includes('.com') ||
      lower.includes('.xyz') ||
      lower.includes('.online')
    ) {
      console.warn('[QR Security Guard]: Suspicious non-UPI URL payload blocked:', payload);
      this.handleSuspiciousQr(payload);
      return;
    }

    // 2. Query FastAPI QR verification endpoint
    try {
      const resp = await fetch('http://127.0.0.1:8000/api/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_payload: payload })
      });

      if (resp.ok) {
        const data = await resp.json();
        this.processQrVerificationResult(data);
        return;
      }
    } catch (err) {
      console.warn('[QR Backend Offline Fallback]:', err.message);
    }

    // 3. Resilient Client-Side Verification Fallback
    const localResult = this.clientSideVerifyQr(payload);
    this.processQrVerificationResult(localResult);
  }

  processQrVerificationResult(result) {
    console.log('[QR Verification Result]:', result);

    // A. Suspicious / Blocked payload
    if (result.suspicious || result.risk_level === 'BLOCKED' || !result.valid) {
      this.handleSuspiciousQr(result.warning_message || 'Suspicious QR code blocked.');
      return;
    }

    // B. Known / Verified Merchant
    if (result.verified) {
      this.merchant.name = result.merchant_name || 'Verified Merchant';
      this.merchant.upiId = result.upi_id || 'merchant@upi';
      this.merchant.verified = true;

      window.AcousticHaptic.playSuccess();
      window.TTSVoice.speakQRVerified(this.merchant.name);

      if (result.amount && result.amount > 0) {
        this.amount = result.amount.toString();
        this.updateMerchantDisplay();
        this.switchView('view-confirm');
      } else {
        this.amount = '500';
        this.updateMerchantDisplay();
        this.switchView('view-amount');
      }
      return;
    }

    // C. Unverified / Unknown Payee QR (e.g. Suresh Stores)
    console.warn('[QR Payee Verification]: Unverified QR detected:', result.merchant_name);
    const amt = (result.amount && result.amount > 0) ? result.amount.toString() : '500';
    this.merchant.name = result.merchant_name || 'Unverified Payee';
    this.merchant.upiId = result.upi_id || '';
    this.merchant.verified = false;
    this.amount = amt;
    this.updateMerchantDisplay();

    // Trigger wrong receiver warning modal without auto-creating fake UPI handle
    this.triggerWrongReceiverWarning(this.merchant.name, amt);
    if (this.pendingPayment) {
      this.pendingPayment.upiId = result.upi_id || null;
    }
  }

  handleSuspiciousQr(details) {
    this.stopCamera();
    window.AcousticHaptic.playWarning();
    this.triggerSuspiciousQRWarning();
  }

  clientSideVerifyQr(payload) {
    const lower = payload.toLowerCase();

    // Block URLs
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('javascript:')) {
      return {
        valid: false,
        merchant_name: null,
        upi_id: null,
        amount: null,
        currency: 'INR',
        verified: false,
        suspicious: true,
        warning_message: 'Security Alert: Non-UPI web URL blocked.',
        risk_level: 'BLOCKED'
      };
    }

    // Parse UPI URI
    if (lower.startsWith('upi://pay')) {
      const parsed = this.parseUpiUri(payload);
      if (!parsed.pa) {
        return {
          valid: false,
          merchant_name: parsed.pn,
          upi_id: null,
          amount: parsed.am,
          currency: parsed.cu,
          verified: false,
          suspicious: true,
          warning_message: 'Malformed UPI QR: payee address missing.',
          risk_level: 'BLOCKED'
        };
      }

      // Check against known contacts directory
      let isVerified = false;
      let resolvedName = parsed.pn || 'Merchant';
      let cleanPa = parsed.pa.trim();

      for (const contact of this.knownContacts) {
        if (cleanPa.toLowerCase() === contact.upiId.toLowerCase() || (parsed.pn && contact.name.toLowerCase().includes(parsed.pn.toLowerCase()))) {
          isVerified = true;
          resolvedName = contact.name;
          cleanPa = contact.upiId;
          break;
        }
      }

      return {
        valid: true,
        merchant_name: resolvedName,
        upi_id: cleanPa,
        amount: parsed.am,
        currency: parsed.cu || 'INR',
        verified: isVerified,
        suspicious: false,
        warning_message: isVerified ? null : 'Unverified Merchant',
        risk_level: isVerified ? 'SAFE' : 'MEDIUM'
      };
    }

    // Direct UPI ID string
    if (payload.includes('@') && !payload.includes(' ') && payload.includes('.')) {
      let isVerified = false;
      let resolvedName = 'Merchant';
      for (const contact of this.knownContacts) {
        if (payload.toLowerCase() === contact.upiId.toLowerCase()) {
          isVerified = true;
          resolvedName = contact.name;
          break;
        }
      }
      return {
        valid: true,
        merchant_name: resolvedName,
        upi_id: payload,
        amount: null,
        currency: 'INR',
        verified: isVerified,
        suspicious: false,
        warning_message: isVerified ? null : 'Unverified Merchant',
        risk_level: isVerified ? 'SAFE' : 'MEDIUM'
      };
    }

    // Unknown format
    return {
      valid: false,
      merchant_name: null,
      upi_id: null,
      amount: null,
      currency: 'INR',
      verified: false,
      suspicious: true,
      warning_message: 'Unrecognized QR code format.',
      risk_level: 'BLOCKED'
    };
  }

  parseUpiUri(uri) {
    const result = { pa: null, pn: null, am: null, cu: 'INR', tn: null };
    try {
      const qIndex = uri.indexOf('?');
      if (qIndex === -1) return result;
      const queryStr = uri.slice(qIndex + 1);
      const params = new URLSearchParams(queryStr);

      result.pa = params.get('pa');
      result.pn = params.get('pn');
      result.cu = params.get('cu') || 'INR';
      result.tn = params.get('tn');

      const am = params.get('am');
      if (am) {
        const parsed = parseFloat(am);
        if (!isNaN(parsed)) result.am = parsed;
      }
    } catch (e) {
      console.warn('URI parse error:', e);
    }
    return result;
  }

  simulateDemoQr(type = 'kumar') {
    this.stopCamera();
    window.AcousticHaptic.playClick();

    if (type === 'kumar') {
      window.TTSVoice.speak({
        ta: 'டெமோ க்யூஆர் தேர்ந்தெடுக்கப்பட்டது: குமார் மளிகை, ₹500.',
        en: 'Demo QR selected: Kumar Groceries, ₹500.'
      });
      this.handleDecodedQr('upi://pay?pa=kumar.store@okhdfcbank&pn=Kumar%20Groceries&am=500&cu=INR&tn=Store%20Purchase');
    } else if (type === 'unknown') {
      window.TTSVoice.speak({
        ta: 'டெமோ க்யூஆர் தேர்ந்தெடுக்கப்பட்டது: சரிபார்க்கப்படாத புதிய பெறுநர், ₹250.',
        en: 'Demo QR selected: Unverified Merchant, ₹250.'
      });
      this.handleDecodedQr('upi://pay?pa=suresh.shop@okaxis&pn=Suresh%20Stores&am=250&cu=INR');
    } else if (type === 'suspicious') {
      window.TTSVoice.speak({
        ta: 'டெமோ க்யூஆர் தேர்ந்தெடுக்கப்பட்டது: சந்தேகத்திற்குரிய போலி இணைய இணைப்பு.',
        en: 'Demo QR selected: Suspicious phishing link.'
      });
      this.handleDecodedQr('https://phishing-scam-bank.com/steal-upi-pin');
    }
  }

  // =========================================================================
  // VOICE NAVIGATION ACTIONS
  // =========================================================================
  openHistoryView() {
    this.renderTransactions();
    this.switchView('view-history');
  }

  openContactsView() {
    this.renderBeneficiariesList();
    this.switchView('view-contacts');
    window.TTSVoice.speakBeneficiaryDirectoryOpened(this.beneficiaries ? this.beneficiaries.length : 5);
  }

  goHome() {
    clearTimeout(this.scanTimeout);
    this.stopCamera();
    this.enteredPin = '';
    this.isConfirmedByVoice = false;
    this.pendingPayment = null;
    this.isProcessingPayment = false;
    this.renderTransactions();
    this.switchView('view-home');
  }

  openPayUpiView() {
    this.switchView('view-pay-upi');
    const input = document.getElementById('input-upi-id');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
    const err = document.getElementById('upi-error-msg');
    if (err) err.style.display = 'none';
  }

  submitUpiId() {
    const input = document.getElementById('input-upi-id');
    const err = document.getElementById('upi-error-msg');
    if (!input) return;
    
    const upiId = input.value.trim();
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9]{2,}$/;
    
    if (!upiRegex.test(upiId)) {
      if (err) err.style.display = 'block';
      if (window.TTSVoice && window.TTSVoice.speak) {
        window.TTSVoice.speak({
          ta: 'தவறான யூபிஐ ஐடி.',
          tanglish: 'Thappana UPI ID.',
          en: 'Invalid UPI ID format. Please try again.'
        });
      }
      return;
    }
    
    if (err) err.style.display = 'none';
    const merchantName = upiId.split('@')[0].toUpperCase();
    this.selectMerchant(merchantName, upiId, '');
  }

  openBillsView() {
    this.switchView('view-bills');
    const providerSection = document.getElementById('bill-provider-section');
    if (providerSection) providerSection.style.display = 'none';
    const form = document.getElementById('form-pay-bill');
    if (form) form.reset();
  }

  selectBillCategory(category) {
    const providerSection = document.getElementById('bill-provider-section');
    const title = document.getElementById('bill-category-title');
    const select = document.getElementById('select-provider');
    
    if (providerSection && title && select) {
      title.textContent = `Select Provider for ${category}`;
      providerSection.style.display = 'block';
      providerSection.dataset.category = category;
      
      select.innerHTML = '<option value="">Choose Provider</option>';
      let providers = [];
      
      switch(category) {
        case 'Mobile Recharge':
          providers = ['Jio', 'Airtel', 'Vi', 'BSNL'];
          break;
        case 'Electricity':
          providers = ['TNEB / TANGEDCO'];
          break;
        case 'DTH':
          providers = ['Tata Play', 'Airtel Digital TV', 'Sun Direct', 'Dish TV'];
          break;
        case 'Broadband':
          providers = ['Airtel Xstream', 'JioFiber', 'BSNL'];
          break;
        case 'Water':
          providers = ['Municipal Water Board'];
          break;
        case 'Gas':
          providers = ['LPG / Gas Bill'];
          break;
        default:
          providers = ['Generic Provider'];
      }
      
      providers.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.toLowerCase().replace(/[^a-z0-9]/g, '');
        opt.textContent = p;
        select.appendChild(opt);
      });
      
      setTimeout(() => {
        select.focus();
      }, 100);
    }
  }

  submitBillPayment() {
    const select = document.getElementById('select-provider');
    const accountInput = document.getElementById('input-account-no');
    const providerSection = document.getElementById('bill-provider-section');
    
    if (!select || !accountInput || !select.value || !accountInput.value.trim()) return;
    
    const providerName = select.options[select.selectedIndex].text;
    const category = providerSection ? providerSection.dataset.category : 'Bill';
    const merchantName = `${providerName} - ${category}`;
    const upiId = `biller.${select.value}@oneability`;
    
    this.selectMerchant(merchantName, upiId, '');
  }

  selectMerchant(name, upiId, defaultAmount = '500') {
    this.merchant.name = name;
    this.merchant.upiId = upiId;
    this.merchant.verified = true;
    this.amount = defaultAmount;
    this.updateMerchantDisplay();
    this.switchView('view-amount');
  }

  setAmountChip(val) {
    this.amount = val.toString();
    const amountInput = document.getElementById('sim-amount-input');
    if (amountInput) amountInput.value = val;
    window.AcousticHaptic.playClick();
    window.TTSVoice.speak({
      ta: `தொகை ₹${val} ஆக அமைக்கப்பட்டது.`,
      en: `Amount set to ₹${val}`
    });
  }

  proceedToConfirm() {
    const amountInput = document.getElementById('sim-amount-input');
    if (amountInput && amountInput.value && amountInput.value.trim() !== '') {
      this.amount = amountInput.value.trim();
    } else if (!this.amount) {
      this.amount = '500';
    }

    const numAmount = parseFloat(this.amount);
    if (numAmount >= 10000) {
      this.triggerFraudWarning(numAmount);
      return;
    }

    this.updateMerchantDisplay();
    this.switchView('view-confirm');
  }

  triggerFraudWarning(amount) {
    window.AcousticHaptic.playWarning();
    const modal = document.getElementById('fraud-guard-modal');
    const titleEl = document.getElementById('fraud-title');
    const msg = document.getElementById('fraud-warning-msg');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    if (titleEl) {
      titleEl.textContent = isTa ? '⚠️ பாதுகாப்பு வரம்பு அறிவிப்பு' : '⚠️ Safety Guard Notice';
    }
    if (msg) {
      msg.textContent = isTa
        ? `உயர் மதிப்பு பரிவர்த்தனை எச்சரிக்கை! நீங்கள் ₹${amount} செலுத்துகிறீர்கள். "${this.merchant.name}" அவர்களுக்கு பணம் அனுப்பப்படும்.`
        : `High-value transfer alert! You entered ₹${amount}. Confirming will transfer this sum to "${this.merchant.name}".`;
    }
    if (modal) modal.classList.add('active');
    window.TTSVoice.speakError(`High value transfer of ₹${amount}. Double check recipient before proceeding.`);
  }

  dismissFraudWarning(proceedAnyway = false) {
    const modal = document.getElementById('fraud-guard-modal');
    if (modal) modal.classList.remove('active');

    if (proceedAnyway) {
      // If proceeding from unverified contact warning
      if (this.pendingPayment) {
        this.merchant.name = this.pendingPayment.recipient;
        this.merchant.upiId = this.pendingPayment.upiId || '';
        this.merchant.verified = false;
        this.amount = this.pendingPayment.amount;
        this.pendingPayment = null;
      }
      this.updateMerchantDisplay();
      this.switchView('view-confirm');
      window.AcousticHaptic.playConfirmPrompt();
      window.TTSVoice.speakConfirmationPrompt(this.merchant.name, this.amount);
    } else {
      this.pendingPayment = null;
      window.TTSVoice.speak({
        ta: 'உங்கள் பாதுகாப்பிற்காக பரிவர்த்தனை ரத்து செய்யப்பட்டது.',
        en: 'Transfer aborted for your safety.'
      });
      this.goHome();
    }
  }

  // =========================================================================
  // PAYMENT CONFIRMATION & PERSISTENT EXECUTION
  // =========================================================================
  async handleVoiceConfirmation(isConfirmed) {
    if (isConfirmed) {
      // Route through WebAuthn / Platform Biometrics or College Demo Simulation
      const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';
      const statusBadge = document.getElementById('confirm-voice-status');
      if (statusBadge) {
        statusBadge.textContent = isTa ? '🔐 சாதன பாதுகாப்பை சரிபார்க்கவும்...' : '🔐 Authorize with device security...';
        statusBadge.style.color = 'var(--accent-cyan)';
      }
      this.authenticatePaymentBiometric();
    } else {
      this.cancelPayment();
    }
  }

  async executePaymentAfterAuth() {
    const amt = parseFloat(this.amount) || 0;
    if (amt <= 0 || !this.merchant.name) {
      console.warn('executePaymentAfterAuth aborted: invalid amount or missing recipient.');
      return;
    }
    if (this.isProcessingPayment) return;
    this.isProcessingPayment = true;

    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';
    this.isConfirmedByVoice = true;

    // 1. UI Loading state
    const statusBadge = document.getElementById('confirm-voice-status');
    if (statusBadge) {
      statusBadge.textContent = isTa ? '⏳ கட்டணம் செயலாக்கப்படுகிறது...' : '⏳ Processing mock payment...';
      statusBadge.style.color = 'var(--accent-amber)';
    }

    window.AcousticHaptic.playFocus();
    window.TTSVoice.speak({
      ta: 'கட்டணம் செயலாக்கப்படுகிறது...',
      en: 'Processing mock payment...'
    });

    // Simulated reference
    let txnId = `MOCK_${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    try {
      const resp = await fetch('http://127.0.0.1:8000/api/voice/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: this.merchant.name,
          upi_id: this.merchant.upiId,
          amount: parseFloat(this.amount),
          action: 'confirm'
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.transaction_id) txnId = data.transaction_id;
      }
    } catch (err) {
      console.warn('Backend confirm error, executing simulated offline fallback:', err.message);
    }

    // 2. Finalize & Persist Payment
    setTimeout(() => {
      this.isProcessingPayment = false;
      this.lastTxId = txnId;
      this.finalizeSuccessfulPayment(txnId);

      const successAmt = document.getElementById('success-amount-display');
      if (successAmt) successAmt.textContent = `₹${this.amount}`;

      const txIdEl = document.getElementById('success-txid-display');
      if (txIdEl) txIdEl.textContent = `UPI Ref: ${txnId}`;

      this.switchView('view-success');
      window.AcousticHaptic.playSuccess();
      window.TTSVoice.speakSuccess(this.merchant.name, this.amount, txnId);

      const resultMsg = document.getElementById('parsed-message');
      if (resultMsg) {
        resultMsg.textContent = isTa
          ? `✔ ${this.merchant.name} அவர்களுக்கு ₹${this.amount} மாதிரி கட்டணம் வெற்றிகரமாக செலுத்தப்பட்டது. (Ref: ${txnId})`
          : `✔ Mock payment of ₹${this.amount} to ${this.merchant.name} completed successfully. (Ref: ${txnId})`;
      }
    }, 600);
  }

  cancelPayment() {
    this.isProcessingPayment = false;
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';
    this.isConfirmedByVoice = false;
    this.pendingPayment = null;
    window.AcousticHaptic.playError();
    window.TTSVoice.speakCancelled();

    // Clear payment data
    this.merchant = { name: '', upiId: '', verified: false };
    this.amount = '0';

    document.querySelectorAll('.sim-merchant-name').forEach(el => el.textContent = '');
    document.querySelectorAll('.sim-merchant-upi').forEach(el => el.textContent = '');
    const amountInput = document.getElementById('sim-amount-input');
    if (amountInput) amountInput.value = '';
    const confirmAmtEl = document.getElementById('confirm-amount-display');
    if (confirmAmtEl) confirmAmtEl.textContent = '₹0';

    const statusBadge = document.getElementById('confirm-voice-status');
    if (statusBadge) {
      statusBadge.textContent = isTa ? '❌ கட்டணம் ரத்து செய்யப்பட்டது' : '❌ Payment Cancelled';
      statusBadge.style.color = 'var(--accent-rose)';
    }

    setTimeout(() => {
      this.goHome();
    }, 900);
  }

  openPinScreen() {
    this.enteredPin = '';
    this.updatePinDots();
    this.switchView('view-pin');
  }

  // =========================================================================
  // VOICE ACCESSIBILITY & DYNAMIC BALANCE
  // =========================================================================
  checkBalanceVoice() {
    window.AcousticHaptic.playSuccess();
    this.updateBalanceUI(true);
    window.TTSVoice.speakBalance('State Bank of India', this.getFormattedBalance());
  }

  readReceiptAloud() {
    const txId = this.lastTxId || '948201849204';
    window.AcousticHaptic.playClick();
    window.TTSVoice.speakReceipt(
      this.merchant.name || 'Kumar Groceries',
      this.merchant.upiId || 'kumar.store@okhdfcbank',
      this.amount || '500',
      txId
    );
  }

  // =========================================================================
  // WEBAUTHN PLATFORM AUTHENTICATION & DEMO BIOMETRIC SIMULATION
  // =========================================================================
  loadStoredCredential() {
    try {
      const saved = localStorage.getItem('oneability_webauthn_credential');
      if (saved) {
        this.registeredCredential = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[WebAuthn] Error loading stored credential:', e);
    }
  }

  async checkWebAuthnSupport() {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      this.webAuthnStatus = 'UNSUPPORTED';
      this.updateWebAuthnUI();
      return this.webAuthnStatus;
    }

    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        this.webAuthnStatus = available ? 'SUPPORTED' : 'UNAVAILABLE';
      } else {
        this.webAuthnStatus = 'SUPPORTED';
      }
    } catch (e) {
      console.warn('[WebAuthn] Capability detection check failed:', e);
      this.webAuthnStatus = 'UNAVAILABLE';
    }

    this.updateWebAuthnUI();
    return this.webAuthnStatus;
  }

  updateWebAuthnUI() {
    const badge = document.getElementById('biometric-capability-badge');
    const iconEl = document.getElementById('biometric-status-icon');
    const textEl = document.getElementById('biometric-status-text');
    const enrollBtn = document.getElementById('webauthn-enroll-btn');
    const biometricBtn = document.getElementById('btn-biometric-auth');
    const biometricText = document.getElementById('btn-biometric-text');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    if (badge) {
      badge.classList.remove('supported', 'unavailable', 'unsupported');
      if (this.webAuthnStatus === 'SUPPORTED') {
        badge.classList.add('supported');
        if (iconEl) iconEl.textContent = '🛡️';
        if (textEl) textEl.textContent = isTa
          ? '● சாதன பயோமெட்ரிக் பாதுகாப்பு தயார் (WebAuthn)'
          : '● Device Platform Biometrics Ready (WebAuthn)';
        if (biometricBtn) biometricBtn.disabled = false;
        if (biometricText) biometricText.textContent = isTa
          ? '🔐 சாதன பயோமெட்ரிக் மூலம் அங்கீகரிக்கவும்'
          : '🔐 Authenticate with Device Biometrics';
        if (enrollBtn) enrollBtn.textContent = this.registeredCredential ? '🔐 Enrolled (Platform)' : '🔐 Enroll Biometrics';
      } else if (this.webAuthnStatus === 'UNAVAILABLE') {
        badge.classList.add('unavailable');
        if (iconEl) iconEl.textContent = '⚠️';
        if (textEl) textEl.textContent = isTa
          ? 'சாதன பயோமெட்ரிக் இல்லை (கல்லூரி மாதிரி தயார்)'
          : 'Device biometrics unavailable (College Demo Ready)';
        if (biometricBtn) biometricBtn.disabled = true;
        if (biometricText) biometricText.textContent = isTa
          ? '🔐 சாதன பயோமெட்ரிக் இல்லை'
          : '🔐 Platform Biometrics Unavailable';
        if (enrollBtn) enrollBtn.textContent = '⚠️ Unavailable';
      } else {
        badge.classList.add('unsupported');
        if (iconEl) iconEl.textContent = '⚠️';
        if (textEl) textEl.textContent = isTa
          ? 'உலாவியில் WebAuthn ஆதரவு இல்லை (மாதிரி தயார்)'
          : 'WebAuthn unsupported on this browser (Demo Ready)';
        if (biometricBtn) biometricBtn.disabled = true;
        if (biometricText) biometricText.textContent = isTa
          ? '🔐 WebAuthn ஆதரவு இல்லை'
          : '🔐 WebAuthn Unsupported';
        if (enrollBtn) enrollBtn.textContent = '⚠️ Unsupported';
      }
    }
  }

  async registerWebAuthnCredential() {
    if (this.webAuthnStatus === 'UNSUPPORTED' || typeof navigator === 'undefined' || !navigator.credentials || !navigator.credentials.create) {
      window.AcousticHaptic.playWarning();
      window.TTSVoice.speakWebAuthnFallback();
      return false;
    }

    const challenge = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(challenge);
    } else {
      for (let i = 0; i < 32; i++) challenge[i] = Math.floor(Math.random() * 256);
    }

    const userId = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(userId);
    }

    const creationOptions = {
      publicKey: {
        challenge: challenge,
        rp: {
          name: 'OneAbility AI Pay',
          id: (typeof window !== 'undefined' && window.location && window.location.hostname) || 'localhost'
        },
        user: {
          id: userId,
          name: (window.UserManager && typeof window.UserManager.getUserEmail === 'function') ? window.UserManager.getUserEmail() : 'sandhiya@oneability',
          displayName: `${(window.UserManager && typeof window.UserManager.getUserName === 'function') ? window.UserManager.getUserName() : 'Sandhiya'} (OneAbility User)`
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },  // ES256
          { type: 'public-key', alg: -257 } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          requireResidentKey: false
        },
        timeout: 60000,
        attestation: 'none'
      }
    };

    window.AcousticHaptic.playBiometricScan();
    window.TTSVoice.speak({
      ta: 'சாதன பயோமெட்ரிக் பதிவை தொடங்க கைரேகை அல்லது சாதன பின் பயன்படுத்தவும்.',
      en: 'Use your fingerprint or device PIN to enroll device biometrics.'
    });

    try {
      const credential = await navigator.credentials.create(creationOptions);
      if (credential) {
        const meta = {
          credentialId: credential.id || 'demo_cred_id',
          registeredAt: new Date().toISOString(),
          type: credential.type || 'public-key',
          authenticatorAttachment: 'platform'
        };
        localStorage.setItem('oneability_webauthn_credential', JSON.stringify(meta));
        this.registeredCredential = meta;

        window.AcousticHaptic.playBiometricSuccess();
        window.TTSVoice.speak({
          ta: 'சாதன பயோமெட்ரிக் பாதுகாப்பு வெற்றிகரமாக பதிவு செய்யப்பட்டது.',
          en: 'Device biometric security enrolled successfully.'
        });
        this.updateWebAuthnUI();
        return true;
      }
    } catch (err) {
      console.warn('[WebAuthn Enrollment Error]:', err.name, err.message);
      window.AcousticHaptic.playWarning();
      if (err.name === 'NotAllowedError') {
        window.TTSVoice.speak({
          ta: 'பயோமெட்ரிக் பதிவு ரத்து செய்யப்பட்டது.',
          en: 'Device biometric enrollment was cancelled.'
        });
      } else {
        window.TTSVoice.speakWebAuthnFallback();
      }
      return false;
    }
  }

  async authenticatePaymentBiometric() {
    if (this.webAuthnStatus === 'SUPPORTED' && typeof navigator !== 'undefined' && navigator.credentials && navigator.credentials.get) {
      return this.authenticateWithWebAuthn();
    } else {
      return this.triggerBiometricSimulation();
    }
  }

  async authenticateWithWebAuthn() {
    window.AcousticHaptic.playBiometricScan();
    window.TTSVoice.speakWebAuthnPrompt();

    const statusBadge = document.getElementById('confirm-voice-status');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';
    if (statusBadge) {
      statusBadge.textContent = isTa ? '🔐 சாதன பாதுகாப்பை சரிபார்க்கவும்...' : '🔐 Verifying platform credentials...';
      statusBadge.style.color = 'var(--accent-cyan)';
    }

    const challenge = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(challenge);
    } else {
      for (let i = 0; i < 32; i++) challenge[i] = Math.floor(Math.random() * 256);
    }

    const getOptions = {
      publicKey: {
        challenge: challenge,
        rpId: (typeof window !== 'undefined' && window.location && window.location.hostname) || 'localhost',
        userVerification: 'preferred',
        timeout: 60000
      }
    };

    try {
      const assertion = await navigator.credentials.get(getOptions);
      if (assertion) {
        window.AcousticHaptic.playBiometricSuccess();
        window.TTSVoice.speakWebAuthnSuccess();

        if (statusBadge) {
          statusBadge.textContent = isTa ? '✔ பயோமெட்ரிக் அங்கீகரிக்கப்பட்டது!' : '✔ Device Security Verified!';
          statusBadge.style.color = 'var(--accent-green)';
        }

        setTimeout(() => {
          this.executePaymentAfterAuth();
        }, 500);
        return true;
      }
    } catch (err) {
      console.warn('[WebAuthn Authentication Exception]:', err.name, err.message);
      window.AcousticHaptic.playWarning();

      if (err.name === 'NotAllowedError') {
        window.TTSVoice.speakWebAuthnCancelled();
        if (statusBadge) {
          statusBadge.textContent = isTa ? '❌ பயோமெட்ரிக் ரத்து செய்யப்பட்டது.' : '❌ Biometric authentication cancelled.';
          statusBadge.style.color = 'var(--accent-rose)';
        }
      } else {
        window.TTSVoice.speakWebAuthnFallback();
        if (statusBadge) {
          statusBadge.textContent = isTa ? '⚠️ பயோமெட்ரிக் பிழை. மாதிரி சிமுலேஷன் பயன்படுத்தவும்.' : '⚠️ Biometric error. Use Demo Simulation.';
          statusBadge.style.color = 'var(--accent-amber)';
        }
      }
      return false;
    }
  }

  triggerBiometricSimulation() {
    window.AcousticHaptic.playBiometricScan();
    window.TTSVoice.speakBiometricPrompt();

    const statusBadge = document.getElementById('confirm-voice-status');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';
    if (statusBadge) {
      statusBadge.textContent = isTa ? '⚡ மாதிரி கைரேகை ஸ்கேன் செய்யப்படுகிறது...' : '⚡ Scanning demo fingerprint (College Simulation)...';
      statusBadge.style.color = 'var(--accent-cyan)';
    }

    if (this.biometricSimTimer) clearTimeout(this.biometricSimTimer);

    this.biometricSimTimer = setTimeout(() => {
      window.AcousticHaptic.playBiometricSuccess();
      window.TTSVoice.speakBiometricSuccess();

      if (statusBadge) {
        statusBadge.textContent = isTa ? '✔ மாதிரி கைரேகை அங்கீகரிக்கப்பட்டது!' : '✔ Demo Biometric Verified!';
        statusBadge.style.color = 'var(--accent-green)';
      }

      this.biometricSimTimer = setTimeout(() => {
        this.executePaymentAfterAuth();
      }, 500);
    }, 1100);
  }

  // Alias for backward compatibility
  triggerBiometricAuth() {
    return this.authenticatePaymentBiometric();
  }

  emergencyStop() {
    clearTimeout(this.scanTimeout);
    if (this.smsSimTimer) {
      clearTimeout(this.smsSimTimer);
      this.smsSimTimer = null;
    }
    if (this.biometricSimTimer) {
      clearTimeout(this.biometricSimTimer);
      this.biometricSimTimer = null;
    }
    this.stopCamera();
    this.closeBeneficiaryModal();
    this.cancelDeleteBeneficiary(true);
    window.AcousticHaptic.playEmergencyStop();
    this.cancelPayment();
    this.currentLinkingStep = 1;
    this.goHome();
    window.TTSVoice.speakEmergencyStop();
  }

  // Reads dynamic transactions from state
  speakTransactionHistoryVoice() {
    const recent = this.transactions.slice(0, 3);
    window.AcousticHaptic.playClick();
    window.TTSVoice.speakTransactionHistory(recent);
    this.openHistoryView();
  }

  searchTransactionsVoice(query) {
    window.AcousticHaptic.playFocus();
    const q = query.toLowerCase().trim();
    const matches = this.transactions.filter(t => 
      t.merchant.toLowerCase().includes(q) || (t.upiId && t.upiId.toLowerCase().includes(q))
    );

    const count = matches.length;
    let details = '';
    if (count > 0) {
      details = `Latest: ₹${matches[0].amount} to ${matches[0].merchant}.`;
    } else {
      details = 'No past transactions match that name.';
    }

    window.TTSVoice.speakSearchResults(query, count, details);
  }

  // Real-time Application State Queries for Dex Conversational Assistant
  getCurrentBalance() {
    return this.balance !== undefined ? this.balance : 24850.00;
  }

  getCurrentBalanceFormatted() {
    return this.getCurrentBalance().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  revealBalance() {
    this.checkBalanceVoice();
  }

  getMonthlyExpenseTotal() {
    if (!this.transactions || this.transactions.length === 0) {
      return 5350;
    }
    const sum = this.transactions
      .filter(t => t.type === 'debit' || !t.type)
      .reduce((acc, t) => acc + Math.abs(parseFloat(t.amount) || 0), 0);
    return sum > 0 ? sum : 5350;
  }

  getMonthlyExpenseFormatted() {
    return this.getMonthlyExpenseTotal().toLocaleString('en-IN');
  }

  getDueBillsList() {
    return [
      { id: 'elec', category: 'Electricity', provider: 'TNEB Electricity Bill', amount: 840, status: 'Due', dueDate: '25 Sep' },
      { id: 'mob', category: 'Mobile Recharge', provider: 'Airtel 5G Monthly Plan', amount: 299, status: 'Due', dueDate: '22 Sep' },
      { id: 'dth', category: 'DTH', provider: 'Tata Play HD Super', amount: 350, status: 'Paid', dueDate: '15 Sep' },
      { id: 'fastag', category: 'FASTag', provider: 'SBI FASTag Toll Pass', amount: 500, status: 'Paid', dueDate: '10 Sep' },
      { id: 'gas', category: 'Gas', provider: 'Indane Gas Cylinder', amount: 912, status: 'Paid', dueDate: '05 Sep' },
      { id: 'water', category: 'Water', provider: 'Chennai Metro Water', amount: 180, status: 'Paid', dueDate: '01 Sep' }
    ];
  }

  getDueBillsTamilSummary() {
    const dues = this.getDueBillsList().filter(b => b.status === 'Due');
    if (dues.length === 0) return 'நிலுவையில் உள்ள கட்டணங்கள் ஏதுமில்லை, அனைத்தும் செலுத்தப்பட்டுவிட்டன';
    return 'ஒரு electricity bill மற்றும் ஒரு mobile recharge due இருக்கு';
  }

  getDueBillsEnglishSummary() {
    const dues = this.getDueBillsList().filter(b => b.status === 'Due');
    if (dues.length === 0) return 'all utility bills are paid, no pending dues';
    return 'you have an electricity bill and a mobile recharge due';
  }

  getLastTransactionTamil() {
    if (this.transactions && this.transactions.length > 0) {
      const top = this.transactions[0];
      return `${top.merchant}-க்கு ₹${top.amount}`;
    }
    return 'Kumar Groceries-க்கு ₹450';
  }

  getLastTransactionEnglish() {
    if (this.transactions && this.transactions.length > 0) {
      const top = this.transactions[0];
      return `₹${top.amount} to ${top.merchant}`;
    }
    return '₹450 to Kumar Groceries';
  }

  scrollToBillsSection() {
    const billsSec = document.getElementById('home-bills-section') || document.querySelector('.bills-shortcuts-grid');
    if (billsSec) {
      billsSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      billsSec.classList.add('highlight-section');
      setTimeout(() => billsSec.classList.remove('highlight-section'), 2000);
    }
  }

  showBillDetails(category = 'Electricity') {
    const bill = this.getDueBillsList().find(b => b.category.toLowerCase().includes(category.toLowerCase())) || this.getDueBillsList()[0];
    const isTa = window.I18n && window.I18n.currentLang === 'ta';
    alert(`${isTa ? 'கட்டண விவரங்கள்' : 'Bill Details'}:\n` +
          `சேவை: ${bill.provider}\n` +
          `தொகை: ₹${bill.amount}\n` +
          `நிலை: ${bill.status}\n` +
          `கடைசி தேதி: ${bill.dueDate}`);
  }

  initiateBillPayment(category = 'Electricity', amount = 840) {
    const bill = this.getDueBillsList().find(b => b.category.toLowerCase().includes(category.toLowerCase())) || {
      provider: `${category} Bill`,
      amount: amount
    };
    this.openVoicePaymentConfirmation(bill.provider, bill.amount);
  }

  // =========================================================================
  // DEX CONVERSATIONAL ACTION / FUNCTION LAYER (Section 9)
  // Deterministic source of truth for Dex assistant queries & actions
  // =========================================================================

  get_balance() {
    return this.getCurrentBalanceFormatted();
  }

  get_monthly_expenses(month = 'current') {
    return month === 'last' ? 4750 : this.getMonthlyExpenseTotal();
  }

  get_category_expense(month = 'current', category = 'food') {
    const table = {
      food: { name: 'Food & Groceries', current: 2840, last: 2100 },
      medical: { name: 'Medical & Pharmacy', current: 850, last: 600 },
      transport: { name: 'Transport & Travel', current: 620, last: 950 },
      bills: { name: 'Bills & Utilities', current: 1040, last: 1100 }
    };
    const key = category.toLowerCase().includes('food') || category.toLowerCase().includes('groc') ? 'food' :
                category.toLowerCase().includes('med') || category.toLowerCase().includes('pharm') ? 'medical' :
                category.toLowerCase().includes('trans') || category.toLowerCase().includes('metro') ? 'transport' : 'bills';
    return table[key] || table.food;
  }

  get_last_transaction() {
    return this.transactions && this.transactions.length > 0 ? this.transactions[0] : { merchant: 'Kumar Groceries', amount: 450 };
  }

  get_due_bills() {
    return this.getDueBillsList().filter(b => b.status === 'Due');
  }

  open_scan() {
    this.openQrScanner();
  }

  open_bills() {
    this.scrollToBillsSection();
  }

  open_bill_details(type = 'Electricity') {
    this.showBillDetails(type);
  }

  find_beneficiary(name) {
    const q = (name || '').toLowerCase().trim();
    return this.contacts.find(c => c.name.toLowerCase().includes(q)) || { name: name || 'Kumar', upiId: `${name.toLowerCase()}@okhdfcbank` };
  }

  prepare_payment(recipient = 'Kumar', amount = 500) {
    this.openVoicePaymentConfirmation(recipient, amount);
  }

  cancel_pending_action() {
    if (this.currentView === 'view-confirm') {
      this.switchView('view-home');
    }
    const modal = document.getElementById('fraud-guard-modal');
    if (modal) modal.classList.remove('active');
  }

  navigate_back() {
    this.switchView('view-home');
  }

  openVoicePaymentConfirmation(recipient = 'Kumar', amount = 500) {
    this.merchant = {
      name: recipient,
      upiId: `${recipient.toLowerCase().replace(/[^a-z0-9]/g, '')}@okhdfcbank`,
      verified: true
    };
    this.amount = String(amount || 500);
    this.enteredPin = '';
    this.updateMerchantDisplay();
    this.switchView('view-confirm');
    window.AcousticHaptic.playFocus();
  }

  triggerSuspiciousQRWarning() {
    window.AcousticHaptic.playWarning();
    const modal = document.getElementById('fraud-guard-modal');
    const titleEl = document.getElementById('fraud-title');
    const msg = document.getElementById('fraud-warning-msg');
    const isTa = window.TTSVoice && window.TTSVoice.currentLang === 'ta';

    if (titleEl) {
      titleEl.textContent = isTa ? '⚠️ சந்தேக க்யூஆர் எச்சரிக்கை' : '⚠️ Suspicious QR Alert';
    }
    if (msg) {
      msg.textContent = isTa
        ? 'பாதுகாப்பு எச்சரிக்கை! சந்தேகத்திற்குரிய அல்லது சரிபார்க்கப்படாத க்யூஆர் குறியீடு கண்டறியப்பட்டது. பணம் செலுத்த வேண்டாம்.'
        : 'Security Alert: Suspicious or unverified QR code detected. Proceeding may cause financial loss.';
    }
    if (modal) modal.classList.add('active');
    window.TTSVoice.speakSuspiciousQRWarning();
  }

  linkBankAccountVoice() {
    window.AcousticHaptic.playSuccess();
    this.startGuidedBankLinking(1);
  }

  // =========================================================================
  // GUIDED BANK ACCOUNT LINKING & ACCOUNT MANAGEMENT (SAFE DEMO)
  // =========================================================================
  getMockBankDirectory() {
    return [
      {
        id: 'sbi',
        name: 'State Bank of India',
        code: 'SBI',
        icon: '🏛️',
        themeColor: '#1e40af',
        aliases: ['sbi', 'state bank', 'state bank of india', 'எஸ்பிஐ', 'ஸ்டேட் பாங்க்', 'ஸ்டேட் பேங்க்'],
        mockAccounts: [
          { accType: 'Savings A/c', maskedAcc: '•••• 4821', balance: 24850.00 },
          { accType: 'Current A/c', maskedAcc: '•••• 9102', balance: 5000.00 }
        ]
      },
      {
        id: 'hdfc',
        name: 'HDFC Bank',
        code: 'HDFC',
        icon: '🏦',
        themeColor: '#004c8f',
        aliases: ['hdfc', 'hdfc bank', 'ஹெச்டிஎஃப்சி', 'ஹெச்டிஎப்சி', 'ஹெச் டி எஃப் சி'],
        mockAccounts: [
          { accType: 'Savings A/c', maskedAcc: '•••• 7294', balance: 15420.00 }
        ]
      },
      {
        id: 'icici',
        name: 'ICICI Bank',
        code: 'ICICI',
        icon: '🏢',
        themeColor: '#f97316',
        aliases: ['icici', 'icici bank', 'ஐசிஐசிஐ', 'ஐ சி ஐ சி ஐ'],
        mockAccounts: [
          { accType: 'Savings A/c', maskedAcc: '•••• 3150', balance: 32100.00 }
        ]
      },
      {
        id: 'indian_bank',
        name: 'Indian Bank',
        code: 'Indian Bank',
        icon: '🇮🇳',
        themeColor: '#059669',
        aliases: ['indian bank', 'indian', 'இந்தியன் வங்கி', 'இந்தியன் பேங்க்'],
        mockAccounts: [
          { accType: 'Savings A/c', maskedAcc: '•••• 6401', balance: 18250.00 }
        ]
      },
      {
        id: 'canara_bank',
        name: 'Canara Bank',
        code: 'Canara',
        icon: '🪪',
        themeColor: '#0284c7',
        aliases: ['canara bank', 'canara', 'கனரா வங்கி', 'கனரா பேங்க்'],
        mockAccounts: [
          { accType: 'Savings A/c', maskedAcc: '•••• 8852', balance: 9340.00 }
        ]
      }
    ];
  }

  getDefaultBanks() {
    return [
      {
        id: 'sbi',
        name: 'State Bank of India',
        code: 'SBI',
        icon: '🏛️',
        accType: 'Savings A/c',
        maskedAcc: '•••• 4821',
        isPrimary: true,
        balance: 24850.00
      }
    ];
  }

  initBankStorage() {
    const savedBanks = localStorage.getItem('oneability_linked_banks');
    if (savedBanks) {
      try {
        this.linkedBanks = JSON.parse(savedBanks);
      } catch (e) {
        this.linkedBanks = this.getDefaultBanks();
      }
    } else {
      this.linkedBanks = this.getDefaultBanks();
      if (this.balance && this.linkedBanks[0]) {
        this.linkedBanks[0].balance = this.balance;
      }
      localStorage.setItem('oneability_linked_banks', JSON.stringify(this.linkedBanks));
    }

    // Ensure at least one primary bank exists
    let primary = this.getPrimaryAccount();
    if (!primary && this.linkedBanks.length > 0) {
      this.linkedBanks[0].isPrimary = true;
      primary = this.linkedBanks[0];
      this.saveLinkedBanks();
    }

    if (primary) {
      this.balance = primary.balance;
      localStorage.setItem('oneability_balance', this.balance.toString());
    }

    this.updateHomeBankCard();
    this.renderLinkedBanksList();
  }

  saveLinkedBanks() {
    localStorage.setItem('oneability_linked_banks', JSON.stringify(this.linkedBanks));
  }

  getPrimaryAccount() {
    return (this.linkedBanks && this.linkedBanks.find(b => b.isPrimary)) || (this.linkedBanks && this.linkedBanks[0]) || null;
  }

  updateHomeBankCard() {
    const primary = this.getPrimaryAccount();
    if (!primary) return;

    const logoEl = document.getElementById('home-bank-logo');
    const nameEl = document.getElementById('home-bank-name');
    const accEl = document.getElementById('home-bank-acc');
    const chipEl = document.getElementById('home-bank-chip');
    const confirmBankEl = document.getElementById('confirm-debited-bank-text');
    const pinBankEl = document.getElementById('pin-debited-bank-text');
    const profileBtnEl = document.getElementById('profile-bank-btn');
    const profileStatusEl = document.getElementById('profile-bank-status');

    if (logoEl) logoEl.textContent = primary.icon || '🏛️';
    if (nameEl) nameEl.textContent = primary.name;
    if (accEl) accEl.textContent = `${primary.accType || 'Savings A/c'} ${primary.maskedAcc}`;
    if (chipEl) chipEl.textContent = primary.isPrimary ? 'Primary' : 'Linked';

    const bankShort = `${primary.name} (${primary.maskedAcc.replace('•••• ', '•• ')})`;
    if (confirmBankEl) confirmBankEl.textContent = bankShort;
    if (pinBankEl) pinBankEl.textContent = bankShort;
    if (profileBtnEl) profileBtnEl.textContent = `${primary.icon || '🏛️'} ${primary.code || primary.name} Linked`;
    if (profileStatusEl) profileStatusEl.textContent = `● Active • ${primary.code || primary.name} Account Linked`;
  }

  renderLinkedBanksList() {
    const container = document.getElementById('linked-banks-list');
    if (!container || typeof document.createElement !== 'function') return;

    container.innerHTML = '';
    if (!this.linkedBanks || this.linkedBanks.length === 0) {
      container.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem; background: var(--bg-surface-elevated); border-radius: 14px;">
          No bank accounts linked yet. Click <strong>+ Link Bank</strong> to connect an account.
        </div>
      `;
      return;
    }

    this.linkedBanks.forEach(bank => {
      const card = document.createElement('div');
      card.className = `linked-bank-mgmt-card ${bank.isPrimary ? 'is-primary' : ''}`;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `${bank.name} ${bank.accType || 'Savings A/c'} ending in ${bank.maskedAcc.replace('•••• ', '')}, Balance: ₹${bank.balance.toFixed(2)}, ${bank.isPrimary ? 'Primary' : 'Secondary'}`);

      const formattedBal = `₹${bank.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      card.innerHTML = `
        <div class="mgmt-card-header">
          <div class="mgmt-bank-identity">
            <div class="bank-logo-badge" aria-hidden="true">${bank.icon || '🏦'}</div>
            <div class="mgmt-bank-info">
              <span class="mgmt-bank-name">${bank.name}</span>
              <span class="mgmt-bank-acc">${bank.accType || 'Savings A/c'} ${bank.maskedAcc}</span>
            </div>
          </div>
          ${bank.isPrimary ? '<span class="primary-chip">Primary</span>' : ''}
        </div>
        <div class="mgmt-card-actions">
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Balance</span>
            <span class="mgmt-balance-text">${formattedBal}</span>
          </div>
          <div class="mgmt-btn-group">
            <button class="mgmt-action-btn primary-btn" onclick="window.PaySimulator.checkBankBalance('${bank.id}')" aria-label="Check and speak balance for ${bank.name}">
              🔊 Balance
            </button>
            ${!bank.isPrimary ? `
              <button class="mgmt-action-btn primary-btn" onclick="window.PaySimulator.setPrimaryAccount('${bank.id}')" aria-label="Set ${bank.name} as primary account">
                Set Primary
              </button>
            ` : ''}
            ${this.linkedBanks.length > 1 ? `
              <button class="mgmt-action-btn danger-btn" onclick="window.PaySimulator.removeLinkedAccount('${bank.id}')" aria-label="Remove ${bank.name} account">
                Remove
              </button>
            ` : ''}
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  setPrimaryAccount(bankId) {
    const bank = this.linkedBanks.find(b => b.id === bankId);
    if (!bank) return;

    this.linkedBanks.forEach(b => {
      b.isPrimary = (b.id === bankId);
    });

    this.balance = bank.balance;
    this.saveLinkedBanks();
    localStorage.setItem('oneability_balance', this.balance.toString());

    this.updateBalanceUI(null);
    this.updateHomeBankCard();
    this.renderLinkedBanksList();

    window.AcousticHaptic.playSuccess();
    window.TTSVoice.speakPrimaryAccountUpdated(bank.name);
  }

  removeLinkedAccount(bankId) {
    if (this.linkedBanks.length <= 1) {
      window.AcousticHaptic.playWarning();
      window.TTSVoice.speak({
        ta: 'குறைந்தது ஒரு வங்கிக் கணக்கு இணைக்கப்பட்டிருக்க வேண்டும்.',
        en: 'Cannot remove account. At least one linked bank account is required.'
      }, 'assertive');
      return;
    }

    const removedIndex = this.linkedBanks.findIndex(b => b.id === bankId);
    if (removedIndex === -1) return;

    const removedBank = this.linkedBanks[removedIndex];
    const wasPrimary = removedBank.isPrimary;

    this.linkedBanks.splice(removedIndex, 1);

    if (wasPrimary && this.linkedBanks.length > 0) {
      this.linkedBanks[0].isPrimary = true;
      this.balance = this.linkedBanks[0].balance;
      localStorage.setItem('oneability_balance', this.balance.toString());
    }

    this.saveLinkedBanks();
    this.updateBalanceUI(null);
    this.updateHomeBankCard();
    this.renderLinkedBanksList();

    window.AcousticHaptic.playClick();
    window.TTSVoice.speakAccountRemoved(removedBank.name);
  }

  checkBankBalance(bankId) {
    const bank = this.linkedBanks.find(b => b.id === bankId);
    if (!bank) return;

    const formattedBal = `₹${bank.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    window.AcousticHaptic.playClick();
    window.TTSVoice.speakSpecificBankBalance(bank.name, formattedBal);
  }

  // Guided 6-Step Linking Flow
  startGuidedBankLinking(step = 1) {
    window.AcousticHaptic.playFocus();
    if (this.smsSimTimer) {
      clearTimeout(this.smsSimTimer);
      this.smsSimTimer = null;
    }

    this.selectedBankForLinking = this.selectedBankForLinking || this.mockBanks[0];
    this.selectedDiscoveredAccount = this.selectedBankForLinking.mockAccounts[0];

    this.switchView('view-bank-linking');
    this.goToLinkingStep(step);
  }

  selectBankForLinking(bankId) {
    const bank = this.mockBanks.find(b => b.id === bankId);
    if (!bank) return;

    this.selectedBankForLinking = bank;
    this.selectedDiscoveredAccount = bank.mockAccounts[0];

    document.querySelectorAll('.bank-card-option').forEach(btn => {
      const isMatch = btn.getAttribute('data-bank-id') === bankId;
      btn.classList.toggle('selected', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    window.AcousticHaptic.playClick();
    window.TTSVoice.speakBankSelected(bank.name);

    setTimeout(() => {
      this.goToLinkingStep(2);
    }, 450);
  }

  goToLinkingStep(step) {
    if (this.smsSimTimer) {
      clearTimeout(this.smsSimTimer);
      this.smsSimTimer = null;
    }

    this.currentLinkingStep = step;

    // Update progress bar
    const progressFill = document.getElementById('wizard-progress-fill');
    const stepIndicator = document.getElementById('wizard-step-indicator');
    const stepDesc = document.getElementById('wizard-step-desc');
    const progressContainer = document.getElementById('wizard-progress-bar');

    const stepNames = {
      1: 'Choose Bank',
      2: 'Confirm Mobile',
      3: 'SMS Verification',
      4: 'Discovered Accounts',
      5: 'Primary Selection',
      6: 'Linked Successfully'
    };

    const pct = Math.round((step / 6) * 100);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (stepIndicator) stepIndicator.textContent = `Step ${step} of 6`;
    if (stepDesc) stepDesc.textContent = stepNames[step] || '';
    if (progressContainer) {
      progressContainer.setAttribute('aria-valuenow', step.toString());
      progressContainer.setAttribute('aria-label', `Step ${step} of 6: ${stepNames[step]}`);
    }

    // Toggle active panel
    document.querySelectorAll('.linking-step-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`linking-step-${step}`);
    if (activePanel) activePanel.classList.add('active');

    window.AcousticHaptic.playFocus();

    const bank = this.selectedBankForLinking || this.mockBanks[0];

    if (step === 1) {
      window.TTSVoice.speakBankLinkingStep(1);
    } else if (step === 2) {
      const bankNameEl = document.getElementById('step2-selected-bank-name');
      if (bankNameEl) bankNameEl.textContent = bank.name;
      window.TTSVoice.speakBankLinkingStep(2, bank.name);
    } else if (step === 3) {
      this.runMockSmsVerification();
    } else if (step === 4) {
      this.renderDiscoveredAccounts();
      const masked = this.selectedDiscoveredAccount ? this.selectedDiscoveredAccount.maskedAcc.replace('•••• ', '') : '4821';
      window.TTSVoice.speakBankLinkingStep(4, bank.name, masked);
    } else if (step === 5) {
      const logoEl = document.getElementById('step5-bank-logo');
      const nameEl = document.getElementById('step5-bank-name');
      const accEl = document.getElementById('step5-acc-num');
      if (logoEl) logoEl.textContent = bank.icon;
      if (nameEl) nameEl.textContent = bank.name;
      if (accEl && this.selectedDiscoveredAccount) {
        accEl.textContent = `${this.selectedDiscoveredAccount.accType} ${this.selectedDiscoveredAccount.maskedAcc}`;
      }
      window.TTSVoice.speakBankLinkingStep(5, bank.name);
    } else if (step === 6) {
      const logoEl = document.getElementById('step6-bank-logo');
      const nameEl = document.getElementById('step6-bank-name');
      const accEl = document.getElementById('step6-acc-number');
      const subEl = document.getElementById('step6-success-subtitle');
      const balEl = document.getElementById('step6-balance-display');
      const chipEl = document.getElementById('step6-primary-chip');

      if (logoEl) logoEl.textContent = bank.icon;
      if (nameEl) nameEl.textContent = bank.name;
      if (accEl && this.selectedDiscoveredAccount) {
        accEl.textContent = `${this.selectedDiscoveredAccount.accType} ${this.selectedDiscoveredAccount.maskedAcc}`;
      }
      if (subEl) subEl.textContent = `Your ${bank.name} account is now linked and active.`;
      if (balEl && this.selectedDiscoveredAccount) {
        balEl.textContent = `₹${this.selectedDiscoveredAccount.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      }
      const isPrimary = this.getPrimaryAccount() && this.getPrimaryAccount().id === bank.id;
      if (chipEl) chipEl.textContent = isPrimary ? 'Primary' : 'Linked';

      window.AcousticHaptic.playSuccess();
      window.TTSVoice.speakBankLinkingStep(6, bank.name);
    }
  }

  confirmMobileStep() {
    window.AcousticHaptic.playClick();
    this.goToLinkingStep(3);
  }

  runMockSmsVerification() {
    const stageTitle = document.getElementById('sms-stage-title');
    const stageDesc = document.getElementById('sms-stage-desc');
    const progressBar = document.getElementById('sms-progress-bar-fill');
    const pulseIcon = document.getElementById('sms-sim-icon');

    if (stageTitle) stageTitle.textContent = 'Sending Device Binding SMS...';
    if (stageDesc) stageDesc.textContent = 'Carrier handshake in progress. Safe mock verification.';
    if (progressBar) progressBar.style.width = '30%';
    if (pulseIcon) pulseIcon.textContent = '📨';

    window.TTSVoice.speakBankLinkingStep(3);

    this.smsSimTimer = setTimeout(() => {
      if (stageTitle) stageTitle.textContent = 'Carrier Delivery Confirmed!';
      if (stageDesc) stageDesc.textContent = 'Cryptographic token verified by simulated bank gateway.';
      if (progressBar) progressBar.style.width = '80%';
      if (pulseIcon) pulseIcon.textContent = '📡';
      window.AcousticHaptic.playClick();

      this.smsSimTimer = setTimeout(() => {
        if (stageTitle) stageTitle.textContent = 'Device Bound Successfully (Demo Mode)';
        if (stageDesc) stageDesc.textContent = 'Retrieving accounts matching your verified mobile...';
        if (progressBar) progressBar.style.width = '100%';
        if (pulseIcon) pulseIcon.textContent = '✅';
        window.AcousticHaptic.playSuccess();

        this.smsSimTimer = setTimeout(() => {
          this.goToLinkingStep(4);
        }, 800);
      }, 900);
    }, 1100);
  }

  renderDiscoveredAccounts() {
    const container = document.getElementById('discovered-accounts-list');
    if (!container || typeof document.createElement !== 'function') return;

    container.innerHTML = '';
    const bank = this.selectedBankForLinking || this.mockBanks[0];
    const accounts = bank.mockAccounts || [];

    accounts.forEach((acc, idx) => {
      const card = document.createElement('button');
      const isSelected = idx === 0;
      card.className = `discovered-acc-card ${isSelected ? 'selected' : ''}`;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      card.setAttribute('aria-label', `${acc.accType} ending in ${acc.maskedAcc.replace('•••• ', '')}, Balance ₹${acc.balance}`);

      card.onclick = () => {
        this.selectDiscoveredAccount(idx);
      };

      card.innerHTML = `
        <div class="acc-card-left">
          <div class="acc-card-icon" aria-hidden="true">${bank.icon}</div>
          <div class="acc-card-details">
            <span class="acc-card-type">${acc.accType}</span>
            <span class="acc-card-number">${acc.maskedAcc}</span>
          </div>
        </div>
        <div class="acc-card-balance">
          ₹${acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      `;
      container.appendChild(card);
    });

    this.selectedDiscoveredAccount = accounts[0];
  }

  selectDiscoveredAccount(idx) {
    const bank = this.selectedBankForLinking || this.mockBanks[0];
    const accounts = bank.mockAccounts || [];
    if (!accounts[idx]) return;

    this.selectedDiscoveredAccount = accounts[idx];

    const cards = document.querySelectorAll('.discovered-acc-card');
    cards.forEach((c, i) => {
      c.classList.toggle('selected', i === idx);
      c.setAttribute('aria-checked', i === idx ? 'true' : 'false');
    });

    window.AcousticHaptic.playClick();
  }

  proceedToPrimaryStep() {
    window.AcousticHaptic.playClick();
    this.goToLinkingStep(5);
  }

  finalizeGuidedLinking() {
    const bank = this.selectedBankForLinking || this.mockBanks[0];
    const acc = this.selectedDiscoveredAccount || bank.mockAccounts[0];

    const primaryRadio = document.querySelector('input[name="primary-pref"]:checked');
    const isPrimary = (primaryRadio && primaryRadio.value === 'yes') || this.linkedBanks.length === 0;

    const existingIndex = this.linkedBanks.findIndex(b => b.id === bank.id);
    if (existingIndex >= 0) {
      this.linkedBanks[existingIndex].accType = acc.accType;
      this.linkedBanks[existingIndex].maskedAcc = acc.maskedAcc;
      this.linkedBanks[existingIndex].balance = acc.balance;
      if (isPrimary) {
        this.linkedBanks.forEach(b => b.isPrimary = false);
        this.linkedBanks[existingIndex].isPrimary = true;
      }
    } else {
      if (isPrimary) {
        this.linkedBanks.forEach(b => b.isPrimary = false);
      }
      this.linkedBanks.push({
        id: bank.id,
        name: bank.name,
        code: bank.code,
        icon: bank.icon,
        accType: acc.accType,
        maskedAcc: acc.maskedAcc,
        isPrimary: isPrimary,
        balance: acc.balance
      });
    }

    if (isPrimary) {
      this.balance = acc.balance;
      localStorage.setItem('oneability_balance', this.balance.toString());
    }

    this.saveLinkedBanks();
    this.updateBalanceUI(null);
    this.updateHomeBankCard();
    this.renderLinkedBanksList();

    this.goToLinkingStep(6);
  }

  cancelBankLinking() {
    if (this.smsSimTimer) {
      clearTimeout(this.smsSimTimer);
      this.smsSimTimer = null;
    }
    window.AcousticHaptic.playClick();
    this.currentLinkingStep = 1;
    this.switchView(this.previousView && this.previousView !== 'view-bank-linking' ? this.previousView : 'view-home');
    window.TTSVoice.speak({
      ta: 'வங்கி இணைப்பு செயல்முறை ரத்து செய்யப்பட்டது.',
      en: 'Bank linking cancelled.'
    });
  }

  voiceRechargeBill(serviceType = 'Mobile Recharge', defaultAmount = '299') {
    window.AcousticHaptic.playClick();
    this.merchant.name = `${serviceType} Service`;
    this.merchant.upiId = 'bills@oneability';
    this.merchant.verified = true;
    this.amount = defaultAmount;
    this.updateMerchantDisplay();
    window.TTSVoice.speak({
      ta: `${serviceType} தேர்ந்தெடுக்கப்பட்டது. தொகை ₹${defaultAmount}. உறுதி செய்ய தொடரவும்.`,
      en: `${serviceType} selected. Amount set to ₹${defaultAmount}. Proceed to confirm.`
    });
    this.switchView('view-confirm');
  }

  // ==========================================
  // BENEFICIARY DIRECTORY & MANAGEMENT METHODS
  // ==========================================

  getDefaultBeneficiaries() {
    return [
      {
        id: 'ben-1',
        name: 'Kumar Groceries',
        upiId: 'kumar.store@okhdfcbank',
        nickname: 'Kumar',
        verified: true,
        favorite: true,
        lastPaidAt: '2026-09-18T10:15:00Z',
        totalMockPayments: 3,
        aliases: ['kumar', 'kumar groceries', 'groceries', 'மளிகை', 'குமார்', 'குமாருக்கு']
      },
      {
        id: 'ben-2',
        name: 'Priya Medicals',
        upiId: 'priya.pharmacy@okaxis',
        nickname: 'Priya',
        verified: true,
        favorite: true,
        lastPaidAt: '2026-09-17T18:40:00Z',
        totalMockPayments: 2,
        aliases: ['priya', 'priya medicals', 'pharmacy', 'medicals', 'மருந்தகம்', 'பிரியா', 'பிரியாவுக்கு']
      },
      {
        id: 'ben-3',
        name: 'Metro Transport',
        upiId: 'metro.ride@icici',
        nickname: 'Metro',
        verified: true,
        favorite: false,
        lastPaidAt: '2026-09-16T08:30:00Z',
        totalMockPayments: 1,
        aliases: ['metro', 'metro transport', 'transport', 'மெட்ரோ', 'மெட்ரோவுக்கு']
      },
      {
        id: 'ben-4',
        name: 'Ravi Milk Depot',
        upiId: 'ravi.milk@sbi',
        nickname: 'Ravi',
        verified: true,
        favorite: false,
        lastPaidAt: null,
        totalMockPayments: 0,
        aliases: ['ravi', 'ravi milk', 'milk depot', 'பால்', 'ரவி', 'ரவிக்கு']
      },
      {
        id: 'ben-5',
        name: 'Anand Kumar',
        upiId: 'anand@hdfc',
        nickname: 'Anand',
        verified: true,
        favorite: true,
        lastPaidAt: '2026-09-15T14:20:00Z',
        totalMockPayments: 4,
        aliases: ['anand', 'anand kumar', 'ஆனந்த்', 'ஆனந்துக்கு']
      }
    ];
  }

  initBeneficiaryStorage() {
    try {
      const stored = localStorage.getItem('oneability_beneficiaries');
      if (stored) {
        this.beneficiaries = JSON.parse(stored);
      } else {
        this.beneficiaries = this.getDefaultBeneficiaries();
        this.saveBeneficiaries();
      }
    } catch (e) {
      console.warn('Beneficiary storage load failed:', e);
      this.beneficiaries = this.getDefaultBeneficiaries();
    }
  }

  saveBeneficiaries() {
    try {
      localStorage.setItem('oneability_beneficiaries', JSON.stringify(this.beneficiaries));
    } catch (e) {
      console.error('Error saving beneficiaries to localStorage:', e);
    }
  }

  renderHomeQuickContacts() {
    const strip = document.getElementById('home-quick-contacts-strip');
    if (!strip) return;

    // Favor marked favorites first, show up to 5 contacts
    let list = this.beneficiaries.filter(b => b.favorite);
    if (list.length < 5) {
      const others = this.beneficiaries.filter(b => !b.favorite);
      list = list.concat(others).slice(0, 5);
    } else {
      list = list.slice(0, 5);
    }

    const colors = [
      { border: 'rgba(0, 229, 255, 0.4)', text: 'var(--accent-cyan)' },
      { border: 'rgba(16, 185, 129, 0.4)', text: 'var(--accent-green)' },
      { border: 'rgba(139, 92, 246, 0.4)', text: 'var(--accent-purple)' },
      { border: 'rgba(245, 158, 11, 0.4)', text: 'var(--accent-amber)' },
      { border: 'rgba(59, 130, 246, 0.4)', text: '#38bdf8' }
    ];

    strip.innerHTML = list.map((b, idx) => {
      const color = colors[idx % colors.length];
      const initials = (b.nickname || b.name).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const safeName = this.escapeHtml(b.name);
      const safeUpi = this.escapeHtml(b.upiId);
      const displayName = this.escapeHtml(b.nickname || b.name.split(' ')[0]);
      return `
        <div class="contact-bubble-item" data-id="${b.id}" data-name="${safeName}" data-upi="${safeUpi}" role="listitem" tabindex="0" aria-label="Pay ${safeName}">
          <div class="contact-avatar-round" style="border-color: ${color.border}; color: ${color.text};">
            ${initials}
          </div>
          <span class="contact-avatar-name">${displayName}</span>
        </div>
      `;
    }).join('');

    // Re-attach keyboard & click listeners
    strip.querySelectorAll('.contact-bubble-item').forEach(item => {
      const trigger = () => {
        const name = item.dataset.name;
        const upi = item.dataset.upi;
        this.selectContact(name, upi);
      };
      item.onclick = trigger;
      item.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger();
        }
      };
    });
  }

  renderBeneficiariesList(filter = null, query = null) {
    if (filter !== null) {
      this.activeBeneficiaryFilter = filter;
    }

    const allBtn = document.getElementById('filter-ben-all');
    const favBtn = document.getElementById('filter-ben-fav');
    const allLabel = document.getElementById('filter-ben-all-label');

    if (allLabel) {
      allLabel.textContent = `All (${this.beneficiaries.length})`;
    }

    if (allBtn && favBtn) {
      if (this.activeBeneficiaryFilter === 'fav') {
        allBtn.classList.remove('active');
        allBtn.setAttribute('aria-selected', 'false');
        favBtn.classList.add('active');
        favBtn.setAttribute('aria-selected', 'true');
      } else {
        allBtn.classList.add('active');
        allBtn.setAttribute('aria-selected', 'true');
        favBtn.classList.remove('active');
        favBtn.setAttribute('aria-selected', 'false');
      }
    }

    const container = document.getElementById('beneficiary-list-container');
    if (!container) return;

    // Filter items
    let list = [...this.beneficiaries];
    if (this.activeBeneficiaryFilter === 'fav') {
      list = list.filter(b => b.favorite);
    }

    const searchInput = document.getElementById('beneficiary-search-input');
    const q = (query !== null ? query : (searchInput ? searchInput.value : '')).toLowerCase().trim();

    if (q) {
      list = list.filter(b => {
        const nameMatch = b.name && b.name.toLowerCase().includes(q);
        const upiMatch = b.upiId && b.upiId.toLowerCase().includes(q);
        const nickMatch = b.nickname && b.nickname.toLowerCase().includes(q);
        const aliasMatch = b.aliases && b.aliases.some(a => a.toLowerCase().includes(q));
        return nameMatch || upiMatch || nickMatch || aliasMatch;
      });
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="beneficiary-empty-state" style="text-align: center; padding: 30px 16px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">👥</div>
          <div style="font-weight: 700; color: #cbd5e1; font-size: 1rem;">No beneficiaries found</div>
          <p style="font-size: 0.82rem; margin-top: 4px;">Try searching for a different name, or tap "+ Add" to save a new contact.</p>
        </div>
      `;
      return;
    }

    const colors = [
      { border: 'rgba(0, 229, 255, 0.4)', text: 'var(--accent-cyan)' },
      { border: 'rgba(16, 185, 129, 0.4)', text: 'var(--accent-green)' },
      { border: 'rgba(139, 92, 246, 0.4)', text: 'var(--accent-purple)' },
      { border: 'rgba(245, 158, 11, 0.4)', text: 'var(--accent-amber)' },
      { border: 'rgba(59, 130, 246, 0.4)', text: '#38bdf8' }
    ];

    container.innerHTML = list.map((b, idx) => {
      const color = colors[idx % colors.length];
      const initials = (b.nickname || b.name).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const safeName = this.escapeHtml(b.name);
      const safeUpi = this.escapeHtml(b.upiId);
      const safeNick = b.nickname ? this.escapeHtml(b.nickname) : '';
      const verifiedBadge = b.verified
        ? '<span class="ben-verified-badge" title="Verified UPI Payee">✓ Verified</span>'
        : '<span class="ben-unverified-badge" title="Custom unverified payee">⚠️ Unverified</span>';
      
      const starIcon = b.favorite ? '⭐' : '☆';
      const starActive = b.favorite ? 'active' : '';

      let paymentMeta = '';
      if (b.totalMockPayments > 0) {
        paymentMeta = `Paid ${b.totalMockPayments} times`;
      } else {
        paymentMeta = 'No payments yet';
      }

      return `
        <div class="beneficiary-card" data-id="${b.id}" role="listitem" tabindex="0" aria-label="Beneficiary ${safeName}, UPI ID ${safeUpi}">
          <div class="ben-card-top">
            <div class="ben-avatar-circle" style="border-color: ${color.border}; color: ${color.text};">
              ${initials}
            </div>
            <div class="ben-meta-wrap">
              <div class="ben-title-row">
                <span class="ben-name-text">${safeName}</span>
                ${verifiedBadge}
              </div>
              <div class="ben-upi-text">${safeUpi}</div>
              <div class="ben-history-text">${paymentMeta}${safeNick ? ' • Nickname: ' + safeNick : ''}</div>
            </div>
          </div>

          <div class="ben-card-actions">
            <button class="ben-star-btn ${starActive}" onclick="event.stopPropagation(); window.PaySimulator.toggleFavoriteBeneficiary('${b.id}')" aria-label="${b.favorite ? 'Remove from favorites' : 'Add to favorites'}">
              <span>${starIcon}</span>
            </button>
            <button class="btn-quick-pay-card" onclick="event.stopPropagation(); window.PaySimulator.quickPayBeneficiary('${b.id}')" aria-label="Pay ${safeName}">
              <span>⚡ Pay</span>
            </button>
            <button class="ben-action-icon-btn" onclick="event.stopPropagation(); window.PaySimulator.openEditBeneficiaryModal('${b.id}')" aria-label="Edit ${safeName}">
              <span>✏️</span>
            </button>
            <button class="ben-action-icon-btn danger" onclick="event.stopPropagation(); window.PaySimulator.promptDeleteBeneficiary('${b.id}')" aria-label="Delete ${safeName}">
              <span>🗑️</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  openAddBeneficiaryModal(prefillName = '', prefillUpi = '') {
    const modal = document.getElementById('beneficiary-form-modal');
    if (!modal) return;

    const idEl = document.getElementById('ben-form-id');
    const nameEl = document.getElementById('ben-form-name');
    const upiEl = document.getElementById('ben-form-upi');
    const nickEl = document.getElementById('ben-form-nickname');
    const favEl = document.getElementById('ben-form-favorite');

    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = prefillName;
    if (upiEl) upiEl.value = prefillUpi;
    if (nickEl) nickEl.value = '';
    if (favEl) favEl.checked = false;

    const titleEl = document.getElementById('ben-modal-title');
    if (titleEl) titleEl.textContent = 'Add Beneficiary';

    modal.classList.add('active');
    window.AcousticHaptic.playFocus();

    if (nameEl) setTimeout(() => nameEl.focus(), 150);

    window.TTSVoice.speak({
      ta: 'புதிய பெறுநர் சேர்க்கும் படிவம் திறக்கப்பட்டது. பெயர் மற்றும் யுபிஐ உள்ளிடவும்.',
      en: 'Add beneficiary form opened. Enter name and UPI ID.'
    });
  }

  openEditBeneficiaryModal(id) {
    const b = this.beneficiaries.find(item => item.id === id);
    if (!b) return;

    const modal = document.getElementById('beneficiary-form-modal');
    if (!modal) return;

    const idEl = document.getElementById('ben-form-id');
    const nameEl = document.getElementById('ben-form-name');
    const upiEl = document.getElementById('ben-form-upi');
    const nickEl = document.getElementById('ben-form-nickname');
    const favEl = document.getElementById('ben-form-favorite');

    if (idEl) idEl.value = b.id;
    if (nameEl) nameEl.value = b.name;
    if (upiEl) upiEl.value = b.upiId;
    if (nickEl) nickEl.value = b.nickname || '';
    if (favEl) favEl.checked = !!b.favorite;

    const titleEl = document.getElementById('ben-modal-title');
    if (titleEl) titleEl.textContent = `Edit ${b.name}`;

    modal.classList.add('active');
    window.AcousticHaptic.playFocus();

    if (nameEl) setTimeout(() => nameEl.focus(), 150);

    window.TTSVoice.speak({
      ta: `${b.name} விவரங்களை திருத்தும் படிவம் திறக்கப்பட்டது.`,
      en: `Edit form opened for ${b.name}.`
    });
  }

  closeBeneficiaryModal() {
    const modal = document.getElementById('beneficiary-form-modal');
    if (modal) modal.classList.remove('active');
    window.AcousticHaptic.playClick();
  }

  saveBeneficiaryForm() {
    const id = document.getElementById('ben-form-id')?.value.trim();
    const name = document.getElementById('ben-form-name')?.value.trim();
    const upi = document.getElementById('ben-form-upi')?.value.trim();
    const nickname = document.getElementById('ben-form-nickname')?.value.trim();
    const isFav = !!document.getElementById('ben-form-favorite')?.checked;

    if (!name || !upi) {
      window.AcousticHaptic.playWarning();
      window.TTSVoice.speak({
        ta: 'பெயர் மற்றும் யுபிஐ முகவரி கட்டாயம் தேவை.',
        en: 'Name and UPI ID are required.'
      });
      return;
    }

    const aliases = [name.toLowerCase()];
    if (nickname) aliases.push(nickname.toLowerCase());
    name.split(' ').forEach(w => {
      if (w.length > 2) aliases.push(w.toLowerCase());
    });

    if (id) {
      // Edit existing
      const existing = this.beneficiaries.find(b => b.id === id);
      if (existing) {
        existing.name = name;
        existing.upiId = upi;
        existing.nickname = nickname;
        existing.favorite = isFav;
        existing.aliases = Array.from(new Set([...(existing.aliases || []), ...aliases]));
      }
      this.saveBeneficiaries();
      this.closeBeneficiaryModal();
      this.renderBeneficiariesList();
      this.renderHomeQuickContacts();
      window.AcousticHaptic.playSuccess();
      window.TTSVoice.speakBeneficiaryUpdated(name);
    } else {
      // Create new
      const newBen = {
        id: `ben-${Date.now()}`,
        name: name,
        upiId: upi,
        nickname: nickname,
        verified: false, // Default unverified to allow safe testing of Wrong Receiver Warning
        favorite: isFav,
        lastPaidAt: null,
        totalMockPayments: 0,
        aliases: Array.from(new Set(aliases))
      };
      this.beneficiaries.unshift(newBen);
      this.saveBeneficiaries();
      this.closeBeneficiaryModal();
      this.renderBeneficiariesList();
      this.renderHomeQuickContacts();
      window.AcousticHaptic.playSuccess();
      window.TTSVoice.speakBeneficiaryAdded(name);
    }
  }

  promptDeleteBeneficiary(id) {
    const b = this.beneficiaries.find(item => item.id === id);
    if (!b) return;

    this.pendingDeleteBeneficiaryId = id;
    const nameEl = document.getElementById('ben-delete-name');
    if (nameEl) nameEl.textContent = b.name;

    const modal = document.getElementById('beneficiary-delete-modal');
    if (modal) modal.classList.add('active');

    window.AcousticHaptic.playWarning();
    window.TTSVoice.speakBeneficiaryDeletePrompt(b.name);
  }

  confirmDeleteBeneficiary() {
    if (!this.pendingDeleteBeneficiaryId) return;

    const b = this.beneficiaries.find(item => item.id === this.pendingDeleteBeneficiaryId);
    const name = b ? b.name : 'Beneficiary';

    this.beneficiaries = this.beneficiaries.filter(item => item.id !== this.pendingDeleteBeneficiaryId);
    this.pendingDeleteBeneficiaryId = null;

    const modal = document.getElementById('beneficiary-delete-modal');
    if (modal) modal.classList.remove('active');

    this.saveBeneficiaries();
    this.renderBeneficiariesList();
    this.renderHomeQuickContacts();

    window.AcousticHaptic.playSuccess();
    window.TTSVoice.speakBeneficiaryDeleted(name);
  }

  cancelDeleteBeneficiary(silent = false) {
    const wasPending = !!this.pendingDeleteBeneficiaryId;
    this.pendingDeleteBeneficiaryId = null;
    const modal = document.getElementById('beneficiary-delete-modal');
    if (modal) modal.classList.remove('active');
    if (!silent && wasPending) {
      if (window.AcousticHaptic && typeof window.AcousticHaptic.playClick === 'function') {
        window.AcousticHaptic.playClick();
      }
      if (window.TTSVoice && typeof window.TTSVoice.speakBeneficiaryDeleteCancelled === 'function') {
        window.TTSVoice.speakBeneficiaryDeleteCancelled();
      }
    }
  }

  toggleFavoriteBeneficiary(id) {
    const b = this.beneficiaries.find(item => item.id === id);
    if (!b) return;

    b.favorite = !b.favorite;
    this.saveBeneficiaries();
    this.renderBeneficiariesList();
    this.renderHomeQuickContacts();

    window.AcousticHaptic.playClick();
    window.TTSVoice.speakFavoriteToggled(b.name, b.favorite);
  }

  quickPayBeneficiary(id, customAmount = null) {
    const b = this.beneficiaries.find(item => item.id === id);
    if (!b) return;

    window.AcousticHaptic.playClick();

    if (!b.verified) {
      // Unverified custom contact triggers Wrong Receiver Warning modal
      this.triggerWrongReceiverWarning(b.name, customAmount || '500', b.upiId);
      return;
    }

    this.merchant.name = b.name;
    this.merchant.upiId = b.upiId;
    this.merchant.verified = true;
    this.amount = customAmount ? String(customAmount) : '500';

    this.updateMerchantDisplay();
    this.switchView('view-confirm');
    window.TTSVoice.speakConfirmationPrompt(this.merchant.name, this.amount);
  }

  searchBeneficiariesVoice(query) {
    window.AcousticHaptic.playFocus();
    const q = query.toLowerCase().trim();
    const input = document.getElementById('beneficiary-search-input');
    if (input) input.value = query;

    this.renderBeneficiariesList(this.activeBeneficiaryFilter, query);

    const matches = this.beneficiaries.filter(b => {
      const nameMatch = b.name && b.name.toLowerCase().includes(q);
      const upiMatch = b.upiId && b.upiId.toLowerCase().includes(q);
      const nickMatch = b.nickname && b.nickname.toLowerCase().includes(q);
      const aliasMatch = b.aliases && b.aliases.some(a => a.toLowerCase().includes(q));
      return nameMatch || upiMatch || nickMatch || aliasMatch;
    });

    const topName = matches.length > 0 ? matches[0].name : '';
    window.TTSVoice.speakBeneficiarySearchResult(query, matches.length, topName);

    if (this.currentView !== 'view-contacts') {
      this.openContactsView();
    }
  }

  speakLastPaidContact() {
    const paid = this.beneficiaries.filter(b => b.lastPaidAt).sort((a, b) => new Date(b.lastPaidAt) - new Date(a.lastPaidAt));
    if (paid.length === 0) {
      window.TTSVoice.speak({
        ta: 'சமீபத்திய கொடுப்பனவுகள் ஏதும் இல்லை.',
        en: 'No recent payments found to beneficiaries.'
      });
      return;
    }
    const top = paid[0];
    window.AcousticHaptic.playClick();
    window.TTSVoice.speakLastPaidBeneficiary(top.name, top.lastPaidAt, top.totalMockPayments);
  }

  speakFavoriteBeneficiaries() {
    const favs = this.beneficiaries.filter(b => b.favorite);
    window.AcousticHaptic.playClick();
    window.TTSVoice.speakFavoriteBeneficiaries(favs.length, favs.map(f => f.name).join(', '));
  }

  promptBeneficiaryVoiceSearch() {
    window.AcousticHaptic.playFocus();
    window.TTSVoice.speak({
      ta: 'யாரை தேட வேண்டும்? பெறுநரின் பெயரை சொல்லவும்.',
      en: 'Who do you want to find? Say the beneficiary name.'
    });
    if (window.STTListener && typeof window.STTListener.start === 'function') {
      setTimeout(() => window.STTListener.start(), 1500);
    }
  }

  pressPinKey(digit) {
    if (digit === 'clear') {
      this.enteredPin = '';
      this.updatePinDots();
      window.AcousticHaptic.playWarning();
      window.TTSVoice.speak({
        ta: 'பின் எண் அழிக்கப்பட்டது.',
        en: 'PIN cleared.'
      });
      return;
    }

    if (this.enteredPin.length < this.correctPinLength) {
      this.enteredPin += digit;
      this.updatePinDots();
      window.AcousticHaptic.playClick();

      window.TTSVoice.speakPinDigit(this.enteredPin.length);

      if (this.enteredPin.length === this.correctPinLength) {
        setTimeout(() => {
          this.executePaymentSuccess();
        }, 400);
      }
    }
  }

  updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('filled', idx < this.enteredPin.length);
      dot.setAttribute('aria-checked', idx < this.enteredPin.length ? 'true' : 'false');
    });
  }

  executePaymentSuccess() {
    const amt = parseFloat(this.amount) || 0;
    if (amt <= 0 || !this.merchant.name) {
      console.warn('executePaymentSuccess aborted: invalid amount or missing recipient.');
      this.goHome();
      return;
    }
    if (this.isProcessingPayment) return;
    this.isProcessingPayment = true;

    const txnId = `MOCK_${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    this.lastTxId = txnId;

    // Finalize & Persist
    this.finalizeSuccessfulPayment(txnId);
    this.isProcessingPayment = false;

    const successAmt = document.getElementById('success-amount-display');
    if (successAmt) successAmt.textContent = `₹${this.amount}`;

    const txIdEl = document.getElementById('success-txid-display');
    if (txIdEl) txIdEl.textContent = `UPI Ref: ${txnId}`;

    this.switchView('view-success');
    window.AcousticHaptic.playSuccess();
    window.TTSVoice.speakSuccess(this.merchant.name, this.amount, txnId);
  }
}

// Global instance
window.PaySimulator = new PaySimulatorEngine();
