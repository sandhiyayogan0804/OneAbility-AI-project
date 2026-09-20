/**
 * OneAbility AI - Universal Accessibility Engine
 * 
 * Manages:
 * 1. Accessibility Profile Presets (Vision, Hearing, Motor, Cognitive, Senior, Standard, Custom)
 * 2. 9 Independent Accessibility Controls (Toggles with manual override capability)
 * 3. Dwell-Click simulation for motor assistance
 * 4. Screen-flash alerts for hearing assistance
 * 5. Slower speech cadence for senior mode
 * 6. Profile change modal with live previews
 */

class AccessibilityEngine {
  constructor() {
    this.currentMode = 'standard';
    this.fontSizeLevel = 0; // 0 = normal, 1 = large, 2 = xlarge
    this.dwellEnabled = false;
    this.dwellInterval = null;
    this.dwellTarget = null;
    this.dwellDuration = 1400; // 1.4 seconds dwell time
    this.dwellIndicator = null;
    this.dwellCircle = null;

    this.tempModalProfile = 'standard';

    this.profileNames = {
      standard: { en: 'Standard', ta: 'இயல்பான முறை (Standard)' },
      vision: { en: 'Vision Assist', ta: 'பார்வை உதவி (Vision Assist)' },
      hearing: { en: 'Hearing Assist', ta: 'செவித்திறன் உதவி (Hearing Assist)' },
      motor: { en: 'Motor Assist', ta: 'இயக்க உதவி (Motor Assist)' },
      cognitive: { en: 'Cognitive / Simplified Mode', ta: 'எளிய முறை (Cognitive Mode)' },
      senior: { en: 'Easy / Senior Mode', ta: 'முதியோர் முறை (Senior Mode)' },
      custom: { en: 'Custom / Multiple Needs', ta: 'தனிப்பயன் முறை (Custom Mode)' }
    };

    this.profilePreviews = {
      standard: {
        en: 'Standard mode provides balanced voice, touch, and visual banking.',
        ta: 'இயல்பான முறை சமநிலையான குரல் மற்றும் காட்சி வங்கி அனுபவத்தை வழங்குகிறது.'
      },
      vision: {
        en: 'Vision Assist will enable spoken navigation, larger text, strong focus indicators, and voice receipts.',
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
        en: 'Cognitive Mode will remove distractions, enforce one action per step, and show plain guidance.',
        ta: 'எளிய முறை: தேவையற்ற கவனச்சிதறல்களை அகற்றி, எளிய வழிமுறைகள் மற்றும் மோசடி பாதுகாப்பை இயக்கும்.'
      },
      senior: {
        en: 'Senior Mode will enable large text & icons, simplified home, and slower spoken feedback.',
        ta: 'முதியோர் முறை: பெரிய எழுத்துக்கள், எளிமையான முகப்பு மற்றும் மெதுவான குரல் வழிகாட்டலை இயக்கும்.'
      },
      custom: {
        en: 'Custom Mode allows you to freely toggle any combination of accommodations.',
        ta: 'தனிப்பயன் முறை: உங்கள் விருப்பத்திற்கேற்ப அனைத்து அமைப்புகளையும் சுதந்திரமாக இணைக்க உதவும்.'
      }
    };

    this.initDwellCursor();
    this.initKeyboardShortcuts();
  }

  // Backward compatibility alias for legacy callers
  switchPersona(mode) {
    if (window.UserManager && typeof window.UserManager.setAccessibilityProfile === 'function') {
      window.UserManager.setAccessibilityProfile(mode);
    } else {
      this.applyProfile(mode);
    }
  }

