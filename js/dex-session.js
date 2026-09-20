/**
 * OneAbility AI - Dex Continuous Conversational Assistant Engine
 * 
 * Implements:
 * 1. Single-tap activation ("Talk to Dex")
 * 2. Natural wake name response ("Dex" -> "Haan Sandhiya, sollunga.")
 * 3. Continuous turn-taking conversation loop:
 *    User speaks -> Dex listens -> Dex thinks -> Dex replies -> Dex resumes listening
 * 4. Echo prevention: Mic paused while Dex speaks, resumed when finished
 * 5. Real-time application state context injection (balance, expense, bills, transactions)
 * 6. Non-executing payment review safety gate (never executes payments from voice alone)
 * 7. Safe session termination ("Stop", "Niruthu", "போதும்", Stop button, Emergency Stop)
 */

class DexSessionManager {
  constructor() {
    this.isActive = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.isThinking = false;
    this.status = 'Ready'; // 'Listening', 'Thinking', 'Speaking', 'Ready', 'Stopped'
    this.sttEngine = null;
    this.activeLanguage = 'ta';

    // Short-Term Conversational Session Memory (Section 3)
    this.sessionMemory = {
      topic: null,                     // e.g. "monthly_expenses", "bills", "payment", "general"
      last_user_request: null,
      last_selected_bill: null,        // e.g. "Electricity"
      last_selected_beneficiary: null, // e.g. "Kumar"
      last_mentioned_amount: null,     // e.g. 500
      last_discussed_month: 'current', // "current" or "last"
      last_discussed_category: null,   // "food", "medical", "transport", "bills"
      pending_action: null,            // "awaiting_payment_amount", "awaiting_payment_confirmation", "awaiting_bill_payment_confirmation"
      history: []                      // List of recent { user, dex } turns
    };
  }

  resetMemory() {
    this.sessionMemory = {
      topic: null,
      last_user_request: null,
      last_selected_bill: null,
      last_selected_beneficiary: null,
      last_mentioned_amount: null,
      last_discussed_month: 'current',
      last_discussed_category: null,
      pending_action: null,
      history: []
    };
  }

  init() {
    this.bindDomElements();
  }

