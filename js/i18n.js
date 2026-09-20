/**
 * OneAbility AI - Internationalization (i18n) Engine
 * Dedicated Bilingual Support: தமிழ் (Tamil) • English
 * 
 * Manages:
 * - Dynamic UI language switching between Tamil ('ta') and English ('en')
 * - Full DOM translation of text, placeholders, and ARIA labels
 * - Synchronization of all language selector controls across views
 * - Dynamic time greetings in Tamil and English
 */

class I18nEngine {
  constructor() {
    this.STORAGE_KEY = 'oneability_language';
    let savedLang = 'ta';
    try {
      savedLang = localStorage.getItem(this.STORAGE_KEY) || 'ta';
    } catch (e) {
      console.warn('[i18n] Storage read error:', e);
    }
    this.currentLang = (savedLang === 'en') ? 'en' : 'ta';
    this.translations = {
      en: {
        // App / Shell
        skip_link: 'Skip to Main Content',
        live_captions: 'Live Captions',
        caption_welcome: 'Welcome to OneAbility Pay. Voice assistance active.',

        // Header
        greeting_morning: 'Good Morning, Sandhiya',
        greeting_afternoon: 'Good Afternoon, Sandhiya',
        greeting_evening: 'Good Evening, Sandhiya',
        header_status: 'OneAbility Pay Active',
        search_label: 'Search',
        notif_label: 'Notifications',
        theme_light: '☀️ Light',
        theme_dark: '🌙 Dark',

        // Quick Assist Bar
        blind_assist: 'Assist Mode',
        lang_btn_text: '🇬🇧 English',
        voice_balance: '🔊 Balance',
        contrast_btn: '🟡 Contrast',
        stop_btn: '🛑 Stop',

        // Bank Card
        bank_name: 'State Bank of India',
        bank_acc: 'Savings A/c •••• 4821',
        primary_chip: 'Primary',
        available_balance: 'Available Balance',
        check_balance: 'Check Balance',
        hide_balance: 'Hide Balance',

        // 4 Main Payment Actions
        scan_pay_title: 'Scan & Pay',
        scan_pay_sub: 'Voice-guided QR',
        pay_contact_title: 'Pay Contact',
        pay_contact_sub: 'Phone numbers',
        pay_upi_title: 'Pay UPI ID',
        pay_upi_sub: 'VPA or number',
        voice_pay_title: 'Voice Pay',
        voice_pay_sub: 'Hands-free',

        // Voice Hero Card
        voice_card_badge: 'Voice-First Pay',
        voice_card_title: 'Pay using your voice',
        voice_card_subtitle: 'Tamil • English • Tanglish',
        mic_status_idle: 'Tap mic or click command below to speak',
        mic_status_listening: 'Listening... Speak in Tamil, English, or Tanglish.',
        speech_sample_1: 'Send ₹500 to Kumar',
        speech_sample_2: 'Send ₹250 to Priya',
        speech_sample_3: 'Pay ₹100 to Ravi',

        // Quick Contacts
        quick_contacts: 'Quick Contacts',
        view_all: 'View All',
        pay_link: 'Pay →',

        // Bills & Recharge
        bills_recharge: 'Bills & Recharge',
        bill_mobile: 'Mobile',
        bill_electricity: 'Electricity',
        bill_dth: 'DTH TV',
        bill_fastag: 'FASTag',

        // Rewards
        rewards_headline: '🎉 Cashback & Rewards',
        rewards_sub: "You've won ₹125 total cashback!",
        rewards_badge: '2 Scratch Cards',

        // Recent Transactions
        recent_tx: 'Recent Transactions',
        see_all: 'See All',
        tx_today: 'Today, 10:15 AM',
        tx_yesterday: 'Yesterday, 6:40 PM',

        // QR Scanner
        scan_qr_title: 'Scan any UPI QR',
        scanner_align_guide: 'Align QR inside the frame',
        voice_help_btn: '🔊 Voice Help',
        detect_qr_btn: '⚡ Detect QR',
        test_suspicious_qr: '⚠️ Test Suspicious QR Alert',

        // Confirmation Screen
        confirm_top_pill: 'Verified UPI Transfer',
        confirm_paying_to: 'Paying to',
        confirm_upi_label: 'UPI ID',
        confirm_amount_label: 'Amount',
        confirm_debited_from: 'Debited From',
        confirm_cancel: 'Cancel',
        confirm_proceed: 'Confirm Payment',
        btn_biometric: '🖐️ Touch Fingerprint to Authorize',

        // Enter Amount Screen
        amount_cancel: 'Cancel',
        amount_proceed: 'Proceed →',

        // PIN Screen
        pin_title: 'Enter 4-Digit UPI PIN',
        pin_clear: 'Clear',
        pin_auto: 'Auto',

        // Success Screen
        success_title: 'Payment Successful!',
        success_paid_prefix: 'Paid to',
        read_receipt: '🔊 Read Receipt Aloud',
        done_return_home: 'Done & Return Home',

        // Contacts & History Views
        select_contact_title: 'Select Contact to Pay',
        history_title: 'Transaction History',
        read_all: '🔊 Read All',

        // Profile & Accessibility
        profile_title: 'Profile & Accessibility',
        profile_account_status: '● Active • SBI Account Linked',
        assistive_profiles_heading: 'Assistive Profiles',
        persona_standard: 'Standard',
        persona_vision: 'Vision Assist',
        persona_hearing: 'Hearing Assist',
        persona_motor: 'Motor Assist',
        persona_cognitive: 'Cognitive Simplicity Assist',
        label_text_scaling: 'Text Scaling',
        label_spoken_lang: 'Spoken Language',
        label_audio_feedback: 'Audio Voice Feedback',
        label_bank_linking: 'Bank Account Linking',
        voice_toggle_on: '🔊 Voice: ON',
        voice_toggle_off: '🔇 Voice: OFF',
        sbi_linked: '🏛️ SBI Linked',

        // Bottom Navigation
        nav_home: 'Home',
        nav_scan: 'Scan',
        nav_history: 'History',
        nav_profile: 'Profile',

        // Modals
        safety_guard_title: 'Safety Guard Notice',
        safety_guard_msg: 'High-value transaction warning! Please verify recipient before proceeding.',
        safety_cancel: 'Cancel (Safe)',
        safety_confirm: 'Confirm Anyway',
        search_modal_title: 'Search Payees & History',
        search_placeholder: 'Search payee, phone, or amount...',
        notif_modal_title: 'Accessible Notifications',
        notif_1_title: '₹25 Cashback Credited',
        notif_1_desc: 'Cashback rewarded for grocery voice payment.',
        notif_2_title: 'Security Verification Active',
        notif_2_desc: 'SBI Account •••• 4821 is protected with voice confirmation gate & biometric auth.'
      },

      ta: {
        // App / Shell
        skip_link: 'முக்கிய விவரங்களுக்குச் செல்ல',
        live_captions: 'நேரலை வசனங்கள்',
        caption_welcome: 'ஒன்அபிலிட்டி பே செயலிக்கு வரவேற்கிறோம். குரல் உதவி தயார்.',

        // Header
        greeting_morning: 'காலை வணக்கம், சந்தியா!',
        greeting_afternoon: 'மதிய வணக்கம், சந்தியா!',
        greeting_evening: 'மாலை வணக்கம், சந்தியா!',
        header_status: 'ஒன்அபிலிட்டி பே செயலில் உள்ளது',
        search_label: 'தேடல்',
        notif_label: 'அறிவிப்புகள்',
        theme_light: '☀️ Light',
        theme_dark: '🌙 Dark',

        // Quick Assist Bar
        blind_assist: 'உதவி முறை',
        lang_btn_text: '🇮🇳 தமிழ் (Tamil)',
        voice_balance: '🔊 இருப்பு',
        contrast_btn: '🟡 மாறுபட்ட வண்ணம்',
        stop_btn: '🛑 நிறுத்து',

        // Bank Card
        bank_name: 'ஸ்டேட் பாங்க் ஆஃப் இந்தியா',
        bank_acc: 'சேமிப்பு கணக்கு •••• 4821',
        primary_chip: 'முதன்மை',
        available_balance: 'கிடைக்கக்கூடிய இருப்பு',
        check_balance: 'இருப்பை சரிபார்க்க',
        hide_balance: 'இருப்பை மறைக்க',

        // 4 Main Payment Actions
        scan_pay_title: 'ஸ்கேன் & பே',
        scan_pay_sub: 'குரல் வழி க்யூஆர்',
        pay_contact_title: 'தொடர்புக்கு அனுப்பு',
        pay_contact_sub: 'தொலைபேசி எண்கள்',
        pay_upi_title: 'யூபிஐ ஐடி மூலம்',
        pay_upi_sub: 'விபிஏ அல்லது எண்',
        voice_pay_title: 'குரல் வழி செலுத்து',
        voice_pay_sub: 'ஹேண்ட்ஸ்-ஃப்ரீ',

        // Voice Hero Card
        voice_card_badge: 'குரல் வழி பேமெண்ட்',
        voice_card_title: 'உங்கள் குரல் மூலம் செலுத்துங்கள்',
        voice_card_subtitle: 'தமிழ் • ஆங்கிலம் • டங்கிலிஷ்',
        mic_status_idle: 'மைக் பட்டனை அழுத்தவும் அல்லது கீழே உள்ள கட்டளையைத் தொடவும்',
        mic_status_listening: 'கேட்கிறது... தமிழ், ஆங்கிலம் அல்லது டங்கிலிஷில் பேசவும்.',
        speech_sample_1: 'குமாருக்கு 500 ரூபாய் அனுப்பு',
        speech_sample_2: 'பிரியாவுக்கு 250 ரூபாய் அனுப்பு',
        speech_sample_3: 'ரவிக்கு 100 ரூபாய் அனுப்பு',

        // Quick Contacts
        quick_contacts: 'விரைவு தொடர்புகள்',
        view_all: 'அனைத்தும் காண்க',
        pay_link: 'செலுத்து →',

        // Bills & Recharge
        bills_recharge: 'கட்டணங்கள் & ரீசார்ஜ்',
        bill_mobile: 'மொபைல்',
        bill_electricity: 'மின்சாரம்',
        bill_dth: 'டிடிஎச் டிவி',
        bill_fastag: 'ஃபாஸ்டேக்',

        // Rewards
        rewards_headline: '🎉 கேஷ்பேக் & வெகுமதிகள்',
        rewards_sub: 'நீங்கள் மொத்தம் ₹125 கேஷ்பேக் வென்றுள்ளீர்கள்!',
        rewards_badge: '2 ஸ்கிராட்ச் கார்டுகள்',

        // Recent Transactions
        recent_tx: 'சமீபத்திய பரிவர்த்தனைகள்',
        see_all: 'அனைத்தும்',
        tx_today: 'இன்று, முற்பகல் 10:15',
        tx_yesterday: 'நேற்று, பிற்பகல் 6:40',

        // QR Scanner
        scan_qr_title: 'எந்தவொரு யூபிஐ க்யூஆரையும் ஸ்கேன் செய்க',
        scanner_align_guide: 'க்யூஆரை சட்டத்தின் நடுவில் வைக்கவும்',
        voice_help_btn: '🔊 குரல் உதவி',
        detect_qr_btn: '⚡ க்யூஆர் கண்டறி',
        test_suspicious_qr: '⚠️ சந்தேக க்யூஆர் எச்சரிக்கை',

        // Confirmation Screen
        confirm_top_pill: 'சரிபார்க்கப்பட்ட யூபிஐ பரிமாற்றம்',
        confirm_paying_to: 'செலுத்தும் பெறுநர்',
        confirm_upi_label: 'யூபிஐ ஐடி',
        confirm_amount_label: 'தொகை',
        confirm_debited_from: 'பணம் எடுக்கப்படும் கணக்கு',
        confirm_cancel: 'ரத்து',
        confirm_proceed: 'உறுதி செய்து செலுத்து',
        btn_biometric: '🖐️ கைரேகை மூலம் அங்கீகரிக்கவும்',

        // Enter Amount Screen
        amount_cancel: 'ரத்து',
        amount_proceed: 'தொடர்க →',

        // PIN Screen
        pin_title: '4-இலக்க யூபிஐ பின் எண்ணை உள்ளிடவும்',
        pin_clear: 'அழி',
        pin_auto: 'தானியங்கி',

        // Success Screen
        success_title: 'பணம் வெற்றிகரமாக செலுத்தப்பட்டது!',
        success_paid_prefix: 'செலுத்தப்பட்ட பெறுநர்:',
        read_receipt: '🔊 ரசீதை வாசிக்கவும்',
        done_return_home: 'முடிந்தது & முகப்புக்குச் செல்',

        // Contacts & History Views
        select_contact_title: 'பணம் செலுத்த ஒரு தொடர்பைத் தேர்ந்தெடுக்கவும்',
        history_title: 'பரிவர்த்தனை வரலாறு',
        read_all: '🔊 அனைத்தையும் வாசிக்க',

        // Profile & Accessibility
        profile_title: 'சுயவிவரம் & அணுகல்தன்மை',
        profile_account_status: '● செயலில் உள்ளது • எஸ்பிஐ இணைக்கப்பட்டுள்ளது',
        assistive_profiles_heading: 'உதவி சுயவிவரங்கள்',
        persona_standard: 'இயல்பான முறை',
        persona_vision: 'பார்வை உதவி',
        persona_hearing: 'செவித்திறன் உதவி',
        persona_motor: 'இயக்க உதவி',
        persona_cognitive: 'எளிய முறை உதவி',
        label_text_scaling: 'எழுத்து அளவு',
        label_spoken_lang: 'பயன்பாட்டு மொழி',
        label_audio_feedback: 'குரல் பின்னூட்டம்',
        label_bank_linking: 'வங்கி கணக்கு இணைப்பு',
        voice_toggle_on: '🔊 குரல்: இயக்கத்தில்',
        voice_toggle_off: '🔇 குரல்: முடக்கப்பட்டது',
        sbi_linked: '🏛️ எஸ்பிஐ இணைக்கப்பட்டது',

        // Bottom Navigation
        nav_home: 'முகப்பு',
        nav_scan: 'ஸ்கேன்',
        nav_history: 'வரலாறு',
        nav_profile: 'சுயவிவரம்',

        // Modals
        safety_guard_title: 'பாதுகாப்பு எச்சரிக்கை அறிவிப்பு',
        safety_guard_msg: 'உயர் மதிப்பு பரிவர்த்தனை எச்சரிக்கை! தொடர்வதற்கு முன் பெறுநரை சரிபார்க்கவும்.',
        safety_cancel: 'ரத்து (பாதுகாப்பானது)',
        safety_confirm: 'உறுதி செய்',
        search_modal_title: 'பெறுநர்கள் மற்றும் வரலாற்றைத் தேடுங்கள்',
        search_placeholder: 'பெயர், எண் அல்லது தொகையைத் தேடுங்கள்...',
        notif_modal_title: 'அணுகக்கூடிய அறிவிப்புகள்',
        notif_1_title: '₹25 கேஷ்பேக் வரவு வைக்கப்பட்டது',
        notif_1_desc: 'மளிகைப் பொருள் கட்டணத்திற்காக கேஷ்பேக் வழங்கப்பட்டது.',
        notif_2_title: 'பாதுகாப்பு சரிபார்ப்பு செயலில் உள்ளது',
        notif_2_desc: 'எஸ்பிஐ கணக்கு •••• 4821 குரல் உறுதிப்படுத்தல் வாயில் மற்றும் கைரேகை மூலம் பாதுகாக்கப்படுகிறது.'
      }
    };
  }

