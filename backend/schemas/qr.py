from pydantic import BaseModel, Field
from typing import Optional

class QRParseRequest(BaseModel):
    qr_data: str = Field(..., min_length=1, description="Raw scanned QR string content")

class QRParsedResponse(BaseModel):
    is_valid_upi: bool
    error_message: Optional[str] = None
    upi_id: Optional[str] = None
    recipient_name: Optional[str] = None
    amount: Optional[float] = None
    formatted_amount: Optional[str] = None
    currency: str = "INR"
    transaction_note: Optional[str] = None
    merchant_code: Optional[str] = None
    raw_qr: str
