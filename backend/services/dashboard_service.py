from datetime import datetime, timezone
from decimal import Decimal
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from models.user import User
from models.bank_account import BankAccount
from models.transaction import Transaction
from models.notification import Notification
from models.accessibility import AccessibilityPreference
from schemas.dashboard import (
    DashboardHomeResponse,
    DashboardUser,
    DashboardBalance,
    BankAccountSummary,
    QuickActionItem,
    TransactionSummary,
    NotificationSummary,
    AccessibilitySettingsSummary,
)

class DashboardService:

    @staticmethod
    def get_time_based_greeting(name: str) -> str:
        """Returns time of day greeting."""
        current_hour = datetime.now().hour
        if 5 <= current_hour < 12:
            time_str = "Good morning"
        elif 12 <= current_hour < 17:
            time_str = "Good afternoon"
        else:
            time_str = "Good evening"
        first_name = name.split()[0] if name else "User"
        return f"{time_str}, {first_name}"

    @staticmethod
    def _mask_account(acc_num: str) -> str:
        """Masks account number keeping only last 4 digits visible."""
        if not acc_num or len(acc_num) < 4:
            return "•••• ••••"
        return f"•••• {acc_num[-4:]}"

    @classmethod
    def ensure_starter_demo_data(cls, db: Session, user: User) -> None:
        """Ensures the user has an initialized bank account and starter data for complete dashboard experience."""
        # 1. Check if user has at least one bank account
        account_count = db.query(BankAccount).filter(BankAccount.user_id == user.id).count()
        if account_count == 0:
            starter_account = BankAccount(
                user_id=user.id,
                account_number="98765432104821",
                ifsc_code="SBIN0001234",
                bank_name="State Bank of India",
                account_type="SAVINGS",
                balance=Decimal("25480.00"),
                is_primary=True,
                is_active=True
            )
            db.add(starter_account)
            db.flush()

            # Add sample transactions
            tx1 = Transaction(
                reference_id=f"TXN_{int(datetime.now().timestamp())}_01",
                sender_user_id=user.id,
                receiver_user_id=None,
                sender_account_id=starter_account.id,
                amount=Decimal("450.00"),
                currency="INR",
                payment_method="UPI",
                status="SUCCESS",
                description="Organic Grocery Store",
            )
            tx2 = Transaction(
                reference_id=f"TXN_{int(datetime.now().timestamp())}_02",
                sender_user_id=None,
                receiver_user_id=user.id,
                receiver_account_id=starter_account.id,
                amount=Decimal("2500.00"),
                currency="INR",
                payment_method="BANK_TRANSFER",
                status="SUCCESS",
                description="Project Freelance Stipend",
            )
            tx3 = Transaction(
                reference_id=f"TXN_{int(datetime.now().timestamp())}_03",
                sender_user_id=user.id,
                receiver_user_id=None,
                sender_account_id=starter_account.id,
                amount=Decimal("120.00"),
                currency="INR",
                payment_method="QR",
                status="SUCCESS",
                description="Metro Ride Fare",
            )
            db.add_all([tx1, tx2, tx3])
            db.commit()

    @classmethod
    def get_dashboard_data(cls, db: Session, user: User) -> DashboardHomeResponse:
        """Assembles all data needed for the authenticated Home Dashboard."""
        # Ensure user has starter bank account & transactions
        cls.ensure_starter_demo_data(db, user)

        # 1. Greeting
        greeting = cls.get_time_based_greeting(user.full_name)

        # 2. Bank Accounts & Balance
        accounts = db.query(BankAccount).filter(
            BankAccount.user_id == user.id,
            BankAccount.is_active == True
        ).all()

        total_balance = sum([float(acc.balance) for acc in accounts]) if accounts else 0.0
        primary_acc_model = next((acc for acc in accounts if acc.is_primary), accounts[0] if accounts else None)

        primary_summary = None
        if primary_acc_model:
            primary_summary = BankAccountSummary(
                id=primary_acc_model.id,
                bank_name=primary_acc_model.bank_name,
                account_number_masked=cls._mask_account(primary_acc_model.account_number),
                account_type=primary_acc_model.account_type,
                ifsc_code=primary_acc_model.ifsc_code,
                balance=float(primary_acc_model.balance),
                is_primary=primary_acc_model.is_primary,
            )

        linked_accounts_list = [
            BankAccountSummary(
                id=acc.id,
                bank_name=acc.bank_name,
                account_number_masked=cls._mask_account(acc.account_number),
                account_type=acc.account_type,
                ifsc_code=acc.ifsc_code,
                balance=float(acc.balance),
                is_primary=acc.is_primary,
            )
            for acc in accounts
        ]

        # 3. Quick Actions
        quick_actions = [
            QuickActionItem(
                id="scan_pay",
                title="Scan & Pay",
                icon="📷",
                route="/scan",
                aria_label="Scan QR code to pay instantly",
                description="Scan any UPI QR"
            ),
            QuickActionItem(
                id="pay_contact",
                title="Pay Contact",
                icon="👤",
                route="/pay?tab=contact",
                aria_label="Send money to a saved contact or mobile number",
                description="To phone contact"
            ),
            QuickActionItem(
                id="pay_upi",
                title="Pay UPI ID",
                icon="⚡",
                route="/pay?tab=upi",
                aria_label="Pay directly to any UPI VPA ID",
                description="To any UPI handle"
            ),
            QuickActionItem(
                id="request_money",
                title="Request Money",
                icon="📥",
                route="/pay?tab=request",
                aria_label="Request payment from a contact",
                description="Create payment request"
            ),
        ]

        # 4. Recent Transactions (last 5)
        tx_query = db.query(Transaction).filter(
            or_(
                Transaction.sender_user_id == user.id,
                Transaction.receiver_user_id == user.id
            )
        ).order_by(desc(Transaction.created_at)).limit(5).all()

        recent_txs: List[TransactionSummary] = []
        for tx in tx_query:
            is_debit = (tx.sender_user_id == user.id)
            tx_type = "DEBIT" if is_debit else "CREDIT"
            amount_val = float(tx.amount)
            formatted = f"-₹{amount_val:,.2f}" if is_debit else f"+₹{amount_val:,.2f}"
            party = tx.description or ("Sent Payment" if is_debit else "Received Payment")

            recent_txs.append(
                TransactionSummary(
                    id=tx.id,
                    reference_id=tx.reference_id,
                    party_name=party,
                    transaction_type=tx_type,
                    amount=amount_val,
                    formatted_amount=formatted,
                    currency=tx.currency,
                    payment_method=tx.payment_method,
                    status=tx.status,
                    created_at=tx.created_at,
                    description=tx.description
                )
            )

        # 5. Notifications
        notifs = db.query(Notification).filter(
            Notification.user_id == user.id
        ).order_by(desc(Notification.created_at)).limit(5).all()

        unread_count = db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_read == False
        ).count()

        notif_summaries = [
            NotificationSummary(
                id=n.id,
                title=n.title,
                message=n.message,
                notification_type=n.notification_type,
                is_read=n.is_read,
                created_at=n.created_at
            )
            for n in notifs
        ]

        # 6. Accessibility Settings
        pref = db.query(AccessibilityPreference).filter(
            AccessibilityPreference.user_id == user.id
        ).first()

        access_summary = AccessibilitySettingsSummary(
            high_contrast=pref.high_contrast if pref else False,
            font_size_scale=pref.font_size_scale if pref else "medium",
            voice_guidance=pref.voice_guidance if pref else True,
            haptic_feedback=pref.haptic_feedback if pref else True,
            preferred_language=pref.preferred_language if pref else "en"
        )

        # Fallback UPI ID if not set
        upi_handle = user.upi_id or f"{user.phone_number}@oneability"

        return DashboardHomeResponse(
            greeting=greeting,
            user=DashboardUser(
                id=user.id,
                full_name=user.full_name,
                phone_number=user.phone_number,
                email=user.email,
                upi_id=upi_handle
            ),
            balance=DashboardBalance(
                total_balance=total_balance,
                currency="INR",
                currency_symbol="₹",
                formatted_balance=f"₹{total_balance:,.2f}"
            ),
            primary_account=primary_summary,
            linked_accounts_count=len(linked_accounts_list),
            linked_accounts=linked_accounts_list,
            quick_actions=quick_actions,
            recent_transactions=recent_txs,
            notifications=notif_summaries,
            unread_notifications_count=unread_count,
            accessibility=access_summary
        )
