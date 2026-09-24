from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DashboardUser(BaseModel):
    id: int
    full_name: str
    phone_number: str
    email: Optional[str] = None
    upi_id: Optional[str] = None

class DashboardBalance(BaseModel):
    total_balance: float
    currency: str = "INR"
    currency_symbol: str = "₹"
    formatted_balance: str

class BankAccountSummary(BaseModel):
    id: int
    bank_name: str
    account_number_masked: str
    account_type: str
    ifsc_code: str
    balance: float
    is_primary: bool

class QuickActionItem(BaseModel):
    id: str
    title: str
    icon: str
    route: str
    aria_label: str
    description: str

class TransactionSummary(BaseModel):
    id: int
    reference_id: str
    party_name: str
    transaction_type: str  # "CREDIT" or "DEBIT"
    amount: float
    formatted_amount: str
    currency: str = "INR"
    payment_method: str
    status: str
    created_at: datetime
    description: Optional[str] = None

class NotificationSummary(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime

class AccessibilitySettingsSummary(BaseModel):
    high_contrast: bool
    font_size_scale: str
    voice_guidance: bool
    haptic_feedback: bool
    preferred_language: str

class DashboardHomeResponse(BaseModel):
    greeting: str
    user: DashboardUser
    balance: DashboardBalance
    primary_account: Optional[BankAccountSummary] = None
    linked_accounts_count: int
    linked_accounts: List[BankAccountSummary] = []
    quick_actions: List[QuickActionItem] = []
    recent_transactions: List[TransactionSummary] = []
    notifications: List[NotificationSummary] = []
    unread_notifications_count: int
    accessibility: AccessibilitySettingsSummary
