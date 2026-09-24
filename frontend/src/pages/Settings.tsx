import React, { useState } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
    speak,
    triggerHaptic,
    loading,
  } = useAccessibility();

  const { isAuthenticated, demoLogin } = useAuth();
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleToggle = async (key: keyof typeof preferences, val: any, label: string) => {
    triggerHaptic(40);
    await updatePreferences({ [key]: val });
    showToast(`${label} ${val ? 'enabled' : 'disabled'}`);
    if (key === 'voice_guidance' && val) {
      speak('Voice guidance is now enabled.');
    } else if (key === 'high_contrast') {
      speak(`High contrast mode ${val ? 'activated' : 'deactivated'}.`);
    } else if (key === 'simple_mode') {
      speak(`Simple mode ${val ? 'activated' : 'deactivated'}.`);
    }
  };

  const handleFontSize = async (scale: 'normal' | 'large' | 'x-large') => {
    triggerHaptic(40);
    await updatePreferences({ font_size_scale: scale });
    showToast(`Font size set to ${scale}`);
    speak(`Font size updated to ${scale}.`);
  };

  const handleTestVoice = () => {
    triggerHaptic(40);
    speak('OneAbility AI speech synthesis is working properly. Accessible payments for everyone.', true);
    showToast('Testing speech output...');
  };

  const handleTestHaptic = () => {
    triggerHaptic([100, 50, 100, 50, 150]);
    showToast('Triggered haptic vibration pattern.');
  };

  const handleReset = async () => {
    triggerHaptic([60, 40, 60]);
    await resetPreferences();
    showToast('Reset all accessibility preferences to defaults.');
    speak('Accessibility preferences have been reset to default.');
  };

  return (
    <div className="dashboard-space" role="region" aria-label="Accessibility & Preferences Control Center">
      {/* 1. Header */}
      <section className="dashboard-greeting" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>⚙️ Accessibility Center</h2>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Adaptive Engine
            </span>
            {loading && (
              <span className="text-secondary text-xs" style={{ marginLeft: '8px' }} aria-live="polite">
                🔄 Syncing...
              </span>
            )}
          </div>
          <p className="text-secondary text-sm" style={{ marginTop: '4px' }}>
            One unified interface that adapts seamlessly to your individual visual, auditory, cognitive, and motor preferences.
          </p>
        </div>
      </section>

      {/* Floating Save Notification Toast */}
      {saveToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-text-primary, #111827)',
            color: 'var(--color-bg, #ffffff)',
            padding: '10px 20px',
            borderRadius: '24px',
            fontSize: '0.9rem',
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          ✓ {saveToast}
        </div>
      )}

      {/* Unauthenticated notice */}
      {!isAuthenticated && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', textAlign: 'center' }}>
          <p className="text-secondary text-sm" style={{ margin: '0 0 10px 0' }}>
            Settings applied here work instantly in this browser. Sign in to sync your preferences across all your devices.
          </p>
          <button onClick={() => demoLogin()} className="btn btn-secondary" style={{ minHeight: '44px' }}>
            🔑 Sign In to Cloud-Sync Preferences
          </button>
        </div>
      )}

      {/* 2. Visual & Display Settings */}
      <section className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.15rem' }}>👁️ Visual & Display</h3>
          <span className="text-xs text-secondary">Contrast, Text & Layout</span>
        </div>

        {/* High Contrast Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>High Contrast Mode</span>
            <span className="text-secondary text-xs">
              Stark contrast black/white/yellow theme meeting WCAG AAA standard (&gt; 7:1 ratio).
            </span>
          </div>
          <button
            onClick={() => handleToggle('high_contrast', !preferences.high_contrast, 'High contrast')}
            className={`btn ${preferences.high_contrast ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px', minWidth: '90px', fontWeight: 700 }}
            aria-pressed={preferences.high_contrast}
          >
            {preferences.high_contrast ? 'ON ✓' : 'OFF'}
          </button>
        </div>

        {/* Text Size Scale Selector */}
        <div
          style={{
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>Adjustable Font Size</span>
            <span className="text-secondary text-xs">
              Scales typography across all screens for enhanced readability.
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button
              onClick={() => handleFontSize('normal')}
              className={`btn ${preferences.font_size_scale === 'normal' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '48px', fontSize: '0.9rem' }}
              aria-pressed={preferences.font_size_scale === 'normal'}
            >
              Normal (100%)
            </button>
            <button
              onClick={() => handleFontSize('large')}
              className={`btn ${preferences.font_size_scale === 'large' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '48px', fontSize: '1.05rem', fontWeight: 700 }}
              aria-pressed={preferences.font_size_scale === 'large'}
            >
              Large (115%)
            </button>
            <button
              onClick={() => handleFontSize('x-large')}
              className={`btn ${preferences.font_size_scale === 'x-large' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '48px', fontSize: '1.15rem', fontWeight: 800 }}
              aria-pressed={preferences.font_size_scale === 'x-large'}
            >
              Extra (130%)
            </button>
          </div>
        </div>

        {/* Simple Mode Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
          }}
        >
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>Simple Mode (Cognitive Ease)</span>
            <span className="text-secondary text-xs">
              Declutters decorative elements, enlarges touch targets (&ge; 56px), and highlights core payment actions.
            </span>
          </div>
          <button
            onClick={() => handleToggle('simple_mode', !preferences.simple_mode, 'Simple mode')}
            className={`btn ${preferences.simple_mode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px', minWidth: '90px', fontWeight: 700 }}
            aria-pressed={preferences.simple_mode}
          >
            {preferences.simple_mode ? 'ON ✓' : 'OFF'}
          </button>
        </div>
      </section>

      {/* 3. Audio & Voice Navigation */}
      <section className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.15rem' }}>🔊 Voice & Auditory</h3>
          <span className="text-xs text-secondary">SpeechSynthesis & Guidance</span>
        </div>

        {/* Voice Guidance Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>Voice Guidance (Text-to-Speech)</span>
            <span className="text-secondary text-xs">
              Reads aloud transaction status, assistant prompts, and critical safety shields.
            </span>
          </div>
          <button
            onClick={() => handleToggle('voice_guidance', !preferences.voice_guidance, 'Voice guidance')}
            className={`btn ${preferences.voice_guidance ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px', minWidth: '90px', fontWeight: 700 }}
            aria-pressed={preferences.voice_guidance}
          >
            {preferences.voice_guidance ? 'ON ✓' : 'OFF'}
          </button>
        </div>

        {/* Test Speech Button */}
        <div style={{ paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-secondary text-xs font-semibold">Test Speech Output</span>
          <button
            onClick={handleTestVoice}
            className="btn btn-secondary"
            style={{ minHeight: '44px', padding: '0 14px' }}
          >
            🔊 Play Test Announcement
          </button>
        </div>
      </section>

      {/* 4. Motion & Tactile Feedback */}
      <section className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.15rem' }}>📳 Motion & Haptic</h3>
          <span className="text-xs text-secondary">Sensory Controls</span>
        </div>

        {/* Reduced Motion Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>Reduced Motion</span>
            <span className="text-secondary text-xs">
              Disables animations, spinners, and motion transitions to prevent vestibular discomfort.
            </span>
          </div>
          <button
            onClick={() => handleToggle('reduced_motion', !preferences.reduced_motion, 'Reduced motion')}
            className={`btn ${preferences.reduced_motion ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px', minWidth: '90px', fontWeight: 700 }}
            aria-pressed={preferences.reduced_motion}
          >
            {preferences.reduced_motion ? 'ON ✓' : 'OFF'}
          </button>
        </div>

        {/* Haptic Feedback Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>Haptic Feedback (Vibration)</span>
            <span className="text-secondary text-xs">
              Vibrates device on key button taps, explicit confirmation, and safety warnings.
            </span>
          </div>
          <button
            onClick={() => handleToggle('haptic_feedback', !preferences.haptic_feedback, 'Haptic feedback')}
            className={`btn ${preferences.haptic_feedback ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px', minWidth: '90px', fontWeight: 700 }}
            aria-pressed={preferences.haptic_feedback}
          >
            {preferences.haptic_feedback ? 'ON ✓' : 'OFF'}
          </button>
        </div>

        {/* Test Haptic Button */}
        <div style={{ paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-secondary text-xs font-semibold">Test Haptic Vibration</span>
          <button
            onClick={handleTestHaptic}
            className="btn btn-secondary"
            style={{ minHeight: '44px', padding: '0 14px' }}
          >
            📳 Trigger Haptic Pulse
          </button>
        </div>
      </section>

      {/* 5. Captions & Screen Reader Assistance */}
      <section className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.15rem' }}>💬 Captions & Screen Readers</h3>
          <span className="text-xs text-secondary">Multimodal Alternatives</span>
        </div>

        {/* Captions Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>Captions & Text Alternatives</span>
            <span className="text-secondary text-xs">
              Always display clear on-screen textual subtitles alongside speech and audio cues.
            </span>
          </div>
          <button
            onClick={() => handleToggle('captions_enabled', !preferences.captions_enabled, 'Captions')}
            className={`btn ${preferences.captions_enabled ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px', minWidth: '90px', fontWeight: 700 }}
            aria-pressed={preferences.captions_enabled}
          >
            {preferences.captions_enabled ? 'ON ✓' : 'OFF'}
          </button>
        </div>

        {/* Screen Reader Optimization */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
          }}
        >
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>Screen Reader Enhanced Verbosity</span>
            <span className="text-secondary text-xs">
              Generates expanded ARIA descriptions, currency codes, and status announcements.
            </span>
          </div>
          <button
            onClick={() => handleToggle('screen_reader_optimized', !preferences.screen_reader_optimized, 'Screen reader mode')}
            className={`btn ${preferences.screen_reader_optimized ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px', minWidth: '90px', fontWeight: 700 }}
            aria-pressed={preferences.screen_reader_optimized}
          >
            {preferences.screen_reader_optimized ? 'ON ✓' : 'OFF'}
          </button>
        </div>
      </section>

      {/* 6. Language Preference */}
      <section className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.15rem' }}>🌐 Preferred Language</h3>
          <span className="text-xs text-secondary">Voice & Assistive Speech</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <button
            onClick={() => updatePreferences({ preferred_language: 'en' })}
            className={`btn ${preferences.preferred_language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px' }}
            aria-pressed={preferences.preferred_language === 'en'}
          >
            English (India)
          </button>
          <button
            onClick={() => updatePreferences({ preferred_language: 'ta' })}
            className={`btn ${preferences.preferred_language === 'ta' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px' }}
            aria-pressed={preferences.preferred_language === 'ta'}
          >
            தமிழ் (Tamil)
          </button>
          <button
            onClick={() => updatePreferences({ preferred_language: 'mixed' })}
            className={`btn ${preferences.preferred_language === 'mixed' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '48px' }}
            aria-pressed={preferences.preferred_language === 'mixed'}
          >
            Tanglish (Mixed)
          </button>
        </div>
      </section>

      {/* 7. Reset to System Defaults */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button
          onClick={handleReset}
          className="btn btn-secondary"
          style={{ minHeight: '48px', width: '100%', border: '1px dashed var(--color-danger, #ef4444)', color: 'var(--color-danger, #ef4444)' }}
        >
          🔄 Reset All Accessibility Settings to Default
        </button>
      </div>
    </div>
  );
};

export default Settings;
