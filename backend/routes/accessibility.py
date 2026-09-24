from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.user import User
from schemas.accessibility import (
    AccessibilityPreferenceResponse,
    AccessibilityPreferenceUpdateRequest
)
from services.accessibility_service import AccessibilityService
from security.dependencies import get_current_user

router = APIRouter()

@router.get(
    "/preferences",
    response_model=AccessibilityPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user accessibility preferences"
)
def get_accessibility_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves the global accessibility preferences for the authenticated user."""
    return AccessibilityService.get_or_create_preferences(db=db, user=current_user)

@router.put(
    "/preferences",
    response_model=AccessibilityPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Update user accessibility preferences"
)
def update_accessibility_preferences(
    req: AccessibilityPreferenceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the global accessibility preferences for the authenticated user.
    Supports high contrast, font size scale, simple mode, reduced motion,
    haptic feedback, voice guidance, captions, and language.
    """
    return AccessibilityService.update_preferences(db=db, user=current_user, req=req)

@router.patch(
    "/preferences",
    response_model=AccessibilityPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Partial update user accessibility preferences"
)
def patch_accessibility_preferences(
    req: AccessibilityPreferenceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Partially updates user accessibility preferences."""
    return AccessibilityService.update_preferences(db=db, user=current_user, req=req)
