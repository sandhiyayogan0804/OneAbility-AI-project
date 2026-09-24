from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.user import User
from schemas.payment import (
    BeneficiaryResponse,
    BeneficiaryCreateRequest,
    VerifyRecipientRequest,
    VerifyRecipientResponse,
    PaymentExecuteRequest,
    PaymentResultResponse,
)
from schemas.safety import PaymentSafetyCheckRequest, PaymentSafetyCheckResponse
from schemas.transaction import TransactionSummary, TransactionDetailResponse
from services.payment_service import PaymentService
from services.payment_safety_service import PaymentSafetyService
from security.dependencies import get_current_user

router = APIRouter()

@router.post("/safety-check", response_model=PaymentSafetyCheckResponse, summary="Perform AI Risk and Payment Safety Checks")
def check_payment_safety(
    req: PaymentSafetyCheckRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Evaluates risk factors before payment execution:
    - New recipient / first-time beneficiary
    - Unusual or high payment amount
    - Insufficient bank balance
    - Duplicate/repeated payment within 5 minutes
    - Suspicious keywords or phishing UPI patterns
    - Invalid or ambiguous recipient formats
    
    SAFETY ASSURANCE:
    - Strictly READ-ONLY evaluation.
    - Never mutates balances or executes transactions.
    - Never processes or asks for UPI PIN.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return PaymentSafetyService.check_payment_safety(
        db=db,
        user=current_user,
        req=req,
        client_ip=client_ip,
        user_agent=user_agent
    )

@router.get("/beneficiaries", response_model=List[BeneficiaryResponse], summary="Get saved beneficiaries for authenticated user")
def get_beneficiaries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves saved contacts/beneficiaries for fast payments."""
    return PaymentService.get_or_seed_beneficiaries(db=db, user=current_user)

@router.post("/beneficiaries", response_model=BeneficiaryResponse, status_code=status.HTTP_201_CREATED, summary="Add a new beneficiary")
def add_beneficiary(
    req: BeneficiaryCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Adds a new beneficiary/contact to the user's saved list."""
    return PaymentService.add_beneficiary(db=db, user=current_user, req=req)

@router.post("/verify-recipient", response_model=VerifyRecipientResponse, summary="Verify recipient before payment")
def verify_recipient(
    req: VerifyRecipientRequest,
    current_user: User = Depends(get_current_user)
):
    """Verifies UPI ID or phone number format and returns resolved name."""
    return PaymentService.verify_recipient(identifier=req.identifier, recipient_type=req.recipient_type)

@router.post("/execute", response_model=PaymentResultResponse, summary="Execute simulated payment transaction")
def execute_payment(
    req: PaymentExecuteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executes a simulated payment transaction:
    - Validates recipient and amount
    - Deducts from primary account balance
    - Records transaction in MySQL
    - Dispatches notification and audit logs
    """
    client_ip = request.client.host if request.client else None
    return PaymentService.execute_payment(db=db, user=current_user, req=req, client_ip=client_ip)

@router.get("/transactions", response_model=List[TransactionSummary], summary="Get filtered transaction history")
def get_transactions(
    search: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the user's transaction history with search, status, type, and date range filters."""
    return PaymentService.get_transaction_history(
        db=db,
        user=current_user,
        search=search,
        status_filter=status,
        tx_type_filter=type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )

@router.get("/transactions/{reference_or_id}", response_model=TransactionDetailResponse, summary="Get full transaction receipt details")
def get_transaction_detail(
    reference_or_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full transaction receipt details.
    Protected with JWT auth and verifies that the current user is an authorized party (sender or receiver).
    """
    return PaymentService.get_transaction_detail(
        db=db,
        user=current_user,
        reference_or_id=reference_or_id
    )
