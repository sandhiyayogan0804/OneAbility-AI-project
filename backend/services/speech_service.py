import io
import base64
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("oneability.speech")

try:
    from gtts import gTTS
except ImportError:
    gTTS = None


class SpeechService:
    """
    Synthesizes fluent, natural spoken audio for OneAbility AI assistant 'Dex'
    specializing in native Tamil ('ta') and Indian English ('en').
    """

    def synthesize(self, text: str, language: str = "ta") -> Dict[str, Any]:
        raw_text = (text or "").strip()
        if not raw_text:
            return {
                "status": "error",
                "message": "Empty text provided",
                "audio_base64": None,
                "format": "audio/mp3",
                "language": language
            }

        target_lang = "ta" if language.lower().startswith("ta") else "en"

        # 1. Synthesize using Google Text-to-Speech (gTTS)
        if gTTS:
            try:
                # Use tld 'co.in' for natural Indian English or standard Tamil
                tld = "co.in" if target_lang == "en" else "com"
                tts = gTTS(text=raw_text, lang=target_lang, tld=tld, slow=False)
                fp = io.BytesIO()
                tts.write_to_fp(fp)
                fp.seek(0)
                audio_bytes = fp.read()
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

                return {
                    "status": "success",
                    "audio_base64": audio_b64,
                    "format": "audio/mp3",
                    "language": target_lang
                }
            except Exception as err:
                logger.warning(f"[SpeechService] gTTS synthesis failed: {err}")

        # Fallback if synthesis fails
        return {
            "status": "fallback",
            "message": "Speech synthesis unavailable; use client-side TTS",
            "audio_base64": None,
            "format": "audio/mp3",
            "language": target_lang
        }


speech_service = SpeechService()
