/**
 * OneAbility AI - Multilingual Speech Synthesis Engine
 * Dedicated Bilingual Support: தமிழ் (Tamil) • English
 * 
 * Specifically optimized for blind and visually impaired users:
 * 1. Strictly enforces selected language:
 *    - In English mode: UI text and voice responses are in English.
 *    - In Tamil mode: UI text and voice responses are in Tamil.
 *    - DO NOT speak English when Tamil mode is selected.
 * 2. Automatic native Tamil voice detection ('ta-IN', Google தமிழ், Microsoft Valluvar/Pallavi).
 * 3. Safe fallback to ta-IN browser locale synthesis without ever reverting to English speech.
 */

class TTSVoiceEngine {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.currentLang = 'ta'; // Default to Tamil as requested
    this.rate = 1.0;
    this.pitch = 1.0;
    this.isVoiceEnabled = true;
    this.voices = [];

    this.tamilVoice = null;
    this.indianVoice = null;
    this.englishVoice = null;
    this.selectedVoice = null;

    // Translation dictionary for direct English string conversion when in Tamil mode
    this.stringTranslations = {
      'Returned to Home.': 'முகப்புப் பக்கத்திற்குத் திரும்பினோம்.',
      'Already on Home screen.': 'நீங்கள் ஏற்கனவே முகப்பு பக்கத்தில் உள்ளீர்கள்.',
      'Returned to previous screen.': 'முந்தைய பக்கத்திற்குத் திரும்பினோம்.',
      'Payment Cancelled.': 'பரிவர்த்தனை ரத்து செய்யப்பட்டது.',
      'Processing mock payment...': 'பரிவர்த்தனை செயல்படுத்தப்படுகிறது...',
      'PIN cleared.': 'பின் எண் அழிக்கப்பட்டது.',
      'Flashlight turned ON.': 'ஃப்ளாஷ்லைட் இயக்கப்பட்டது.',
      'Flashlight turned OFF.': 'ஃப்ளாஷ்லைட் அணைக்கப்பட்டது.',
      'Vision Assist Mode Activated. High contrast yellow-on-black theme and spoken guidance enabled.':
        'பார்வை உதவி முறை இயக்கப்பட்டது. மஞ்சள் மற்றும் கருப்பு வண்ணக் கட்டமைப்பு மற்றும் குரல் வழிகாட்டல் தயாராக உள்ளது.',
      'Hearing Assist Mode Activated. Real-time visual captions and screen flash alerts are on.':
        'செவித்திறன் உதவி முறை இயக்கப்பட்டது. நேரலை வசனங்கள் மற்றும் திரை ஒளிரும் எச்சரிக்கைகள் தயாராக உள்ளன.',
      'Motor Assist Mode Activated. Oversized touch zones and hands-free Dwell Click are active. Hover over any button to click.':
        'இயக்க உதவி முறை இயக்கப்பட்டது. பெரிய தொடு பட்டன்கள் மற்றும் தானியங்கி கிளிக் வசதி தயாராக உள்ளது.',
      'Cognitive Simplicity Mode Activated. Visual distractions removed and step-by-step guidance enabled.':
        'எளிய முறை உதவி இயக்கப்பட்டது. தேவையற்ற கவனச்சிதறல்கள் அகற்றப்பட்டு எளிய வழிகாட்டல் தயாராக உள்ளது.',
      'Easy / Senior Mode Activated. Large text and simplified guidance enabled.':
        'முதியோர் முறை இயக்கப்பட்டது. பெரிய எழுத்துக்கள் மற்றும் எளிய வழிகாட்டல் தயாராக உள்ளது.',
      'Custom Accessibility Profile Activated.':
        'தனிப்பயன் அணுகல்தன்மை முறை இயக்கப்பட்டது.',
      'Default Accessibility Profile Restored.': 'இயல்பான அணுகல்தன்மை முறை மீட்டமைக்கப்பட்டது.',
      'Text size increased to Large.': 'எழுத்து அளவு பெரிதாக்கப்பட்டது.',
      'Text size increased to Extra Large.': 'எழுத்து அளவு மேலும் பெரிதாக்கப்பட்டது.',
      'Text size restored to normal.': 'எழுத்து அளவு இயல்பு நிலைக்கு மாற்றப்பட்டது.',
      'Account balance hidden.': 'வங்கி கணக்கு இருப்பு மறைக்கப்பட்டது.',
      'Select QR image from photo gallery.': 'கேலரியிலிருந்து க்யூஆர் குறியீட்டு படத்தை தேர்ந்தெடுக்கவும்.',
      'Transfer aborted for your safety.': 'உங்கள் பாதுகாப்பிற்காக பரிவர்த்தனை ரத்து செய்யப்பட்டது.',
      'Voice assistance activated.': 'குரல் உதவி இயக்கப்பட்டது.',
      'Please say "Yes", "Confirm", or "Send" to complete payment, or "No" or "Cancel" to abort.':
        'கட்டணத்தை உறுதி செய்ய "ஆம்" அல்லது "கன்பார்ம்" என்று சொல்லவும், ரத்து செய்ய "வேண்டாம்" என்று சொல்லவும்.',
      'Could not understand payment details. Please try again.':
        'கட்டண விவரங்களைப் புரிந்து கொள்ள முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
      'Please specify recipient and amount, like Kumar-ku 500 anuppu.':
        'பெறுநர் மற்றும் தொகையைக் குறிப்பிடவும், உதாரணமாக "குமாருக்கு 500 ரூபாய் அனுப்பு" என்று சொல்லவும்.'
    };

