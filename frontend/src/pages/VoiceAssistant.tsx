import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { api } from '../services/api';
import type {
  VoiceNLPResponse,
  PaymentResultResponse,
  Beneficiary,
  PaymentSafetyCheckResponse,
} from '../types';
import PaymentSafetyCard from '../components/PaymentSafetyCard';

// SpeechRecognition typing for Web Speech API
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

const VoiceAssistant: React.FC = () => {
  const { isAuthenticated, demoLogin } = useAuth();
  const { preferences, updatePreferences, speak, triggerHaptic, announce } = useAccessibility();
  const navigate = useNavigate();

  // Assistant State
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('mixed'); // 'mixed' | 'en' | 'ta'

  // NLP Analysis State
  const [loadingParse, setLoadingParse] = useState<boolean>(false);
  const [nlpResponse, setNlpResponse] = useState<VoiceNLPResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Safety & AI Risk States
  const [safetyData, setSafetyData] = useState<PaymentSafetyCheckResponse | null>(null);
  const [loadingSafety, setLoadingSafety] = useState<boolean>(false);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState<boolean>(false);

  // Missing info inline input states
  const [missingAmountInput, setMissingAmountInput] = useState<string>('');
  const [missingRecipientInput, setMissingRecipientInput] = useState<string>('');
  const [savedBeneficiaries, setSavedBeneficiaries] = useState<Beneficiary[]>([]);

  // Payment Execution & Review State
  const [paymentStep, setPaymentStep] = useState<'IDLE' | 'REVIEW' | 'PROCESSING' | 'RESULT'>('IDLE');
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [paymentResult, setPaymentResult] = useState<PaymentResultResponse | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number>(23030);
  const [primaryBank, setPrimaryBank] = useState<string>('State Bank of India (•••• 4821)');
  // Global accessibility preference for speech guidance
  const speechAudioEnabled = preferences.voice_guidance;

  // Recognition ref
  const recognitionRef = useRef<any>(null);

  // Sample prompt commands for quick testing
  const sampleCommands = [
    { label: 'English: Send 250 rs to Priya', text: 'Send 250 rs to Priya', lang: 'en' },
    { label: 'Tanglish: Kumar-ku 500 rooba anuppu', text: 'Kumar-ku 500 rooba anuppu', lang: 'mixed' },
    { label: 'Tamil Word: Priya-ku ainooru rooba send pannu', text: 'Priya-ku ainooru rooba send pannu', lang: 'mixed' },
    { label: 'Tamil Word: Ramesh-kku nooru rooba kudu', text: 'Ramesh-kku nooru rooba kudu', lang: 'mixed' },
    { label: 'Check Balance: En balance evvalavu iruku', text: 'En balance evvalavu iruku', lang: 'mixed' },
  ];

  // Initialize Speech Recognition & Load beneficiaries
  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setSpeechSupported(false);
    }

    if (isAuthenticated) {
      loadUserData();
    }
  }, [isAuthenticated]);

  const loadUserData = async () => {
    try {
      const [bList, dash] = await Promise.all([
        api.getBeneficiaries().catch(() => []),
        api.getDashboardHome().catch(() => null),
      ]);
      setSavedBeneficiaries(bList);
      if (dash) {
        setAvailableBalance(dash.balance.total_balance);
        if (dash.primary_account) {
          setPrimaryBank(`${dash.primary_account.bank_name} (${dash.primary_account.account_number_masked})`);
        }
      }
    } catch (e) {
      console.error('Failed to load user data for voice:', e);
    }
  };

  // Text-to-speech speaker using adaptive AccessibilityContext
  const speakFeedback = (text: string) => {
    if (!speechAudioEnabled) return;
    speak(text);
  };

  // Start Voice Recognition
  const startListening = () => {
    triggerHaptic(40);
    announce('Voice assistant is listening for your command');
    setMicPermissionError(null);
    setParseError(null);
    setNlpResponse(null);
    setPaymentStep('IDLE');

    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setSpeechSupported(false);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = true;

      // Set language code
      if (selectedLanguage === 'ta') {
        recognition.lang = 'ta-IN';
      } else if (selectedLanguage === 'en') {
        recognition.lang = 'en-IN';
      } else {
        // Mixed / Tanglish - use Indian English with phonetic recognition
        recognition.lang = 'en-IN';
      }

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicPermissionError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          setMicPermissionError('No speech was detected. Please tap the microphone and speak clearly.');
        } else {
          setMicPermissionError(`Voice error: ${event.error}. You can also type your command below.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (transcript.trim()) {
          processTranscript(transcript.trim());
        }
      };

      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setMicPermissionError(err.message || 'Unable to access microphone.');
    }
  };

  // Stop Voice Recognition
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    if (transcript.trim()) {
      processTranscript(transcript.trim());
    }
  };

  const runSafetyCheck = async (amt: number, recip: any) => {
    if (!recip || !amt) return;
    setLoadingSafety(true);
    setHasAcknowledgedRisk(false);
    try {
      const ident = recip.identifier || recip.name;
      const safety = await api.checkPaymentSafety({
        recipient_type: ident?.includes('@') ? 'UPI_ID' : 'CONTACT',
        recipient_identifier: ident,
        recipient_name: recip.name || ident,
        amount: amt,
        source: 'VOICE',
      });
      setSafetyData(safety);
      if (safety.risk_level === 'CRITICAL' || safety.risk_level === 'HIGH') {
        speakFeedback(`Safety Shield Warning: ${safety.warning_title || 'Please review caution notice before confirming'}.`);
      }
    } catch (err) {
      console.error('Safety check failed:', err);
    } finally {
      setLoadingSafety(false);
    }
  };

  // Send Transcript to Backend NLP Parser
  const processTranscript = async (textToParse: string) => {
    if (!textToParse.trim()) return;
    setLoadingParse(true);
    setParseError(null);

    try {
      const resp = await api.parseVoiceCommand(textToParse, selectedLanguage);
      setNlpResponse(resp);

      // Audio readout of assistant's response
      if (resp.spoken_response) {
        speakFeedback(resp.spoken_response);
      }

      // If command is complete and intent is SEND_MONEY, transition to REVIEW
      if (resp.intent === 'SEND_MONEY' && resp.is_complete && resp.amount && resp.recipient) {
        setPaymentStep('REVIEW');
        runSafetyCheck(resp.amount, resp.recipient);
      } else {
        setPaymentStep('IDLE');
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to understand voice command.');
    } finally {
      setLoadingParse(false);
    }
  };

  // Handle Missing Amount Fill
  const handleAddMissingAmount = (amt: number) => {
    if (!nlpResponse) return;
    const updatedAmount = amt;
    const updatedResp: VoiceNLPResponse = {
      ...nlpResponse,
      amount: updatedAmount,
      formatted_amount: `₹${updatedAmount.toFixed(2)}`,
      missing_fields: nlpResponse.missing_fields.filter((f) => f !== 'amount'),
      is_complete: !nlpResponse.missing_fields.includes('recipient'),
      action_suggested: 'PROCEED_TO_REVIEW',
    };
    setNlpResponse(updatedResp);
    if (updatedResp.is_complete && updatedResp.recipient) {
      setPaymentStep('REVIEW');
      speakFeedback(`Ready to send ₹${updatedAmount} to ${updatedResp.recipient?.name || 'recipient'}. Please confirm.`);
      runSafetyCheck(updatedAmount, updatedResp.recipient);
    }
  };

  // Handle Missing Recipient Fill
  const handleSelectMissingBeneficiary = (b: { id?: number; name: string; nickname?: string | null; upi_id?: string | null; phone_number?: string | null }) => {
    if (!nlpResponse) return;
    const updatedRecipient = {
      name: b.name,
      identifier: b.upi_id || b.phone_number || '',
      matched_beneficiary_id: b.id || null,
      is_saved_contact: !!b.id,
    };
    const updatedResp: VoiceNLPResponse = {
      ...nlpResponse,
      recipient: updatedRecipient,
      missing_fields: nlpResponse.missing_fields.filter((f) => f !== 'recipient'),
      is_complete: !nlpResponse.missing_fields.includes('amount') && (nlpResponse.amount || 0) > 0,
      action_suggested: 'PROCEED_TO_REVIEW',
    };
    setNlpResponse(updatedResp);
    if (updatedResp.is_complete && updatedResp.amount) {
      setPaymentStep('REVIEW');
      speakFeedback(`Ready to send ₹${updatedResp.amount} to ${b.name}. Please confirm.`);
      runSafetyCheck(updatedResp.amount, updatedRecipient);
    }
  };

  // Explicit Payment Confirmation (SAFETY: Voice never executes without this click)
  const handleConfirmPayment = async () => {
    if (!nlpResponse || !nlpResponse.recipient || !nlpResponse.amount) return;

    setPaymentStep('PROCESSING');
    setProcessingMessage('Connecting to bank payment gateway...');

    const recipientIdentifier = nlpResponse.recipient.identifier || `${nlpResponse.recipient.name?.toLowerCase().replace(/\s+/g, '')}@upi`;
    const recipientName = nlpResponse.recipient.name || recipientIdentifier;

    setTimeout(() => {
      setProcessingMessage('Verifying account balance & NPCI rails...');
    }, 600);

    setTimeout(async () => {
      try {
        const res = await api.executePayment({
          recipient_type: recipientIdentifier.includes('@') ? 'UPI_ID' : 'CONTACT',
          recipient_identifier: recipientIdentifier,
          recipient_name: recipientName,
          amount: nlpResponse.amount!,
          description: `Voice payment via OneAbility AI: "${nlpResponse.raw_transcript}"`,
          simulate_failure: false,
        });
        setPaymentResult(res);
        setPaymentStep('RESULT');
        speakFeedback(`Payment of ₹${nlpResponse.amount} to ${recipientName} was successful.`);
      } catch (err: any) {
        setPaymentResult({
          status: 'FAILED',
          reference_id: `ERR-${Date.now().toString().slice(-6)}`,
          amount: nlpResponse.amount!,
          formatted_amount: nlpResponse.formatted_amount || `₹${nlpResponse.amount}`,
          currency: 'INR',
          payment_method: 'UPI',
          recipient_name: recipientName,
          recipient_identifier: recipientIdentifier,
          sender_bank: primaryBank,
          sender_account_masked: '•••• 4821',
          created_at: new Date().toISOString(),
          message: err.message || 'Payment execution failed in simulator.',
          remaining_balance: availableBalance,
        });
        setPaymentStep('RESULT');
        speakFeedback('Payment failed. Please check details and try again.');
      }
    }, 1200);
  };

  // Reset Assistant
  const handleReset = () => {
    setTranscript('');
    setNlpResponse(null);
    setParseError(null);
    setPaymentStep('IDLE');
    setPaymentResult(null);
    setMissingAmountInput('');
    setMissingRecipientInput('');
  };

  return (
    <div className="voice-assistant-page" role="region" aria-label="OneAbility Voice Payment Assistant">
      {/* 1. Header */}
      <section className="dashboard-greeting" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>🎙️ Voice Assistant</h2>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Tamil • Tanglish • English
            </span>
          </div>
          <p className="text-secondary text-sm" style={{ marginTop: '4px' }}>
            Speak naturally in Tamil, English, or mixed Tanglish to send money or check balance.
          </p>
        </div>

        {/* Audio feedback mute toggle connected to global preferences */}
        <button
          onClick={async () => {
            triggerHaptic(40);
            await updatePreferences({ voice_guidance: !speechAudioEnabled });
          }}
          className="btn btn-secondary"
          style={{
            minHeight: '44px',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
          }}
          title={speechAudioEnabled ? 'Mute voice readout' : 'Enable voice readout'}
          aria-label={speechAudioEnabled ? 'Voice readout is active' : 'Voice readout is muted'}
        >
          <span>{speechAudioEnabled ? '🔊' : '🔇'}</span>
          <span>{speechAudioEnabled ? 'Audio On' : 'Muted'}</span>
        </button>
      </section>

      {/* 2. Unauthenticated State */}
      {!isAuthenticated && (
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem' }}>
          <p className="text-secondary font-medium" style={{ marginBottom: '1rem' }}>
            Please sign in to make voice payments and verify contacts.
          </p>
          <button onClick={() => demoLogin()} className="btn btn-primary" style={{ minHeight: '48px' }}>
            🔑 Sign In as Alex Johnson (Demo)
          </button>
        </div>
      )}

      {/* 3. Safety Notice Banner */}
      <div
        style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '1.3rem' }}>🛡️</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)' }}>
            Strict Safety Boundary
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            Voice alone will <strong>NEVER</strong> execute a payment. An explicit on-screen review and confirmation button is always required.
          </p>
        </div>
      </div>

      {/* 4. Language Selector & Mic Controls */}
      <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem' }}>
        {/* Language Selection Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedLanguage('mixed')}
            className={`btn ${selectedLanguage === 'mixed' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '40px', fontSize: '0.85rem', padding: '0 14px', borderRadius: '20px' }}
          >
            🇮🇳 Tanglish (Mixed)
          </button>
          <button
            onClick={() => setSelectedLanguage('en')}
            className={`btn ${selectedLanguage === 'en' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '40px', fontSize: '0.85rem', padding: '0 14px', borderRadius: '20px' }}
          >
            🇬🇧 English (India)
          </button>
          <button
            onClick={() => setSelectedLanguage('ta')}
            className={`btn ${selectedLanguage === 'ta' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '40px', fontSize: '0.85rem', padding: '0 14px', borderRadius: '20px' }}
          >
            🇮🇳 தமிழ் (Tamil)
          </button>
        </div>

        {/* Large Central Microphone Button */}
        <div style={{ position: 'relative', display: 'inline-block', margin: '0.5rem 0 1.5rem 0' }}>
          {isListening && (
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                left: '-12px',
                right: '-12px',
                bottom: '-12px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.25)',
                animation: 'pulse 1.5s infinite',
                zIndex: 0,
              }}
            />
          )}

          <button
            onClick={isListening ? stopListening : startListening}
            aria-label={isListening ? 'Stop listening' : 'Start voice payment assistant'}
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              backgroundColor: isListening ? '#ef4444' : 'var(--color-primary, #6366f1)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '2.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isListening
                ? '0 0 25px rgba(239, 68, 68, 0.7)'
                : '0 10px 25px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.25s ease',
              position: 'relative',
              zIndex: 1,
              outline: 'none',
            }}
          >
            {isListening ? '🛑' : '🎙️'}
          </button>
        </div>

        {/* Listening Indicator */}
        <div>
          {isListening ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  animation: 'pulse 1s infinite',
                }}
              />
              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '1rem' }}>
                Listening... Speak now
              </span>
            </div>
          ) : (
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Tap microphone to speak
            </p>
          )}
        </div>

        {/* Microphone Permission / Browser Error */}
        {micPermissionError && (
          <div className="alert alert-error" style={{ marginTop: '1rem', textAlign: 'left' }}>
            <span>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Microphone Notice</p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>{micPermissionError}</p>
            </div>
          </div>
        )}

        {!speechSupported && (
          <div className="alert alert-info" style={{ marginTop: '1rem', textAlign: 'left' }}>
            <span>ℹ️</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Browser Speech Recognition</p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                Web Speech API is not natively supported in this browser. You can use the text box below or test with quick sample commands!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 5. Transcript Display & Accessible Manual Input */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <label
          htmlFor="voice-transcript-input"
          style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}
        >
          Recognized Transcript / Natural Language Input:
        </label>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            id="voice-transcript-input"
            type="text"
            className="input-field"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                processTranscript(transcript);
              }
            }}
            placeholder="e.g. Kumar-ku 500 rooba anuppu or Send 250 to Priya"
            style={{ flex: 1, minHeight: '48px', fontSize: '1rem' }}
          />

          <button
            onClick={() => processTranscript(transcript)}
            disabled={!transcript.trim() || loadingParse}
            className="btn btn-primary"
            style={{ minHeight: '48px', minWidth: '90px' }}
          >
            {loadingParse ? '⏳ Analyzing...' : 'Analyze ➔'}
          </button>

          {transcript && (
            <button
              onClick={handleReset}
              className="btn btn-secondary"
              style={{ minHeight: '48px', padding: '0 12px' }}
              title="Clear transcript"
            >
              ✕
            </button>
          )}
        </div>

        {parseError && (
          <div className="alert alert-error" style={{ marginTop: '1rem', textAlign: 'left' }}>
            <span>⚠️</span>
            <p style={{ margin: 0 }}>{parseError}</p>
          </div>
        )}

        {/* Quick Sample Commands */}
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            💡 Try quick sample commands:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {sampleCommands.map((sc, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setTranscript(sc.text);
                  setSelectedLanguage(sc.lang);
                  processTranscript(sc.text);
                }}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  background: 'var(--color-bg-secondary, #f3f4f6)',
                  border: '1px solid var(--color-border, #e5e7eb)',
                }}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6. NLP Structured Analysis Results */}
      {nlpResponse && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.25rem',
            border: '2px solid var(--color-primary, #6366f1)',
          }}
        >
          {/* Header with Intent & Confidence */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--color-border, #e5e7eb)',
              paddingBottom: '10px',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🧠</span>
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>
                Intent: {nlpResponse.intent.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '10px',
                  backgroundColor:
                    nlpResponse.confidence > 0.8
                      ? 'rgba(16, 185, 129, 0.15)'
                      : nlpResponse.confidence > 0.5
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  color:
                    nlpResponse.confidence > 0.8
                      ? '#10b981'
                      : nlpResponse.confidence > 0.5
                      ? '#d97706'
                      : '#ef4444',
                }}
              >
                {Math.round(nlpResponse.confidence * 100)}% Confidence
              </span>
            </div>
          </div>

          {/* Assistant Spoken Response / Clarification */}
          <div
            style={{
              background: 'var(--color-bg-secondary, #f8fafc)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '14px',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>💬</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-primary)' }}>
                Assistant Response:
              </p>
              <p style={{ margin: '2px 0 0 0' }}>{nlpResponse.spoken_response}</p>
            </div>
            {speechAudioEnabled && (
              <button
                onClick={() => speakFeedback(nlpResponse.spoken_response)}
                className="btn btn-secondary"
                style={{ minHeight: '32px', padding: '0 8px', fontSize: '0.8rem' }}
                title="Replay voice audio"
              >
                🔊 Play
              </button>
            )}
          </div>

          {/* Extracted Slots Breakdown */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '14px',
            }}
          >
            {/* Recipient Slot */}
            <div
              style={{
                border: '1px solid var(--color-border, #e5e7eb)',
                borderRadius: '8px',
                padding: '10px',
                background: nlpResponse.recipient ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Recipient
              </span>
              {nlpResponse.recipient ? (
                <div style={{ marginTop: '4px' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>
                    {nlpResponse.recipient.name || nlpResponse.recipient.identifier}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {nlpResponse.recipient.identifier}
                  </span>
                  {nlpResponse.recipient.is_saved_contact && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginLeft: '6px',
                        fontSize: '0.7rem',
                        background: '#dcfce7',
                        color: '#15803d',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      ✓ Saved Contact
                    </span>
                  )}
                </div>
              ) : (
                <p style={{ margin: '4px 0 0 0', color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>
                  ⚠️ Missing recipient
                </p>
              )}
            </div>

            {/* Amount Slot */}
            <div
              style={{
                border: '1px solid var(--color-border, #e5e7eb)',
                borderRadius: '8px',
                padding: '10px',
                background: nlpResponse.amount ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Amount (INR)
              </span>
              {nlpResponse.amount ? (
                <p style={{ margin: '4px 0 0 0', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-primary)' }}>
                  {nlpResponse.formatted_amount || `₹${nlpResponse.amount}`}
                </p>
              ) : (
                <p style={{ margin: '4px 0 0 0', color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>
                  ⚠️ Missing amount
                </p>
              )}
            </div>
          </div>

          {/* Missing Information Resolution UI */}
          {nlpResponse.missing_fields && nlpResponse.missing_fields.length > 0 && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px dashed #f59e0b',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '14px',
              }}
            >
              <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: '#b45309', fontSize: '0.9rem' }}>
                ❓ Missing Information Needed:
              </p>

              {/* If Amount is missing */}
              {nlpResponse.missing_fields.includes('amount') && (
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Select or enter amount to send:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    {[100, 250, 500, 1000, 2000].map((quickAmt) => (
                      <button
                        key={quickAmt}
                        onClick={() => handleAddMissingAmount(quickAmt)}
                        className="btn btn-secondary"
                        style={{ minHeight: '36px', padding: '0 10px', fontSize: '0.85rem' }}
                      >
                        + ₹{quickAmt}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="Enter amount (₹)"
                      value={missingAmountInput}
                      onChange={(e) => setMissingAmountInput(e.target.value)}
                      style={{ maxWidth: '160px', minHeight: '40px' }}
                    />
                    <button
                      onClick={() => {
                        const val = parseFloat(missingAmountInput);
                        if (!isNaN(val) && val > 0) handleAddMissingAmount(val);
                      }}
                      className="btn btn-primary"
                      style={{ minHeight: '40px' }}
                    >
                      Set Amount
                    </button>
                  </div>
                </div>
              )}

              {/* If Recipient is missing */}
              {nlpResponse.missing_fields.includes('recipient') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Select a contact to pay:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {savedBeneficiaries.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => handleSelectMissingBeneficiary(b)}
                        className="btn btn-secondary"
                        style={{ minHeight: '36px', padding: '0 10px', fontSize: '0.85rem' }}
                      >
                        👤 {b.name}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Or enter recipient name / UPI ID"
                      value={missingRecipientInput}
                      onChange={(e) => setMissingRecipientInput(e.target.value)}
                      style={{ minHeight: '40px', flex: 1 }}
                    />
                    <button
                      onClick={() => {
                        if (missingRecipientInput.trim()) {
                          const name = missingRecipientInput.trim();
                          const ident = name.includes('@') ? name : `${name.toLowerCase().replace(/\s+/g, '')}@upi`;
                          handleSelectMissingBeneficiary({
                            id: 0,
                            name: name,
                            nickname: name,
                            upi_id: ident,
                          });
                        }
                      }}
                      className="btn btn-primary"
                      style={{ minHeight: '40px' }}
                    >
                      Set Recipient
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick shortcuts for CHECK_BALANCE / VIEW_HISTORY */}
          {nlpResponse.intent === 'CHECK_BALANCE' && (
            <div style={{ marginTop: '10px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  marginBottom: '12px',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>Your Account Balance</p>
                <p style={{ margin: '6px 0', fontSize: '2rem', fontWeight: 800 }}>
                  ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85 }}>{primaryBank}</p>
              </div>
              <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ width: '100%', minHeight: '48px' }}>
                Go to Home Dashboard ➔
              </button>
            </div>
          )}

          {nlpResponse.intent === 'VIEW_HISTORY' && (
            <div style={{ marginTop: '10px' }}>
              <button onClick={() => navigate('/history')} className="btn btn-primary" style={{ width: '100%', minHeight: '48px' }}>
                🕒 View Transaction History ➔
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. Explicit Payment Review Card */}
      {paymentStep === 'REVIEW' && nlpResponse && nlpResponse.recipient && nlpResponse.amount && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '2px solid var(--color-primary, #6366f1)',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.15)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--color-primary)',
                letterSpacing: '1px',
              }}
            >
              Step 2 of 2: Explicit Payment Review
            </span>
            <h3 style={{ margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
              Confirm Voice-Initiated Payment
            </h3>
            <p className="text-secondary text-xs" style={{ marginTop: '4px' }}>
              Please review all transfer details before explicit authorization.
            </p>
          </div>

          {/* Amount Badge */}
          <div
            style={{
              textAlign: 'center',
              padding: '16px',
              background: 'rgba(99, 102, 241, 0.06)',
              borderRadius: '12px',
              marginBottom: '1rem',
            }}
          >
            <span className="text-secondary text-xs font-semibold">TOTAL TRANSFER AMOUNT</span>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
              {nlpResponse.formatted_amount || `₹${nlpResponse.amount.toFixed(2)}`}
            </div>
          </div>

          {/* Transfer Details Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span className="text-secondary">Paying To:</span>
              <span className="font-bold">{nlpResponse.recipient.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span className="text-secondary">UPI / Identifier:</span>
              <span className="font-mono text-xs">{nlpResponse.recipient.identifier}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span className="text-secondary">Debited From:</span>
              <span className="font-medium text-xs">{primaryBank}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span className="text-secondary">Convenience Fee:</span>
              <span className="font-bold" style={{ color: '#10b981' }}>FREE (₹0.00)</span>
            </div>
          </div>

          {/* AI Risk & Payment Safety Shield */}
          <div style={{ marginBottom: '1.25rem' }}>
            <PaymentSafetyCard
              safetyData={safetyData}
              loading={loadingSafety}
              hasAcknowledgedRisk={hasAcknowledgedRisk}
              onToggleAcknowledge={setHasAcknowledgedRisk}
              recipientName={nlpResponse.recipient.name || nlpResponse.recipient.identifier || 'Recipient'}
              recipientIdentifier={nlpResponse.recipient.identifier || ''}
              amount={nlpResponse.amount}
            />
          </div>

          {/* Explicit Confirmation Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleConfirmPayment}
              className="btn btn-primary"
              style={{
                minHeight: '52px',
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                opacity: (loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)) ? 0.6 : 1,
                cursor: (loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)) ? 'not-allowed' : 'pointer',
              }}
              disabled={loadingSafety || safetyData?.recommended_action === 'BLOCK' || (safetyData?.requires_strong_confirmation && !hasAcknowledgedRisk)}
            >
              {loadingSafety
                ? 'Evaluating Safety...'
                : safetyData?.recommended_action === 'BLOCK'
                ? '⛔ Transfer Blocked by Safety Shield'
                : `🔒 Explicitly Confirm & Pay ${nlpResponse.formatted_amount || `₹${nlpResponse.amount}`}`}
            </button>
            <button
              onClick={() => setPaymentStep('IDLE')}
              className="btn btn-secondary"
              style={{ minHeight: '44px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 8. Payment Processing Simulator Screen */}
      {paymentStep === 'PROCESSING' && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '4px solid #e5e7eb',
              borderTopColor: 'var(--color-primary)',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem auto',
            }}
          />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800 }}>
            Processing Payment
          </h3>
          <p className="text-secondary font-medium" style={{ margin: 0 }}>
            {processingMessage}
          </p>
          <p className="text-xs text-secondary" style={{ marginTop: '8px' }}>
            Authorizing transfer via NPCI simulation...
          </p>
        </div>
      )}

      {/* 9. Payment Result Screen */}
      {paymentStep === 'RESULT' && paymentResult && (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '2rem 1.5rem',
            marginBottom: '1.5rem',
            border: paymentResult.status === 'SUCCESS' ? '2px solid #10b981' : '2px solid #ef4444',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: paymentResult.status === 'SUCCESS' ? '#10b981' : '#ef4444',
              color: '#ffffff',
              fontSize: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}
          >
            {paymentResult.status === 'SUCCESS' ? '✓' : '✕'}
          </div>

          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.35rem', fontWeight: 800 }}>
            {paymentResult.status === 'SUCCESS' ? 'Payment Successful!' : 'Payment Failed'}
          </h3>
          <p className="text-secondary text-sm" style={{ margin: '0 0 1.25rem 0' }}>
            {paymentResult.message}
          </p>

          <div
            style={{
              background: 'var(--color-bg-secondary, #f8fafc)',
              borderRadius: '12px',
              padding: '14px',
              textAlign: 'left',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-secondary">Amount:</span>
              <span className="font-bold">{paymentResult.formatted_amount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-secondary">Recipient:</span>
              <span className="font-medium">{paymentResult.recipient_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-secondary">Reference ID:</span>
              <span className="font-mono text-xs">{paymentResult.reference_id}</span>
            </div>
            {paymentResult.remaining_balance !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Updated Balance:</span>
                <span className="font-bold">₹{paymentResult.remaining_balance.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleReset} className="btn btn-secondary" style={{ flex: 1, minHeight: '48px' }}>
              🎙️ New Voice Command
            </button>
            <button onClick={() => navigate('/history')} className="btn btn-primary" style={{ flex: 1, minHeight: '48px' }}>
              View in History ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;