  /**
   * Applies an accessibility profile preset and its individual settings
   * @param {string} mode - 'vision', 'hearing', 'motor', 'cognitive', 'senior', 'standard', 'custom'
   * @param {object} [customSettings] - Optional map of 9 individual boolean overrides
   */
  applyProfile(mode, customSettings = null) {
    this.currentMode = mode || 'standard';
    const body = document.body;

    // Remove legacy mode classes
    body.classList.remove('mode-vision', 'mode-hearing', 'mode-motor', 'mode-cognitive', 'mode-senior', 'mode-standard');
    if (mode && mode !== 'standard' && mode !== 'custom') {
      body.classList.add(`mode-${mode}`);
    } else if (mode === 'standard') {
      body.classList.add('mode-standard');
    }

    // Resolve settings
    const settings = customSettings || (window.UserManager && typeof window.UserManager.getDefaultSettingsForProfile === 'function'
      ? window.UserManager.getDefaultSettingsForProfile(mode)
      : {});

    // Apply 9 individual settings
    this.applyIndividualSetting('large_text', Boolean(settings.large_text));
    this.applyIndividualSetting('high_contrast', Boolean(settings.high_contrast));
    this.applyIndividualSetting('spoken_feedback', Boolean(settings.spoken_feedback));
    this.applyIndividualSetting('live_captions', Boolean(settings.live_captions));
    this.applyIndividualSetting('vibration', Boolean(settings.vibration));
    this.applyIndividualSetting('flash_alerts', Boolean(settings.flash_alerts));
    this.applyIndividualSetting('dwell_click', Boolean(settings.dwell_click));
    this.applyIndividualSetting('simplified_ui', Boolean(settings.simplified_ui));
    this.applyIndividualSetting('reduced_motion', Boolean(settings.reduced_motion));

    // Speech Cadence for Senior Mode
    if (window.TTSVoice) {
      if (mode === 'senior') {
        window.TTSVoice.rate = 0.85; // Slower, clearer cadence
      } else {
        window.TTSVoice.rate = 1.0;
      }
    }

    // Update active persona buttons in settings
    document.querySelectorAll('.persona-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update UI Profile badges & text
    this.syncProfileUI();
  }

  /**
   * Applies an individual accommodation toggle without forcing a full profile switch
   */
  applyIndividualSetting(key, value) {
    const body = document.body;
    const isEnabled = Boolean(value);

    switch (key) {
      case 'large_text':
        body.classList.toggle('font-size-large', isEnabled);
        body.classList.toggle('acc-large-text', isEnabled);
        this.fontSizeLevel = isEnabled ? 1 : 0;
        const fontBtn = document.getElementById('font-size-toggle');
        if (fontBtn) fontBtn.textContent = isEnabled ? 'A++ (Large)' : 'A+ (Scale)';
        break;

      case 'high_contrast':
        body.classList.toggle('acc-high-contrast', isEnabled);
        if (isEnabled && this.currentMode !== 'vision') {
          body.classList.add('mode-vision');
        } else if (!isEnabled && this.currentMode !== 'vision') {
          body.classList.remove('mode-vision');
        }
        break;

      case 'spoken_feedback':
        if (window.TTSVoice) {
          window.TTSVoice.isVoiceEnabled = isEnabled;
        }
        const voiceBtn = document.getElementById('voice-mute-toggle');
        if (voiceBtn) {
          voiceBtn.textContent = isEnabled ? '🔊 Voice: ON' : '🔇 Voice: OFF';
        }
        break;

      case 'live_captions':
        body.classList.toggle('acc-live-captions', isEnabled);
        const captionsBar = document.querySelector('.hearing-captions-bar');
        if (captionsBar) {
          captionsBar.style.display = isEnabled ? 'flex' : '';
        }
        break;

      case 'vibration':
        if (window.AcousticHaptic) {
          window.AcousticHaptic.hapticsEnabled = isEnabled;
        }
        break;

      case 'flash_alerts':
        body.classList.toggle('acc-flash-alerts', isEnabled);
        break;

      case 'dwell_click':
        body.classList.toggle('acc-dwell-click', isEnabled);
        this.enableDwellClick(isEnabled);
        break;

      case 'simplified_ui':
        body.classList.toggle('acc-simplified', isEnabled);
        break;

      case 'reduced_motion':
        body.classList.toggle('acc-reduced-motion', isEnabled);
        break;
    }

    // Update the individual button in Settings
    this.syncToggleUI(key, isEnabled);
  }

  toggleSetting(key) {
    if (!window.UserManager) return;
    const currentSettings = window.UserManager.getAccessibilitySettings();
    const currentVal = Boolean(currentSettings[key]);
    const newVal = !currentVal;

    // Save and apply individual setting
    window.UserManager.setAccessibilitySetting(key, newVal);

    // Announce to user
    const isTa = window.I18n && window.I18n.currentLang === 'ta';
    const statusText = newVal ? (isTa ? 'இயக்கப்பட்டது' : 'Enabled') : (isTa ? 'முடக்கப்பட்டது' : 'Disabled');
    const label = this.getSettingLabel(key, isTa ? 'ta' : 'en');
    if (window.TTSVoice && window.TTSVoice.isVoiceEnabled) {
      window.TTSVoice.speak({
        ta: `${label} ${statusText}.`,
        en: `${label} ${statusText}.`
      });
    }
  }

  getSettingLabel(key, lang = 'en') {
    const labels = {
      large_text: { en: 'Large Text', ta: 'பெரிய எழுத்துக்கள்' },
      high_contrast: { en: 'High Contrast', ta: 'அதிக மாறுபட்ட வண்ணம்' },
      spoken_feedback: { en: 'Spoken Feedback', ta: 'குரல் வழிகாட்டல்' },
      live_captions: { en: 'Live Captions', ta: 'நேரலை வசனங்கள்' },
      vibration: { en: 'Vibration', ta: 'அதிர்வு கருத்து' },
      flash_alerts: { en: 'Flash Alerts', ta: 'திரை ஒளிரும் அறிவிப்பு' },
      dwell_click: { en: 'Dwell Click', ta: 'தானியங்கி கிளிக்' },
      simplified_ui: { en: 'Simplified Interface', ta: 'எளிமையான இடைமுகம்' },
      reduced_motion: { en: 'Reduced Motion', ta: 'அசைவு குறைப்பு' }
    };
    return (labels[key] && labels[key][lang]) || key;
  }

  syncProfileUI() {
    const isTa = window.I18n && window.I18n.currentLang === 'ta';
    const mode = this.currentMode || 'standard';
    const meta = this.profileNames[mode] || this.profileNames.standard;
    const name = meta[isTa ? 'ta' : 'en'];

    const activeEl = document.getElementById('settings-active-profile-name');
    if (activeEl) activeEl.textContent = name;

    const badge = document.getElementById('current-profile-badge');
    if (badge) badge.textContent = name;
  }

  syncToggleUI(key, isEnabled) {
    const isTa = window.I18n && window.I18n.currentLang === 'ta';
    const btn = document.getElementById(`btn-toggle-${key.replace(/_/g, '-')}`);
    if (btn) {
      btn.classList.toggle('active', isEnabled);
      btn.setAttribute('aria-checked', isEnabled ? 'true' : 'false');
      btn.textContent = isEnabled ? (isTa ? 'இயக்கத்தில்' : 'ON') : (isTa ? 'முடக்கம்' : 'OFF');
    }
  }

  // =========================================================================
  // PROFILE CHANGE MODAL FLOW (Settings -> Accessibility -> Change Profile)
  // =========================================================================

  openChangeProfileModal() {
    const modal = document.getElementById('change-accessibility-profile-modal');
    if (!modal) return;
    modal.classList.add('active');

    const currentProfile = (window.UserManager && window.UserManager.getAccessibilityProfile()) || this.currentMode || 'standard';
    this.tempModalProfile = currentProfile;
    this.selectProfileInModal(currentProfile);
  }

  closeChangeProfileModal() {
    const modal = document.getElementById('change-accessibility-profile-modal');
    if (modal) modal.classList.remove('active');
  }

  selectProfileInModal(profileKey) {
    this.tempModalProfile = profileKey;

    // Check radio buttons in modal
    document.querySelectorAll('.modal-profile-radio-card').forEach(card => {
      const isSelected = card.dataset.profile === profileKey;
      card.classList.toggle('selected', isSelected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });

    // Update Preview Text Box
    const isTa = window.I18n && window.I18n.currentLang === 'ta';
    const previewEl = document.getElementById('modal-profile-preview-text');
    if (previewEl) {
      const prev = this.profilePreviews[profileKey] || this.profilePreviews.standard;
      previewEl.textContent = prev[isTa ? 'ta' : 'en'];
    }
  }

  confirmChangeProfile() {
    const chosenProfile = this.tempModalProfile || 'standard';
    if (window.UserManager && typeof window.UserManager.setAccessibilityProfile === 'function') {
      window.UserManager.setAccessibilityProfile(chosenProfile);
    } else {
      this.applyProfile(chosenProfile);
    }

    this.closeChangeProfileModal();

    // Spoken confirmation
    const isTa = window.I18n && window.I18n.currentLang === 'ta';
    const name = (this.profileNames[chosenProfile] || this.profileNames.standard)[isTa ? 'ta' : 'en'];
    if (window.TTSVoice && window.TTSVoice.isVoiceEnabled) {
      window.TTSVoice.speak({
        ta: `அணுகல்தன்மை அமைப்பு மாற்றப்பட்டது: ${name}.`,
        en: `Accessibility profile changed to ${name}.`
      }, 'assertive');
    }
  }

  // =========================================================================
  // DWELL-CLICK (MOTOR ACCESSIBILITY)
  // =========================================================================

  initDwellCursor() {
    let indicator = document.getElementById('dwell-cursor-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'dwell-cursor-indicator';
      indicator.innerHTML = `
        <svg viewBox="0 0 50 50">
          <circle class="dwell-bg" cx="25" cy="25" r="20"></circle>
          <circle class="dwell-bar" id="dwell-progress-ring" cx="25" cy="25" r="20"></circle>
        </svg>
      `;
      document.body.appendChild(indicator);
    }

    this.dwellIndicator = indicator;
    this.dwellCircle = document.getElementById('dwell-progress-ring');

    document.addEventListener('mousemove', (e) => {
      if (!this.dwellEnabled) return;
      indicator.style.left = `${e.clientX}px`;
      indicator.style.top = `${e.clientY}px`;
    });

    document.addEventListener('mouseover', (e) => {
      if (!this.dwellEnabled) return;
      const target = e.target.closest('button, a, input, [role="button"], .assistance-option-card, .a11y-toggle-item');
      if (target && target !== this.dwellTarget) {
        this.startDwell(target);
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (!this.dwellEnabled) return;
      const target = e.target.closest('button, a, input, [role="button"], .assistance-option-card, .a11y-toggle-item');
      if (target && target === this.dwellTarget) {
        this.cancelDwell();
      }
    });
  }

  enableDwellClick(enable) {
    this.dwellEnabled = enable;
    if (this.dwellIndicator) {
      this.dwellIndicator.style.display = enable ? 'block' : 'none';
    }
    if (!enable) {
      this.cancelDwell();
    }
  }

  startDwell(target) {
    this.cancelDwell();
    this.dwellTarget = target;
    target.classList.add('switch-highlight');

    const circumference = 2 * Math.PI * 20; // ~125.66
    if (this.dwellCircle) this.dwellCircle.style.strokeDashoffset = `${circumference}`;

    let startTime = Date.now();

    this.dwellInterval = setInterval(() => {
      let elapsed = Date.now() - startTime;
      let progress = Math.min(elapsed / this.dwellDuration, 1);
      let offset = circumference - (progress * circumference);
      if (this.dwellCircle) this.dwellCircle.style.strokeDashoffset = `${offset}`;

      if (progress >= 1) {
        this.executeDwellClick(target);
      }
    }, 25);
  }

  cancelDwell() {
    if (this.dwellInterval) {
      clearInterval(this.dwellInterval);
      this.dwellInterval = null;
    }
    if (this.dwellTarget) {
      this.dwellTarget.classList.remove('switch-highlight');
      this.dwellTarget = null;
    }
    if (this.dwellCircle) {
      this.dwellCircle.style.strokeDashoffset = '126';
    }
  }

  executeDwellClick(target) {
    this.cancelDwell();
    if (window.AcousticHaptic) window.AcousticHaptic.playClick();
    target.click();
    target.focus();
  }

  // =========================================================================
  // KEYBOARD ACCESSIBILITY SHORTCUTS
  // =========================================================================

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            this.switchPersona('vision');
            break;
          case '2':
            e.preventDefault();
            this.switchPersona('hearing');
            break;
          case '3':
            e.preventDefault();
            this.switchPersona('motor');
            break;
          case '4':
            e.preventDefault();
            this.switchPersona('cognitive');
            break;
          case '5':
            e.preventDefault();
            this.switchPersona('senior');
            break;
          case '0':
            e.preventDefault();
            this.switchPersona('standard');
            break;
          case 'v':
          case 'V':
            e.preventDefault();
            if (window.STTListener) window.STTListener.toggleListening();
            break;
          case 'r':
          case 'R':
            e.preventDefault();
            if (window.ScreenInspector) window.ScreenInspector.inspectCurrentScreen();
            break;
        }
      }
    });
  }
}

window.AccessibilityEngine = new AccessibilityEngine();
