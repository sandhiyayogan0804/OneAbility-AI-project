from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from models.user import User
from models.notification import Notification
from schemas.notification import (
    NotificationResponse,
    UnreadCountResponse,
    NotificationStatusResponse,
)

TYPE_ICONS = {
    "TRANSACTION": "💸",
    "BILL_PAYMENT": "🧾",
    "SECURITY": "🛡️",
    "SAFETY_WARNING": "⚠️",
    "SYSTEM": "♿",
    "INFO": "ℹ️",
}

class NotificationService:

    @staticmethod
    def _format_relative_time(dt: datetime) -> str:
        """Formats datetime into human-friendly relative string."""
        if not dt:
            return "Just now"
        
        now = datetime.now(timezone.utc)
        # Normalize dt to UTC if needed
        if dt.tzinfo is None:
            # Assume local/UTC naive
            diff = datetime.now() - dt
        else:
            diff = now - dt

        seconds = max(0, int(diff.total_seconds()))
        if seconds < 60:
            return "Just now"
        elif seconds < 3600:
            mins = seconds // 60
            return f"{mins}m ago"
        elif seconds < 86400:
            hours = seconds // 3600
            return f"{hours}h ago"
        elif seconds < 172800:
            return "Yesterday"
        else:
            days = seconds // 86400
            return f"{days}d ago"

    @classmethod
    def _to_response(cls, notif: Notification) -> NotificationResponse:
        """Converts SQLAlchemy Notification model to NotificationResponse schema."""
        type_key = (notif.notification_type or "INFO").upper()
        icon = TYPE_ICONS.get(type_key, "🔔")
        formatted = cls._format_relative_time(notif.created_at)

        return NotificationResponse(
            id=notif.id,
            user_id=notif.user_id,
            title=notif.title,
            message=notif.message,
            notification_type=type_key,
            is_read=notif.is_read,
            created_at=notif.created_at,
            formatted_time=formatted,
            icon=icon,
        )

    @classmethod
    def seed_initial_notifications_if_empty(cls, db: Session, user: User) -> None:
        """Ensures the user has representative starter notifications across all supported types."""
        count = db.query(Notification).filter(Notification.user_id == user.id).count()
        if count > 0:
            return

        starter_notifs = [
            Notification(
                user_id=user.id,
                title="Welcome to OneAbility AI",
                message="Welcome! Experience inclusive, voice-guided & high-contrast digital payments.",
                notification_type="SYSTEM",
                is_read=False,
            ),
            Notification(
                user_id=user.id,
                title="Security Alert: Two-Factor Guard Active",
                message="Device protection and biometric sign-in are enabled for your primary UPI ID.",
                notification_type="SECURITY",
                is_read=False,
            ),
            Notification(
                user_id=user.id,
                title="AI Safety Protection Active",
                message="OneAbility AI automatically inspects payment transfers for suspicious VPA patterns and high amounts.",
                notification_type="SAFETY_WARNING",
                is_read=False,
            ),
            Notification(
                user_id=user.id,
                title="Payment Received",
                message="Received ₹1,500.00 from Priya Sharma (priya@okaxis). Ref: TXN_UPI_SAMPLE_01",
                notification_type="TRANSACTION",
                is_read=True,
            ),
            Notification(
                user_id=user.id,
                title="Bill Reminder",
                message="Electricity bill for BESCOM (CA: 123456789) is due soon. Tap to pay with OneAbility.",
                notification_type="BILL_PAYMENT",
                is_read=True,
            ),
        ]
        db.add_all(starter_notifs)
        db.commit()

    @classmethod
    def get_notifications(
        cls,
        db: Session,
        user: User,
        is_read: Optional[bool] = None,
        notification_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[NotificationResponse]:
        """
        Retrieves all notifications for the authenticated user with optional filtering:
        - is_read: True / False / None (all)
        - notification_type: filter by specific category
        """
        # Ensure user has sample notifications if brand new
        cls.seed_initial_notifications_if_empty(db, user)

        query = db.query(Notification).filter(Notification.user_id == user.id)

        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)

        if notification_type:
            # Allow multiple comma-separated types or single type
            types = [t.strip().upper() for t in notification_type.split(",") if t.strip()]
            if types:
                query = query.filter(Notification.notification_type.in_(types))

        # Order by newest first
        records = query.order_by(desc(Notification.created_at), desc(Notification.id)).offset(offset).limit(limit).all()

        return [cls._to_response(n) for n in records]

    @classmethod
    def get_unread_count(cls, db: Session, user: User) -> UnreadCountResponse:
        """Returns the number of unread notifications for the user."""
        cls.seed_initial_notifications_if_empty(db, user)
        count = db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_read == False
        ).count()
        return UnreadCountResponse(unread_count=count)

    @classmethod
    def mark_as_read(cls, db: Session, user: User, notification_id: int) -> NotificationResponse:
        """Marks a specific notification as read for the authenticated user."""
        notif = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user.id
        ).first()

        if not notif:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Notification #{notification_id} not found."
            )

        if not notif.is_read:
            notif.is_read = True
            db.commit()
            db.refresh(notif)

        return cls._to_response(notif)

    @classmethod
    def mark_all_as_read(cls, db: Session, user: User) -> NotificationStatusResponse:
        """Marks all unread notifications for the authenticated user as read."""
        unread_items = db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_read == False
        ).all()

        updated_count = len(unread_items)
        if updated_count > 0:
            for item in unread_items:
                item.is_read = True
            db.commit()

        return NotificationStatusResponse(
            success=True,
            message=f"Marked {updated_count} notification(s) as read.",
            updated_count=updated_count,
            unread_count=0
        )

    @classmethod
    def create_notification(
        cls,
        db: Session,
        user_id: int,
        title: str,
        message: str,
        notification_type: str = "INFO",
        commit: bool = True
    ) -> Notification:
        """Helper to create a single notification in MySQL."""
        notif = Notification(
            user_id=user_id,
            title=title.strip(),
            message=message.strip(),
            notification_type=notification_type.upper(),
            is_read=False
        )
        db.add(notif)
        if commit:
            db.commit()
            db.refresh(notif)
        return notif
