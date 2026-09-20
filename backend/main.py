import time
import random
import urllib.parse
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models.schemas import (
    VoicePaymentRequest,
    VoicePaymentResponse,
    ConfirmPaymentRequest,
    ConfirmPaymentResponse,
    QRVerifyRequest,
    QRVerifyResponse,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantSpeakRequest,
    AssistantSpeakResponse
)
from services.nlp_engine import NLPEngine, KNOWN_CONTACTS
from services.gemini_service import gemini_service
from services.speech_service import speech_service

app = FastAPI(
    title="OneAbility AI Voice Payment Backend",
    description="Universal Accessibility Platform API for Voice-Driven Digital Payments",
    version="1.2.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8085",
        "http://127.0.0.1:8085",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "app": "OneAbility AI Voice Payment Backend",
        "status": "running",
        "endpoints": {
            "assistant_chat": "POST /api/assistant/chat",
            "parse_payment": "POST /api/voice/parse-payment",
            "confirm_payment": "POST /api/voice/confirm-payment",
            "qr_verify": "POST /api/qr/verify"
        }
    }


@app.post("/api/assistant/chat", response_model=AssistantChatResponse)
def assistant_chat(payload: AssistantChatRequest):
    """
    Intelligent multimodal voice assistant endpoint powered by Gemini
    with deterministic fallback for offline and safety resiliency.
    Understands Tamil, English, and Tanglish.
    """
    try:
        result = gemini_service.process_chat(
            message=payload.message,
            language=payload.language,
            context=payload.context
        )
        return AssistantChatResponse(**result)
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Error in assistant chat: {str(err)}"
        )


@app.post("/api/assistant/speak", response_model=AssistantSpeakResponse)
def assistant_speak(payload: AssistantSpeakRequest):
    """
    Synthesizes natural spoken speech in native Tamil or English.
    Returns base64-encoded audio for browser playback with zero API key exposure.
    """
    try:
        result = speech_service.synthesize(text=payload.text, language=payload.language)
        return AssistantSpeakResponse(**result)
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Error in assistant speech synthesis: {str(err)}"
        )



@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/voice/parse-payment", response_model=VoicePaymentResponse)
def parse_voice_payment(payload: VoicePaymentRequest):
    """
    Accepts natural speech text in Tamil, Tanglish, or English.
    Extracts recipient, upi_id, amount, and calculates confidence.
    """
    try:
        parsed_result = NLPEngine.parse_payment_intent(payload.speech_text)
        return VoicePaymentResponse(**parsed_result)
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing voice payment text: {str(err)}"
        )


@app.post("/api/voice/confirm-payment", response_model=ConfirmPaymentResponse)
def confirm_payment(payload: ConfirmPaymentRequest):
    """
    Handles mock payment processing upon user confirmation.
    Zero real money / UPI transfer.
    """
    action = payload.action.strip().lower()
    timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")

    if action in ["confirm", "yes", "send", "aama", "sari"]:
        # Simulated mock transaction reference
        mock_txn_id = f"MOCK_{random.randint(100000000000, 999999999999)}"
        return ConfirmPaymentResponse(
            status="SUCCESS",
            transaction_id=mock_txn_id,
            recipient=payload.recipient,
            amount=payload.amount,
            message=f"Mock payment of ₹{payload.amount:g} to {payload.recipient} was successful.",
            timestamp=timestamp_str
        )
    else:
        # User cancelled
        return ConfirmPaymentResponse(
            status="CANCELLED",
            transaction_id=None,
            recipient=payload.recipient,
            amount=payload.amount,
            message="Payment Cancelled. No money was debited.",
            timestamp=timestamp_str
        )


