import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../services/api';
import type { AccessibilityPreferences } from '../types';

interface AccessibilityContextType {
  preferences: AccessibilityPreferences;
  loading: boolean;
  updatePreferences: (partial: Partial<AccessibilityPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  speak: (text: string, force?: boolean) => void;
  stopSpeaking: () => void;
  triggerHaptic: (pattern?: number | number[]) => void;
  announce: (message: string) => void;
  screenReaderAnnouncement: string;
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  high_contrast: false,
  font_size_scale: 'normal',
  simple_mode: false,
  reduced_motion: false,
  voice_guidance: true,
  haptic_feedback: true,
  captions_enabled: true,
  screen_reader_optimized: false,
  color_blind_mode: 'none',
  preferred_language: 'en',
};

const STORAGE_KEY = 'oneability_accessibility';

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {}
    // Detect OS reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
      ...DEFAULT_PREFERENCES,
      reduced_motion: prefersReducedMotion,
    };
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState<string>('');

  // Apply DOM attributes immediately without reload
  const applyDomAttributes = useCallback((prefs: AccessibilityPreferences) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // 1. High contrast
    root.setAttribute('data-contrast', prefs.high_contrast ? 'high' : 'normal');

    // 2. Font size scale ('normal', 'large', 'x-large')
    const scale = prefs.font_size_scale === 'medium' ? 'normal' : prefs.font_size_scale;
    root.setAttribute('data-font-size', scale);

    // 3. Simple mode
    root.setAttribute('data-simple-mode', prefs.simple_mode ? 'true' : 'false');

    // 4. Reduced motion
    root.setAttribute('data-reduced-motion', prefs.reduced_motion ? 'true' : 'false');

    // 5. Captions
    root.setAttribute('data-captions', prefs.captions_enabled ? 'true' : 'false');

    // 6. Color blind filter
    root.setAttribute('data-color-blind', prefs.color_blind_mode || 'none');
  }, []);

  // Sync to DOM on initial render and whenever preferences change
  useEffect(() => {
    applyDomAttributes(preferences);
  }, [preferences, applyDomAttributes]);

  // Load from backend when authenticated token exists
  useEffect(() => {
    const fetchBackendPreferences = async () => {
      if (!api.hasToken()) return;
      setLoading(true);
      try {
        const backendPrefs = await api.getAccessibilityPreferences();
        const merged: AccessibilityPreferences = {
          ...preferences,
          ...backendPrefs,
          font_size_scale: backendPrefs.font_size_scale === 'medium' ? 'normal' : (backendPrefs.font_size_scale as any),
        };
        setPreferences(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        applyDomAttributes(merged);
      } catch (err) {
        console.warn('Could not sync accessibility settings with backend:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBackendPreferences();
  }, [applyDomAttributes]);

  // Update preferences globally and persist
  const updatePreferences = async (partial: Partial<AccessibilityPreferences>) => {
    const updated: AccessibilityPreferences = { ...preferences, ...partial };
    setPreferences(updated);
    applyDomAttributes(updated);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    // Persist to backend if user is authenticated
    if (api.hasToken()) {
      try {
        await api.updateAccessibilityPreferences(partial);
      } catch (err) {
        console.error('Failed to save accessibility preferences to backend:', err);
      }
    }
  };

  // Reset to system defaults
  const resetPreferences = async () => {
    await updatePreferences(DEFAULT_PREFERENCES);
  };

  // Text-to-speech speaker (honoring voice_guidance setting)
  const speak = useCallback((text: string, force = false) => {
    if (!text) return;
    if (!force && !preferences.voice_guidance) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = preferences.reduced_motion ? 0.9 : 1.0;
      utterance.pitch = 1.0;

      if (preferences.preferred_language === 'ta') {
        utterance.lang = 'ta-IN';
      } else {
        utterance.lang = 'en-IN';
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  }, [preferences.voice_guidance, preferences.reduced_motion, preferences.preferred_language]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, []);

  // Haptic feedback trigger (honoring haptic_feedback setting)
  const triggerHaptic = useCallback((pattern: number | number[] = 50) => {
    if (!preferences.haptic_feedback) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }, [preferences.haptic_feedback]);

  // Screen reader live region announcer
  const announce = useCallback((message: string) => {
    setScreenReaderAnnouncement('');
    setTimeout(() => {
      setScreenReaderAnnouncement(message);
    }, 50);
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        preferences,
        loading,
        updatePreferences,
        resetPreferences,
        speak,
        stopSpeaking,
        triggerHaptic,
        announce,
        screenReaderAnnouncement,
      }}
    >
      {/* Hidden live region for screen-reader announcements */}
      <div
        id="sr-announcer"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {screenReaderAnnouncement}
      </div>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
