/**
 * OneAbility AI - Splash & Authentication Controller
 * 
 * Manages:
 * 1. Branded Loading / Splash Screen Sequence with official logo
 * 2. Login / Sign-In Screen Presentation & Accessible Form Handling
 * 3. Synchronization with UserProfileManager & localStorage
 * 4. Biometric Authentication Simulation
 * 5. Transition to 4-Step Accessibility Onboarding ("Create Account")
 * 6. Quick Accessibility Options Modal trigger
 * 7. Light / Dark Theme switching on Login screen
 * 8. Log Out / Switch Account flow
 */

class AuthController {
  constructor() {
    this.splashDuration = 1800; // 1.8 seconds branded splash
    this.isLoggedIn = false;
    this.REMEMBER_KEY = 'oneability_remember_me';
    this.splashTimer = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.setupSplash();
    this.setupLoginForm();
    this.setupBiometricLogin();
    this.prefillLoginForm();
  }

  setupSplash() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    // Announce to screen reader
    const statusText = document.getElementById('splash-loading-status');
    const announcer = document.getElementById('app-announcer');
    if (announcer) {
      announcer.textContent = 'OneAbility AI is loading. Accessible Smart Payments for Everyone.';
    }

    const dismissSplash = () => {
      if (splash.classList.contains('fade-out')) return;
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
        this.showLoginScreen();
      }, 450);
    };

    // Auto-advance after splashDuration
    this.splashTimer = setTimeout(dismissSplash, this.splashDuration);

    // Skip button for accessibility / power users
    const skipBtn = document.getElementById('btn-splash-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearTimeout(this.splashTimer);
        dismissSplash();
      });
    }

    // Allow clicking anywhere on splash or pressing Enter / Space to advance
    splash.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        clearTimeout(this.splashTimer);
        dismissSplash();
      }
    });
  }

  showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      loginScreen.style.display = 'flex';
      loginScreen.classList.remove('fade-out');
      
      this.prefillLoginForm();

      const nameInput = document.getElementById('login-name');
      if (nameInput && typeof nameInput.focus === 'function') {
        setTimeout(() => nameInput.focus(), 150);
      }
    }
  }

  hideLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      loginScreen.classList.add('fade-out');
      setTimeout(() => {
        loginScreen.style.display = 'none';
      }, 350);
    }
  }

  prefillLoginForm() {
    const nameInput = document.getElementById('login-name');
    const contactInput = document.getElementById('login-contact');
    const rememberCheckbox = document.getElementById('login-remember-me');

    if (window.UserManager) {
      const savedName = window.UserManager.getUserName();
      const savedMobile = window.UserManager.getUserMobile();
      if (nameInput && (!nameInput.value || nameInput.value === 'Sandhiya')) {
        nameInput.value = savedName || 'Sandhiya';
      }
      if (contactInput && (!contactInput.value || contactInput.value === '9876543210')) {
        contactInput.value = savedMobile || '9876543210';
      }
    }

    if (rememberCheckbox) {
      try {
        const rememberPref = localStorage.getItem(this.REMEMBER_KEY);
        rememberCheckbox.checked = rememberPref !== 'false';
      } catch (e) {}
    }
  }

  setupLoginForm() {
    const form = document.getElementById('login-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLoginSubmit();
      });
    }

    // PIN visibility toggle
    const togglePinBtn = document.getElementById('btn-toggle-login-pin');
    const pinInput = document.getElementById('login-pin');
    if (togglePinBtn && pinInput) {
      togglePinBtn.addEventListener('click', () => {
        const isPassword = pinInput.type === 'password';
        pinInput.type = isPassword ? 'text' : 'password';
        togglePinBtn.textContent = isPassword ? '🙈' : '👁️';
        togglePinBtn.setAttribute('aria-label', isPassword ? 'Hide PIN' : 'Show PIN');
      });
    }

    // "Create Account" button -> smoothly transfers to accessible 4-step onboarding
    const createAccBtn = document.getElementById('btn-login-create-account');
    if (createAccBtn) {
      createAccBtn.addEventListener('click', () => {
        this.hideLoginScreen();
        if (window.UserManager && typeof window.UserManager.showRegistrationModal === 'function') {
          window.UserManager.showRegistrationModal(1);
        }
      });
    }

    // "Forgot Password?" button
    const forgotBtn = document.getElementById('btn-login-forgot-pwd');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => {
        this.handleForgotPassword();
      });
    }

    // "Accessibility Options" quick button on login screen
    const a11yBtn = document.getElementById('btn-login-a11y-options');
    if (a11yBtn) {
      a11yBtn.addEventListener('click', () => {
        if (window.AccessibilityEngine && typeof window.AccessibilityEngine.openChangeProfileModal === 'function') {
          window.AccessibilityEngine.openChangeProfileModal();
        }
      });
    }

    // Theme Toggle on login card
    const themeBtn = document.getElementById('btn-login-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        if (window.ThemeManager && typeof window.ThemeManager.applyTheme === 'function') {
          window.ThemeManager.applyTheme(next, true, true);
        } else {
          html.setAttribute('data-theme', next);
          try { localStorage.setItem('oneability_theme', next); } catch (e) {}
        }
      });
    }
  }

  handleLoginSubmit() {
    const nameInput = document.getElementById('login-name');
    const contactInput = document.getElementById('login-contact');
    const rememberCheckbox = document.getElementById('login-remember-me');

    const name = (nameInput && nameInput.value.trim()) || 'Sandhiya';
    const contact = (contactInput && contactInput.value.trim()) || '9876543210';
    const isEmail = contact.includes('@');
    const mobile = isEmail ? '9876543210' : contact;
    const email = isEmail ? contact : `${name.toLowerCase()}@okhdfcbank`;

    if (rememberCheckbox) {
      try {
        localStorage.setItem(this.REMEMBER_KEY, rememberCheckbox.checked ? 'true' : 'false');
      } catch (e) {}
    }

    // Persist and synchronize with UserProfileManager
    if (window.UserManager) {
      window.UserManager.saveProfile(name, mobile, email);
    }

    this.isLoggedIn = true;
    this.hideLoginScreen();

    // Announce login to screen reader & audio
    const announcer = document.getElementById('app-announcer');
    if (announcer) {
      announcer.textContent = `Welcome back, ${name}. Successfully logged into OneAbility AI.`;
    }

    if (window.TTSVoice && typeof window.TTSVoice.speakWelcome === 'function') {
      const callName = (window.UserManager && typeof window.UserManager.getAssistantCallName === 'function')
        ? window.UserManager.getAssistantCallName()
        : name;
      window.TTSVoice.speakWelcome(callName);
    }
  }

  setupBiometricLogin() {
    const biometricBtn = document.getElementById('btn-login-biometric');
    if (!biometricBtn) return;

    biometricBtn.addEventListener('click', () => {
      this.handleBiometricLogin();
    });
  }

  handleBiometricLogin() {
    const nameInput = document.getElementById('login-name');
    const name = (nameInput && nameInput.value.trim()) || (window.UserManager ? window.UserManager.getUserName() : 'Sandhiya');

    const announcer = document.getElementById('app-announcer');
    if (announcer) {
      announcer.textContent = 'Verifying biometrics. Place your finger on the sensor or face the camera.';
    }

    const btn = document.getElementById('btn-login-biometric');
    if (btn) {
      btn.innerHTML = '<span>🔄 Verifying Biometric...</span>';
      btn.disabled = true;
    }

    setTimeout(() => {
      if (btn) {
        btn.innerHTML = '<span>✅ Biometric Verified!</span>';
      }
      setTimeout(() => {
        if (btn) {
          btn.innerHTML = '<span>🔒 Continue with Biometric</span>';
          btn.disabled = false;
        }
        this.handleLoginSubmit();
      }, 500);
    }, 850);
  }

  handleForgotPassword() {
    const contactInput = document.getElementById('login-contact');
    const contact = (contactInput && contactInput.value.trim()) || 'your registered mobile or email';
    const msg = `Security Passcode: A 6-digit verification code has been sent to ${contact}. Voice-guided reset is available.`;
    
    const announcer = document.getElementById('app-announcer');
    if (announcer) {
      announcer.textContent = msg;
    }

    if (window.TTSVoice && typeof window.TTSVoice.speak === 'function') {
      window.TTSVoice.speak(msg);
    } else {
      alert(msg);
    }
  }

  logout() {
    this.isLoggedIn = false;
    this.showLoginScreen();

    const announcer = document.getElementById('app-announcer');
    if (announcer) {
      announcer.textContent = 'You have been signed out of OneAbility AI.';
    }

    if (window.TTSVoice && typeof window.TTSVoice.speak === 'function') {
      window.TTSVoice.speak('Signed out successfully. Please sign in to continue.');
    }
  }
}

// Instantiate singleton
window.AuthController = new AuthController();

// Automatically initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.AuthController.init();
});