@app.post("/api/qr/verify", response_model=QRVerifyResponse)
def verify_qr(payload: QRVerifyRequest):
    """
    Validates and verifies UPI QR codes.
    - Parses standard UPI URI parameters (pa, pn, am, cu, tn).
    - Checks merchant against safe mock directory.
    - Flags unverified payees for explicit user review.
    - Strictly blocks suspicious web URLs and phishing links.
    """
    raw = payload.qr_payload.strip()
    lower = raw.lower()

    # 1. Strict Security Guard: Block arbitrary web URLs / phishing
    if lower.startswith("http://") or lower.startswith("https://") or lower.startswith("javascript:") or lower.startswith("data:") or ".com" in lower or ".xyz" in lower or ".online" in lower:
        return QRVerifyResponse(
            valid=False,
            merchant_name=None,
            upi_id=None,
            amount=None,
            currency="INR",
            verified=False,
            suspicious=True,
            warning_message="Security Alert: Non-UPI web link detected. Payment blocked for safety.",
            risk_level="BLOCKED"
        )

    # 2. Parse Standard UPI URI (upi://pay?...)
    if lower.startswith("upi://pay"):
        try:
            parsed = urllib.parse.urlparse(raw)
            params = urllib.parse.parse_qs(parsed.query)

            pa = params.get("pa", [None])[0]
            pn = params.get("pn", [None])[0]
            if pn:
                pn = urllib.parse.unquote_plus(pn)

            am_str = params.get("am", [None])[0]
            amount = None
            if am_str:
                try:
                    amount = float(am_str)
                except ValueError:
                    amount = None

            cu = params.get("cu", ["INR"])[0]

            if not pa:
                return QRVerifyResponse(
                    valid=False,
                    merchant_name=pn,
                    upi_id=None,
                    amount=amount,
                    currency=cu,
                    verified=False,
                    suspicious=True,
                    warning_message="Malformed UPI QR: Payee address (pa) missing.",
                    risk_level="BLOCKED"
                )

            # Check known contacts directory
            is_verified = False
            resolved_name = pn or "Merchant"
            clean_pa = pa.strip()

            for key, contact in KNOWN_CONTACTS.items():
                if clean_pa.lower() == contact["upi_id"].lower() or (pn and contact["name"].lower() in pn.lower()):
                    is_verified = True
                    resolved_name = contact["name"]
                    clean_pa = contact["upi_id"]
                    break

            if is_verified:
                return QRVerifyResponse(
                    valid=True,
                    merchant_name=resolved_name,
                    upi_id=clean_pa,
                    amount=amount,
                    currency=cu,
                    verified=True,
                    suspicious=False,
                    warning_message=None,
                    risk_level="SAFE"
                )
            else:
                return QRVerifyResponse(
                    valid=True,
                    merchant_name=resolved_name,
                    upi_id=clean_pa,
                    amount=amount,
                    currency=cu,
                    verified=False,
                    suspicious=False,
                    warning_message=f"Unverified Merchant: {resolved_name} is not in your frequent contacts directory.",
                    risk_level="MEDIUM"
                )
        except Exception as err:
            return QRVerifyResponse(
                valid=False,
                merchant_name=None,
                upi_id=None,
                amount=None,
                currency="INR",
                verified=False,
                suspicious=True,
                warning_message=f"Error parsing UPI QR payload: {str(err)}",
                risk_level="BLOCKED"
            )

    # 3. Direct UPI ID format (e.g. "kumar.store@okhdfcbank")
    if "@" in raw and " " not in raw and "." in raw:
        is_verified = False
        resolved_name = "Merchant"
        for key, contact in KNOWN_CONTACTS.items():
            if raw.lower() == contact["upi_id"].lower():
                is_verified = True
                resolved_name = contact["name"]
                break

        return QRVerifyResponse(
            valid=True,
            merchant_name=resolved_name,
            upi_id=raw,
            amount=None,
            currency="INR",
            verified=is_verified,
            suspicious=False,
            warning_message=None if is_verified else "Unverified Merchant: Payee is not in your frequent contacts directory.",
            risk_level="SAFE" if is_verified else "MEDIUM"
        )

    # 4. Unknown / Malformed QR format
    return QRVerifyResponse(
        valid=False,
        merchant_name=None,
        upi_id=None,
        amount=None,
        currency="INR",
        verified=False,
        suspicious=True,
        warning_message="Unrecognized QR format. Only verified UPI QR codes are supported.",
        risk_level="BLOCKED"
    )