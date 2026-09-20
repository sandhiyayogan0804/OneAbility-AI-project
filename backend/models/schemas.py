from pydantic import BaseModel, Field
from typing import Optional


class VoicePaymentRequest(BaseModel):
    speech_text: str = Field(..., description="Raw transcribed speech text in Tamil, Tanglish, or English")


class VoicePaymentResponse(BaseModel):
    success: bool
    recipient: Optional[str] = None
    upi_id: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "INR"
    confidence: float = 0.0
    message: str
    raw_text: str


class ConfirmPaymentRequest(BaseModel):
    recipient: str
    upi_id: str
    amount: float
    action: str = Field("confirm", description="'confirm' or 'cancel'")


class ConfirmPaymentResponse(BaseModel):
    status: str  # "SUCCESS" or "CANCELLED"
    transaction_id: Optional[str] = None
    recipient: str
    amount: float
    message: str
    timestamp: str


class QRVerifyRequest(BaseModel):
    qr_payload: str = Field(..., description="Raw scanned QR string")


class QRVerifyResponse(BaseModel):
    valid: bool
    merchant_name: Optional[str] = None
    upi_id: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "INR"
    verified: bool
    suspicious: bool
    warning_message: Optional[str] = None
    risk_level: str = "SAFE"  # SAFE, MEDIUM, BLOCKED


class AssistantChatRequest(BaseModel):
    message: str = Field(..., description="User message in Tamil, English, or Tanglish")
    language: str = Field("ta", description="Preferred language code ('ta' or 'en')")
    context: Optional[dict] = Field(default_factory=dict, description="Conversational context including session memory and app state")


class AssistantChatResponse(BaseModel):
    reply: str = Field(..., description="Natural spoken reply in Tamil or English")
    language: str = Field("ta", description="Language of the reply ('ta' or 'en')")
    intent: str = Field(..., description="Detected user intent")
    recipient: Optional[str] = Field(None, description="Extracted recipient name")
    amount: Optional[float] = Field(None, description="Extracted payment amount")
    action: Optional[str] = Field(None, description="Optional action identifier")
    confidence: float = Field(0.95, description="Confidence score")
    updated_memory: Optional[dict] = Field(default_factory=dict, description="Updated short-term conversational session memory")
    action_type: Optional[str] = Field("conversation", description="High-level classification: conversation, app_info, app_navigation, financial_action_prep, confirmation, cancellation, clarification")


class AssistantSpeakRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize to speech")
    language: str = Field("ta", description="Target language ('ta' or 'en')")


class AssistantSpeakResponse(BaseModel):
    status: str
    audio_base64: Optional[str] = None
    format: str = "audio/mp3"
    language: str = "ta"


