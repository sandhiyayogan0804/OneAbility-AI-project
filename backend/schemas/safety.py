from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class PaymentSafetyCheckRequest(BaseModel):
    recipient_type: str = Field(..., description="Recipient type: 'CONTACT', 'UPI_ID', 'BENEFICIARY', 'QR'")
    recipient_identifier: str = Field(..., min_length=1, description="UPI ID or Phone number")
    recipient_name: Optional[str] = Field(None, description="Resolved or provided recipient name")
    amount: float = Field(..., description="Payment amount in INR")
    source: Optional[str] = Field("MANUAL", description="Initiating channel: 'MANUAL', 'VOICE', 'QR'")
    description: Optional[str] = Field(None, description="Optional payment note/remark")

class PaymentSafetyCheckResponse(BaseModel):
    risk_level: str = Field(..., description="Overall risk level: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Risk score from 0.0 (safe) to 1.0 (dangerous)")
    risk_flags: List[str] = Field(default=[], description="Specific risk flags detected")
    is_safe_to_proceed: bool = Field(..., description="True if payment can proceed with or without confirmation")
    requires_strong_confirmation: bool = Field(..., description="True if explicit elevated warning confirmation is needed")
    recommended_action: str = Field(..., description="'ALLOW', 'CONFIRM_WITH_WARNING', or 'BLOCK'")
    warning_title: Optional[str] = Field(None, description="User-facing concise alert title")
    warning_message: Optional[str] = Field(None, description="Detailed accessible plain-language warning explanation")
    safety_tips: List[str] = Field(default=[], description="Actionable security tips for the user")
    details: Dict[str, Any] = Field(default={}, description="Contextual check metrics")