    this.initVoices();
    if (this.synth && this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.initVoices();
    }
  }

  initVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();

    // 1. Detect native Tamil voices
    this.tamilVoice = this.voices.find(v => {
      const lang = (v.lang || '').toLowerCase().replace('_', '-');
      const name = (v.name || '').toLowerCase();
      return lang.startsWith('ta') || name.includes('tamil') || name.includes('valluvar') || name.includes('pallavi');
    }) || null;

    // 2. Detect Indian English voices
    this.indianVoice = this.voices.find(v => {
      const lang = (v.lang || '').toLowerCase().replace('_', '-');
      const name = (v.name || '').toLowerCase();
      return lang.includes('en-in') || name.includes('heera') || name.includes('ravi') || name.includes('neerja') || name.includes('prabhat') || name.includes('india');
    }) || null;

    // 3. Detect standard English voice
    this.englishVoice = this.voices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('en');
    }) || this.voices[0] || null;

    console.log('[TTS Voices Detected]:', {
      tamil: this.tamilVoice ? this.tamilVoice.name : 'System ta-IN Engine',
      indian: this.indianVoice ? this.indianVoice.name : 'Default',
      english: this.englishVoice ? this.englishVoice.name : 'Default'
    });

    this.updateVoiceForCurrentLang();
  }

  updateVoiceForCurrentLang() {
    if (this.currentLang === 'ta') {
      // In Tamil mode, NEVER assign an English voice (ta-IN TTS)
      this.selectedVoice = this.tamilVoice || null;
    } else {
      // In English mode, prioritize Indian English voice (en-IN TTS)
      this.selectedVoice = this.indianVoice || this.englishVoice || null;
    }
  }

  /**
   * Set language: 'ta' (Tamil) or 'en' (English)
   */
  setLanguage(lang, announce = true) {
    if (lang !== 'ta' && lang !== 'en') {
      lang = 'ta';
    }
    this.currentLang = lang;
    this.updateVoiceForCurrentLang();

    // Synchronize UI language selector labels if any
    const labels = {
      'ta': '🇮🇳 தமிழ் (Tamil)',
      'en': '🇬🇧 English'
    };
    const activeLabel = labels[lang] || labels['ta'];

    document.querySelectorAll('.lang-display-btn, #header-lang-btn, #lang-toggle-btn').forEach(btn => {
      btn.textContent = activeLabel;
    });

    // Synchronize with i18n DOM engine if present
    if (window.I18n && window.I18n.currentLang !== lang) {
      window.I18n.setLanguage(lang, false);
    }

    if (announce) {
      if (lang === 'ta') {
        this.speak({
          ta: 'மொழி தமிழாக மாற்றப்பட்டது',
          en: 'Tamil language selected.'
        }, 'assertive');
      } else {
        this.speak({
          ta: 'Language changed to English',
          en: 'Language changed to English'
        }, 'assertive');
      }
    }
  }

  cycleLanguage() {
    this.setLanguage(this.currentLang === 'ta' ? 'en' : 'ta', true);
  }

  toggleVoice() {
    this.isVoiceEnabled = !this.isVoiceEnabled;
    if (!this.isVoiceEnabled) {
      this.cancel();
    } else {
      this.speak({
        ta: 'குரல் உதவி இயக்கப்பட்டது.',
        en: 'Voice assistance activated.'
      });
    }
    return this.isVoiceEnabled;
  }

  cancel() {
    this.stopAllAudio();
  }

  /**
   * Translate an English string to Tamil if in Tamil mode
   */
  translateToTamil(str) {
    if (!str) return '';
    // If it already contains Tamil characters, return as is
    if (/[\u0B80-\u0BFF]/.test(str)) {
      return str;
    }

    const trimmed = str.trim();
    if (this.stringTranslations[trimmed]) {
      return this.stringTranslations[trimmed];
    }

    // Dynamic patterns
    // 1. Amount set to ₹X
    const amtMatch = trimmed.match(/Amount set to ₹(\d+)/i);
    if (amtMatch) {
      return `தொகை ₹${amtMatch[1]} ஆக அமைக்கப்பட்டது.`;
    }

    // 2. PIN digit X of 4 entered
    const pinMatch = trimmed.match(/PIN digit (\d+) of 4 entered/i);
    if (pinMatch) {
      return `நான்கில் பின் எண் ${pinMatch[1]} உள்ளிடப்பட்டது.`;
    }

    // 3. Payment of ₹X to Y successful
    const payMatch = trimmed.match(/Payment of ₹([\d.]+) to (.+?) successful/i);
    if (payMatch) {
      return `${payMatch[2]} அவர்களுக்கு ₹${payMatch[1]} வெற்றிகரமாக செலுத்தப்பட்டது!`;
    }

    // 4. Voice search for "X": Found Y matching records
    const searchMatch = trimmed.match(/Voice search for "(.+?)": Found (\d+) matching records/i);
    if (searchMatch) {
      return `"${searchMatch[1]}" தேடல் முடிவுகள்: ${searchMatch[2]} பதிவுகள் கண்டறியப்பட்டன.`;
    }

    // 5. X selected. Amount set to ₹Y. Proceed to confirm.
    const rechargeMatch = trimmed.match(/(.+?) selected\. Amount set to ₹(\d+)\. Proceed to confirm\./i);
    if (rechargeMatch) {
      return `${rechargeMatch[1]} தேர்ந்தெடுக்கப்பட்டது. தொகை ₹${rechargeMatch[2]}. உறுதி செய்ய தொடரவும்.`;
    }

    // 6. High value transfer of ₹X
    const fraudMatch = trimmed.match(/High value transfer of ₹([\d.]+)/i);
    if (fraudMatch) {
      return `உயர் மதிப்பு பரிவர்த்தனை எச்சரிக்கை! நீங்கள் ₹${fraudMatch[1]} செலுத்துகிறீர்கள். சரிபார்க்கவும்.`;
    }

    // 7. Transaction details: X debited to Y
    const txMatch = trimmed.match(/Transaction details: (.+) debited to (.+)/i);
    if (txMatch) {
      return `பரிவர்த்தனை விவரம்: ${txMatch[2]} அவர்களுக்கு ${txMatch[1]} செலுத்தப்பட்டது.`;
    }

    // Default Tamil fallback if an unmapped English phrase is caught
    return 'தகவல் சரிபார்க்கப்பட்டது.';
  }

  /**
   * Unified Speak Method with Strict Language Isolation
   * If currentLang === 'ta':
   *   - NEVER speaks English words.
   *   - Uses content.ta or translates to Tamil.
   *   - Uses 'ta-IN' locale with native Tamil voice if available.
   * If currentLang === 'en':
   *   - Speaks in English with 'en-US' / 'en-IN'.
   */
  speak(content, priority = 'polite') {
    if (!content) return;
    let spokenText = '';
    let visualCaptionText = '';
    let langTag = 'en-IN';

    if (this.currentLang === 'ta') {
      langTag = 'ta-IN';
      if (typeof content === 'object' && content !== null) {
        // Strict Tamil speech - NEVER use content.en
        spokenText = content.ta || (content.tanglish ? content.tanglish : this.translateToTamil(content.en || ''));
        visualCaptionText = content.ta || spokenText;
      } else {
        const rawStr = content.toString();
        spokenText = this.translateToTamil(rawStr);
        visualCaptionText = spokenText;
      }
    } else {
      // English mode: en-IN TTS
      langTag = 'en-IN';
      if (typeof content === 'object' && content !== null) {
        spokenText = content.en || content.tanglish || content.ta || '';
        visualCaptionText = content.en || spokenText;
      } else {
        spokenText = content.toString();
        visualCaptionText = spokenText;
      }
    }

    if (!spokenText) return;

    // Synchronize with visual captions dock & ARIA live announcer
    this.updateCaptions(visualCaptionText);
    this.announceAria(visualCaptionText, priority);
    this.appendSpokenLog('agent', visualCaptionText);

    if (!this.synth || !this.isVoiceEnabled) return;

    this.synth.cancel(); // Interrupt previous utterance for zero-latency response

    const utterance = new SpeechSynthesisUtterance(spokenText);
    if (this.currentLang === 'ta') {
      if (this.tamilVoice) {
        utterance.voice = this.tamilVoice;
      }
      // If no native voice object, leave voice unset so browser uses ta-IN locale engine
    } else {
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
    }
    utterance.lang = langTag;
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    const aiWave = document.querySelector('.audio-pulse-indicator');
    utterance.onstart = () => {
      if (aiWave) aiWave.style.opacity = '1';
    };
    utterance.onend = () => {
      if (aiWave) aiWave.style.opacity = '0.5';
    };
    utterance.onerror = (e) => {
      console.warn('Speech synthesis utterance status/error:', e);
      if (aiWave) aiWave.style.opacity = '0.5';
    };

    this.synth.speak(utterance);
  }

  /**
   * Dex Conversational Speech with Fallback Hierarchy:
   * 1. Gemini / Server-Side Speech (natural Tamil/English via backend POST /api/assistant/speak)
   * 2. Browser SpeechSynthesis (native ta-IN or en-IN)
   * 3. Visible Captions / Text Announcements
   *
   * Calls onStart when speaking begins and onEnd when speaking concludes,
   * enabling continuous conversational sessions without Dex hearing itself.
   */
  async speakDex(text, lang = 'ta', onStart = null, onEnd = null) {
    if (!text || !text.trim()) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    const cleanText = text.trim();
    const targetLang = lang && lang.toLowerCase().startsWith('ta') ? 'ta' : 'en';

    // Always update live captions & ARIA announcements immediately
    this.updateCaptions(cleanText);
    this.announceAria(cleanText, 'assertive');
    this.appendSpokenLog('agent', cleanText);

    // If audio is disabled by user setting
    if (!this.isVoiceEnabled) {
      if (typeof onStart === 'function') onStart();
      setTimeout(() => {
        if (typeof onEnd === 'function') onEnd();
      }, 1500);
      return;
    }

    let started = false;
    const triggerStart = () => {
      if (!started) {
        started = true;
        const aiWave = document.querySelector('.audio-pulse-indicator');
        if (aiWave) aiWave.style.opacity = '1';
        if (typeof onStart === 'function') onStart();
      }
    };

    let ended = false;
    const triggerEnd = () => {
      if (!ended) {
        ended = true;
        const aiWave = document.querySelector('.audio-pulse-indicator');
        if (aiWave) aiWave.style.opacity = '0.5';
        if (typeof onEnd === 'function') onEnd();
      }
    };

    // 1. Try Backend Speech Synthesis (gTTS / Gemini)
    try {
      const endpoints = ['http://127.0.0.1:8001', 'http://127.0.0.1:8000', ''];
      let speakSuccess = false;

      for (const base of endpoints) {
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;

          const res = await fetch(`${base}/api/assistant/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanText, language: targetLang }),
            signal: controller ? controller.signal : undefined
          });
          if (timeoutId) clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success' && data.audio_base64) {
              const audio = new Audio('data:audio/mp3;base64,' + data.audio_base64);
              this.activeAudio = audio;

              audio.onplay = () => triggerStart();
              audio.onended = () => triggerEnd();
              audio.onerror = () => {
                console.warn('[TTS] Audio element playback error, falling back.');
                this._fallbackBrowserSpeech(cleanText, targetLang, triggerStart, triggerEnd);
              };

              await audio.play();
              speakSuccess = true;
              break;
            }
          }
        } catch (endpointErr) {
          // continue to next endpoint
        }
      }

      if (speakSuccess) return;
    } catch (backendErr) {
      console.warn('[TTS] Backend speech synthesis unavailable:', backendErr.message);
    }

    // 2. Fallback to Browser SpeechSynthesis
    this._fallbackBrowserSpeech(cleanText, targetLang, triggerStart, triggerEnd);
  }

  _fallbackBrowserSpeech(text, lang, triggerStart, triggerEnd) {
    if (!this.synth) {
      triggerStart();
      setTimeout(triggerEnd, 2000);
      return;
    }

    try {
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
      if (lang === 'ta' && this.tamilVoice) {
        utterance.voice = this.tamilVoice;
      } else if (lang === 'en' && this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;

      utterance.onstart = () => triggerStart();
      utterance.onend = () => triggerEnd();
      utterance.onerror = () => triggerEnd();

      this.synth.speak(utterance);
    } catch (e) {
      triggerStart();
      setTimeout(triggerEnd, 2000);
    }
  }

  stopAllAudio() {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (e) {}
      this.activeAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }

  // =========================================================================
  // BILINGUAL SPOKEN MESSAGES FOR ALL ACTIONS (TAMIL & ENGLISH)
  // =========================================================================

  // Initial Welcome Greeting
  speakWelcome(userName) {
    const resolvedName = userName || (window.UserManager && typeof window.UserManager.getAssistantCallName === 'function' ? window.UserManager.getAssistantCallName() : 'Sandhiya');
    this.speak({
      ta: `வணக்கம் ${resolvedName}! ஒன்அபிலிட்டி பே செயலி தயார். வாய்ஸ் பேமென்ட் செய்ய மைக் பட்டனை அழுத்தவும் அல்லது "குமாருக்கு 500 ரூபாய் அனுப்பு" என்று சொல்லவும்.`,
      en: `Welcome ${resolvedName}! OneAbility Pay is ready. Tap the microphone or say "Send 500 to Kumar" to initiate payment.`
    });
  }

  // Payment Confirmation Gate Prompt
  speakConfirmationPrompt(merchantName, amount) {
    this.speak({
      ta: `${merchantName} அவர்களுக்கு ${amount} ரூபாய் அனுப்ப வேண்டுமா? உறுதி செய்ய 'ஆம்' அல்லது 'கன்பார்ம்' என்று சொல்லவும். ரத்து செய்ய 'வேண்டாம்' என்று சொல்லவும்.`,
      en: `You are sending ₹${amount} to ${merchantName}. Say Yes to confirm or No to cancel.`
    }, 'assertive');
  }

  // Bank Balance Read Aloud
  speakBalance(bankName = 'State Bank of India', balance = '₹24,850.00') {
    const userCallName = (window.UserManager && typeof window.UserManager.getAssistantCallName === 'function')
      ? window.UserManager.getAssistantCallName()
      : 'Sandhiya';
    this.speak({
      ta: `${userCallName}, உங்கள் தற்போதைய இருப்பு ${balance}.`,
      en: `${userCallName}, your current balance is ${balance}.`
    }, 'assertive');
  }

  // Payment Success Alert
  speakSuccess(merchantName, amount, txId) {
    this.speak({
      ta: `பணம் வெற்றிகரமாக செலுத்தப்பட்டது! ${merchantName} அவர்களுக்கு ${amount} ரூபாய் அனுப்பப்பட்டது. மாதிரி பரிவர்த்தனை எண்: ${txId}.`,
      en: `Payment of ₹${amount} to ${merchantName} was successful. UPI Reference: ${txId}.`
    });
  }

  // Payment Cancelled
  speakCancelled() {
    this.speak({
      ta: `பரிவர்த்தனை ரத்து செய்யப்பட்டது. முகப்புப் பக்கத்திற்குத் திரும்புகிறோம்.`,
      en: `Payment cancelled. Returned to home screen.`
    });
  }

  // QR Code Guidance
  speakQRGuidance(step = 'start') {
    if (step === 'start') {
      this.speak({
        ta: `க்யூஆர் ஸ்கேனர் தயார். கேமராவை க்யூஆர் குறியீட்டின் நேராக அசைக்காமல் வைக்கவும்.`,
        en: `Align QR inside the frame. Camera is active.`
      });
    } else if (step === 'aligning') {
      this.speak({
        ta: `ஸ்கேன் செய்யப்படுகிறது. தொலைபேசியை அசைக்காமல் பிடிக்கவும்.`,
        en: `Scanning QR code. Hold camera still.`
      });
    }
  }

  // QR Detected Details
  speakQRDetected(merchantName, upiId) {
    this.speak({
      ta: `க்யூஆர் குறியீடு கண்டறியப்பட்டது! பெறுநர்: ${merchantName}.`,
      en: `QR Code detected for ${merchantName}.`
    });
  }

  // QR Verifying state
  speakQRVerifying() {
    this.speak({
      ta: 'க்யூஆர் கண்டறியப்பட்டது. பெறுநர் சரிபார்க்கப்படுகிறார்.',
      en: 'QR detected. Verifying merchant.'
    }, 'assertive');
  }

  // QR Verified
  speakQRVerified(merchantName) {
    this.speak({
      ta: `பெறுநர் சரிபார்க்கப்பட்டார்: ${merchantName}.`,
      en: `Merchant verified. ${merchantName}.`
    }, 'assertive');
  }

  // QR Unverified
  speakQRUnverified(merchantName) {
    this.speak({
      ta: `கவனிக்கவும்! ${merchantName} சரிபார்க்கப்படாத பெறுநர். தயவுசெய்து பரிசீலிக்கவும்.`,
      en: `This merchant is not verified: ${merchantName}. Please review carefully.`
    }, 'assertive');
  }

  // QR Suspicious / Blocked
  speakQRSuspicious() {
    this.speak({
      ta: 'பாதுகாப்பு எச்சரிக்கை! இந்த க்யூஆர் குறியீடு பாதுகாப்பற்றதாக இருக்கலாம். கட்டணம் செலுத்தப்படுவது நிறுத்தப்பட்டது.',
      en: 'Warning. This QR code may be unsafe. Payment has been blocked.'
    }, 'assertive');
  }

  // Camera Access Failure
  speakCameraError() {
    this.speak({
      ta: 'கேமராவை இயக்க முடியவில்லை. கீழே உள்ள டெமோ க்யூஆர் பொத்தான்களைப் பயன்படுத்தலாம்.',
      en: 'Camera could not be accessed. You can use the Demo QR buttons below.'
    }, 'assertive');
  }

  // Receipt Read Aloud
  speakReceipt(merchantName, upiId, amount, txId) {
    const userName = (window.UserManager && typeof window.UserManager.getUserName === 'function')
      ? window.UserManager.getUserName()
      : 'Sandhiya';
    this.speak({
      ta: `${userName}, ரசீது விவரம்: ${merchantName} அவர்களுக்கு ${amount} ரூபாய் வெற்றிகரமாக செலுத்தப்பட்டது. யூபிஐ ஐடி: ${upiId}. பரிவர்த்தனை எண்: ${txId}. நிலை: வெற்றி.`,
      en: `${userName}, Payment Receipt: ₹${amount} successfully sent to ${merchantName}. UPI ID: ${upiId}. Reference: ${txId}. Status: Completed.`
    }, 'assertive');
  }

  // Biometric / Fingerprint Prompt (Demo Simulation)
  speakBiometricPrompt() {
    this.speak({
      ta: `கைரேகை அங்கீகாரம்: மாதிரி விரலை சென்சாரில் வைக்கவும் அல்லது 'ஆம்' என்று சொல்லவும்.`,
      en: `Touch fingerprint sensor or say Yes to authorize mock payment.`
    }, 'assertive');
  }

  // Biometric Success
  speakBiometricSuccess() {
    this.speak({
      ta: `கைரேகை சரிபார்க்கப்பட்டது! கட்டணம் அங்கீகரிக்கப்பட்டது.`,
      en: `Fingerprint verified successfully! Authorizing your payment.`
    }, 'assertive');
  }

  // WebAuthn Device Platform Prompt
  speakWebAuthnPrompt() {
    this.speak({
      ta: `உங்கள் சாதன பாதுகாப்பைப் பயன்படுத்தி உறுதிப்படுத்தவும்.`,
      en: `Authenticate using your device security.`
    }, 'assertive');
  }

  // WebAuthn Device Platform Success
  speakWebAuthnSuccess() {
    this.speak({
      ta: `சாதன பாதுகாப்பு சரிபார்க்கப்பட்டது. கட்டணம் செலுத்தப்படுகிறது.`,
      en: `Device security verified successfully. Executing mock payment.`
    }, 'assertive');
  }

  // WebAuthn Device Platform Cancelled
  speakWebAuthnCancelled() {
    this.speak({
      ta: `சாதன பாதுகாப்பு சரிபார்ப்பு ரத்து செய்யப்பட்டது. பணம் செலுத்தப்படவில்லை.`,
      en: `Device authentication was cancelled. Payment not executed.`
    }, 'assertive');
  }

  // WebAuthn Fallback Notice
  speakWebAuthnFallback() {
    this.speak({
      ta: `இந்த சாதனத்தில் பயோமெட்ரிக் வசதி இல்லை. கல்லூரி மாதிரி சிமுலேஷனை பயன்படுத்தலாம்.`,
      en: `Device biometric authentication is unavailable on this system. Demo simulation fallback is ready.`
    }, 'assertive');
  }

  // Emergency Payment Stop
  speakEmergencyStop() {
    this.speak({
      ta: `அவசர கட்டண ரத்து செய்யப்பட்டது! அனைத்து நடவடிக்கைகளும் உடனடியாக நிறுத்தப்பட்டன. உங்கள் பணம் பாதுகாப்பாக உள்ளது.`,
      en: `Emergency Payment Stop activated! All transactions cancelled safely.`
    }, 'assertive');
  }

  // Wrong Receiver Warning
  speakWrongReceiverWarning(merchantName) {
    this.speak({
      ta: `கவனிக்கவும்! ${merchantName} உங்கள் வழக்கமான தொடர்புகளில் இல்லை. சரிபார்த்துவிட்டு 'ஆம்' அல்லது 'வேண்டாம்' என்று சொல்லவும்.`,
      en: `Attention: ${merchantName} is not in your frequent contacts. Confirm if intended.`
    }, 'assertive');
  }

  // Suspicious QR / Fraud Warning
  speakSuspiciousQRWarning() {
    this.speak({
      ta: `பாதுகாப்பு எச்சரிக்கை! இந்த க்யூஆர் குறியீடு சந்தேகத்திற்குரியது. பணம் செலுத்த வேண்டாம் என்று பரிந்துரைக்கிறோம். ரத்து செய்ய 'வேண்டாம்' என்று சொல்லவும்.`,
      en: `Security Alert! This QR code is suspicious. Say Cancel to abort safely.`
    }, 'assertive');
  }

  // Payment Limit Alert
  speakLimitAlert(amount, limit = '10,000') {
    this.speak({
      ta: `கட்டண வரம்பு எச்சரிக்கை! நீங்கள் செலுத்தும் ₹${amount} தொகை உங்கள் தினசரி பாதுகாப்பு வரம்பை விட அதிகம்.`,
      en: `Payment limit alert: The amount of ₹${amount} exceeds your daily safety limit.`
    }, 'assertive');
  }

  // Spoken Transaction History
  speakTransactionHistory(records) {
    this.speak({
      ta: `பரிவர்த்தனை வரலாறு: குமார் மளிகைக்கு ₹320, பிரியா மெடிக்கல்ஸுக்கு ₹240, மெட்ரோ பயணத்திற்கு ₹50 செலுத்தப்பட்டது. கேஷ்பேக் ₹25 பெறப்பட்டது.`,
      en: `Transaction History: Recent payments include ₹320 to Kumar Groceries and ₹240 to Priya Medicals.`
    }, 'assertive');
  }

  // Spoken Voice Search Results
  speakSearchResults(query, count, details) {
    this.speak({
      ta: `"${query}" தேடல் முடிவுகள்: ${count} பதிவுகள் கண்டறியப்பட்டன.`,
      en: `Voice search for "${query}": Found ${count} matching records. ${details}`
    }, 'assertive');
  }

  // Bank Linking Status
  speakBankLinking() {
    this.speak({
      ta: `வங்கி கணக்கு இணைப்பு முறை தொடங்குகிறது. உங்கள் வங்கியை தேர்ந்தெடுக்கவும்.`,
      en: `Starting guided bank account linking. Please choose your bank.`
    }, 'assertive');
  }

  speakBankLinkingStep(stepNumber, bankName = '', extraInfo = '') {
    const steps = {
      1: {
        ta: `படி 1: உங்கள் வங்கியை தேர்ந்தெடுக்கவும். எஸ்பிஐ, ஹெச்டிஎஃப்சி, ஐசிஐசிஐ, இந்தியன் வங்கி, அல்லது கனரா வங்கி.`,
        en: `Step 1: Choose your bank. State Bank of India, HDFC Bank, ICICI Bank, Indian Bank, or Canara Bank.`
      },
      2: {
        ta: `படி 2: ${bankName} வங்கியில் பதிவு செய்யப்பட்ட மொபைல் எண் +91 98••••••12. உறுதி செய்ய Next அல்லது Confirm சொல்லவும்.`,
        en: `Step 2: Confirm registered mobile number +91 98••••••12 for ${bankName}. Say Next or click Confirm to proceed.`
      },
      3: {
        ta: `படி 3: சிமுலேட்டட் எஸ்எம்எஸ் சரிபார்ப்பு நடைபெறுகிறது... சாதனம் சரிபார்க்கப்படுகிறது.`,
        en: `Step 3: Simulating SMS device verification... Carrier binding in progress.`
      },
      4: {
        ta: `படி 4: ${bankName} கணக்கு ${extraInfo} கண்டறியப்பட்டது. தொடர Next சொல்லவும்.`,
        en: `Step 4: Discovered ${bankName} account ending in ${extraInfo}. Click or say Next to continue.`
      },
      5: {
        ta: `படி 5: இந்த வங்கியை முதல் நிலை கட்டணக் கணக்காக அமைக்கவா? Primary set pannu அல்லது Save சொல்லவும்.`,
        en: `Step 5: Set this as your primary payment account? Say 'Set primary' or click Save.`
      },
      6: {
        ta: `வங்கி கணக்கு வெற்றிகரமாக இணைக்கப்பட்டது! ${bankName} கணக்கு இப்போது தயாராக உள்ளது.`,
        en: `Bank account linked successfully! ${bankName} is now ready for UPI payments.`
      }
    };
    const s = steps[stepNumber] || steps[1];
    this.speak(s, 'assertive');
  }

  speakBankSelected(bankName) {
    this.speak({
      ta: `${bankName} தேர்ந்தெடுக்கப்பட்டது. பதிவு செய்யப்பட்ட மொபைல் எண்ணை உறுதி செய்யவும்.`,
      en: `${bankName} selected. Please confirm your registered mobile number.`
    });
  }

  speakPrimaryAccountUpdated(bankName) {
    this.speak({
      ta: `${bankName} உங்கள் முதல் நிலை வங்கிக் கணக்காக அமைக்கப்பட்டது.`,
      en: `${bankName} set as your primary payment account.`
    }, 'assertive');
  }

  speakAccountRemoved(bankName) {
    this.speak({
      ta: `${bankName} கணக்கு வெற்றிகரமாக நீக்கப்பட்டது.`,
      en: `${bankName} account removed successfully.`
    }, 'assertive');
  }

  speakSpecificBankBalance(bankName, balance) {
    this.speak({
      ta: `உங்கள் ${bankName} கணக்கு இருப்பு ${balance}.`,
      en: `Your available balance in ${bankName} is ${balance}.`
    }, 'assertive');
  }


  // Home Navigation Step
  speakHomeStep() {
    this.speak({
      ta: `ஒன்அபிலிட்டி பே முகப்பு பக்கம். ஸ்கேன், காண்டாக்ட், அல்லது வாய்ஸ் பேமென்ட் தயார்.`,
      en: `OneAbility Pay Home. Scan & Pay, Pay Contacts, Pay UPI ID, or Voice Pay ready.`
    });
  }

  // Contacts Navigation Step
  speakContactsStep() {
    this.speak({
      ta: `பணம் செலுத்த ஒரு தொடர்பைத் தேர்ந்தெடுக்கவும்: குமார் மளிகை, பிரியா மெடிக்கல்ஸ், அல்லது ரவி.`,
      en: `Select a contact to pay: Kumar Groceries, Priya Medicals, or Ravi Milk.`
    });
  }

  // Amount Navigation Step
  speakAmountStep(merchantName) {
    this.speak({
      ta: `${merchantName} தேர்ந்தெடுக்கப்பட்டார். செலுத்த வேண்டிய தொகையை உள்ளிடவும் அல்லது ₹50, ₹100, ₹500 தேர்ந்தெடுக்கவும்.`,
      en: `Selected Recipient: ${merchantName}. Enter payment amount or choose shortcuts.`
    });
  }

  // PIN Navigation Step
  speakPinStep() {
    this.speak({
      ta: `நான்கு இலக்க யூபிஐ பின் எண்ணை உள்ளிடவும்.`,
      en: `Enter 4-digit UPI PIN to authorize payment.`
    });
  }

  // PIN Digit Entered Feedback
  speakPinDigit(count) {
    this.speak({
      ta: `நான்கில் பின் எண் ${count} உள்ளிடப்பட்டது.`,
      en: `PIN digit ${count} of 4 entered.`
    });
  }

  // Profile Navigation Step
  speakProfileStep() {
    const userName = (window.UserManager && typeof window.UserManager.getUserName === 'function')
      ? window.UserManager.getUserName()
      : 'Sandhiya';
    this.speak({
      ta: `${userName} அவர்களின் சுயவிவரம் மற்றும் அணுகல்தன்மை அமைப்புகள்.`,
      en: `Profile and accessibility settings for ${userName}.`
    });
  }

  // Generic Error Alert
  speakError(errorMessage) {
    this.speak({
      ta: `கவனிக்கவும்! ${this.translateToTamil(errorMessage)}`,
      en: `Alert: ${errorMessage}`
    }, 'assertive');
  }

  updateCaptions(text) {
    const captionEl = document.getElementById('caption-text');
    if (captionEl) {
      captionEl.textContent = text;
    }
  }

  announceAria(text, priority = 'polite') {
    const announcer = document.getElementById('sr-announcer');
    const announcerMsg = document.getElementById('sr-announcer-msg');
    if (announcer && announcerMsg) {
      announcer.setAttribute('aria-live', priority);
      announcerMsg.textContent = text;
      announcer.classList.add('active');
      clearTimeout(this.announcerTimer);
      this.announcerTimer = setTimeout(() => {
        announcer.classList.remove('active');
      }, 4500);
    }
  }

  appendSpokenLog(sender, text) {
    const logContainer = document.getElementById('spoken-transcript-stream');
    if (!logContainer) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${sender}`;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    entry.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-message"><strong>${sender === 'agent' ? 'OneAbility AI' : 'User'}:</strong> ${text}</span>
    `;

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  // =========================================================================
  // BENEFICIARY DIRECTORY & QUICK PAY SPEECH
  // =========================================================================
  speakBeneficiaryDirectoryOpened(count = 5) {
    this.speak({
      ta: `பெறுநர்கள் பட்டியல் திறக்கப்பட்டது. மொத்தம் ${count} பெறுநர்கள் உள்ளனர். விரைவு கட்டணம் செலுத்த தொடவும் அல்லது பெயரைக் கூறவும்.`,
      en: `Beneficiary directory opened with ${count} contacts. Tap to quick pay or speak a name.`
    });
  }

  speakBeneficiaryAdded(name) {
    this.speak({
      ta: `${name} பெறுநராக வெற்றிகரமாக சேர்க்கப்பட்டார்.`,
      en: `${name} added successfully to your beneficiaries.`
    }, 'assertive');
  }

  speakBeneficiaryUpdated(name) {
    this.speak({
      ta: `${name} விவரங்கள் வெற்றிகரமாக புதுப்பிக்கப்பட்டன.`,
      en: `${name} details updated successfully.`
    }, 'assertive');
  }

  speakBeneficiaryDeletePrompt(name) {
    this.speak({
      ta: `${name} பெறுநரை நீக்கவா? உறுதி செய்ய 'ஆம்' அல்லது 'நீக்கு' என்றும், ரத்து செய்ய 'வேண்டாம்' என்றும் சொல்லவும்.`,
      en: `Are you sure you want to delete ${name}? Say 'Yes' or 'Delete' to confirm, or 'Cancel' to keep.`
    }, 'assertive');
  }

  speakBeneficiaryDeleted(name) {
    this.speak({
      ta: `${name} பெறுநர் பட்டியலிலிருந்து நீக்கப்பட்டார்.`,
      en: `${name} has been removed from your beneficiaries.`
    }, 'assertive');
  }

  speakBeneficiaryDeleteCancelled() {
    this.speak({
      ta: `பெறுநர் நீக்கம் ரத்து செய்யப்பட்டது.`,
      en: `Beneficiary deletion cancelled safely.`
    });
  }

  speakFavoriteToggled(name, isFav) {
    this.speak({
      ta: isFav
        ? `${name} விருப்பப் பட்டியலில் சேர்க்கப்பட்டார். முகப்புத் திரையில் காண்பிக்கப்படும்.`
        : `${name} விருப்பப் பட்டியலிலிருந்து நீக்கப்பட்டார்.`,
      en: isFav
        ? `${name} added to Quick Pay favorites on Home.`
        : `${name} removed from favorites.`
    });
  }

  speakBeneficiarySearchResult(foundCount, topName = '') {
    if (foundCount > 0) {
      this.speak({
        ta: `${foundCount} பெறுநர்கள் கண்டறியப்பட்டனர். முதலாவது ${topName}.`,
        en: `Found ${foundCount} beneficiaries. Top match is ${topName}.`
      });
    } else {
      this.speak({
        ta: `பொருத்தமான பெறுநர்கள் எவரும் கண்டறியப்படவில்லை.`,
        en: `No beneficiaries found matching that search.`
      });
    }
  }

  speakLastPaidBeneficiary(name, amt, timeStr = '') {
    this.speak({
      ta: `கடைசியாக ${name} அவர்களுக்கு ₹${amt} மாதிரி கட்டணம் செலுத்தப்பட்டது.`,
      en: `Last payment was ₹${amt} to ${name}.`
    }, 'assertive');
  }

  speakFavoriteBeneficiaries(names = []) {
    if (names.length === 0) {
      this.speak({
        ta: `விருப்பப் பட்டியலில் பெறுநர்கள் எவரும் இல்லை.`,
        en: `You have no favorite beneficiaries saved yet.`
      });
      return;
    }
    const joined = names.join(', ');
    this.speak({
      ta: `உங்கள் விருப்பப் பெறுநர்கள்: ${joined}.`,
      en: `Your favorite beneficiaries are: ${joined}.`
    });
  }
}

// Global instance
window.TTSVoice = new TTSVoiceEngine();