  /**
   * Get translation for given key
   */
  t(key, defaultVal = '') {
    const langObj = this.translations[this.currentLang] || this.translations['en'];
    return langObj[key] !== undefined ? langObj[key] : (this.translations['en'][key] || defaultVal || key);
  }

  /**
   * Apply language across the whole application
   * @param {string} lang - 'ta' or 'en'
   * @param {boolean} announce - whether to speak announcement
   */
  setLanguage(lang, announce = true) {
    if (lang !== 'ta' && lang !== 'en') {
      lang = 'ta';
    }
    this.currentLang = lang;
    document.documentElement.lang = lang;

    // Persist selected language using existing storage logic
    try {
      localStorage.setItem(this.STORAGE_KEY, lang);
    } catch (e) {
      console.warn('[i18n] Storage write error:', e);
    }

    // 1. Update all DOM elements with data-i18n
    this.updateDOM();

    // 2. Update Settings -> Language radio controls
    const radioEn = document.getElementById('setting-lang-en');
    const radioTa = document.getElementById('setting-lang-ta');
    const rowEn = document.getElementById('row-lang-en');
    const rowTa = document.getElementById('row-lang-ta');
    if (radioEn) radioEn.checked = (lang === 'en');
    if (radioTa) radioTa.checked = (lang === 'ta');
    if (rowEn) rowEn.classList.toggle('selected', lang === 'en');
    if (rowTa) rowTa.classList.toggle('selected', lang === 'ta');

    // Also update legacy buttons for backwards compatibility
    const btnEn = document.getElementById('btn-lang-en');
    const btnTa = document.getElementById('btn-lang-ta');
    if (btnEn && btnTa) {
      if (lang === 'en') {
        btnEn.classList.add('active');
        btnEn.setAttribute('aria-checked', 'true');
        btnTa.classList.remove('active');
        btnTa.setAttribute('aria-checked', 'false');
      } else {
        btnTa.classList.add('active');
        btnTa.setAttribute('aria-checked', 'true');
        btnEn.classList.remove('active');
        btnEn.setAttribute('aria-checked', 'false');
      }
    }

    // 3. Update Blind Assist bar language button
    const blindLangBtn = document.getElementById('header-lang-btn');
    if (blindLangBtn) {
      blindLangBtn.textContent = lang === 'ta' ? '🇮🇳 தமிழ்' : '🇬🇧 English';
      blindLangBtn.setAttribute('aria-label', lang === 'ta' ? 'தற்போதைய மொழி: தமிழ். ஆங்கிலத்திற்கு மாற்ற அழுத்தவும்' : 'Current language: English. Click to switch to Tamil');
    }

    // 4. Update Profile language selector buttons if present
    const profileEn = document.getElementById('profile-lang-en');
    const profileTa = document.getElementById('profile-lang-ta');
    if (profileEn && profileTa) {
      profileEn.classList.toggle('active', lang === 'en');
      profileTa.classList.toggle('active', lang === 'ta');
    }

    // 5. Update Quick Speech Chips text and commands
    this.updateSpeechChips(lang);

    // 6. Update dynamic greeting
    this.updateGreeting(lang);

    // 7. Update Confirmation Banner if active
    this.updateConfirmPrompt(lang);

    // 8. Inform TTS Voice engine
    if (window.TTSVoice) {
      window.TTSVoice.currentLang = lang;
      window.TTSVoice.updateVoiceForCurrentLang();
    }

    // 9. Inform STT Listener engine
    if (window.STTListener && typeof window.STTListener.onLanguageChange === 'function') {
      window.STTListener.onLanguageChange(lang);
    }

    // 10. Add accessible confirmation:
    // English: "Language changed to English"
    // Tamil: "மொழி தமிழாக மாற்றப்பட்டது"
    if (announce) {
      const confirmText = (lang === 'ta') ? 'மொழி தமிழாக மாற்றப்பட்டது' : 'Language changed to English';

      // Live ARIA screen reader announcement
      const srAnnouncerMsg = document.getElementById('sr-announcer-msg');
      const srAnnouncer = document.getElementById('sr-announcer');
      if (srAnnouncerMsg && srAnnouncer) {
        srAnnouncerMsg.textContent = confirmText;
        srAnnouncer.classList.add('active');
        setTimeout(() => srAnnouncer.classList.remove('active'), 2500);
      }

      if (window.TTSVoice && window.TTSVoice.speak) {
        window.TTSVoice.speak({
          ta: 'மொழி தமிழாக மாற்றப்பட்டது',
          en: 'Language changed to English'
        }, 'assertive');
      }
    }

    console.log(`[i18n Engine] Active Language set to: ${lang.toUpperCase()} (persisted: ${lang})`);
  }

