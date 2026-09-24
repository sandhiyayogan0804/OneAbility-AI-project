from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.user import User
from schemas.transaction import TransactionSummary, TransactionDetailResponse
from services.payment_service import PaymentService
from security.dependencies import get_current_user

router = APIRouter()

@router.get("", response_model=List[TransactionSummary], summary="Get filtered transactions history")
def list_transactions(
    search: Optional[str] = Query(None, description="Search term for reference ID, description, or recipient"),
    status: Optional[str] = Query(None, description="Filter by status: 'SUCCESS' or 'FAILED'"),
    type: Optional[str] = Query(None, description="Filter by type: 'SENT' or 'RECEIVED'"),
    start_date: Optional[str] = Query(None, description="Filter start date: YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter end date: YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
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

@router.get("/{reference_or_id}", response_model=TransactionDetailResponse, summary="Get full transaction details & receipt")
def get_transaction_details(
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
