from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class NotificationCreate(BaseModel):
    title: str = Field(..., max_length=200, description="Title of the notification")
    message: str = Field(..., description="Detailed message content")
    notification_type: str = Field(
        default="INFO",
        description="Type: TRANSACTION, BILL_PAYMENT, SECURITY, SAFETY_WARNING, SYSTEM, INFO"
    )

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime
    formatted_time: Optional[str] = None
    icon: Optional[str] = None

    class Config:
        from_attributes = True

class UnreadCountResponse(BaseModel):
    unread_count: int

class NotificationStatusResponse(BaseModel):
    success: bool
    message: str
    updated_count: int = 1
    unread_count: Optional[int] = None
    notification: Optional[NotificationResponse] = None
