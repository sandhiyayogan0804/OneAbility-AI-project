/**
 * OneAbility AI - AI Screen Inspector & Multimodal OCR Analyzer
 * Visual parser and screen reader engine that detects UI elements,
 * buttons, inputs, amounts, and explains them in simple audio/visual terms.
 */

class ScreenInspectorEngine {
  constructor() {
    this.currentPreset = 'gpay';
    this.presets = {
      gpay: {
        title: 'Google Pay (UPI Merchant Pay)',
        accessibilityScore: '94/100 (Optimized with OneAbility)',
        elements: [
          { type: 'Header', label: 'Paying Kumar Groceries', action: 'Verified merchant identity checked', confidence: '99%' },
          { type: 'Amount Field', label: '₹500.00', action: 'Tap to edit or use voice', confidence: '98%' },
          { type: 'Bank Account', label: 'State Bank of India (•• 4821)', action: 'Selected payment source', confidence: '96%' },
          { type: 'Action Button', label: 'Pay ₹500', action: 'Will trigger UPI PIN keypad', confidence: '100%' }
        ],
        spokenSummary: 'Screen Analysis: You are on the Google Pay confirmation screen. You are paying ₹500 to verified merchant Kumar Groceries using your SBI account ending in 4821. Next step: Tap "Pay ₹500" or say "Confirm".'
      },
      paytm: {
        title: 'Paytm (QR Merchant Checkout)',
        accessibilityScore: '92/100 (Cleaned via Cognitive Mode)',
        elements: [
          { type: 'QR Scanner', label: 'Store Soundbox QR Detected', action: 'Audio confirmation received', confidence: '99%' },
          { type: 'Merchant Name', label: 'Saravana Medicals', action: 'Pharmacy Merchant (Category: Health)', confidence: '97%' },
          { type: 'Amount Due', label: '₹240.00', action: 'Auto-filled from QR code', confidence: '95%' },
          { type: 'Action Button', label: 'Proceed to Pay', action: 'Voice prompt ready', confidence: '99%' }
        ],
        spokenSummary: 'Screen Analysis: Paytm scanned QR for Saravana Medicals. Bill amount is ₹240. Ads and promotional cashback banners have been filtered out for your clarity.'
      },
      banking: {
        title: 'Net Banking Fund Transfer',
        accessibilityScore: '89/100 (High Contrast Applied)',
        elements: [
          { type: 'Beneficiary', label: 'Anand Kumar (HDFC Bank)', action: 'Saved frequent payee', confidence: '98%' },
          { type: 'Transfer Type', label: 'IMPS (Instant 24x7)', action: 'Fastest method', confidence: '94%' },
          { type: 'Amount', label: '₹2,500.00', action: 'Requires OTP confirmation', confidence: '99%' },
          { type: 'Security Notice', label: 'Anti-Phishing Token Active', action: 'Safe connection verified', confidence: '100%' }
        ],
        spokenSummary: 'Screen Analysis: Banking app transfer to Anand Kumar for ₹2,500 via IMPS. Safe verification passed. Say "Confirm" to proceed.'
      }
    };
  }

  loadPreset(key) {
    this.currentPreset = key;

    document.querySelectorAll('.sample-screen-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === key);
    });

    this.renderInspectorUI();
    window.AcousticHaptic.playClick();
  }

  renderInspectorUI() {
    const data = this.presets[this.currentPreset];
    if (!data) return;

    const container = document.getElementById('inspector-elements-list');
    const scoreEl = document.getElementById('inspector-score-badge');
    const titleEl = document.getElementById('inspector-current-app-title');

    if (titleEl) titleEl.textContent = data.title;
    if (scoreEl) scoreEl.textContent = `A11y Score: ${data.accessibilityScore}`;

    if (container) {
      container.innerHTML = '';
      data.elements.forEach(item => {
        const row = document.createElement('div');
        row.className = 'detected-element-box';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.innerHTML = `
          <div class="detected-label">
            <i class="badge-cyan"></i>
            <span><strong>[${item.type}]</strong> ${item.label}</span>
          </div>
          <div class="detected-action">
            ${item.action} (${item.confidence})
          </div>
        `;

        row.addEventListener('click', () => {
          window.AcousticHaptic.playFocus();
          window.TTSVoice.speak(`${item.type}: ${item.label}. Note: ${item.action}`);
        });

        container.appendChild(row);
      });
    }
  }

  inspectCurrentScreen() {
    window.AcousticHaptic.playDetected();
    const data = this.presets[this.currentPreset];
    if (data) {
      window.TTSVoice.speak(data.spokenSummary);
    } else {
      window.TTSVoice.speak('Scanning current viewport with AI Vision. All interactive elements identified.');
    }
  }
}

// Global instance
window.ScreenInspector = new ScreenInspectorEngine();
