from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class TransactionSummary(BaseModel):
    id: int
    reference_id: str
    party_name: str
    transaction_type: str  # "CREDIT" or "DEBIT"
    amount: float
    formatted_amount: str
    currency: str = "INR"
    payment_method: str
    status: str
    created_at: datetime
    description: Optional[str] = None

class TransactionDetailResponse(BaseModel):
    id: int
    reference_id: str
    party_name: str
    transaction_type: str  # "CREDIT" or "DEBIT"
    amount: float
    formatted_amount: str
    currency: str = "INR"
    payment_method: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    description: Optional[str] = None

    # Sender & Receiver Details
    sender_name: str
    sender_bank_name: Optional[str] = None
    sender_account_masked: Optional[str] = None
    
    receiver_name: Optional[str] = None
    receiver_bank_name: Optional[str] = None
    receiver_account_masked: Optional[str] = None

class TransactionFilterQuery(BaseModel):
    search: Optional[str] = Field(None, description="Search term for reference ID, description, or party")
    status: Optional[str] = Field(None, description="'SUCCESS' or 'FAILED'")
    type: Optional[str] = Field(None, description="'SENT' ('DEBIT') or 'RECEIVED' ('CREDIT')")
    start_date: Optional[str] = Field(None, description="ISO format start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="ISO format end date (YYYY-MM-DD)")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)
