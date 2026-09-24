from typing import List
from fastapi import APIRouter, Depends, Request, status, HTTPException
from sqlalchemy.orm import Session

from config.database import get_db
from models.user import User
from security.dependencies import get_current_user
from services.bill_service import BillService
from schemas.bill import (
    BillCategory,
    BillFetchRequest,
    BillFetchResponse,
    BillPaymentRequest,
    BillPaymentResponse,
)

router = APIRouter()

@router.get("/categories", response_model=List[BillCategory])
def get_bill_categories(
    current_user: User = Depends(get_current_user),
):
    """Retrieve all 10 supported bill & recharge categories and billers."""
    return BillService.get_categories()

@router.get("/categories/{category_id}", response_model=BillCategory)
def get_bill_category_details(
    category_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve details and billers for a specific bill category."""
    cat = BillService.get_category_by_id(category_id)
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found."
        )
    return cat

@router.post("/fetch", response_model=BillFetchResponse)
def fetch_bill_details(
    req: BillFetchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Simulates bill fetch and account validation for the given provider."""
    return BillService.fetch_bill_details(db=db, user=current_user, req=req)

@router.post("/pay", response_model=BillPaymentResponse)
def execute_bill_payment(
    req: BillPaymentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes a simulated bill payment:
    - Validates inputs
    - Verifies account balance
    - Records transaction and bill payment
    - Never handles or requests UPI PIN
    """
    client_ip = request.client.host if request.client else None
    return BillService.execute_bill_payment(db=db, user=current_user, req=req, client_ip=client_ip)

@router.get("/history", response_model=List[BillPaymentResponse])
def get_bill_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve recent bill and recharge payment history for the authenticated user."""
    return BillService.get_user_bill_history(db=db, user=current_user)
