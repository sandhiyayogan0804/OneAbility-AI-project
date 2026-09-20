/**
 * OneAbility AI - Modern Mobile Payment App Controller
 * Orchestrates:
 * - Top Header (Avatar, Greeting, Search, Notifications)
 * - Bank Balance Card (Check Balance toggle)
 * - 4 Main Actions (Scan & Pay, Pay Contact, Pay UPI ID, Voice Pay)
 * - Voice Payment Hero Card (Mic & Natural Speech transcription)
 * - Payment Confirmation Screen
 * - Full-Screen QR Scanner Experience
 * - Dashboard Feeds (Contacts, Bills, Rewards, History)
 * - Fixed Bottom Navigation
 * - Universal Accessibility & Persona Profiles
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing OneAbility AI Mobile Payment App...');

  // 1. Dynamic Greeting Based on Current Time
  const greetingEl = document.getElementById('user-greeting-heading');
  if (greetingEl) {
    const hour = new Date().getHours();
    let timeGreeting = 'Good Evening';
    if (hour < 12) timeGreeting = 'Good Morning';
    const userName = (window.UserManager && typeof window.UserManager.getUserName === 'function')
      ? window.UserManager.getUserName()
      : 'Sandhiya';
    greetingEl.textContent = `${timeGreeting}, ${userName}`;
  }

  // ------------------------------------------------------------------------
  // THEME MANAGEMENT (Light Mode / Dark Mode in Shades of Dark Blue)
  // Persistence: localStorage key 'oneability_theme' ('system' / 'light' / 'dark')
  // Fallback: prefers-color-scheme -> default to light
  // ------------------------------------------------------------------------
  const ThemeManager = {
    STORAGE_KEY: 'oneability_theme',
    currentTheme: 'light',
    userPreference: 'system', // 'system', 'light', 'dark'

    init() {
      let saved = null;
      try {
        saved = localStorage.getItem(this.STORAGE_KEY);
      } catch (e) {
        console.warn('[Theme] localStorage read error:', e);
      }

      if (saved === 'dark' || saved === 'light') {
        this.userPreference = saved;
        this.currentTheme = saved;
      } else if (saved === 'system') {
        this.userPreference = 'system';
        this.currentTheme = this.resolveSystemTheme();
      } else {
        this.userPreference = 'system';
        this.currentTheme = this.resolveSystemTheme();
      }

      this.applyTheme(this.currentTheme, false, false);
      this.syncRadioInputs();

      // Listen for OS / system dark mode changes when preference is 'system'
      if (window.matchMedia) {
        try {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.userPreference === 'system') {
              this.applyTheme(e.matches ? 'dark' : 'light', true, false);
            }
          });
        } catch (e) {}
      }

      // Attach Header Theme Toggle Button
      const headerToggleBtn = document.getElementById('header-theme-toggle');
      if (headerToggleBtn) {
        headerToggleBtn.addEventListener('click', () => {
          this.toggleTheme();
        });
        headerToggleBtn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.toggleTheme();
          }
        });
      }

      // Attach Profile Settings Theme Toggle Button
      const profileToggleBtn = document.getElementById('profile-theme-toggle');
      if (profileToggleBtn) {
        profileToggleBtn.addEventListener('click', () => {
          this.toggleTheme();
        });
      }

      // Attach Settings -> Appearance radio buttons
      this.bindAppearanceRadios();
    },

    resolveSystemTheme() {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    },

    setAppearance(pref, announce = true) {
      this.userPreference = pref;
      try {
        localStorage.setItem(this.STORAGE_KEY, pref);
      } catch (e) {}

      const effectiveTheme = (pref === 'system') ? this.resolveSystemTheme() : pref;
      this.applyTheme(effectiveTheme, announce, false);
      this.syncRadioInputs();
    },

    toggleTheme() {
      const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
      this.userPreference = nextTheme;
      this.applyTheme(nextTheme, true, true);
    },

    applyTheme(theme, announce, persist = true) {
      this.currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      if (document.body) {
        document.body.setAttribute('data-theme', theme);
      }

      if (persist) {
        try {
          localStorage.setItem(this.STORAGE_KEY, this.userPreference);
        } catch (e) {
          console.warn('[Theme] localStorage write error:', e);
        }
      }

      this.updateUIButtons();
      this.syncRadioInputs();

      if (announce) {
        if (window.AcousticHaptic && window.AcousticHaptic.playClick) {
          window.AcousticHaptic.playClick();
        }

        const spokenEn = theme === 'dark' ? 'Dark mode activated. Dark blue theme.' : 'Light mode activated. Soft blue theme.';
        const spokenTa = theme === 'dark' ? 'டார்க் மோட் இயக்கப்பட்டது. இருண்ட நீல நிற வடிவமைப்பு.' : 'லைட் மோட் இயக்கப்பட்டது. மென்மையான நீல வடிவமைப்பு.';
        const srText = theme === 'dark' ? 'Dark Mode Active (இருண்ட வடிவமைப்பு)' : 'Light Mode Active (வெளிச்ச வடிவமைப்பு)';

        // Live ARIA screen reader announcement
        const srAnnouncerMsg = document.getElementById('sr-announcer-msg');
        const srAnnouncer = document.getElementById('sr-announcer');
        if (srAnnouncerMsg && srAnnouncer) {
          srAnnouncerMsg.textContent = srText;
          srAnnouncer.classList.add('active');
          setTimeout(() => srAnnouncer.classList.remove('active'), 2500);
        }

        if (window.TTSVoice && window.TTSVoice.speak) {
          window.TTSVoice.speak({
            ta: spokenTa,
            en: spokenEn
          });
        }
      }
    },

    syncRadioInputs() {
      const pref = this.userPreference;
      const radioSys = document.getElementById('theme-pref-system');
      const radioLight = document.getElementById('theme-pref-light');
      const radioDark = document.getElementById('theme-pref-dark');
      const rowSys = document.getElementById('row-theme-system');
      const rowLight = document.getElementById('row-theme-light');
      const rowDark = document.getElementById('row-theme-dark');

      if (radioSys) radioSys.checked = (pref === 'system');
      if (radioLight) radioLight.checked = (pref === 'light');
      if (radioDark) radioDark.checked = (pref === 'dark');

      if (rowSys) rowSys.classList.toggle('selected', pref === 'system');
      if (rowLight) rowLight.classList.toggle('selected', pref === 'light');
      if (rowDark) rowDark.classList.toggle('selected', pref === 'dark');
    },

    bindAppearanceRadios() {
      const radioSys = document.getElementById('theme-pref-system');
      const radioLight = document.getElementById('theme-pref-light');
      const radioDark = document.getElementById('theme-pref-dark');
      const rowSys = document.getElementById('row-theme-system');
      const rowLight = document.getElementById('row-theme-light');
      const rowDark = document.getElementById('row-theme-dark');

      if (radioSys) {
        radioSys.addEventListener('change', () => { if (radioSys.checked) this.setAppearance('system', true); });
      }
      if (radioLight) {
        radioLight.addEventListener('change', () => { if (radioLight.checked) this.setAppearance('light', true); });
      }
      if (radioDark) {
        radioDark.addEventListener('change', () => { if (radioDark.checked) this.setAppearance('dark', true); });
      }

      if (rowSys) {
        rowSys.addEventListener('click', (e) => {
          if (e.target !== radioSys) {
            if (radioSys) radioSys.checked = true;
            this.setAppearance('system', true);
          }
        });
      }
      if (rowLight) {
        rowLight.addEventListener('click', (e) => {
          if (e.target !== radioLight) {
            if (radioLight) radioLight.checked = true;
            this.setAppearance('light', true);
          }
        });
      }
      if (rowDark) {
        rowDark.addEventListener('click', (e) => {
          if (e.target !== radioDark) {
            if (radioDark) radioDark.checked = true;
            this.setAppearance('dark', true);
          }
        });
      }
    },

    updateUIButtons() {
      const headerToggleBtn = document.getElementById('header-theme-toggle');
      const iconEl = document.getElementById('theme-toggle-icon');
      const textEl = document.getElementById('theme-toggle-text');
      const profileToggleBtn = document.getElementById('profile-theme-toggle');

      const isLight = this.currentTheme === 'light';
      const icon = isLight ? '☀️' : '🌙';
      const text = isLight ? 'Light' : 'Dark';
      const nextThemeName = isLight ? 'Dark' : 'Light';
      const ariaLabel = `Theme: ${text} Mode. Press Enter or click to switch to ${nextThemeName} Mode.`;

      if (iconEl) iconEl.textContent = icon;
      if (textEl) textEl.textContent = text;
      if (headerToggleBtn) {
        headerToggleBtn.setAttribute('aria-label', ariaLabel);
        headerToggleBtn.title = `Switch to ${nextThemeName} Mode`;
      }
      if (profileToggleBtn) {
        profileToggleBtn.textContent = `${icon} ${text}`;
        profileToggleBtn.setAttribute('aria-label', ariaLabel);
      }
    }
  };

  window.ThemeManager = ThemeManager;
  ThemeManager.init();

  // Quick Blind Mode / High Contrast Toggle
  const blindModeToggle = document.getElementById('btn-blind-mode-toggle');
  if (blindModeToggle) {
    blindModeToggle.addEventListener('click', () => {
      const isVision = document.body.classList.contains('mode-vision');
      window.AccessibilityEngine.switchPersona(isVision ? 'default' : 'vision');
    });
  }

  // Emergency Payment Stop Button
  const emergencyStopBtn = document.getElementById('btn-emergency-stop');
  if (emergencyStopBtn) {
    emergencyStopBtn.addEventListener('click', () => {
      window.PaySimulator.emergencyStop();
    });
  }

  // Voice Balance Button
  const voiceBalanceBtn = document.getElementById('btn-voice-balance');
  if (voiceBalanceBtn) {
    voiceBalanceBtn.addEventListener('click', () => {
      window.PaySimulator.checkBalanceVoice();
    });
  }

  // Read Receipt Aloud Button
  const readReceiptBtn = document.getElementById('btn-read-receipt');
  if (readReceiptBtn) {
    readReceiptBtn.addEventListener('click', () => {
      window.PaySimulator.readReceiptAloud();
    });
  }

  // Biometric / Fingerprint Authentication Button
  const biometricBtn = document.getElementById('btn-biometric-auth');
  if (biometricBtn) {
    biometricBtn.addEventListener('click', () => {
      window.PaySimulator.triggerBiometricAuth();
    });
  }

  // Suspicious QR Simulation Button
  const simSuspiciousQrBtn = document.getElementById('btn-sim-suspicious-qr');
  if (simSuspiciousQrBtn) {
    simSuspiciousQrBtn.addEventListener('click', () => {
      window.PaySimulator.triggerSuspiciousQRWarning();
    });
  }

  // Voice Search inside Search Modal
  const voiceSearchBtn = document.getElementById('btn-voice-search');
  if (voiceSearchBtn) {
    voiceSearchBtn.addEventListener('click', () => {
      window.TTSVoice.speak({
        ta: 'பெறுநர் பெயர் அல்லது "குமார்" என்று குரலில் சொல்லவும்.',
        en: 'Speak who you want to search, like "Kumar" or "Recent".'
      });
      window.STTListener.toggleListening();
    });
  }

  // 2. Top Header Buttons
  const avatarBtn = document.getElementById('header-avatar-btn');
  if (avatarBtn) {
    avatarBtn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.PaySimulator.switchView('view-profile');
    });
  }

  const searchBtn = document.getElementById('header-search-btn');
  const searchModal = document.getElementById('search-overlay-modal');
  const searchCloseBtn = document.getElementById('search-modal-close');
  if (searchBtn && searchModal) {
    searchBtn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      searchModal.classList.add('active');
      const input = document.getElementById('search-input-field');
      if (input) setTimeout(() => input.focus(), 100);
      window.TTSVoice.speak({
        ta: 'பெறுநர் பெயர், தொலைபேசி எண், அல்லது யூபிஐ ஐடியைத் தேடுங்கள்.',
        tanglish: 'Payee name, phone number, alladhu UPI ID thedunga.',
        en: 'Search payees, phone numbers, or UPI IDs.'
      });
    });
  }
  if (searchCloseBtn && searchModal) {
    searchCloseBtn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      searchModal.classList.remove('active');
    });
  }

  const notifBtn = document.getElementById('header-notif-btn');
  const notifModal = document.getElementById('notif-overlay-modal');
  const notifCloseBtn = document.getElementById('notif-modal-close');
  if (notifBtn && notifModal) {
    notifBtn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      notifModal.classList.add('active');
      window.TTSVoice.speak({
        ta: 'அறிவிப்புகள்: கடைசி பரிவர்த்தனைக்கு ₹25 கேஷ்பேக் பெறப்பட்டது.',
        tanglish: 'Notifications: Kadasi payment-ku ₹25 cashback kedaichurukku.',
        en: 'Notifications: Cashback of ₹25 received for your last transaction.'
      });
    });
  }
  if (notifCloseBtn && notifModal) {
    notifCloseBtn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      notifModal.classList.remove('active');
    });
  }

  // 3. Bank Balance Card Toggle
  const checkBalanceBtn = document.getElementById('btn-check-balance');
  const balanceDisplay = document.getElementById('balance-amount-display');
  let balanceVisible = false;

  if (checkBalanceBtn && balanceDisplay) {
    checkBalanceBtn.addEventListener('click', () => {
      balanceVisible = !balanceVisible;
      if (balanceVisible) {
        window.PaySimulator.checkBalanceVoice();
      } else {
        window.AcousticHaptic.playClick();
        balanceDisplay.textContent = '₹ • • • • •';
        checkBalanceBtn.textContent = 'Check Balance';
        window.TTSVoice.speak({
          ta: 'வங்கி கணக்கு இருப்பு மறைக்கப்பட்டது.',
          tanglish: 'Bank account balance maraikkappattadhu.',
          en: 'Account balance hidden.'
        });
      }
    });
  }

  // 4. Main Payment Action Buttons
  const actionScan = document.getElementById('action-scan-pay');
  if (actionScan) {
    actionScan.addEventListener('click', () => window.PaySimulator.openScanner());
  }

  const actionCheckBalance = document.getElementById('action-check-balance');
  if (actionCheckBalance) {
    actionCheckBalance.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.PaySimulator.revealBalance();
    });
  }

  const actionBills = document.getElementById('action-bills');
  if (actionBills) {
    actionBills.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.PaySimulator.scrollToBillsSection();
    });
  }

  const actionTalkDex = document.getElementById('action-talk-dex');
  if (actionTalkDex) {
    actionTalkDex.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      if (window.DexSession) {
        window.DexSession.startSession();
      }
    });
  }

  const actionContact = document.getElementById('action-pay-contact');
  if (actionContact) {
    actionContact.addEventListener('click', () => window.PaySimulator.openContactsView());
  }

  const actionUpi = document.getElementById('action-pay-upi');
  if (actionUpi) {
    actionUpi.addEventListener('click', () => {
      window.PaySimulator.selectMerchant('Kumar Groceries', 'kumar.store@okhdfcbank', '500');
    });
  }

  const actionVoice = document.getElementById('action-voice-pay');
  if (actionVoice) {
    actionVoice.addEventListener('click', () => {
      if (window.DexSession) {
        window.DexSession.toggleSession();
      } else {
        window.STTListener.toggleListening();
      }
    });
  }

  // 5. Voice Payment Hero Card Mic & Speech Chips
  const voiceMicBtn = document.getElementById('voice-mic-btn');
  if (voiceMicBtn) {
    voiceMicBtn.addEventListener('click', () => {
      if (window.DexSession) {
        window.DexSession.toggleSession();
      } else {
        window.STTListener.toggleListening();
      }
    });
  }

  document.querySelectorAll('.speech-chip-btn, .cmd-pill').forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.dataset.cmd || chip.textContent.replace(/["“”]/g, '').trim();
      window.AcousticHaptic.playClick();
      if (window.DexSession) {
        if (!window.DexSession.isActive) {
          window.DexSession.isActive = true;
          window.DexSession.showPanel();
        }
        window.DexSession.setUserTranscript(cmd);
        window.DexSession.handleUserUtterance(cmd);
      } else {
        window.TTSVoice.appendSpokenLog('user', `"${cmd}"`);
        window.STTListener.parseNaturalLanguage(cmd);
      }
    });
  });

  // 6. Payment Confirmation Screen Action Handlers
  const btnConfirmPay = document.getElementById('btn-confirm-payment');
  if (btnConfirmPay) {
    btnConfirmPay.addEventListener('click', () => {
      window.PaySimulator.handleVoiceConfirmation(true);
    });
  }

  const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
  if (btnConfirmCancel) {
    btnConfirmCancel.addEventListener('click', () => {
      window.PaySimulator.handleVoiceConfirmation(false);
    });
  }

  const btnBiometricAuth = document.getElementById('btn-biometric-auth');
  if (btnBiometricAuth) {
    btnBiometricAuth.addEventListener('click', () => {
      window.PaySimulator.authenticatePaymentBiometric();
    });
  }

  const btnDemoBiometric = document.getElementById('btn-demo-biometric-fallback');
  if (btnDemoBiometric) {
    btnDemoBiometric.addEventListener('click', () => {
      window.PaySimulator.triggerBiometricSimulation();
    });
  }

  const btnWebAuthnEnroll = document.getElementById('webauthn-enroll-btn');
  if (btnWebAuthnEnroll) {
    btnWebAuthnEnroll.addEventListener('click', () => {
      window.PaySimulator.registerWebAuthnCredential();
    });
  }

  // 7. Full-Screen QR Scanner Experience Handlers
  const scannerBack = document.getElementById('scanner-back-btn');
  if (scannerBack) {
    scannerBack.addEventListener('click', () => window.PaySimulator.goHome());
  }

  const scannerFlash = document.getElementById('scanner-flash-btn');
  let flashActive = false;
  if (scannerFlash) {
    scannerFlash.addEventListener('click', () => {
      flashActive = !flashActive;
      scannerFlash.classList.toggle('active', flashActive);
      window.AcousticHaptic.playClick();
      window.TTSVoice.speak({
        ta: flashActive ? 'ஃப்ளாஷ்லைட் இயக்கப்பட்டது.' : 'ஃப்ளாஷ்லைட் அணைக்கப்பட்டது.',
        tanglish: flashActive ? 'Flashlight ON aayiduchu.' : 'Flashlight OFF aayiduchu.',
        en: flashActive ? 'Flashlight turned ON.' : 'Flashlight turned OFF.'
      });
    });
  }

  const scannerGallery = document.getElementById('scanner-gallery-btn');
  if (scannerGallery) {
    scannerGallery.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.TTSVoice.speak({
        ta: 'க்யூஆர் குறியீட்டு படத்தை கேலரியிலிருந்து தேர்ந்தெடுக்கவும்.',
        tanglish: 'Photo gallery-la irundhu QR image select pannunga.',
        en: 'Select QR image from photo gallery.'
      });
      setTimeout(() => {
        window.PaySimulator.handleQRDetected();
      }, 1200);
    });
  }

  // Explicit Demo QR Buttons for College Demonstration & Camera Fallback
  const demoQrKumar = document.getElementById('btn-demo-qr-kumar');
  if (demoQrKumar) {
    demoQrKumar.addEventListener('click', () => {
      window.PaySimulator.simulateDemoQr('kumar');
    });
  }

  const demoQrUnknown = document.getElementById('btn-demo-qr-unknown');
  if (demoQrUnknown) {
    demoQrUnknown.addEventListener('click', () => {
      window.PaySimulator.simulateDemoQr('unknown');
    });
  }

  const demoQrSuspicious = document.getElementById('btn-sim-suspicious-qr');
  if (demoQrSuspicious) {
    demoQrSuspicious.addEventListener('click', () => {
      window.PaySimulator.simulateDemoQr('suspicious');
    });
  }

  const qrVoiceHelp = document.getElementById('btn-qr-voice-help');
  if (qrVoiceHelp) {
    qrVoiceHelp.addEventListener('click', () => {
      window.TTSVoice.speakQRGuidance('start');
    });
  }

  // 8. Quick Contacts Carousel
  document.querySelectorAll('.contact-bubble-item, .sim-contact-item').forEach(item => {
    item.addEventListener('click', () => {
      const name = item.dataset.name || 'Kumar Groceries';
      const upi = item.dataset.upi || 'kumar.store@okhdfcbank';
      window.AcousticHaptic.playClick();
      window.PaySimulator.selectMerchant(name, upi, '500');
    });
  });

  const viewAllContacts = document.getElementById('btn-view-all-contacts');
  if (viewAllContacts) {
    viewAllContacts.addEventListener('click', () => window.PaySimulator.openContactsView());
  }

  // 9. Bills & Recharge Shortcuts
  document.querySelectorAll('.bill-shortcut-card').forEach(card => {
    card.addEventListener('click', () => {
      const billType = card.dataset.bill || 'Mobile Recharge';
      window.AcousticHaptic.playClick();
      window.PaySimulator.voiceRechargeBill(billType, '299');
    });
  });

  // 10. Rewards Banner
  const rewardsBanner = document.querySelector('.rewards-banner-card');
  if (rewardsBanner) {
    rewardsBanner.addEventListener('click', () => {
      window.AcousticHaptic.playSuccess();
      window.TTSVoice.speak({
        ta: 'பரிசுகள்! நீங்கள் மொத்தம் ₹125 கேஷ்பேக் மற்றும் இரண்டு ஸ்க்ராட்ச் கார்டுகளை வென்றுள்ளீர்கள்.',
        tanglish: 'Rewards unlocked! Ungalukku motham ₹125 cashback matrum 2 scratch cards irukku.',
        en: 'Rewards unlocked! You have won ₹125 total cashback with 2 active scratch cards.'
      });
    });
  }

  // 11. Recent Transactions Click
  document.querySelectorAll('.transaction-row-card').forEach(tx => {
    tx.addEventListener('click', () => {
      const name = tx.dataset.name || 'Merchant';
      const amount = tx.dataset.amount || '₹320';
      window.AcousticHaptic.playClick();
      window.TTSVoice.speak({
        ta: `பரிவர்த்தனை விவரம்: ${name} அவர்களுக்கு ${amount} செலுத்தப்பட்டது.`,
        tanglish: `Transaction details: ${name}-ku ${amount} debited aagirukku.`,
        en: `Transaction details: ${amount} debited to ${name}.`
      });
    });
  });

  const seeHistoryLink = document.getElementById('btn-see-history-link');
  if (seeHistoryLink) {
    seeHistoryLink.addEventListener('click', () => window.PaySimulator.openHistoryView());
  }

  // 12. Bottom Navigation Bar
  const navHome = document.getElementById('nav-btn-home');
  if (navHome) {
    navHome.addEventListener('click', () => window.PaySimulator.goHome());
  }

  const navScan = document.getElementById('nav-btn-scan');
  if (navScan) {
    navScan.addEventListener('click', () => window.PaySimulator.openScanner());
  }

  const navVoice = document.getElementById('nav-btn-voice');
  if (navVoice) {
    navVoice.addEventListener('click', () => {
      window.STTListener.toggleListening();
    });
  }

  const navHistory = document.getElementById('nav-btn-history');
  if (navHistory) {
    navHistory.addEventListener('click', () => window.PaySimulator.openHistoryView());
  }

  const navProfile = document.getElementById('nav-btn-profile');
  if (navProfile) {
    navProfile.addEventListener('click', () => window.PaySimulator.switchView('view-profile'));
  }

  // 13. Contacts List View Back & Selection
  const contactsBackBtn = document.getElementById('contacts-back-btn');
  if (contactsBackBtn) {
    contactsBackBtn.addEventListener('click', () => window.PaySimulator.goHome());
  }

  // 14. Enter Amount Screen Handlers
  const amountProceedBtn = document.getElementById('amount-proceed-btn');
  if (amountProceedBtn) {
    amountProceedBtn.addEventListener('click', () => window.PaySimulator.proceedToConfirm());
  }

  const amountCancelBtn = document.getElementById('amount-cancel-btn');
  if (amountCancelBtn) {
    amountCancelBtn.addEventListener('click', () => window.PaySimulator.goHome());
  }

  document.querySelectorAll('.amount-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.amount;
      window.PaySimulator.setAmountChip(val);
    });
  });

  // 15. PIN Keypad Screen Handlers
  document.querySelectorAll('.keypad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const digit = btn.dataset.key;
      window.PaySimulator.pressPinKey(digit);
    });
  });

  // 16. Success Screen Done Handler
  const successDoneBtn = document.getElementById('success-done-btn');
  if (successDoneBtn) {
    successDoneBtn.addEventListener('click', () => window.PaySimulator.goHome());
  }

  // 17. Accessibility Persona Switchers
  document.querySelectorAll('.persona-pill-btn, .persona-card, .mode-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      window.AccessibilityEngine.switchPersona(mode);
    });
  });

  // 18. Accessibility Font & Audio Toggles
  const fontBtn = document.getElementById('font-size-toggle');
  if (fontBtn) {
    fontBtn.addEventListener('click', () => window.AccessibilityEngine.cycleFontSize());
  }

  // Language Selectors (Header segmented control & Profile options & Blind Assist Bar)
  const btnLangEn = document.getElementById('btn-lang-en');
  if (btnLangEn) {
    btnLangEn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.I18n.setLanguage('en', true);
    });
  }

  const btnLangTa = document.getElementById('btn-lang-ta');
  if (btnLangTa) {
    btnLangTa.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.I18n.setLanguage('ta', true);
    });
  }

  const profileLangEn = document.getElementById('profile-lang-en');
  if (profileLangEn) {
    profileLangEn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.I18n.setLanguage('en', true);
    });
  }

  const profileLangTa = document.getElementById('profile-lang-ta');
  if (profileLangTa) {
    profileLangTa.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.I18n.setLanguage('ta', true);
    });
  }

  // Settings -> Language Radio Controls
  const settingLangEn = document.getElementById('setting-lang-en');
  if (settingLangEn) {
    settingLangEn.addEventListener('change', () => {
      if (settingLangEn.checked) {
        window.AcousticHaptic.playClick();
        window.I18n.setLanguage('en', true);
      }
    });
  }

  const settingLangTa = document.getElementById('setting-lang-ta');
  if (settingLangTa) {
    settingLangTa.addEventListener('change', () => {
      if (settingLangTa.checked) {
        window.AcousticHaptic.playClick();
        window.I18n.setLanguage('ta', true);
      }
    });
  }

  const rowLangEn = document.getElementById('row-lang-en');
  if (rowLangEn) {
    rowLangEn.addEventListener('click', (e) => {
      if (e.target !== settingLangEn) {
        if (settingLangEn) settingLangEn.checked = true;
        window.AcousticHaptic.playClick();
        window.I18n.setLanguage('en', true);
      }
    });
  }

  const rowLangTa = document.getElementById('row-lang-ta');
  if (rowLangTa) {
    rowLangTa.addEventListener('click', (e) => {
      if (e.target !== settingLangTa) {
        if (settingLangTa) settingLangTa.checked = true;
        window.AcousticHaptic.playClick();
        window.I18n.setLanguage('ta', true);
      }
    });
  }

  // Blind Assist Bar single-tap toggle
  const blindLangBtn = document.getElementById('header-lang-btn');
  if (blindLangBtn) {
    blindLangBtn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.TTSVoice.cycleLanguage();
    });
  }

  const muteBtn = document.getElementById('voice-mute-toggle');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const isVoiceOn = window.TTSVoice.toggleVoice();
      muteBtn.classList.toggle('active', !isVoiceOn);
      muteBtn.textContent = isVoiceOn ? '🔊 Voice: ON' : '🔇 Voice: OFF';
      window.AcousticHaptic.playClick();
    });
  }

  // Safety Guard & Wrong Receiver Modal Action Buttons
  const fraudCancelBtn = document.getElementById('fraud-cancel-btn');
  if (fraudCancelBtn) {
    fraudCancelBtn.addEventListener('click', () => {
      window.PaySimulator.dismissFraudWarning(false);
    });
  }

  const fraudProceedBtn = document.getElementById('fraud-proceed-btn');
  if (fraudProceedBtn) {
    fraudProceedBtn.addEventListener('click', () => {
      window.PaySimulator.dismissFraudWarning(true);
    });
  }

  // Beneficiary Directory Event Listeners
  const benSearchInput = document.getElementById('beneficiary-search-input');
  const benSearchClear = document.getElementById('beneficiary-search-clear');
  if (benSearchInput) {
    benSearchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (benSearchClear) {
        benSearchClear.style.display = val ? 'block' : 'none';
      }
      window.PaySimulator.renderBeneficiariesList(window.PaySimulator.activeBeneficiaryFilter, val);
    });
  }

  if (benSearchClear && benSearchInput) {
    benSearchClear.addEventListener('click', () => {
      benSearchInput.value = '';
      benSearchClear.style.display = 'none';
      window.PaySimulator.renderBeneficiariesList(window.PaySimulator.activeBeneficiaryFilter, '');
      benSearchInput.focus();
    });
  }

  const filterAllBtn = document.getElementById('filter-ben-all');
  if (filterAllBtn) {
    filterAllBtn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.PaySimulator.renderBeneficiariesList('all');
    });
  }

  const filterFavBtn = document.getElementById('filter-ben-fav');
  if (filterFavBtn) {
    filterFavBtn.addEventListener('click', () => {
      window.AcousticHaptic.playClick();
      window.PaySimulator.renderBeneficiariesList('fav');
    });
  }

  const benForm = document.getElementById('beneficiary-form');
  if (benForm) {
    benForm.addEventListener('submit', (e) => {
      e.preventDefault();
      window.PaySimulator.saveBeneficiaryForm();
    });
  }

  // Delete Beneficiary Modal Buttons
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete-ben');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
      window.PaySimulator.confirmDeleteBeneficiary();
    });
  }

  const cancelDeleteBtn = document.getElementById('btn-cancel-delete-ben');
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      window.PaySimulator.cancelDeleteBeneficiary();
    });
  }

  // Universal Modal Dismissal on Escape Key (WCAG 2.1 Keyboard Accessibility)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const benDelModal = document.getElementById('beneficiary-delete-modal');
      if (benDelModal && benDelModal.classList.contains('active')) {
        window.PaySimulator.cancelDeleteBeneficiary();
        return;
      }
      const benFormModal = document.getElementById('beneficiary-form-modal');
      if (benFormModal && benFormModal.classList.contains('active')) {
        window.PaySimulator.closeBeneficiaryModal();
        return;
      }
      const fraudModal = document.getElementById('fraud-guard-modal');
      if (fraudModal && fraudModal.classList.contains('active')) {
        window.PaySimulator.dismissFraudWarning(false);
        return;
      }
      const searchModal = document.getElementById('search-overlay-modal');
      if (searchModal && searchModal.classList.contains('active')) {
        searchModal.classList.remove('active');
        return;
      }
    }
  });

  // Initialize UI language to Tamil by default without spoken announcement on load
  if (window.I18n) {
    window.I18n.setLanguage('ta', false);
  }

  // Safe PWA Service Worker Registration for Offline Accessibility
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed (normal if not on HTTP/HTTPS server):', err);
        });
    });
  }

  // Initial welcome greeting for user (only if already authenticated)
  setTimeout(() => {
    if (window.AuthController && !window.AuthController.isLoggedIn) {
      return;
    }
    const callName = (window.UserManager && typeof window.UserManager.getAssistantCallName === 'function')
      ? window.UserManager.getAssistantCallName()
      : 'Sandhiya';
    window.TTSVoice.speakWelcome(callName);
  }, 1200);
});