  attachEventListeners() {
    const radioEn = document.getElementById('setting-lang-en');
    const radioTa = document.getElementById('setting-lang-ta');
    const rowEn = document.getElementById('row-lang-en');
    const rowTa = document.getElementById('row-lang-ta');

    if (radioEn) {
      radioEn.addEventListener('change', () => {
        if (radioEn.checked) this.setLanguage('en', true);
      });
    }
    if (radioTa) {
      radioTa.addEventListener('change', () => {
        if (radioTa.checked) this.setLanguage('ta', true);
      });
    }
    if (rowEn) {
      rowEn.addEventListener('click', (e) => {
        if (e.target !== radioEn) {
          if (radioEn) radioEn.checked = true;
          this.setLanguage('en', true);
        }
      });
    }
    if (rowTa) {
      rowTa.addEventListener('click', (e) => {
        if (e.target !== radioTa) {
          if (radioTa) radioTa.checked = true;
          this.setLanguage('ta', true);
        }
      });
    }
  }

  /**
   * Traverse DOM and update elements with data-i18n
   */
  updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      if (translation) {
        el.textContent = translation;
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translation = this.t(key);
      if (translation) {
        el.placeholder = translation;
      }
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const translation = this.t(key);
      if (translation) {
        el.setAttribute('aria-label', translation);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translation = this.t(key);
      if (translation) {
        el.setAttribute('title', translation);
      }
    });
  }

  /**
   * Updates Quick Speech Chips to show Tamil or English phrases
   * while keeping natural command data
   */
  updateSpeechChips(lang) {
    const chips = document.querySelectorAll('.speech-chip-btn[data-speech-chip]');
    if (chips.length >= 3) {
      if (lang === 'ta') {
        chips[0].textContent = '“குமாருக்கு 500 ரூபாய் அனுப்பு”';
        chips[0].dataset.cmd = 'குமாருக்கு 500 ரூபாய் அனுப்பு';

        chips[1].textContent = '“பிரியாவுக்கு 250 ரூபாய் அனுப்பு”';
        chips[1].dataset.cmd = 'பிரியாவுக்கு 250 ரூபாய் அனுப்பு';

        chips[2].textContent = '“ரவிக்கு 100 ரூபாய் அனுப்பு”';
        chips[2].dataset.cmd = 'ரவிக்கு 100 ரூபாய் அனுப்பு';
      } else {
        chips[0].textContent = '“Send ₹500 to Kumar”';
        chips[0].dataset.cmd = 'Send 500 to Kumar';

        chips[1].textContent = '“Send ₹250 to Priya”';
        chips[1].dataset.cmd = 'Send 250 to Priya';

        chips[2].textContent = '“Pay ₹100 to Ravi”';
        chips[2].dataset.cmd = 'Pay 100 to Ravi';
      }
    }

    // Also update mic transcript placeholder if not custom
    const transcriptEl = document.getElementById('speech-transcript-text');
    if (transcriptEl) {
      if (lang === 'ta') {
        transcriptEl.textContent = '“குமாருக்கு 500 ரூபாய் அனுப்பு”';
      } else {
        transcriptEl.textContent = '“Send ₹500 to Kumar”';
      }
    }

    if (window.ThemeManager) {
      window.ThemeManager.updateUIButtons();
    }
  }

  /**
   * Time-aware greeting
   */
  updateGreeting(lang) {
    const greetingEl = document.getElementById('user-greeting-heading');
    if (!greetingEl) return;
    const hour = new Date().getHours();
    const userName = (window.UserManager && typeof window.UserManager.getUserName === 'function') 
      ? window.UserManager.getUserName() 
      : 'Sandhiya';

    if (lang === 'ta') {
      if (hour < 12) greetingEl.textContent = `காலை வணக்கம், ${userName}`;
      else if (hour < 17) greetingEl.textContent = `மதிய வணக்கம், ${userName}`;
      else greetingEl.textContent = `மாலை வணக்கம், ${userName}`;
    } else {
      if (hour < 12) greetingEl.textContent = `Good Morning, ${userName}`;
      else if (hour < 17) greetingEl.textContent = `Good Afternoon, ${userName}`;
      else greetingEl.textContent = `Good Evening, ${userName}`;
    }
  }

  /**
   * Update Confirmation Banner text if present
   */
  updateConfirmPrompt(lang) {
    const promptEl = document.getElementById('confirm-prompt-text');
    const merchantEl = document.getElementById('confirm-merchant-name');
    const amountEl = document.getElementById('confirm-amount-display');
    const merchant = merchantEl ? merchantEl.textContent.trim() : 'Kumar Groceries';
    const amount = amountEl ? amountEl.textContent.replace(/[^\d]/g, '') : '500';

    if (promptEl) {
      if (lang === 'ta') {
        promptEl.textContent = `“${merchant} அவர்களுக்கு ₹${amount} அனுப்ப வேண்டுமா? உறுதி செய்ய 'ஆம்', ரத்து செய்ய 'வேண்டாம்' என்று சொல்லவும்.”`;
      } else {
        promptEl.textContent = `“You are sending ₹${amount} to ${merchant}. Say Yes to confirm or No to cancel.”`;
      }
    }

    const successRec = document.getElementById('success-recipient-name');
    if (successRec) {
      if (lang === 'ta') {
        successRec.textContent = `${merchant} அவர்களுக்கு பணம் செலுத்தப்பட்டது`;
      } else {
        successRec.textContent = `Paid to ${merchant}`;
      }
    }
  }

  init() {
    this.attachEventListeners();
    this.setLanguage(this.currentLang, false);
  }
}

// Global instance
window.I18n = new I18nEngine();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.I18n.init());
} else {
  window.I18n.init();
}
