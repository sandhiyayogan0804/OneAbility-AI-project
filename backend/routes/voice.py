from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.user import User
from schemas.voice import VoiceCommandRequest, VoiceNLPResponse
from services.voice_nlp_service import VoiceNLPService
from security.dependencies import get_current_user

router = APIRouter()

@router.post(
    "/parse",
    response_model=VoiceNLPResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse natural-language voice payment command"
)
def parse_voice_command(
    req: VoiceCommandRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parses natural language / voice transcripts in English, Tamil, and Tanglish.
    Extracts payment intent, recipient, and amount.
    
    SAFETY ASSURANCE:
    - This endpoint is strictly read-only NLP parsing.
    - It does NOT authorize, trigger, or execute any financial transaction.
    - It NEVER handles, requests, or stores UPI PINs.
    - Payments must always be explicitly reviewed and confirmed through the payment review interface.
    """
    return VoiceNLPService.parse_command(
        text=req.text,
        language=req.language or "mixed",
        user=current_user,
        db=db
    )
