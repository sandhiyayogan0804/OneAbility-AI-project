from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from config.database import get_db
from models.user import User
from schemas.dashboard import DashboardHomeResponse
from services.dashboard_service import DashboardService
from security.dependencies import get_current_user

router = APIRouter()

@router.get("/home", response_model=DashboardHomeResponse, status_code=status.HTTP_200_OK, summary="Get authenticated Home Dashboard data")
def get_home_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns aggregated data for the authenticated Home Dashboard (balance, UPI, bank, transactions, notifications)."""
    return DashboardService.get_dashboard_data(db=db, user=current_user)

@router.get("", response_model=DashboardHomeResponse, status_code=status.HTTP_200_OK, summary="Alias for Home Dashboard data")
def get_home_dashboard_alias(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alias for /api/dashboard/home."""
    return DashboardService.get_dashboard_data(db=db, user=current_user)
