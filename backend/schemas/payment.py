from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class BeneficiaryResponse(BaseModel):
    id: int
    name: str
    nickname: Optional[str] = None
    upi_id: Optional[str] = None
    phone_number: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    is_favorite: bool
    created_at: datetime

    class Config:
        from_attributes = True

class BeneficiaryCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    upi_id: Optional[str] = Field(None, max_length=50)
    phone_number: Optional[str] = Field(None, max_length=20)
    nickname: Optional[str] = Field(None, max_length=100)

class VerifyRecipientRequest(BaseModel):
    identifier: str = Field(..., description="Phone number or UPI ID")
    recipient_type: str = Field("UPI_ID", description="'CONTACT' or 'UPI_ID'")

class VerifyRecipientResponse(BaseModel):
    identifier: str
    name: str
    upi_id: Optional[str] = None
    phone_number: Optional[str] = None
    is_verified: bool
    bank_handle: Optional[str] = None

class PaymentExecuteRequest(BaseModel):
    recipient_type: str = Field(..., description="'CONTACT', 'UPI_ID', or 'BENEFICIARY'")
    recipient_name: str = Field(..., min_length=1, max_length=100)
    recipient_identifier: str = Field(..., min_length=3, max_length=100)
    amount: float = Field(..., gt=0, description="Payment amount must be greater than zero")
    description: Optional[str] = Field(None, max_length=255)
    simulate_failure: bool = Field(False, description="Flag to explicitly simulate a failed transaction")

class PaymentResultResponse(BaseModel):
    status: str  # "SUCCESS" or "FAILED"
    reference_id: str
    amount: float
    formatted_amount: str
    currency: str = "INR"
    payment_method: str = "UPI"
    recipient_name: str
    recipient_identifier: str
    sender_bank: str
    sender_account_masked: str
    created_at: datetime
    message: str
    remaining_balance: float
