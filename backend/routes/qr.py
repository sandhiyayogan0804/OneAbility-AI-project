from fastapi import APIRouter, Depends, status
from models.user import User
from schemas.qr import QRParseRequest, QRParsedResponse
from services.qr_service import QRService
from security.dependencies import get_current_user

router = APIRouter()

@router.post("/parse", response_model=QRParsedResponse, status_code=status.HTTP_200_OK, summary="Parse and validate scanned QR code payload")
def parse_qr(
    req: QRParseRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Validates and extracts UPI payment information from a scanned QR payload.
    Supports standard upi://pay?... URIs and direct VPA handles.
    Flags invalid and unsupported QR codes with descriptive error messages.
    """
    return QRService.parse_and_validate_qr(qr_string=req.qr_data)
