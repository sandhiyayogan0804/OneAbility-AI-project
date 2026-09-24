import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from fastapi import HTTPException, status

from models.user import User
from models.bank_account import BankAccount
from models.beneficiary import Beneficiary
from models.transaction import Transaction
from models.notification import Notification
from models.security import SecurityEvent
from services.dashboard_service import DashboardService
from schemas.payment import (
    BeneficiaryResponse,
    BeneficiaryCreateRequest,
    VerifyRecipientResponse,
    PaymentExecuteRequest,
    PaymentResultResponse,
)
from schemas.transaction import TransactionSummary, TransactionDetailResponse

class PaymentService:

    @classmethod
    def get_or_seed_beneficiaries(cls, db: Session, user: User) -> List[Beneficiary]:
        """Returns saved beneficiaries or seeds realistic starter contacts for demo."""
        beneficiaries = db.query(Beneficiary).filter(
            Beneficiary.user_id == user.id
        ).order_by(desc(Beneficiary.is_favorite), Beneficiary.name).all()

        if not beneficiaries:
            # Seed 4 starter contacts
            sample_contacts = [
                Beneficiary(
                    user_id=user.id,
                    name="Priya Sharma",
                    nickname="Priya",
                    upi_id="priya@okaxis",
                    phone_number="9876543220",
                    is_favorite=True
                ),
                Beneficiary(
                    user_id=user.id,
                    name="Ramesh Kumar",
                    nickname="Ramesh",
                    upi_id="ramesh@paytm",
                    phone_number="9876543221",
                    is_favorite=True
                ),
                Beneficiary(
                    user_id=user.id,
                    name="Ananya Iyer",
                    nickname="Ananya",
                    upi_id="ananya@okhdfcbank",
                    phone_number="9876543222",
                    is_favorite=False
                ),
                Beneficiary(
                    user_id=user.id,
                    name="House Landlord",
                    nickname="Landlord",
                    upi_id="landlord@icici",
                    phone_number="9876543223",
                    is_favorite=False
                ),
            ]
            db.add_all(sample_contacts)
            db.commit()
            beneficiaries = db.query(Beneficiary).filter(Beneficiary.user_id == user.id).all()

        return beneficiaries

    @classmethod
    def add_beneficiary(cls, db: Session, user: User, req: BeneficiaryCreateRequest) -> Beneficiary:
        """Adds a new beneficiary/contact to the user's saved list."""
        ben = Beneficiary(
            user_id=user.id,
            name=req.name.strip(),
            nickname=req.nickname.strip() if req.nickname else None,
            upi_id=req.upi_id.strip() if req.upi_id else None,
            phone_number=req.phone_number.strip() if req.phone_number else None,
            is_favorite=False
        )
        db.add(ben)
        db.commit()
        db.refresh(ben)
        return ben

    @classmethod
    def verify_recipient(cls, identifier: str, recipient_type: str = "UPI_ID") -> VerifyRecipientResponse:
        """Simulates recipient verification check before payment."""
        ident = identifier.strip()
        if "@" in ident:
            # Parse handle
            parts = ident.split("@")
            username = parts[0].replace(".", " ").replace("_", " ").title()
            bank_handle = parts[1].upper() if len(parts) > 1 else "UPI"
            return VerifyRecipientResponse(
                identifier=ident,
                name=username,
                upi_id=ident,
                phone_number=None,
                is_verified=True,
                bank_handle=bank_handle
            )
        else:
            # Phone number lookup
            return VerifyRecipientResponse(
                identifier=ident,
                name=f"Verified Contact ({ident[-4:]})",
                upi_id=f"{ident}@oneability",
                phone_number=ident,
                is_verified=True,
                bank_handle="ONEABILITY"
            )

    @classmethod
    def execute_payment(
        cls,
        db: Session,
        user: User,
        req: PaymentExecuteRequest,
        client_ip: Optional[str] = None
    ) -> PaymentResultResponse:
        """
        Executes a simulated payment flow:
        - Validates bank account & amount
        - Handles simulate_failure flag
        - Generates unique reference ID
        - Deducts balance from bank account
        - Records transaction in MySQL
        - Generates notification and security audit log
        """
        # Ensure user has starter account
        DashboardService.ensure_starter_demo_data(db, user)

        # 1. Fetch user's active primary bank account
        account = db.query(BankAccount).filter(
            BankAccount.user_id == user.id,
            BankAccount.is_active == True
        ).order_by(desc(BankAccount.is_primary)).first()

        if not account:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active bank account found for payment."
            )

        amount_decimal = Decimal(str(round(req.amount, 2)))
        masked_acc = f"•••• {account.account_number[-4:]}"
        ref_id = f"TXN_UPI_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"

        # 2. Case: Explicit failure simulation requested
        if req.simulate_failure:
            failed_tx = Transaction(
                reference_id=ref_id,
                sender_user_id=user.id,
                receiver_user_id=None,
                sender_account_id=account.id,
                amount=amount_decimal,
                currency="INR",
                payment_method="UPI",
                status="FAILED",
                description=f"Payment Failed (Simulated Decline) to {req.recipient_name} ({req.recipient_identifier})"
            )
            db.add(failed_tx)

            notif = Notification(
                user_id=user.id,
                title="Payment Declined",
                message=f"Simulated transaction of ₹{req.amount:,.2f} to {req.recipient_name} was declined.",
                notification_type="TRANSACTION",
                is_read=False
            )
            db.add(notif)

            sec = SecurityEvent(
                user_id=user.id,
                event_type="PAYMENT_SIMULATED_DECLINE",
                ip_address=client_ip,
                status="FAILURE",
                details={"ref": ref_id, "amount": float(amount_decimal), "recipient": req.recipient_identifier}
            )
            db.add(sec)
            db.commit()

            return PaymentResultResponse(
                status="FAILED",
                reference_id=ref_id,
                amount=float(amount_decimal),
                formatted_amount=f"₹{float(amount_decimal):,.2f}",
                currency="INR",
                payment_method="UPI",
                recipient_name=req.recipient_name,
                recipient_identifier=req.recipient_identifier,
                sender_bank=account.bank_name,
                sender_account_masked=masked_acc,
                created_at=failed_tx.created_at,
                message="Payment was declined by the bank simulator (Simulated Failure).",
                remaining_balance=float(account.balance)
            )

        # 3. Case: Insufficient Funds
        if amount_decimal > account.balance:
            failed_tx = Transaction(
                reference_id=ref_id,
                sender_user_id=user.id,
                receiver_user_id=None,
                sender_account_id=account.id,
                amount=amount_decimal,
                currency="INR",
                payment_method="UPI",
                status="FAILED",
                description=f"Payment Failed (Insufficient Balance) to {req.recipient_name}"
            )
            db.add(failed_tx)

            notif = Notification(
                user_id=user.id,
                title="Payment Failed - Insufficient Balance",
                message=f"Attempted payment of ₹{req.amount:,.2f} failed due to insufficient funds in {account.bank_name}.",
                notification_type="TRANSACTION",
                is_read=False
            )
            db.add(notif)
            db.commit()

            return PaymentResultResponse(
                status="FAILED",
                reference_id=ref_id,
                amount=float(amount_decimal),
                formatted_amount=f"₹{float(amount_decimal):,.2f}",
                currency="INR",
                payment_method="UPI",
                recipient_name=req.recipient_name,
                recipient_identifier=req.recipient_identifier,
                sender_bank=account.bank_name,
                sender_account_masked=masked_acc,
                created_at=failed_tx.created_at,
                message=f"Insufficient balance in {account.bank_name}. Available: ₹{float(account.balance):,.2f}",
                remaining_balance=float(account.balance)
            )

        # 4. Case: Successful Payment
        account.balance -= amount_decimal

        note_suffix = f" - {req.description.strip()}" if req.description and req.description.strip() else ""
        desc_text = f"Paid to {req.recipient_name} ({req.recipient_identifier}){note_suffix}"

        success_tx = Transaction(
            reference_id=ref_id,
            sender_user_id=user.id,
            receiver_user_id=None,
            sender_account_id=account.id,
            amount=amount_decimal,
            currency="INR",
            payment_method="UPI",
            status="SUCCESS",
            description=desc_text
        )
        db.add(success_tx)
        db.flush()

        notif = Notification(
            user_id=user.id,
            title="Payment Successful",
            message=f"Paid ₹{req.amount:,.2f} to {req.recipient_name} from {account.bank_name} ({masked_acc}). Ref: {ref_id}",
            notification_type="TRANSACTION",
            is_read=False
        )
        db.add(notif)

        sec = SecurityEvent(
            user_id=user.id,
            event_type="PAYMENT_EXECUTED",
            ip_address=client_ip,
            status="SUCCESS",
            details={
                "ref": ref_id,
                "amount": float(amount_decimal),
                "recipient": req.recipient_identifier,
                "bank": account.bank_name
            }
        )
        db.add(sec)
        db.commit()
        db.refresh(success_tx)

        return PaymentResultResponse(
            status="SUCCESS",
            reference_id=ref_id,
            amount=float(amount_decimal),
            formatted_amount=f"₹{float(amount_decimal):,.2f}",
            currency="INR",
            payment_method="UPI",
            recipient_name=req.recipient_name,
            recipient_identifier=req.recipient_identifier,
            sender_bank=account.bank_name,
            sender_account_masked=masked_acc,
            created_at=success_tx.created_at,
            message="Payment completed successfully via UPI Simulator.",
            remaining_balance=float(account.balance)
        )

    @classmethod
    def get_transaction_history(
        cls,
        db: Session,
        user: User,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        tx_type_filter: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[TransactionSummary]:
        """Returns comprehensive transaction history with search and filtering for the user."""
        tx_query = db.query(Transaction).filter(
            or_(
                Transaction.sender_user_id == user.id,
                Transaction.receiver_user_id == user.id
            )
        )

        # 1. Search Query filter (matches reference_id, description)
        if search and search.strip():
            term = f"%{search.strip()}%"
            tx_query = tx_query.filter(
                or_(
                    Transaction.reference_id.ilike(term),
                    Transaction.description.ilike(term)
                )
            )

        # 2. Status Filter ('SUCCESS', 'FAILED')
        if status_filter and status_filter.upper() in ["SUCCESS", "FAILED"]:
            tx_query = tx_query.filter(Transaction.status == status_filter.upper())

        # 3. Type Filter ('SENT'/'DEBIT' vs 'RECEIVED'/'CREDIT')
        if tx_type_filter:
            upper_type = tx_type_filter.upper()
            if upper_type in ["SENT", "DEBIT"]:
                tx_query = tx_query.filter(Transaction.sender_user_id == user.id)
            elif upper_type in ["RECEIVED", "CREDIT"]:
                tx_query = tx_query.filter(Transaction.receiver_user_id == user.id)

        # 4. Date Range Filters (start_date, end_date format YYYY-MM-DD)
        if start_date and start_date.strip():
            try:
                start_dt = datetime.strptime(start_date.strip(), "%Y-%m-%d")
                tx_query = tx_query.filter(Transaction.created_at >= start_dt)
            except ValueError:
                pass

        if end_date and end_date.strip():
            try:
                end_dt = datetime.strptime(end_date.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                tx_query = tx_query.filter(Transaction.created_at <= end_dt)
            except ValueError:
                pass

        # Sort and paginate
        tx_list = tx_query.order_by(desc(Transaction.created_at)).offset(offset).limit(limit).all()

        history: List[TransactionSummary] = []
        for tx in tx_list:
            is_debit = (tx.sender_user_id == user.id)
            tx_type = "DEBIT" if is_debit else "CREDIT"
            amount_val = float(tx.amount)
            formatted = f"-₹{amount_val:,.2f}" if is_debit else f"+₹{amount_val:,.2f}"
            party = tx.description or ("Sent Payment" if is_debit else "Received Payment")

            history.append(
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

        return history

    @classmethod
    def get_transaction_detail(
        cls,
        db: Session,
        user: User,
        reference_or_id: str
    ) -> TransactionDetailResponse:
        """
        Retrieves complete transaction receipt details with strict authorization:
        User must be the sender or the receiver of the transaction.
        """
        tx = None
        # Try lookup by reference_id first
        tx = db.query(Transaction).filter(Transaction.reference_id == reference_or_id).first()
        if not tx and reference_or_id.isdigit():
            tx = db.query(Transaction).filter(Transaction.id == int(reference_or_id)).first()

        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction '{reference_or_id}' was not found."
            )

        # Authorization check: user must be sender or receiver
        if tx.sender_user_id != user.id and tx.receiver_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have authorization to view this transaction."
            )

        is_debit = (tx.sender_user_id == user.id)
        tx_type = "DEBIT" if is_debit else "CREDIT"
        amount_val = float(tx.amount)
        formatted = f"-₹{amount_val:,.2f}" if is_debit else f"+₹{amount_val:,.2f}"
        party = tx.description or ("Sent Payment" if is_debit else "Received Payment")

        sender_name = tx.sender_user.full_name if tx.sender_user else (user.full_name if is_debit else "Unknown Sender")
        sender_bank = tx.sender_account.bank_name if tx.sender_account else None
        sender_masked = f"•••• {tx.sender_account.account_number[-4:]}" if tx.sender_account else None

        receiver_name = tx.receiver_user.full_name if tx.receiver_user else None
        receiver_bank = tx.receiver_account.bank_name if tx.receiver_account else None
        receiver_masked = f"•••• {tx.receiver_account.account_number[-4:]}" if tx.receiver_account else None

        # Parse simulated receiver from description if external
        if not receiver_name and tx.description and "Paid to " in tx.description:
            try:
                # Format: "Paid to Name (identifier)"
                after_paid = tx.description.split("Paid to ")[1]
                receiver_name = after_paid.split(" (")[0]
            except Exception:
                pass

        return TransactionDetailResponse(
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
            updated_at=tx.updated_at,
            description=tx.description,
            sender_name=sender_name,
            sender_bank_name=sender_bank,
            sender_account_masked=sender_masked,
            receiver_name=receiver_name or "Recipient",
            receiver_bank_name=receiver_bank,
            receiver_account_masked=receiver_masked,
        )
