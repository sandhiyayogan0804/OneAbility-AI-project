/**
 * OneAbility AI - Natural Speech Recognition & Intent Parser
 * Feature 1: Voice Payment in Tamil, English, and Tanglish.
 * Feature 6: Voice Navigation ("Home-ku po", "Send Money open pannu", "History kaatu", "Back po", "முகப்பு", "வரலாறு").
 * Feature 7: Voice-Guided Confirmation Gate (Aama/Yes/Confirm/ஆம் vs Vendam/No/Cancel/வேண்டாம்).
 * 
 * Tanglish voice input is fully understood in BOTH Tamil and English modes.
 */

class STTListenerEngine {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.currentLang = 'ta'; // Defaults to Tamil mode
    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.updateRecognitionLang();

      this.recognition.onstart = () => {
        this.isListening = true;
        this.updateMicUI(true);
        window.AcousticHaptic.playFocus();
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        window.TTSVoice.appendSpokenLog('user', `"${transcript}"`);
        this.parseNaturalLanguage(transcript);
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition status:', event.error);
        this.isListening = false;
        this.updateMicUI(false);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.updateMicUI(false);
      };
    }
  }

  updateRecognitionLang() {
    if (!this.recognition) return;
    // In Tamil mode, recognition listens for regional/Tamil speech; in English mode for Indian English
    this.recognition.lang = this.currentLang === 'ta' ? 'ta-IN' : 'en-IN';
  }

  onLanguageChange(lang) {
    this.currentLang = lang;
    this.updateRecognitionLang();
    this.updateMicUI(this.isListening);
  }

  toggleListening() {
    if (!this.recognition) {
      const msg = this.currentLang === 'ta'
        ? 'இந்த உலாவியில் பேச்சு அறிதல் கிடைக்கவில்லை. கீழே உள்ள கட்டளைகளை கிளிக் செய்து சோதிக்கலாம்!'
        : 'Speech Recognition is unavailable in this browser environment. You can use the quick voice command chips below to simulate spoken inputs!';
      alert(msg);
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      try {
        this.updateRecognitionLang();
        this.recognition.start();
      } catch (err) {
        console.warn('Recognition start exception:', err);
      }
    }
  }

  updateMicUI(listening) {
    const micBtn = document.getElementById('voice-mic-btn');
    const statusEl = document.getElementById('voice-status-text');
    if (micBtn) {
      if (listening) {
        micBtn.classList.add('listening');
        micBtn.setAttribute('aria-pressed', 'true');
        if (statusEl) {
          statusEl.textContent = this.currentLang === 'ta'
            ? 'கேட்கிறது... தமிழ், ஆங்கிலம் அல்லது டங்கிலிஷில் பேசவும்.'
            : 'Listening... Speak in Tamil, English, or Tanglish.';
        }
      } else {
        micBtn.classList.remove('listening');
        micBtn.setAttribute('aria-pressed', 'false');
        if (statusEl) {
          statusEl.textContent = this.currentLang === 'ta'
            ? 'மைக் பட்டனை அழுத்தவும் அல்லது கீழே உள்ள கட்டளையைத் தொடவும்'
            : 'Tap mic or click command below to speak';
        }
      }
    }
  }

  /**
   * Deep Natural Language & Mixed-Language Intent Parser
   * Understands Tanglish, English, and Tamil script in BOTH modes.
   */
  parseNaturalLanguage(rawText) {
    const text = rawText.toLowerCase().trim();
    console.log('[NLP Intent Parser] Processing voice input:', text);

    // =======================================================================
    // 0. SAFETY GUARD / WRONG RECEIVER WARNING MODAL VOICE GATE
    // =======================================================================
    const fraudModal = document.getElementById('fraud-guard-modal');
    const isFraudActive = fraudModal && fraudModal.classList.contains('active');

    if (isFraudActive) {
      const isPositive = this.checkPositiveIntent(text);
      const isNegative = this.checkNegativeIntent(text);

      if (isPositive) {
        window.PaySimulator.dismissFraudWarning(true);
        return;
      }
      if (isNegative) {
        window.PaySimulator.dismissFraudWarning(false);
        return;
      }

      // Voice prompt when input is unclear
      window.TTSVoice.speak({
        ta: 'எச்சரிக்கையை ஏற்று தொடர "ஆம்" என்றும், ரத்து செய்ய "வேண்டாம்" என்றும் சொல்லவும்.',
        en: 'Say "Yes" or "Proceed" to continue, or "No" or "Cancel" to abort safely.'
      }, 'assertive');
      return;
    }

    // =======================================================================
    // 0B. BENEFICIARY DELETE CONFIRMATION MODAL VOICE GATE
    // =======================================================================
    const benDeleteModal = document.getElementById('beneficiary-delete-modal');
    const isBenDeleteActive = benDeleteModal && benDeleteModal.classList.contains('active');

    if (isBenDeleteActive) {
      const isPositive = this.checkPositiveIntent(text) || text.includes('delete') || text.includes('நீக்கு');
      const isNegative = this.checkNegativeIntent(text) || text.includes('keep') || text.includes('cancel') || text.includes('வேண்டாம்');

      if (isPositive) {
        window.PaySimulator.confirmDeleteBeneficiary();
        return;
      }
      if (isNegative) {
        window.PaySimulator.cancelDeleteBeneficiary();
        return;
      }

      window.TTSVoice.speak({
        ta: 'நீக்க "ஆம்" அல்லது "நீக்கு" என்றும், ரத்து செய்ய "வேண்டாம்" என்றும் சொல்லவும்.',
        en: 'Say "Yes delete" to confirm deletion, or "No cancel" to keep the contact.'
      }, 'assertive');
      return;
    }

    // =======================================================================
    // 1. CONFIRMATION GATE HANDLING (Payment Confirmation)
    // =======================================================================
    const promptSection = document.getElementById('voice-confirmation-prompt-section');
    const isConfirmActive = (window.PaySimulator && window.PaySimulator.currentView === 'view-confirm') ||
                            (promptSection && promptSection.style.display === 'block');

    if (isConfirmActive) {
      // Direct Biometric or Demo Triggers while on confirmation view
      if (
        text.includes('demo biometric') ||
        text.includes('biometric simulation') ||
        text.includes('demo simulation')
      ) {
        window.PaySimulator.triggerBiometricSimulation();
        return;
      }
      if (
        text.includes('fingerprint') ||
        text.includes('biometric') ||
        text.includes('kai regai') ||
        text.includes('touch id') ||
        text.includes('face id') ||
        text.includes('windows hello') ||
        text.includes('கைரேகை')
      ) {
        window.PaySimulator.authenticatePaymentBiometric();
        return;
      }

      const isPositive = this.checkPositiveIntent(text);
      const isNegative = this.checkNegativeIntent(text);

      if (isPositive) {
        window.PaySimulator.handleVoiceConfirmation(true);
        return;
      }
      if (isNegative) {
        window.PaySimulator.handleVoiceConfirmation(false);
        return;
      }

      // If neither clear yes nor no
      window.TTSVoice.speak({
        ta: 'கட்டணத்தை உறுதி செய்ய "ஆம்" அல்லது "கன்பார்ம்" என்று சொல்லவும், ரத்து செய்ய "வேண்டாம்" என்று சொல்லவும்.',
        en: 'Please say "Yes", "Confirm", or "Send" to complete payment, or "No" or "Cancel" to abort.'
      }, 'assertive');
      return;
    }

    // =======================================================================
    // 2. VOICE NAVIGATION COMMANDS
    // =======================================================================

    // A. Emergency Payment Stop & Safety Abort
    if (
      text.includes('emergency') ||
      text.includes('stop') ||
      text.includes('niruthu') ||
      text.includes('abort payment') ||
      text.includes('நிறுத்து') ||
      text.includes('அவசரம்') ||
      text.includes('ரத்து செய்') ||
      text === 'stop'
    ) {
      window.PaySimulator.emergencyStop();
      return;
    }

    // Update natural speech bubble
    const speechTextEl = document.getElementById('speech-transcript-text');
    const speechBox = document.getElementById('speech-transcript-box');
    if (speechTextEl) {
      speechTextEl.textContent = `“${rawText}”`;
    }
    if (speechBox) {
      speechBox.classList.remove('listening');
    }

    // =======================================================================
    // 2. GEMINI ASSISTANT API INTEGRATION (POST /api/assistant/chat)
    // =======================================================================
    if (window.GeminiAssistant && typeof window.GeminiAssistant.sendMessage === 'function') {
      this.callGeminiAssistant(rawText, text);
      return;
    }

    this.parseNaturalLanguageLocal(rawText, text);
  }

  async callGeminiAssistant(rawText, text) {
    try {
      const result = await window.GeminiAssistant.sendMessage(rawText, this.currentLang);
      if (result && result.intent && result.intent !== 'unknown') {
        console.log('[Gemini Assistant Success]:', result);
        this.handleAssistantIntent(result, rawText, text);
        return;
      }
    } catch (err) {
      console.warn('[Gemini Assistant]: Backend communication failed, using local deterministic parser:', err.message);
    }

    // Fallback to local parser if Gemini returned unknown or communication failed
    this.parseNaturalLanguageLocal(rawText, text);
  }

  handleAssistantIntent(result, rawText, text) {
    const { reply, language, intent, recipient, amount } = result;

    // A. Show assistant reply text in transcript bubble
    const speechTextEl = document.getElementById('speech-transcript-text');
    if (speechTextEl && reply) {
      speechTextEl.textContent = reply;
    }

    // B. Speak assistant reply using existing TTSVoice (preserves browser speechSynthesis)
    if (window.TTSVoice && reply) {
      window.TTSVoice.speak({
        ta: reply,
        en: reply
      });
    }

    // C. Route intent to existing application workflow
    switch (intent) {
      case 'payment_request':
        if (recipient && amount !== null && amount !== undefined) {
          window.AcousticHaptic.playDetected();
          // Deterministic confirmation screen flow remains authoritative
          window.PaySimulator.initiateVoicePayment(recipient, null, amount);
        } else if (recipient) {
          const contact = window.PaySimulator.findKnownContact(recipient);
          if (contact) {
            window.PaySimulator.selectContact(contact.name, contact.upiId);
          }
        }
        break;

      case 'balance_check':
        window.PaySimulator.checkBalanceVoice();
        break;

      case 'transaction_history':
        window.PaySimulator.speakTransactionHistoryVoice();
        break;

      case 'beneficiary_search':
        window.PaySimulator.searchBeneficiariesVoice(recipient || '');
        break;

      case 'scan_qr_help':
        window.PaySimulator.openScanner();
        break;

      case 'bill_payment_help':
        window.PaySimulator.voiceRechargeBill('Mobile Recharge');
        break;

      case 'bank_account_help':
        window.PaySimulator.startGuidedBankLinking(1);
        break;

      case 'accessibility_help':
        window.AccessibilityEngine.switchPersona('vision');
        break;

      case 'general_help':
        // Spoken guide already emitted by TTSVoice
        break;

      default:
        this.parseNaturalLanguageLocal(rawText, text);
        break;
    }
  }

  parseNaturalLanguageLocal(rawText, text) {
    // =======================================================================
    // BENEFICIARY & CONTACT VOICE COMMANDS
    // =======================================================================

    // 1. Save Beneficiary Form ("Save contact", "Save beneficiary", "சேமி")
    if (
      text.includes('save contact') ||
      text.includes('save beneficiary') ||
      text.includes('save details') ||
      text.includes('சேமி')
    ) {
      const formModal = document.getElementById('beneficiary-form-modal');
      if (formModal && formModal.classList.contains('active')) {
        window.PaySimulator.saveBeneficiaryForm();
        return;
      }
    }

    // 2. Add Beneficiary ("Add beneficiary", "Add Suresh", "New contact", "புதிய பெறுநர்")
    if (
      text.startsWith('add beneficiary') ||
      text.startsWith('add contact') ||
      text.startsWith('new contact') ||
      text.startsWith('new beneficiary') ||
      text.includes('புதிய பெறுநர்') ||
      text.includes('தொடர்பு சேர்')
    ) {
      window.PaySimulator.openAddBeneficiaryModal();
      return;
    }

    if (text.startsWith('add ')) {
      const parts = text.replace(/^add\s+/i, '').trim();
      const skipAdd = ['payment', 'money', 'card', 'bank', 'rupees', 'rooba', 'account'];
      if (parts && !skipAdd.includes(parts)) {
        window.PaySimulator.openAddBeneficiaryModal(parts.charAt(0).toUpperCase() + parts.slice(1));
        return;
      }
    }

    // 3. Set Mock UPI ID via Voice in Form Modal ("suresh upi id suresh@okaxis")
    if (text.includes('upi id') || text.includes('upi')) {
      const formModal = document.getElementById('beneficiary-form-modal');
      if (formModal && formModal.classList.contains('active')) {
        const upiMatch = text.match(/([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/i);
        if (upiMatch) {
          const upiInput = document.getElementById('ben-form-upi');
          if (upiInput) upiInput.value = upiMatch[1];
          window.TTSVoice.speak({
            ta: `யுபிஐ முகவரி ${upiMatch[1]} அமைக்கப்பட்டது. சேமிக்க "சேமி" என்று சொல்லவும்.`,
            en: `UPI ID set to ${upiMatch[1]}. Say "Save contact" to finish.`
          });
          return;
        }
      }
    }

    // 4. Edit Beneficiary ("Edit Kumar", "Edit Priya", "Change contact Ravi")
    if (text.startsWith('edit ') || text.startsWith('change contact ') || text.startsWith('திருத்து ')) {
      const targetName = text.replace(/^(edit|change contact|திருத்து)\s+/i, '').trim();
      const match = window.PaySimulator.findKnownContact(targetName);
      if (match) {
        window.PaySimulator.openEditBeneficiaryModal(match.id);
        return;
      }
    }

    // 5. Delete Beneficiary ("Delete Ravi", "Remove Anand", "நீக்கு")
    if (text.startsWith('delete ') || text.startsWith('remove ') || text.startsWith('நீக்கு ')) {
      const targetName = text.replace(/^(delete|remove|நீக்கு)\s+/i, '').trim();
      const match = window.PaySimulator.findKnownContact(targetName);
      if (match) {
        window.PaySimulator.promptDeleteBeneficiary(match.id);
        return;
      }
    }

    // 6. Favorites / Quick Pay Contacts ("Show favorites", "Favorite contacts", "விருப்பப் பட்டியல்")
    if (
      text.includes('show favorites') ||
      text.includes('favorite contacts') ||
      text.includes('quick pay contacts') ||
      text.includes('விருப்பப் பட்டியல்') ||
      text.includes('விருப்ப பெறுநர்கள்')
    ) {
      window.PaySimulator.openContactsView();
      window.PaySimulator.renderBeneficiariesList('fav');
      window.PaySimulator.speakFavoriteBeneficiaries();
      return;
    }

    // 7. Last Paid Beneficiary ("Last paid contact", "Recent beneficiary", "கடைசியாக அனுப்பியவர்")
    if (
      text.includes('last paid') ||
      text.includes('recent beneficiary') ||
      text.includes('recent contact') ||
      text.includes('கடைசியாக அனுப்பியவர்') ||
      text.includes('last contact')
    ) {
      window.PaySimulator.speakLastPaidContact();
      return;
    }

    // 8. Beneficiary Voice Search ("Find Kumar", "Search Priya", "Show Metro")
    if (
      text.startsWith('find ') ||
      text.startsWith('search contact ') ||
      (text.startsWith('search ') && !text.includes('payment') && !text.includes('transaction')) ||
      (text.startsWith('show ') && !text.includes('balance') && !text.includes('history') && !text.includes('screen') && !text.includes('qr'))
    ) {
      const q = text.replace(/^(find|search contact|search|show)\s+/i, '').trim();
      if (q && !['history', 'balance', 'qr', 'camera', 'screen', 'varalaaru', 'iruppu', 'favorites'].includes(q)) {
        window.PaySimulator.searchBeneficiariesVoice(q);
        return;
      }
    }

    // 9. Quick Pay Direct Trigger ("Quick pay Kumar", "Quick pay Kumar 500")
    if (text.startsWith('quick pay ')) {
      const rest = text.replace(/^quick pay\s+/i, '').trim();
      const match = window.PaySimulator.findKnownContact(rest);
      if (match) {
        const amt = this.extractAmountNumber(rest) || '500';
        window.PaySimulator.quickPayBeneficiary(match.id, amt);
        return;
      }
    }

    // Specific Bank Balance Queries
    if (text.includes('sbi balance') || text.includes('state bank balance') || text.includes('எஸ்பிஐ இருப்பு')) {
      window.PaySimulator.checkBankBalance('sbi');
      return;
    }
    if (text.includes('hdfc balance') || text.includes('ஹெச்டிஎஃப்சி இருப்பு')) {
      window.PaySimulator.checkBankBalance('hdfc');
      return;
    }
    if (text.includes('icici balance') || text.includes('ஐசிஐசிஐ இருப்பு')) {
      window.PaySimulator.checkBankBalance('icici');
      return;
    }
    if (text.includes('indian bank balance') || text.includes('இந்தியன் வங்கி இருப்பு')) {
      window.PaySimulator.checkBankBalance('indian_bank');
      return;
    }
    if (text.includes('canara bank balance') || text.includes('கனரா வங்கி இருப்பு') || text.includes('canara balance')) {
      window.PaySimulator.checkBankBalance('canara_bank');
      return;
    }

    // B. Voice Balance Check ("Balance evlo", "Check balance", "En balance sollu", "இருப்பு எவ்வளவு")
    if (
      text.includes('balance') ||
      text.includes('kanakku') ||
      text.includes('panam evlo') ||
      text.includes('iruppu') ||
      text.includes('இருப்பு') ||
      text.includes('கணக்கு') ||
      text.includes('பணம் எவ்வளவு')
    ) {
      window.PaySimulator.checkBalanceVoice();
      return;
    }

    // C. Payment Receipt Read Aloud ("Read receipt", "Bill padichu kaatu", "ரசீது வாசி")
    if (
      text.includes('receipt') ||
      text.includes('bill padichu') ||
      text.includes('rasidhu') ||
      text.includes('read receipt') ||
      text.includes('transaction summary') ||
      text.includes('ரசீது') ||
      text.includes('பில்')
    ) {
      window.PaySimulator.readReceiptAloud();
      return;
    }

    // D. Biometric / Fingerprint / Platform Authentication & Demo Simulation
    if (
      text.includes('demo biometric') ||
      text.includes('biometric simulation') ||
      text.includes('demo simulation')
    ) {
      window.PaySimulator.triggerBiometricSimulation();
      return;
    }

    if (
      text.includes('fingerprint') ||
      text.includes('biometric') ||
      text.includes('kai regai') ||
      text.includes('touch id') ||
      text.includes('face id') ||
      text.includes('windows hello') ||
      text.includes('கைரேகை')
    ) {
      window.PaySimulator.triggerBiometricAuth();
      return;
    }

    // E. Voice Search for Transactions ("Search Kumar", "Thedu", "தேடு")
    if (
      text.includes('search') ||
      text.includes('thedu') ||
      text.includes('find payment') ||
      text.includes('தேடு')
    ) {
      const query = text.replace(/search|thedu|for|payment|transactions|தேடு/gi, '').trim() || 'Kumar';
      window.PaySimulator.searchTransactionsVoice(query);
      return;
    }

    // F. Recharge & Bill Payments via Voice ("Mobile recharge", "Current bill", "மின்சாரம்")
    if (
      text.includes('recharge') ||
      text.includes('current bill') ||
      text.includes('electricity') ||
      text.includes('dth') ||
      text.includes('fastag') ||
      text.includes('ரீசார்ஜ்') ||
      text.includes('மின்சாரம்')
    ) {
      let billType = 'Mobile Recharge';
      if (text.includes('electricity') || text.includes('current') || text.includes('மின்சாரம்')) billType = 'Electricity Bill';
      else if (text.includes('dth')) billType = 'DTH TV';
      else if (text.includes('fastag')) billType = 'FASTag';
      window.PaySimulator.voiceRechargeBill(billType);
      return;
    }

    // G. Bank Selection & Guided Linking via Voice
    const isBankLinkingView = window.PaySimulator && window.PaySimulator.currentView === 'view-bank-linking';

    // Bank Selection commands: "SBI select pannu", "HDFC choose pannu", "Indian Bank", etc.
    if (
      text.includes('sbi select') ||
      text.includes('select sbi') ||
      text.includes('sbi choose') ||
      text.includes('choose sbi') ||
      text.includes('state bank select') ||
      text.includes('எஸ்பிஐ') ||
      (isBankLinkingView && (text.includes('sbi') || text.includes('state bank')))
    ) {
      if (!isBankLinkingView) window.PaySimulator.startGuidedBankLinking(1);
      window.PaySimulator.selectBankForLinking('sbi');
      return;
    }

    if (
      text.includes('hdfc select') ||
      text.includes('select hdfc') ||
      text.includes('hdfc choose') ||
      text.includes('choose hdfc') ||
      text.includes('hdfc bank') ||
      text.includes('ஹெச்டிஎஃப்சி') ||
      (isBankLinkingView && text.includes('hdfc'))
    ) {
      if (!isBankLinkingView) window.PaySimulator.startGuidedBankLinking(1);
      window.PaySimulator.selectBankForLinking('hdfc');
      return;
    }

    if (
      text.includes('icici select') ||
      text.includes('select icici') ||
      text.includes('icici choose') ||
      text.includes('choose icici') ||
      text.includes('icici bank') ||
      text.includes('ஐசிஐசிஐ') ||
      (isBankLinkingView && text.includes('icici'))
    ) {
      if (!isBankLinkingView) window.PaySimulator.startGuidedBankLinking(1);
      window.PaySimulator.selectBankForLinking('icici');
      return;
    }

    if (
      text.includes('indian bank select') ||
      text.includes('select indian bank') ||
      text.includes('indian bank choose') ||
      text.includes('indian bank') ||
      text.includes('இந்தியன் வங்கி') ||
      (isBankLinkingView && text.includes('indian'))
    ) {
      if (!isBankLinkingView) window.PaySimulator.startGuidedBankLinking(1);
      window.PaySimulator.selectBankForLinking('indian_bank');
      return;
    }

    if (
      text.includes('canara bank select') ||
      text.includes('select canara bank') ||
      text.includes('canara bank choose') ||
      text.includes('canara bank') ||
      text.includes('canara') ||
      text.includes('கனரா வங்கி')
    ) {
      if (!isBankLinkingView) window.PaySimulator.startGuidedBankLinking(1);
      window.PaySimulator.selectBankForLinking('canara_bank');
      return;
    }

    // Set Primary Account via Voice
    if (
      text.includes('primary account set') ||
      text.includes('set primary') ||
      text.includes('set as primary') ||
      text.includes('primary set pannu') ||
      text.includes('primary aaku') ||
      text.includes('முதல் நிலை')
    ) {
      if (isBankLinkingView && window.PaySimulator.currentLinkingStep === 5) {
        window.PaySimulator.finalizeGuidedLinking();
      } else if (window.PaySimulator.selectedBankForLinking) {
        window.PaySimulator.setPrimaryAccount(window.PaySimulator.selectedBankForLinking.id);
      } else {
        window.TTSVoice.speak({
          ta: 'முதல் நிலை கணக்கு அமைக்க விரும்பும் வங்கியைத் தேர்ந்தெடுக்கவும்.',
          en: 'Please choose which bank account to set as primary.'
        });
      }
      return;
    }

    // Guided Linking Flow Controls ("Next", "Cancel", "Confirm")
    if (isBankLinkingView) {
      if (
        text.includes('next') ||
        text.includes('aduthu') ||
        text.includes('அடுத்து') ||
        text.includes('continue') ||
        text.includes('confirm') ||
        text.includes('உறுதி')
      ) {
        const step = window.PaySimulator.currentLinkingStep;
        if (step === 1) window.PaySimulator.goToLinkingStep(2);
        else if (step === 2) window.PaySimulator.confirmMobileStep();
        else if (step === 4) window.PaySimulator.proceedToPrimaryStep();
        else if (step === 5) window.PaySimulator.finalizeGuidedLinking();
        return;
      }

      if (
        text.includes('cancel') ||
        text.includes('ரத்து') ||
        text.includes('venaam') ||
        text.includes('வேண்டாம்')
      ) {
        window.PaySimulator.cancelBankLinking();
        return;
      }
    }

    // General "Link Bank" trigger
    if (
      text.includes('link bank') ||
      text.includes('bank link') ||
      text.includes('vangi inaippu') ||
      text.includes('connect bank') ||
      text.includes('வங்கி இணைப்பு') ||
      text.includes('bank account link')
    ) {
      window.PaySimulator.linkBankAccountVoice();
      return;
    }

    // View Linked Accounts
    if (
      text.includes('view linked accounts') ||
      text.includes('linked accounts') ||
      text.includes('linked banks') ||
      text.includes('manage bank') ||
      text.includes('இணைக்கப்பட்ட வங்கிகள்')
    ) {
      window.PaySimulator.switchView('view-profile');
      window.TTSVoice.speak({
        ta: 'இணைக்கப்பட்ட வங்கிக் கணக்குகள் பட்டியல் காட்டப்படுகிறது.',
        en: 'Showing list of linked bank accounts.'
      });
      return;
    }

    // Voice Language Switch Commands
    if (
      text.includes('tamil-la pesu') ||
      text.includes('tamil pesu') ||
      text.includes('speak in tamil') ||
      text === 'tamil' ||
      text.includes('தமிழ்')
    ) {
      if (window.I18n) window.I18n.setLanguage('ta');
      else window.TTSVoice.setLanguage('ta');
      return;
    }
    if (
      text.includes('english-la pesu') ||
      text.includes('speak in english') ||
      text.includes('english pesu') ||
      text === 'english' ||
      text.includes('ஆங்கிலம்')
    ) {
      if (window.I18n) window.I18n.setLanguage('en');
      else window.TTSVoice.setLanguage('en');
      return;
    }

    // H. "Home-ku po" / "Go Home" / "Mugappu" / "முகப்பு"
    if (
      text.includes('home') ||
      text.includes('mugappu') ||
      text.includes('main page') ||
      text.includes('home-ku') ||
      text.includes('home ku') ||
      text.includes('முகப்பு') ||
      text.includes('ஹோம்')
    ) {
      window.PaySimulator.goHome();
      window.TTSVoice.speak({
        ta: 'முகப்புப் பக்கத்திற்குத் திரும்பினோம்.',
        en: 'Returned to Home.'
      });
      return;
    }

    // I. "History kaatu" / "Recent transactions" / "Varalaaru" / "வரலாறு"
    if (
      text.includes('history') ||
      text.includes('varalaaru') ||
      text.includes('recent') ||
      text.includes('activity') ||
      text.includes('past transaction') ||
      text.includes('வரலாறு') ||
      text.includes('பரிவர்த்தனை')
    ) {
      window.PaySimulator.speakTransactionHistoryVoice();
      return;
    }

    // J. "Send Money open pannu" / "Pay contacts" / "தொடர்புகள்"
    if (
      text.includes('send money open') ||
      text.includes('pay contacts') ||
      text.includes('contacts list') ||
      text.includes('contacts open') ||
      text.includes('தொடர்புகள்')
    ) {
      window.PaySimulator.openContactsView();
      return;
    }

    // K. "Back po" / "Pinnaadi po" / "Go back" / "பின்னே"
    if (
      text.includes('back') ||
      text.includes('pinnaadi') ||
      text.includes('pinnadi') ||
      text.includes('previous') ||
      text.includes('பின்னே') ||
      text.includes('பின்னாடி')
    ) {
      window.PaySimulator.navigateBack();
      return;
    }

    // L. "Scan QR" / "QR Scanner open pannu" / "Camera open pannu" / "ஸ்கேன்"
    if (
      text.includes('scan qr') ||
      text.includes('qr scan') ||
      text.includes('scanner') ||
      text.includes('camera') ||
      text.includes('ஸ்கேன்') ||
      text === 'scan'
    ) {
      window.PaySimulator.openScanner();
      return;
    }

    // M. "Read Screen" / "Screen-la enna irukku" / "Explain" / "திரை வாசி"
    if (
      text.includes('read') ||
      text.includes('screen') ||
      text.includes('enna irukku') ||
      text.includes('explain') ||
      text.includes('padichu kaatu') ||
      text.includes('திரை')
    ) {
      window.ScreenInspector.inspectCurrentScreen();
      return;
    }

    // N. High Contrast / Blind Mode / Accessibility Switching
    if (
      text.includes('vision') ||
      text.includes('blind') ||
      text.includes('paarvai') ||
      text.includes('high contrast') ||
      text.includes('contrast') ||
      text.includes('பார்வை')
    ) {
      window.AccessibilityEngine.switchPersona('vision');
      return;
    }
    if (text.includes('hearing') || text.includes('deaf') || text.includes('sevi') || text.includes('செவி')) {
      window.AccessibilityEngine.switchPersona('hearing');
      return;
    }
    if (text.includes('motor') || text.includes('mobility') || text.includes('kai') || text.includes('இயக்கம்')) {
      window.AccessibilityEngine.switchPersona('motor');
      return;
    }
    if (text.includes('cognitive') || text.includes('simple') || text.includes('easy') || text.includes('எளிய')) {
      window.AccessibilityEngine.switchPersona('cognitive');
      return;
    }
    if (text.includes('standard') || text.includes('default') || text.includes('normal') || text.includes('இயல்பு')) {
      window.AccessibilityEngine.switchPersona('default');
      return;
    }

    // =======================================================================
    // 3. FULL VOICE PAYMENT INITIATION (FastAPI Backend Integration)
    // =======================================================================
    const isPaymentCommand =
      text.includes('pay') ||
      text.includes('send') ||
      text.includes('transfer') ||
      text.includes('anuppu') ||
      text.includes('kudu') ||
      text.includes('kudunga') ||
      text.includes('podu') ||
      text.includes('rooba') ||
      text.includes('roobai') ||
      text.includes('rupees') ||
      text.includes('rs') ||
      text.includes('kumar') ||
      text.includes('priya') ||
      text.includes('ravi') ||
      text.includes('metro') ||
      text.includes('anand') ||
      text.includes('ரூபாய்') ||
      text.includes('அனுப்பு') ||
      text.includes('செலுத்து') ||
      text.includes('கொடு') ||
      text.includes('குமார்') ||
      text.includes('பிரியா') ||
      text.includes('ரவி') ||
      text.includes('மெட்ரோ') ||
      text.includes('ஆனந்த்');

    if (isPaymentCommand) {
      this.sendVoicePaymentToFastAPI(rawText);
      return;
    }

    // Fallback if intent not recognized
    window.TTSVoice.speak({
      ta: `கேட்டது: "${rawText}". நீங்கள் "குமாருக்கு 500 ரூபாய் அனுப்பு", "க்யூஆர் ஸ்கேன்", "வரலாறு", அல்லது "முகப்பு" என்று சொல்லலாம்.`,
      en: `Heard: "${rawText}". You can say "Send 500 to Kumar", "Scan QR", "Show history", or "Go home".`
    });
  }

  /**
   * Sends speech text to FastAPI backend (http://127.0.0.1:8000/api/voice/parse-payment)
   */
  async sendVoicePaymentToFastAPI(speechText) {
    // Update natural speech bubble
    const speechTextEl = document.getElementById('speech-transcript-text');
    const speechBox = document.getElementById('speech-transcript-box');
    if (speechTextEl) {
      speechTextEl.textContent = `“${speechText}”`;
    }
    if (speechBox) {
      speechBox.classList.remove('listening');
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/api/voice/parse-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speech_text: speechText })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[Voice Payment Parsed]:', data);

      if (data.success && data.recipient && data.amount !== null) {
        window.AcousticHaptic.playDetected();
        // Route to payment confirmation screen
        window.PaySimulator.initiateVoicePayment(data.recipient, data.upi_id, data.amount);
      } else {
        window.AcousticHaptic.playWarning();
        window.TTSVoice.speak({
          ta: 'கட்டண விவரங்களைப் புரிந்து கொள்ள முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
          en: data.message || 'Could not understand payment details. Please try again.'
        }, 'assertive');
      }

      return data;
    } catch (err) {
      console.warn('[Backend Connection Fallback]:', err.message);

      // Local graceful fallback for offline/resilience
      const localResult = this.extractPaymentDetails(speechText.toLowerCase());
      if (localResult) {
        window.PaySimulator.initiateVoicePayment(localResult.recipient, localResult.upiId, localResult.amount);
      } else {
        window.TTSVoice.speak({
          ta: 'பெறுநர் மற்றும் தொகையைக் குறிப்பிடவும், உதாரணமாக "குமாருக்கு 500 ரூபாய் அனுப்பு".',
          en: 'Please specify recipient and amount, like "Send 500 to Kumar".'
        });
      }
    }
  }

  // Check positive affirmation in English, Tamil, Tanglish
  checkPositiveIntent(text) {
    const positiveWords = [
      'aama', 'aamam', 'aam', 'yes', 'confirm', 'sari', 'seri',
      'ok', 'okay', 'anuppu', 'proceed', 'send', 'pay', 'kudunga',
      'correct', 'panlam', 'pannu', 'sure', 'kudu',
      'ஆம்', 'ஆமாம்', 'ஆமா', 'சரி', 'உறுதி', 'அனுப்பு', 'செலுத்து', 'செய்', 'கொடு'
    ];
    return positiveWords.some(w => text.includes(w));
  }

  // Check negative cancellation in English, Tamil, Tanglish
  checkNegativeIntent(text) {
    const negativeWords = [
      'vendam', 'vendaam', 'venam', 'no', 'cancel', 'stop', 'illa',
      'illai', 'dont', "don't", 'abort', 'close', 'thavirthidu', 'reject',
      'வேண்டாம்', 'வேணாம்', 'இல்லை', 'ரத்து', 'நிறுத்து', 'தவிர்'
    ];
    return negativeWords.some(w => text.includes(w));
  }

  /**
   * Extracts Recipient and Amount from mixed natural speech in Tamil, Tanglish, or English
   */
  extractPaymentDetails(text) {
    let recipient = null;
    let upiId = null;

    // Check dynamic beneficiaries directory first
    if (window.PaySimulator && typeof window.PaySimulator.findKnownContact === 'function') {
      const known = window.PaySimulator.findKnownContact(text);
      if (known) {
        recipient = known.name;
        upiId = known.upiId;
      }
    }

    if (!recipient) {
      if (text.includes('kumar') || text.includes('குமார்') || text.includes('குமாருக்கு')) {
        recipient = 'Kumar Groceries';
        upiId = 'kumar.store@okhdfcbank';
      } else if (text.includes('priya') || text.includes('பிரியா') || text.includes('பிரியாவுக்கு')) {
        recipient = 'Priya Medicals';
        upiId = 'priya.pharmacy@okaxis';
      } else if (text.includes('metro') || text.includes('மெட்ரோ') || text.includes('மெட்ரோவுக்கு')) {
        recipient = 'Metro Transport';
        upiId = 'metro.ride@icici';
      } else if (text.includes('ravi') || text.includes('ரவி') || text.includes('ரவிக்கு')) {
        recipient = 'Ravi Milk Depot';
        upiId = 'ravi.milk@sbi';
      } else if (text.includes('anand') || text.includes('ஆனந்த்') || text.includes('ஆனந்துக்கு')) {
        recipient = 'Anand Kumar';
        upiId = 'anand.kumar@okhdfcbank';
      } else {
        // Check for unknown recipient candidate names in Tanglish or English
        // A. Tanglish suffix: "Suresh-ku", "Suresh ku", "Suresh-kku", "ரமேஷ்க்கு"
        const tanglishMatch = text.match(/\b([a-zA-Z\u0B80-\u0BFF]+)(?:-ku|-kku|\s+ku|\s+kku)\b/i);
        if (tanglishMatch) {
          const candidate = tanglishMatch[1].trim();
          const skip = ['pay', 'send', 'money', 'rupees', 'rooba', 'roobai', 'anuppu', 'kudu', 'panam', 'rs'];
          if (!skip.includes(candidate.toLowerCase())) {
            recipient = candidate.charAt(0).toUpperCase() + candidate.slice(1);
            upiId = null; // Do NOT auto-create fake UPI handle
          }
        }

        // B. English / Tanglish commands: "send 1000 to Suresh", "pay Suresh", "transfer to Suresh"
        if (!recipient) {
          const englishMatch = text.match(/(?:send|pay|transfer)\s+(?:money\s+|panam\s+)?(?:(?:(?:\d+|five hundred|hundred|thousand)\s*(?:rupees?|rs|rooba|roobai|ரூபாய்)?)\s*)?(?:to\s+)?([a-zA-Z\u0B80-\u0BFF]+)/i);
          if (englishMatch) {
            const candidate = englishMatch[1].trim();
            const skip = ['money', 'rupees', 'rooba', 'roobai', 'rs', 'to', 'for', 'cash', 'bill', 'panam', 'fastag'];
            if (!skip.includes(candidate.toLowerCase())) {
              recipient = candidate.charAt(0).toUpperCase() + candidate.slice(1);
              upiId = null; // Do NOT auto-create fake UPI handle
            }
          }
        }

        // Check if candidate matches a registered beneficiary
        if (recipient && !upiId && window.PaySimulator && typeof window.PaySimulator.findKnownContact === 'function') {
          const matchedBen = window.PaySimulator.findKnownContact(recipient);
          if (matchedBen) {
            recipient = matchedBen.name;
            upiId = matchedBen.upiId;
          }
        }
      }
    }

    let amount = this.extractAmountNumber(text);

    const hasPayIntent =
      text.includes('pay') ||
      text.includes('send') ||
      text.includes('anuppu') ||
      text.includes('transfer') ||
      text.includes('kudu') ||
      text.includes('rooba') ||
      text.includes('rupees') ||
      text.includes('rs') ||
      text.includes('ரூபாய்') ||
      text.includes('அனுப்பு') ||
      text.includes('செலுத்து');

    if (recipient || hasPayIntent) {
      return {
        recipient: recipient || 'Unknown Payee',
        upiId: upiId, // null if unverified, no fake handles
        amount: amount || '500'
      };
    }

    return null;
  }

  /**
   * Number Extractor supporting digits, Tanglish, Tamil, and English number words
   */
  extractAmountNumber(text) {
    const digitMatch = text.match(/\b\d+\b/);
    if (digitMatch) {
      return digitMatch[0];
    }

    // Tanglish / Tamil / English Numbers
    if (
      text.includes('ainooru') ||
      text.includes('ayinooru') ||
      text.includes('anooru') ||
      text.includes('five hundred') ||
      text.includes('ஐநூறு')
    ) {
      return '500';
    }
    if (
      text.includes('nooru') ||
      text.includes('nuru') ||
      text.includes('one hundred') ||
      text.includes('hundred') ||
      text.includes('நூறு')
    ) {
      return '100';
    }
    if (text.includes('irunooru') || text.includes('two hundred') || text.includes('இருநூறு')) {
      return '200';
    }
    if (text.includes('munnooru') || text.includes('three hundred') || text.includes('முந்நூறு')) {
      return '300';
    }
    if (text.includes('naanooru') || text.includes('four hundred') || text.includes('நானூறு')) {
      return '400';
    }
    if (
      text.includes('aayiram') ||
      text.includes('ayiram') ||
      text.includes('one thousand') ||
      text.includes('thousand') ||
      text.includes('ஆயிரம்')
    ) {
      return '1000';
    }
    if (text.includes('irandaayiram') || text.includes('two thousand') || text.includes('இரண்டாயிரம்')) {
      return '2000';
    }
    if (text.includes('aimbadhu') || text.includes('aimbathu') || text.includes('fifty') || text.includes('ஐம்பது')) {
      return '50';
    }

    return null;
  }
}

// Global instance
window.STTListener = new STTListenerEngine();
