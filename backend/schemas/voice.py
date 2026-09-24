from pydantic import BaseModel, Field
from typing import Optional, List

class VoiceCommandRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Speech-to-text transcript or natural language text")
    language: Optional[str] = Field("mixed", description="Language preference: 'en', 'ta', or 'mixed'")

class ExtractedPaymentRecipient(BaseModel):
    name: Optional[str] = None
    identifier: Optional[str] = None
    matched_beneficiary_id: Optional[int] = None
    is_saved_contact: bool = False

class VoiceNLPResponse(BaseModel):
    raw_transcript: str
    intent: str  # "SEND_MONEY", "CHECK_BALANCE", "VIEW_HISTORY", "UNKNOWN"
    confidence: float  # 0.0 to 1.0
    recipient: Optional[ExtractedPaymentRecipient] = None
    amount: Optional[float] = None
    formatted_amount: Optional[str] = None
    currency: str = "INR"
    is_complete: bool
    missing_fields: List[str] = []
    clarification_prompt: Optional[str] = None
    spoken_response: str
    action_suggested: Optional[str] = None  # "PROCEED_TO_REVIEW", "ASK_AMOUNT", "ASK_RECIPIENT", "VIEW_BALANCE", "VIEW_HISTORY"
