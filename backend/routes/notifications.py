from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from config.database import get_db
from models.user import User
from security.dependencies import get_current_user
from services.notification_service import NotificationService
from schemas.notification import (
    NotificationResponse,
    UnreadCountResponse,
    NotificationStatusResponse,
)

router = APIRouter()

@router.get("", response_model=List[NotificationResponse], summary="Get all notifications for authenticated user")
@router.get("/", response_model=List[NotificationResponse], include_in_schema=False)
def get_notifications(
    is_read: Optional[bool] = Query(None, description="Filter by read status (true/false)"),
    type: Optional[str] = Query(None, description="Filter by notification type or comma-separated types"),
    limit: int = Query(50, ge=1, le=100, description="Max notifications to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves in-app notifications for the authenticated user.
    Supports filtering by read status, category type, and pagination.
    """
    return NotificationService.get_notifications(
        db=db,
        user=current_user,
        is_read=is_read,
        notification_type=type,
        limit=limit,
        offset=offset
    )

@router.get("/unread-count", response_model=UnreadCountResponse, summary="Get unread notifications count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the total number of unread notifications for the user."""
    return NotificationService.get_unread_count(db=db, user=current_user)

@router.patch("/{notification_id}/read", response_model=NotificationResponse, summary="Mark a single notification as read")
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks the specified notification as read for the authenticated user."""
    return NotificationService.mark_as_read(
        db=db,
        user=current_user,
        notification_id=notification_id
    )

@router.post("/read-all", response_model=NotificationStatusResponse, summary="Mark all notifications as read")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks all unread notifications as read for the authenticated user."""
    return NotificationService.mark_all_as_read(
        db=db,
        user=current_user
    )
