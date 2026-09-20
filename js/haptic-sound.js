/**
 * OneAbility AI - Acoustic Feedback & Haptic Pulse System
 * Feature 3: Distinct Haptic Feedback & Zero-Latency Audio Cues
 * Implements customized vibration patterns for buttons, warnings, confirmations,
 * QR detections, and transaction success/errors.
 */

class AcousticHapticEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.hapticsEnabled = true;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // 1. Subtle Button Action / Key Click
  playClick() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.05);
      }
    }
    this.vibrateTap();
  }

  // 2. Navigation / Element Focus Tone
  playFocus() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, this.audioCtx.currentTime); // C5
        gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.08);
      }
    }
    this.vibrateLight();
  }

  // 3. QR Code Detected Chime (Harmonic Triad)
  playDetected() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const notes = [587.33, 739.99, 880.00]; // D5, F#5, A5
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.05);
          gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.05 + 0.22);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(this.audioCtx.currentTime + idx * 0.05);
          osc.stop(this.audioCtx.currentTime + idx * 0.05 + 0.22);
        });
      }
    }
    this.vibrateQRDetected();
    this.triggerVisualFlash('#00e5ff');
  }

  // 4. Voice Confirmation Prompt Chime (Attentive double tone)
  playConfirmPrompt() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const notes = [440, 659.25]; // A4, E5
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.09);
          gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.09 + 0.2);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(this.audioCtx.currentTime + idx * 0.09);
          osc.stop(this.audioCtx.currentTime + idx * 0.09 + 0.2);
        });
      }
    }
    this.vibrateConfirmPrompt();
  }

  // 5. Transaction Success Fanfare (Harmonic Arpeggio)
  playSuccess() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        chord.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.16, this.audioCtx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.08 + 0.5);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(this.audioCtx.currentTime + idx * 0.08);
          osc.stop(this.audioCtx.currentTime + idx * 0.08 + 0.5);
        });
      }
    }
    this.vibrateSuccess();
    this.triggerVisualFlash('#10b981');
  }

  // 6. Warning / Fraud Alert (Sawtooth alert)
  playWarning() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, this.audioCtx.currentTime);
        osc.frequency.setValueAtTime(290, this.audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.14, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.35);
      }
    }
    this.vibrateWarning();
    this.triggerVisualFlash('#f59e0b');
  }

  // 7. Error / Cancel Sound (Low Descending Buzz)
  playError() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, this.audioCtx.currentTime);
        osc.frequency.setValueAtTime(140, this.audioCtx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.38);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.38);
      }
    }
    this.vibrateError();
    this.triggerVisualFlash('#f43f5e');
  }

  // 8. Biometric Fingerprint Scan & Success Sounds
  playBiometricScan() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(950, this.audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
      }
    }
    this.vibrate([25, 25, 25]);
  }

  playBiometricSuccess() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const notes = [659.25, 880.00, 1046.50]; // E5, A5, C6
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.06);
          gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.06 + 0.28);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(this.audioCtx.currentTime + idx * 0.06);
          osc.stop(this.audioCtx.currentTime + idx * 0.06 + 0.28);
        });
      }
    }
    this.vibrate([40, 40, 80]);
    this.triggerVisualFlash('#10b981');
  }

  // 9. Emergency Payment Stop Alarm & Heavy Haptic Alert
  playEmergencyStop() {
    if (!this.isMuted) {
      this.initAudio();
      if (this.audioCtx) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, this.audioCtx.currentTime);
        osc.frequency.setValueAtTime(200, this.audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.45);
      }
    }
    this.vibrate([200, 100, 200, 100, 300]);
    this.triggerVisualFlash('#f43f5e');
  }

  // =========================================================================
  // DISTINCT HAPTIC VIBRATION PROFILES (Feature 3)
  // =========================================================================

  // Subtle tap for normal button clicks (20ms)
  vibrateTap() {
    this.vibrate(20);
  }

  // Light pulse for focus changes (15ms)
  vibrateLight() {
    this.vibrate(15);
  }

  // Double pulse for QR code detection [60ms on, 40ms off, 60ms on]
  vibrateQRDetected() {
    this.vibrate([60, 40, 60]);
  }

  // Triple attention pulse for payment confirmation gate [40ms, 30ms, 40ms, 30ms, 70ms]
  vibrateConfirmPrompt() {
    this.vibrate([40, 30, 40, 30, 70]);
  }

  // Celebration rhythm for payment success [50ms, 40ms, 100ms, 40ms, 220ms]
  vibrateSuccess() {
    this.vibrate([50, 40, 100, 40, 220]);
  }

  // Alert vibration for high-risk warnings [80ms, 50ms, 80ms]
  vibrateWarning() {
    this.vibrate([80, 50, 80]);
  }

  // Heavy double buzz for cancellation or error [120ms, 80ms, 150ms]
  vibrateError() {
    this.vibrate([120, 80, 150]);
  }

  // Native Vibration API Invocation
  vibrate(pattern) {
    if (!this.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        // Suppress if device permissions restrict background vibration
      }
    }
  }

  // Synchronized Screen Flash for visual feedback
  triggerVisualFlash(color = '#10b981') {
    const flashEl = document.getElementById('screen-flash');
    if (flashEl) {
      flashEl.style.backgroundColor = color;
      flashEl.classList.remove('flash');
      void flashEl.offsetWidth; // Reflow trigger
      flashEl.classList.add('flash');
    }
  }
}

// Global instance
window.AcousticHaptic = new AcousticHapticEngine();
