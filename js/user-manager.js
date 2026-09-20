/**
 * OneAbility AI - User Profile & Accessibility Personalization Manager
 * 
 * Identity & Assistance Architecture:
 * - Product: OneAbility AI
 * - Assistant: Dex
 * - Logged-in User: Profile name obtained from Registration / Profile setup
 * - Accessibility Profile: User assistance preference (vision, hearing, motor, cognitive, senior, standard, custom)
 * - Accessibility Settings: 9 independent toggles (presets + manual overrides)
 *
 * Privacy Safeguards:
 * - Never asks for or stores medical diagnosis or disability records.
 * - Stores strictly UI assistance preferences.
 * 
 * Persistence:
 * - Primary Profile: localStorage key 'oneability_user_profile'
 * - Optional Assistant Nickname: localStorage key 'oneability_assistant_nickname'
 */

class UserProfileManager {
  constructor() {
    this.STORAGE_KEY = 'oneability_user_profile';
    this.NICKNAME_KEY = 'oneability_assistant_nickname';
    this.DEFAULT_DEMO_NAME = 'Sandhiya';
    this.DEFAULT_DEMO_MOBILE = '9876543210';
    this.DEFAULT_DEMO_EMAIL = 'sandhiya@okhdfcbank';

    this.profile = null;
    this.isInitialized = false;

    // Onboarding wizard state
    this.currentOnboardingStep = 1;
    this.onboardingLanguage = 'ta'; // default to Tamil
    this.onboardingProfile = 'standard';
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name && parsed.name.trim()) {
          const profName = parsed.name.trim();
          const a11yProf = parsed.accessibilityProfile || 'standard';
          this.profile = {
            name: profName,
            mobile: (parsed.mobile || '').trim(),
            email: (parsed.email || '').trim(),
            accessibilityProfile: a11yProf,
            accessibilitySettings: parsed.accessibilitySettings || this.getDefaultSettingsForProfile(a11yProf)
          };
        }
      } catch (err) {
        console.warn('[UserManager] Failed to parse existing profile:', err);
      }
    }

    if (this.profile) {
      // Profile exists: update application-wide identity and hide registration modal
      this.hideRegistrationModal();
      this.updateAppWideIdentity();
      // Apply saved accessibility profile & settings
      if (window.AccessibilityEngine && typeof window.AccessibilityEngine.applyProfile === 'function') {
        window.AccessibilityEngine.applyProfile(this.profile.accessibilityProfile, this.profile.accessibilitySettings);
      }
    } else {
      // Fresh start: hide registration modal initially so Splash & Login screens show cleanly
      this.hideRegistrationModal();
    }

    this.bindEvents();
  }

  /**
   * Returns primary account name. Used for legal receipts, accounts, headers.
   */
  getUserName() {
    if (this.profile && this.profile.name && this.profile.name.trim()) {
      return this.profile.name.trim();
    }
    return this.DEFAULT_DEMO_NAME;
  }

  getUserMobile() {
    return (this.profile && this.profile.mobile) || this.DEFAULT_DEMO_MOBILE;
  }

  getUserEmail() {
    if (this.profile && this.profile.email && this.profile.email.trim()) {
      return this.profile.email.trim();
    }
    const safeName = this.getUserName().toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${safeName || 'sandhiya'}@okhdfcbank`;
  }

  getAssistantNickname() {
    return (localStorage.getItem(this.NICKNAME_KEY) || '').trim();
  }

  /**
   * Priority: If assistant nickname exists -> return nickname; otherwise -> return account name.
   */
  getAssistantCallName() {
    const nick = this.getAssistantNickname();
    if (nick) {
      return nick;
    }
    return this.getUserName();
  }

  getAccessibilityProfile() {
    return (this.profile && this.profile.accessibilityProfile) || 'standard';
  }

  getAccessibilitySettings() {
    if (this.profile && this.profile.accessibilitySettings) {
      return Object.assign({}, this.profile.accessibilitySettings);
    }
    return this.getDefaultSettingsForProfile(this.getAccessibilityProfile());
  }

  /**
   * Default Presets for each Assistance Profile
   */
  getDefaultSettingsForProfile(profile) {
    switch (profile) {
      case 'vision':
        return {
          large_text: true,
          high_contrast: true,
          spoken_feedback: true,
          live_captions: false,
          vibration: true,
          flash_alerts: false,
          dwell_click: false,
          simplified_ui: false,
          reduced_motion: false
        };
      case 'hearing':
        return {
          large_text: false,
          high_contrast: false,
          spoken_feedback: false,
          live_captions: true,
          vibration: true,
          flash_alerts: true,
          dwell_click: false,
          simplified_ui: false,
          reduced_motion: false
        };
      case 'motor':
        return {
          large_text: false,
          high_contrast: false,
          spoken_feedback: true,
          live_captions: false,
          vibration: true,
          flash_alerts: false,
          dwell_click: true,
          simplified_ui: false,
          reduced_motion: false
        };
      case 'cognitive':
        return {
          large_text: false,
          high_contrast: false,
          spoken_feedback: true,
          live_captions: false,
          vibration: false,
          flash_alerts: false,
          dwell_click: false,
          simplified_ui: true,
          reduced_motion: true
        };
      case 'senior':
        return {
          large_text: true,
          high_contrast: false,
          spoken_feedback: true,
          live_captions: false,
          vibration: true,
          flash_alerts: false,
          dwell_click: false,
          simplified_ui: true,
          reduced_motion: false
        };
      case 'custom':
        return {
          large_text: false,
          high_contrast: false,
          spoken_feedback: true,
          live_captions: false,
          vibration: true,
          flash_alerts: false,
          dwell_click: false,
          simplified_ui: false,
          reduced_motion: false
        };
      case 'standard':
      default:
        return {
          large_text: false,
          high_contrast: false,
          spoken_feedback: true,
          live_captions: false,
          vibration: false,
          flash_alerts: false,
          dwell_click: false,
          simplified_ui: false,
          reduced_motion: false
        };
    }
  }

  saveProfile(name, mobile, email, accessibilityProfile, accessibilitySettings) {
    const cleanName = (name || '').trim() || this.DEFAULT_DEMO_NAME;
    const cleanMobile = (mobile || '').trim() || this.DEFAULT_DEMO_MOBILE;
    const cleanEmail = (email || '').trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@okhdfcbank`;
    const cleanProfile = accessibilityProfile || (this.profile && this.profile.accessibilityProfile) || 'standard';
    const cleanSettings = accessibilitySettings || (this.profile && this.profile.accessibilitySettings) || this.getDefaultSettingsForProfile(cleanProfile);

    this.profile = {
      name: cleanName,
      mobile: cleanMobile,
      email: cleanEmail,
      accessibilityProfile: cleanProfile,
      accessibilitySettings: cleanSettings
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.profile));
    this.updateAppWideIdentity();
    return this.profile;
  }

  setAccessibilityProfile(profileKey) {
    if (!this.profile) {
      this.profile = {
        name: this.DEFAULT_DEMO_NAME,
        mobile: this.DEFAULT_DEMO_MOBILE,
        email: this.DEFAULT_DEMO_EMAIL,
        accessibilityProfile: profileKey,
        accessibilitySettings: this.getDefaultSettingsForProfile(profileKey)
      };
    } else {
      this.profile.accessibilityProfile = profileKey;
      this.profile.accessibilitySettings = this.getDefaultSettingsForProfile(profileKey);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.profile));
    this.updateAppWideIdentity();

    if (window.AccessibilityEngine && typeof window.AccessibilityEngine.applyProfile === 'function') {
      window.AccessibilityEngine.applyProfile(profileKey, this.profile.accessibilitySettings);
    }
  }

  setAccessibilitySetting(settingKey, boolValue) {
    if (!this.profile) {
      this.profile = {
        name: this.DEFAULT_DEMO_NAME,
        mobile: this.DEFAULT_DEMO_MOBILE,
        email: this.DEFAULT_DEMO_EMAIL,
        accessibilityProfile: 'custom',
        accessibilitySettings: this.getDefaultSettingsForProfile('standard')
      };
    }
    if (!this.profile.accessibilitySettings) {
      this.profile.accessibilitySettings = this.getDefaultSettingsForProfile(this.profile.accessibilityProfile);
    }

    this.profile.accessibilitySettings[settingKey] = Boolean(boolValue);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.profile));

    if (window.AccessibilityEngine && typeof window.AccessibilityEngine.applyIndividualSetting === 'function') {
      window.AccessibilityEngine.applyIndividualSetting(settingKey, Boolean(boolValue));
    }
  }

  saveAssistantNickname(nickname) {
    const clean = (nickname || '').trim();
    if (clean) {
      localStorage.setItem(this.NICKNAME_KEY, clean);
    } else {
      localStorage.removeItem(this.NICKNAME_KEY);
    }
    this.updateAppWideIdentity();
  }

  clearAssistantNickname() {
    localStorage.removeItem(this.NICKNAME_KEY);
    this.updateAppWideIdentity();
  }

  /**
   * Synchronizes active user identity across the entire UI and assistive layers
   */
  updateAppWideIdentity() {
    const userName = this.getUserName();
    const assistantCallName = this.getAssistantCallName();
    const email = this.getUserEmail();
    const initialLetter = userName.charAt(0).toUpperCase() || 'S';
    const a11yProfile = this.getAccessibilityProfile();

    // 1. Header greeting & avatar
    const headerAvatar = document.querySelector('.user-avatar-circle');
    if (headerAvatar) {
      headerAvatar.textContent = initialLetter;
    }
    const headerBtn = document.getElementById('header-avatar-btn');
    if (headerBtn) {
      headerBtn.setAttribute('aria-label', `Open profile and accessibility settings for ${userName}`);
    }

    // Call i18n to update greeting text with current language and name
    if (window.I18n && typeof window.I18n.updateGreeting === 'function') {
      window.I18n.updateGreeting(window.I18n.currentLang || 'ta');
    } else {
      const greetingEl = document.getElementById('user-greeting-heading');
      if (greetingEl) {
        const hour = new Date().getHours();
        let timeGreeting = 'Good Evening';
        if (hour < 12) timeGreeting = 'Good Morning';
        else if (hour < 17) timeGreeting = 'Good Afternoon';
        greetingEl.textContent = `${timeGreeting}, ${userName}`;
      }
    }

    // 2. Bottom Nav Profile aria-label
    const navProf = document.getElementById('nav-btn-profile');
    if (navProf) {
      navProf.setAttribute('aria-label', `View profile and accessibility for ${userName}`);
    }

    // 3. Screen Reader Live Announcer
    const srAnnouncer = document.getElementById('sr-announcer-msg');
    if (srAnnouncer) {
      srAnnouncer.textContent = `OneAbility Pay Ready for ${userName}`;
    }

    // 4. Profile View screen details
    const profNameEl = document.getElementById('profile-account-name');
    if (profNameEl) {
      profNameEl.textContent = userName;
    }
    const profEmailEl = document.getElementById('profile-account-sub');
    if (profEmailEl) {
      profEmailEl.textContent = email;
    }
    const profAvatarEl = document.getElementById('profile-avatar-display') || document.querySelector('.profile-avatar-lg');
    if (profAvatarEl) {
      profAvatarEl.textContent = initialLetter;
    }

    // 5. Dex Nickname settings card in Profile view
    const nickInput = document.getElementById('setting-dex-nickname');
    if (nickInput && document.activeElement !== nickInput) {
      nickInput.value = this.getAssistantNickname();
    }
    const nickFallbackEl = document.getElementById('nickname-account-fallback');
    if (nickFallbackEl) {
      nickFallbackEl.textContent = userName;
    }
    const dexActiveCallEl = document.getElementById('dex-active-callname');
    if (dexActiveCallEl) {
      dexActiveCallEl.textContent = assistantCallName;
    }

    // 6. Settings Accessibility active profile name
    const activeProfNameEl = document.getElementById('settings-active-profile-name');
    const activeProfBadgeEl = document.getElementById('current-profile-badge');
    const profDisplayNames = {
      standard: 'Standard',
      vision: 'Vision Assist',
      hearing: 'Hearing Assist',
      motor: 'Motor Assist',
      cognitive: 'Cognitive / Simplified Mode',
      senior: 'Easy / Senior Mode',
      custom: 'Custom / Multiple Needs'
    };
    const displayName = profDisplayNames[a11yProfile] || 'Standard';
    if (activeProfNameEl) activeProfNameEl.textContent = displayName;
    if (activeProfBadgeEl) activeProfBadgeEl.textContent = displayName;
  }

  // =========================================================================
  // MULTI-STEP ONBOARDING FLOW (Steps 1 to 5)
  // =========================================================================

  showRegistrationModal(startStep = 1) {
    const modal = document.getElementById('user-registration-modal');
    if (modal) {
      modal.classList.add('active');
      this.currentOnboardingStep = startStep;
      this.goToOnboardingStep(startStep);
    }
  }

  hideRegistrationModal() {
    const modal = document.getElementById('user-registration-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  goToOnboardingStep(stepNumber) {
    this.currentOnboardingStep = stepNumber;

    // Hide all step panels
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`onboarding-step-${i}`);
      if (panel) {
        panel.style.display = (i === stepNumber) ? 'block' : 'none';
      }
    }

    // Update step badge pill
    const badge = document.getElementById('onboarding-step-badge');
    if (badge) {
      const isTa = this.onboardingLanguage === 'ta';
      badge.textContent = isTa ? `படி ${stepNumber} / 4` : `Step ${stepNumber} of 4`;
    }

    // Dynamic step-specific setup
    if (stepNumber === 1) {
      const nameInput = document.getElementById('reg-form-name');
      if (nameInput) {
        if (!nameInput.value) nameInput.value = this.DEFAULT_DEMO_NAME;
        setTimeout(() => {
          if (nameInput && typeof nameInput.focus === 'function') nameInput.focus();
        }, 150);
      }
    } else if (stepNumber === 3) {
      // Ensure current selection is highlighted
      this.renderAssistanceSelection(this.onboardingProfile);
    } else if (stepNumber === 4) {
      // Render preview summary
      this.renderStep4Preview();
    }
  }

  selectOnboardingLanguage(lang) {
    this.onboardingLanguage = (lang === 'en') ? 'en' : 'ta';

    // Update radio/pill styling in Step 2
    const btnTa = document.getElementById('onboard-lang-ta');
    const btnEn = document.getElementById('onboard-lang-en');
    if (btnTa) btnTa.classList.toggle('selected', this.onboardingLanguage === 'ta');
    if (btnEn) btnEn.classList.toggle('selected', this.onboardingLanguage === 'en');

    // Update text content of onboarding to match selected language immediately
    this.updateOnboardingLanguageUI(this.onboardingLanguage);
  }

  selectOnboardingAssistance(profileKey) {
    this.onboardingProfile = profileKey || 'standard';
    this.renderAssistanceSelection(this.onboardingProfile);
  }

  renderAssistanceSelection(profileKey) {
    document.querySelectorAll('.assistance-option-card').forEach(card => {
      const isSelected = card.dataset.profile === profileKey;
      card.classList.toggle('selected', isSelected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });
  }

  renderStep4Preview() {
    const isTa = this.onboardingLanguage === 'ta';
    const nameInput = document.getElementById('reg-form-name');
    const userName = (nameInput && nameInput.value.trim()) || this.DEFAULT_DEMO_NAME;

    const previewMsgEl = document.getElementById('onboarding-preview-msg');
    const userSummaryEl = document.getElementById('onboarding-user-summary');

    const previewMap = {
      standard: {
        en: 'Standard mode provides balanced voice, touch, and visual banking.',
        ta: 'இயல்பான முறை சமநிலையான குரல் மற்றும் காட்சி வங்கி அனுபவத்தை வழங்குகிறது.'
      },
      vision: {
        en: 'Vision Assist will enable spoken navigation, larger text, strong focus indicators, and voice-guided receipts.',
        ta: 'பார்வை உதவி: குரல் வழி வழிகாட்டல், பெரிய எழுத்துக்கள், வலுவான குவிய குறிகாட்டிகள் மற்றும் குரல் ரசீதுகளை இயக்கும்.'
      },
      hearing: {
        en: 'Hearing Assist will enable real-time visual captions, screen flash alerts, and vibration feedback.',
        ta: 'செவித்திறன் உதவி: நேரலை வசனங்கள், திரை ஒளிரும் எச்சரிக்கைகள் மற்றும் அதிர்வு கருத்துக்களை இயக்கும்.'
      },
      motor: {
        en: 'Motor Assist will enable large 64px+ touch targets, Dwell Click, and reduced tap count.',
        ta: 'இயக்க உதவி: 64px+ பெரிய பொத்தான்கள், தானியங்கி கிளிக் மற்றும் குறைவான தொடுதல்களை இயக்கும்.'
      },
      cognitive: {
        en: 'Cognitive Mode will remove distractions, enforce one action per step, and show plain-language guidance.',
        ta: 'எளிய முறை: தேவையற்ற கவனச்சிதறல்களை அகற்றி, எளிய வழிமுறைகள் மற்றும் மோசடி பாதுகாப்பை இயக்கும்.'
      },
      senior: {
        en: 'Senior Mode will enable large text & icons, simplified home, and slower, clearer spoken feedback.',
        ta: 'முதியோர் முறை: பெரிய எழுத்துக்கள், எளிமையான முகப்பு மற்றும் மெதுவான குரல் வழிகாட்டலை இயக்கும்.'
      },
      custom: {
        en: 'Custom Mode allows you to combine any accommodations tailored to your exact needs.',
        ta: 'தனிப்பயன் முறை: உங்கள் விருப்பத்திற்கேற்ப அனைத்து அமைப்புகளையும் சுதந்திரமாக இணைக்க உதவும்.'
      }
    };

    const previewText = (previewMap[this.onboardingProfile] || previewMap.standard)[isTa ? 'ta' : 'en'];
    if (previewMsgEl) previewMsgEl.textContent = previewText;

    if (userSummaryEl) {
      userSummaryEl.textContent = isTa
        ? `கணக்கு: ${userName} • மொழி: ${this.onboardingLanguage === 'ta' ? 'தமிழ்' : 'English'}`
        : `Account: ${userName} • Language: ${this.onboardingLanguage === 'ta' ? 'தமிழ்' : 'English'}`;
    }
  }

  updateOnboardingLanguageUI(lang) {
    const isTa = lang === 'ta';

    // Step indicators
    const badge = document.getElementById('onboarding-step-badge');
    if (badge) badge.textContent = isTa ? `படி ${this.currentOnboardingStep} / 4` : `Step ${this.currentOnboardingStep} of 4`;

    // Static text mappings for wizard
    const trans = {
      'onboard-title-step1': isTa ? 'கணக்கு விவரங்களை அமைக்கவும்' : 'Create Your Account Profile',
      'onboard-sub-step1': isTa ? 'குரல் வழிகாட்டலைத் தொடங்க உங்கள் விவரங்களை உள்ளிடவும்.' : 'Set up your name and details to personalize your voice fintech experience.',
      'onboard-lbl-name': isTa ? 'முழுப் பெயர் *' : 'Full Name *',
      'onboard-lbl-contact': isTa ? 'மொபைல் எண் அல்லது மின்னஞ்சல்' : 'Mobile or Email',
      'onboard-btn-next1': isTa ? 'அடுத்து: மொழி →' : 'Next: Language →',
      'onboard-btn-skip1': isTa ? 'இப்போதைக்கு தவிர்க்க' : 'Skip for now',

      'onboard-title-step2': isTa ? 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்' : 'Choose Your Language',
      'onboard-sub-step2': isTa ? 'குரல் மற்றும் திரை வழிகாட்டலுக்கு விருப்பமான மொழியைத் தேர்வுசெய்யவும்.' : 'Select your preferred language for voice and screen guidance.',
      'onboard-btn-back2': isTa ? '← பின்செல்ல' : '← Back',
      'onboard-btn-next2': isTa ? 'அடுத்து: உதவி முறை →' : 'Next: Assistance →',
      'onboard-btn-skip2': isTa ? 'இப்போதைக்கு தவிர்க்க' : 'Skip for now',

      'onboard-title-step3': isTa ? 'ஒன்அபிலிட்டி ஏஐ உங்களுக்கு எவ்வாறு உதவ வேண்டும்?' : 'How would you like OneAbility AI to assist you?',
      'onboard-sub-step3': isTa ? 'தொடக்க அமைப்பைத் தேர்ந்தெடுக்கவும். எந்த நேரத்திலும் தனிப்பட்ட அமைப்புகளை மாற்றலாம்.' : 'Select an assistance preset. You can customize individual settings anytime in Settings.',
      'onboard-btn-back3': isTa ? '← பின்செல்ல' : '← Back',
      'onboard-btn-next3': isTa ? 'தொடரவும் →' : 'Continue →',
      'onboard-btn-skip3': isTa ? 'இப்போதைக்கு தவிர்க்க' : 'Skip for now',

      'onboard-title-step4': isTa ? 'உங்கள் அணுகல்தன்மை அமைப்பை மதிப்பாய்வு செய்யவும்' : 'Review Your Assistance Setup',
      'onboard-sub-step4': isTa ? 'தேர்ந்தெடுக்கப்பட்ட அமைப்புகள் தானாகவே பயன்பாட்டிற்குப் பயன்படுத்தப்படும்.' : 'Your assistance preferences will be automatically applied.',
      'onboard-btn-back4': isTa ? '← பின்செல்ல' : '← Back',
      'onboard-btn-apply': isTa ? 'அமைப்புகளைப் பயன்படுத்தி தொடங்க ✨' : 'Apply & Open OneAbility ✨'
    };

    for (const [id, text] of Object.entries(trans)) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }
  }

  skipOnboarding() {
    // Defaults to standard assistance with current form values
    this.onboardingProfile = 'standard';
    this.applyOnboardingAndFinish();
  }

  applyOnboardingAndFinish() {
    const nameInput = document.getElementById('reg-form-name');
    const contactInput = document.getElementById('reg-form-contact');
    const name = (nameInput ? nameInput.value : '').trim() || this.DEFAULT_DEMO_NAME;
    const contact = (contactInput ? contactInput.value : '').trim() || this.DEFAULT_DEMO_MOBILE;

    let mobile = this.DEFAULT_DEMO_MOBILE;
    let email = '';
    if (contact.includes('@')) {
      email = contact;
    } else {
      mobile = contact;
    }

    const defaultSettings = this.getDefaultSettingsForProfile(this.onboardingProfile);

    // Save profile with selected assistance preference
    this.saveProfile(name, mobile, email, this.onboardingProfile, defaultSettings);

    // Save & apply language preference
    if (window.I18n && typeof window.I18n.setLanguage === 'function') {
      window.I18n.setLanguage(this.onboardingLanguage);
    } else {
      localStorage.setItem('oneability_lang', this.onboardingLanguage);
    }

    // Auto apply selected accessibility profile
    if (window.AccessibilityEngine && typeof window.AccessibilityEngine.applyProfile === 'function') {
      window.AccessibilityEngine.applyProfile(this.onboardingProfile, defaultSettings);
    }

    this.hideRegistrationModal();
    if (window.AuthController && typeof window.AuthController.hideLoginScreen === 'function') {
      window.AuthController.isLoggedIn = true;
      window.AuthController.hideLoginScreen();
    }

    // Welcome greeting
    const callName = this.getAssistantCallName();
    if (window.TTSVoice && typeof window.TTSVoice.speak === 'function') {
      const welcomeMsg = this.onboardingLanguage === 'ta'
        ? `வணக்கம் ${callName}! ஒன்அபிலிட்டி பே செயலி தயார்.`
        : `Welcome ${callName}! OneAbility Pay is ready.`;
      window.TTSVoice.speak({ ta: welcomeMsg, en: welcomeMsg }, 'assertive');
    }
  }

  // =========================================================================
  // EDIT PROFILE MODAL
  // =========================================================================

  openEditModal() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
      modal.classList.add('active');
      const nameInput = document.getElementById('edit-prof-name');
      const mobileInput = document.getElementById('edit-prof-mobile');
      const emailInput = document.getElementById('edit-prof-email');
      if (nameInput) nameInput.value = this.getUserName();
      if (mobileInput) mobileInput.value = this.getUserMobile();
      if (emailInput) emailInput.value = this.getUserEmail();
      if (nameInput && typeof nameInput.focus === 'function') setTimeout(() => nameInput.focus(), 150);
    }
  }

  closeEditModal() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  handleEditProfileSubmit() {
    const nameInput = document.getElementById('edit-prof-name');
    const mobileInput = document.getElementById('edit-prof-mobile');
    const emailInput = document.getElementById('edit-prof-email');

    const name = (nameInput ? nameInput.value : '').trim() || this.DEFAULT_DEMO_NAME;
    const mobile = (mobileInput ? mobileInput.value : '').trim() || this.DEFAULT_DEMO_MOBILE;
    const email = (emailInput ? emailInput.value : '').trim();

    this.saveProfile(name, mobile, email);
    this.closeEditModal();

    if (window.TTSVoice && typeof window.TTSVoice.speak === 'function') {
      window.TTSVoice.speak({
        ta: `சுயவிவரம் புதுப்பிக்கப்பட்டது. உங்கள் பெயர்: ${name}`,
        en: `Profile updated. Your account name is ${name}.`
      }, 'assertive');
    }
  }

  saveNicknameFromInput() {
    const nickInput = document.getElementById('setting-dex-nickname');
    const val = (nickInput ? nickInput.value : '').trim();
    this.saveAssistantNickname(val);

    const callName = this.getAssistantCallName();
    if (window.TTSVoice && typeof window.TTSVoice.speak === 'function') {
      window.TTSVoice.speak({
        ta: `இனி டெக்ஸ் உங்களை ${callName} என்று அழைக்கும்.`,
        en: `Dex will now call you ${callName}.`
      });
    }
  }

  clearNicknameFromInput() {
    const nickInput = document.getElementById('setting-dex-nickname');
    if (nickInput) nickInput.value = '';
    this.clearAssistantNickname();

    const callName = this.getAssistantCallName();
    if (window.TTSVoice && typeof window.TTSVoice.speak === 'function') {
      window.TTSVoice.speak({
        ta: `டெக்ஸ் பட்டப்பெயர் நீக்கப்பட்டது. இனி உங்களை ${callName} என்று அழைக்கும்.`,
        en: `Nickname cleared. Dex will call you by your account name, ${callName}.`
      });
    }
  }

  bindEvents() {
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY || e.key === this.NICKNAME_KEY) {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          try {
            this.profile = JSON.parse(raw);
          } catch (err) {}
        }
        this.updateAppWideIdentity();
      }
    });
  }
}

window.UserManager = new UserProfileManager();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.UserManager.init());
} else {
  window.UserManager.init();
}