  bindDomElements() {
    const stopBtn = document.getElementById('btn-stop-dex');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopSession());
    }

    const talkToDexBtn = document.getElementById('btn-talk-to-dex');
    if (talkToDexBtn) {
      talkToDexBtn.addEventListener('click', () => this.toggleSession());
    }

    const actionTalkDex = document.getElementById('action-talk-dex');
    if (actionTalkDex) {
      actionTalkDex.addEventListener('click', () => this.startSession());
    }

    const emergencyStop = document.getElementById('btn-emergency-stop');
    if (emergencyStop) {
      emergencyStop.addEventListener('click', () => {
        if (this.isActive) this.stopSession();
      });
    }
  }

  toggleSession() {
    if (this.isActive) {
      this.stopSession();
    } else {
      this.startSession();
    }
  }

  startSession() {
    this.isActive = true;
    this.showPanel();
    this.updateStatus('Ready');

    const userName = (window.UserManager && typeof window.UserManager.getAssistantCallName === 'function')
      ? window.UserManager.getAssistantCallName()
      : 'Sandhiya';

    const preferredLang = (window.I18n && window.I18n.currentLang) || 'ta';
    this.activeLanguage = preferredLang;

    // Reset transcript UI
    this.setUserTranscript(preferredLang === 'ta' ? 'பேசுங்கள்...' : 'Listening to you...');
    this.setAgentTranscript(preferredLang === 'ta' ? `வணக்கம் ${userName}, நான் டெக்ஸ். சொல்லுங்கள்!` : `Hello ${userName}, I'm Dex. How can I help?`);

    // Greet and immediately start continuous listening
    const greeting = preferredLang === 'ta' ? `வணக்கம் ${userName}!` : `Hello ${userName}!`;
    this.speakAndResumeListening(greeting, preferredLang);
  }

  stopSession() {
    this.isActive = false;
    this.updateStatus('Stopped');
    this.resetMemory();

    if (window.TTSVoice) {
      window.TTSVoice.stopAllAudio();
    }

    if (this.sttEngine && typeof this.sttEngine.stop === 'function') {
      try { this.sttEngine.stop(); } catch (e) {}
    }

    this.hidePanel();

    const userName = (window.UserManager && typeof window.UserManager.getAssistantCallName === 'function')
      ? window.UserManager.getAssistantCallName()
      : 'Sandhiya';

    if (window.TTSVoice && typeof window.TTSVoice.speak === 'function') {
      const msg = this.activeLanguage === 'ta' ? `சரி ${userName}, முடித்துவிட்டேன்.` : `Okay ${userName}, session ended.`;
      window.TTSVoice.speak({ ta: msg, en: msg });
    }
  }

  showPanel() {
    const panel = document.getElementById('dex-session-panel');
    if (panel) {
      panel.style.display = 'block';
      panel.classList.remove('fade-out');
    }
    const talkBtn = document.getElementById('btn-talk-to-dex');
    if (talkBtn) talkBtn.classList.add('session-active');
  }

  hidePanel() {
    const panel = document.getElementById('dex-session-panel');
    if (panel) {
      panel.classList.add('fade-out');
      setTimeout(() => {
        if (!this.isActive) panel.style.display = 'none';
      }, 300);
    }
    const talkBtn = document.getElementById('btn-talk-to-dex');
    if (talkBtn) talkBtn.classList.remove('session-active');
  }

  updateStatus(status) {
    this.status = status;
    const label = document.getElementById('dex-status-label');
    const pill = document.getElementById('dex-session-status');

    if (label) label.textContent = status;
    if (pill) {
      pill.className = 'dex-status-pill ' + status.toLowerCase();
    }
  }

  setUserTranscript(text) {
    const el = document.getElementById('dex-user-speech-text');
    if (el) el.textContent = text;
  }

  setAgentTranscript(text) {
    const el = document.getElementById('dex-agent-speech-text');
    if (el) el.textContent = text;
  }

  /**
   * Starts or resumes listening using browser Web Speech API with pause/resume support
   */
  resumeListening() {
    if (!this.isActive || this.isSpeaking) return;

    this.updateStatus('Listening');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.setAgentTranscript('Speech recognition is not supported in this browser.');
      return;
    }

    if (!this.sttEngine) {
      this.sttEngine = new SpeechRecognition();
      this.sttEngine.continuous = false; // We control turn-taking cleanly
      this.sttEngine.interimResults = true;
      this.sttEngine.maxAlternatives = 1;

      this.sttEngine.onstart = () => {
        this.isListening = true;
        this.updateStatus('Listening');
      };

      this.sttEngine.onresult = (event) => {
        let interim = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          this.setUserTranscript(interim);
        }

        if (finalTranscript.trim()) {
          this.setUserTranscript(finalTranscript.trim());
          this.handleUserUtterance(finalTranscript.trim());
        }
      };

      this.sttEngine.onerror = (e) => {
        this.isListening = false;
        if (e.error === 'no-speech' && this.isActive && !this.isSpeaking) {
          // Restart gracefully
          setTimeout(() => this.resumeListening(), 600);
        } else if (e.error !== 'aborted') {
          console.warn('[DexSession] STT error:', e.error);
        }
      };

      this.sttEngine.onend = () => {
        this.isListening = false;
        // If still active and not speaking, keep waiting/listening
        if (this.isActive && !this.isSpeaking && !this.isThinking) {
          setTimeout(() => this.resumeListening(), 400);
        }
      };
    }

    // Configure language: Tanglish voice understands ta-IN and en-IN
    this.sttEngine.lang = this.activeLanguage === 'ta' ? 'ta-IN' : 'en-IN';

    try {
      this.sttEngine.start();
    } catch (err) {
      // Already running or starting
    }
  }

  pauseListening() {
    this.isListening = false;
    if (this.sttEngine) {
      try {
        this.sttEngine.stop();
      } catch (e) {}
    }
  }

  /**
   * Process a recognized sentence through Gemini & deterministic real-time context
   */
  async handleUserUtterance(sentence) {
    if (!this.isActive) return;

    // 1. Pause microphone immediately to prevent Dex from hearing its own voice
    this.pauseListening();
    this.isThinking = true;
    this.updateStatus('Thinking');

    // 2. Strict PIN Safety Guard (Section 18)
    // Never repeat, store, or forward spoken PINs/passwords
    const lowerSentence = sentence.toLowerCase().trim();
    const isPinSpoken = /\b(pin|otp|password|cvv|secret)\b/.test(lowerSentence);
    const isAmountContext = this.sessionMemory.pending_action === 'awaiting_payment_amount' || /\b(rooba|rupees|rs|\$|₹)\b/.test(lowerSentence);
    if (isPinSpoken && !isAmountContext) {
      this.isThinking = false;
      const userName = (window.UserManager && typeof window.UserManager.getAssistantCallName === 'function')
        ? window.UserManager.getAssistantCallName()
        : 'Sandhiya';
      const warningText = this.activeLanguage === 'ta'
        ? `பாதுகாப்பு எச்சரிக்கை ${userName}: உங்கள் பின் எண்ணை குரலில் சொல்ல வேண்டாம். திரையில் பாதுகாப்பாக உள்ளிடவும்.`
        : `Security notice ${userName}: Never speak your PIN or password out loud. Please enter it securely on screen.`;
      this.setAgentTranscript(warningText);
      this.speakAndResumeListening(warningText, this.activeLanguage);
      return;
    }

    // 3. Build live application state context with session memory
    const sim = window.PaySimulator;
    const context = {
      preferred_name: (window.UserManager && typeof window.UserManager.getAssistantCallName === 'function')
        ? window.UserManager.getAssistantCallName()
        : 'Sandhiya',
      current_balance: sim ? sim.getCurrentBalanceFormatted() : '24,850.00',
      monthly_expense: sim ? sim.getMonthlyExpenseFormatted() : '5,350',
      last_month_expense: '4,750',
      due_bills_tamil: sim ? sim.getDueBillsTamilSummary() : 'ஒரு electricity bill மற்றும் ஒரு mobile recharge due இருக்கு',
      due_bills_english: sim ? sim.getDueBillsEnglishSummary() : 'you have an electricity bill and a mobile recharge due',
      last_transaction_tamil: sim ? sim.getLastTransactionTamil() : 'Kumar Groceries-க்கு ₹450',
      last_transaction_english: sim ? sim.getLastTransactionEnglish() : '₹450 to Kumar Groceries',
      session_memory: this.sessionMemory
    };

    // Detect language of the utterance
    const isTamilChar = /[\u0B80-\u0BFF]/.test(sentence);
    const targetLang = isTamilChar ? 'ta' : this.activeLanguage;

    try {
      let response = null;
      if (window.GeminiAssistant) {
        response = await window.GeminiAssistant.sendMessage(sentence, targetLang, context);
      }

      this.isThinking = false;
      if (response && response.reply) {
        this.setAgentTranscript(response.reply);

        // Update short-term session memory from response
        if (response.updated_memory) {
          Object.assign(this.sessionMemory, response.updated_memory);
        }
        if (!this.sessionMemory.history) this.sessionMemory.history = [];
        this.sessionMemory.history.push({ user: sentence, dex: response.reply });
        if (this.sessionMemory.history.length > 8) this.sessionMemory.history.shift();

        // Check for session stop intent
        if (response.intent === 'session_stop' || response.action === 'stop_dex') {
          this.speakAndStop(response.reply, response.language || targetLang);
          return;
        }

        // Speak reply and execute any accompanied UI action
        this.speakAndResumeListening(response.reply, response.language || targetLang, () => {
          this.executeAction(response);
        });
      } else {
        // Safe conversational fallback
        const fallbackReply = targetLang === 'ta'
          ? `${context.preferred_name}, நான் உங்கள் கட்டளைக்கு தயாராக உள்ளேன்.`
          : `${context.preferred_name}, I am ready for your next request.`;
        this.setAgentTranscript(fallbackReply);
        this.speakAndResumeListening(fallbackReply, targetLang);
      }
    } catch (err) {
      console.warn('[DexSession] Chat request error:', err);
      this.isThinking = false;
      const safeReply = targetLang === 'ta'
        ? `சரி ${context.preferred_name}, சொல்லுங்கள்.`
        : `Yes ${context.preferred_name}, how can I help?`;
      this.setAgentTranscript(safeReply);
      this.speakAndResumeListening(safeReply, targetLang);
    }
  }

  /**
   * Plays audio response cleanly, pausing STT, and automatically resumes listening when speech ends
   */
  speakAndResumeListening(text, lang, onEndCallback = null) {
    if (!this.isActive) return;

    this.isSpeaking = true;
    this.updateStatus('Speaking');

    if (window.TTSVoice && typeof window.TTSVoice.speakDex === 'function') {
      window.TTSVoice.speakDex(
        text,
        lang,
        () => {
          // On speech start: keep listening paused
          this.pauseListening();
        },
        () => {
          // On speech finish:
          this.isSpeaking = false;
          if (typeof onEndCallback === 'function') {
            try { onEndCallback(); } catch (e) { console.error(e); }
          }
          if (this.isActive) {
            this.updateStatus('Ready');
            setTimeout(() => {
              if (this.isActive && !this.isSpeaking) {
                this.resumeListening();
              }
            }, 300);
          }
        }
      );
    } else {
      // Fallback timer if TTSVoice not ready
      setTimeout(() => {
        this.isSpeaking = false;
        if (typeof onEndCallback === 'function') onEndCallback();
        if (this.isActive) this.resumeListening();
      }, 2000);
    }
  }

  speakAndStop(text, lang) {
    this.isSpeaking = true;
    this.updateStatus('Speaking');

    if (window.TTSVoice && typeof window.TTSVoice.speakDex === 'function') {
      window.TTSVoice.speakDex(text, lang, null, () => {
        this.isSpeaking = false;
        this.stopSession();
      });
    } else {
      this.stopSession();
    }
  }

  /**
   * Executes safe, deterministic application actions (NEVER automatic debits)
   */
  executeAction(response) {
    const action = response.action;
    const sim = window.PaySimulator;
    if (!sim) return;

    if (action === 'read_balance' || response.intent === 'balance_check') {
      sim.revealBalance();
    } else if (action === 'open_scanner' || response.intent === 'open_scanner') {
      sim.open_scan();
    } else if (action === 'show_history' || response.intent === 'transaction_history') {
      sim.switchView('view-history');
    } else if (action === 'list_bills' || response.intent === 'bill_inquiry') {
      sim.open_bills();
    } else if (action === 'open_bill_electricity' || response.intent === 'open_bill') {
      sim.open_bill_details('Electricity');
    } else if (action === 'pay_bill_electricity' || response.intent === 'pay_bill') {
      sim.initiateBillPayment('Electricity', 840);
    } else if (action === 'review_payment' || response.intent === 'payment_request') {
      const recipient = response.recipient || this.sessionMemory.last_selected_beneficiary || 'Kumar';
      const amount = response.amount || this.sessionMemory.last_mentioned_amount || 500;
      // Opens payment confirmation review screen for explicit user verification.
      // NEVER executes payment automatically!
      sim.prepare_payment(recipient, amount);
    } else if (action === 'prompt_authentication' || response.intent === 'action_confirmation') {
      if (window.AcousticHaptic) window.AcousticHaptic.playFocus();
      const pinInput = document.getElementById('confirm-pin-display') || document.querySelector('.btn-confirm-payment');
      if (pinInput) pinInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (action === 'cancel_pending_action' || response.intent === 'action_cancellation') {
      sim.cancel_pending_action();
    } else if (action === 'navigate_back' || response.intent === 'navigate_back') {
      sim.navigate_back();
    } else if (action === 'read_category_expense') {
      if (window.AcousticHaptic) window.AcousticHaptic.playSuccess();
    }
  }
}

// Instantiate singleton
window.DexSession = new DexSessionManager();

// Automatically initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.DexSession.init();
});
