import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc

from models.user import User
from models.bank_account import BankAccount
from models.beneficiary import Beneficiary
from models.transaction import Transaction
from models.security import SecurityEvent
from models.notification import Notification
from schemas.safety import PaymentSafetyCheckRequest, PaymentSafetyCheckResponse

# Suspicious words often found in UPI phishing/scams
SCAM_KEYWORDS = [
    "lottery", "prize", "reward", "cashback", "win", "winner",
    "refund", "kyc", "banksupport", "customercare", "helpdesk",
    "police", "claim", "bonus", "telecom", "giftcard", "airtel-support",
    "jio-support", "sbi-support", "hdfc-support", "icici-support"
]

class PaymentSafetyService:

    @classmethod
    def check_payment_safety(
        cls,
        db: Session,
        user: User,
        req: PaymentSafetyCheckRequest,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> PaymentSafetyCheckResponse:
        """
        Evaluates risk factors before payment execution.
        Strictly READ-ONLY: Never executes payments or mutates balances.
        Logs security event for audit.
        """
        flags: List[str] = []
        safety_tips: List[str] = []
        details: Dict[str, Any] = {}
        risk_score: float = 0.05  # Base minimum risk

        amount = req.amount
        ident = req.recipient_identifier.strip()
        recipient_name = (req.recipient_name or "").strip()

        # 1. Amount Validation & Limits
        if amount <= 0:
            flags.append("INVALID_AMOUNT")
            risk_score = 1.0
            return cls._finalize_response(
                db=db, user=user, req=req,
                risk_level="CRITICAL", risk_score=risk_score,
                flags=flags, action="BLOCK", is_safe=False, strong_confirm=False,
                title="Invalid Amount",
                message="Transfer amount must be greater than ₹0.00.",
                tips=["Please enter a positive payment amount."],
                details={"amount": amount}, client_ip=client_ip, user_agent=user_agent
            )

        if amount > 50000.0:
            flags.append("LIMIT_EXCEEDED")
            risk_score = 1.0
            return cls._finalize_response(
                db=db, user=user, req=req,
                risk_level="CRITICAL", risk_score=risk_score,
                flags=flags, action="BLOCK", is_safe=False, strong_confirm=False,
                title="Transfer Limit Exceeded",
                message="Amount exceeds the maximum single UPI transfer limit of ₹50,000.00.",
                tips=["Split into smaller transfers or use net banking for large transfers."],
                details={"amount": amount, "max_limit": 50000.0},
                client_ip=client_ip, user_agent=user_agent
            )

        # 2. Check Insufficient Balance against Primary Bank Account
        primary_account = db.query(BankAccount).filter(
            BankAccount.user_id == user.id,
            BankAccount.is_primary == True
        ).first()

        if not primary_account:
            primary_account = db.query(BankAccount).filter(
                BankAccount.user_id == user.id
            ).first()

        available_balance = float(primary_account.balance) if primary_account else 0.0
        details["available_balance"] = available_balance

        if primary_account and Decimal(str(amount)) > primary_account.balance:
            flags.append("INSUFFICIENT_BALANCE")
            risk_score = 1.0
            return cls._finalize_response(
                db=db, user=user, req=req,
                risk_level="CRITICAL", risk_score=risk_score,
                flags=flags, action="BLOCK", is_safe=False, strong_confirm=False,
                title="Insufficient Balance",
                message=f"Your account balance is ₹{available_balance:,.2f}, which is less than the requested amount of ₹{amount:,.2f}.",
                tips=["Ensure sufficient funds or link another bank account before proceeding."],
                details=details, client_ip=client_ip, user_agent=user_agent
            )

        # 3. Recipient Format Validation
        is_upi = bool(re.match(r'^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$', ident))
        is_phone = bool(re.match(r'^[6-9]\d{9}$', ident))

        if not is_upi and not is_phone:
            flags.append("INVALID_RECIPIENT")
            risk_score = 1.0
            return cls._finalize_response(
                db=db, user=user, req=req,
                risk_level="CRITICAL", risk_score=risk_score,
                flags=flags, action="BLOCK", is_safe=False, strong_confirm=False,
                title="Invalid Recipient Format",
                message="Recipient must be a valid 10-digit mobile number or standard UPI VPA (e.g., name@bank).",
                tips=["Check the UPI ID or mobile number for typos."],
                details={"recipient_identifier": ident}, client_ip=client_ip, user_agent=user_agent
            )

        # 4. Check Suspicious QR / UPI Identifier (Scam / Phishing signals)
        ident_lower = ident.lower()
        matched_scam_keywords = [kw for kw in SCAM_KEYWORDS if kw in ident_lower]
        if matched_scam_keywords:
            flags.append("SUSPICIOUS_IDENTIFIER")
            risk_score = max(risk_score, 0.85)
            safety_tips.append("Legitimate institutions and banks NEVER request money to claim rewards, lotteries, or KYC updates.")
            details["matched_scam_keywords"] = matched_scam_keywords

        # 5. Check New Recipient / New Beneficiary
        # Check in user's saved beneficiaries
        saved_beneficiary = db.query(Beneficiary).filter(
            Beneficiary.user_id == user.id,
            or_(
                Beneficiary.upi_id == ident,
                Beneficiary.phone_number == ident
            )
        ).first()

        # Check in user's previous transaction history
        previous_tx = db.query(Transaction).filter(
            Transaction.sender_user_id == user.id,
            Transaction.status == "SUCCESS",
            Transaction.description.like(f"%{ident}%")
        ).first()

        is_new_recipient = (saved_beneficiary is None and previous_tx is None)
        details["is_saved_contact"] = bool(saved_beneficiary)
        details["has_previous_transactions"] = bool(previous_tx)

        if is_new_recipient:
            flags.append("NEW_RECIPIENT")
            risk_score = max(risk_score, 0.35)
            safety_tips.append("This is the first time you are sending money to this recipient. Double-check recipient name and handle.")

        # 6. Check High / Unusual Amount
        if amount >= 10000.0:
            flags.append("HIGH_AMOUNT")
            risk_score = max(risk_score, 0.50 if not is_new_recipient else 0.75)
            safety_tips.append(f"₹{amount:,.2f} is a high-value transfer. Ensure you personally know the recipient.")
            details["is_high_amount"] = True

        # 7. Check Duplicate / Repeated Payment (within 5 minutes)
        # 5 minutes window
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        duplicate_tx = db.query(Transaction).filter(
            Transaction.sender_user_id == user.id,
            Transaction.status == "SUCCESS",
            Transaction.amount == Decimal(str(amount)),
            Transaction.description.like(f"%{ident}%"),
            Transaction.created_at >= cutoff_time
        ).order_by(desc(Transaction.created_at)).first()

        if duplicate_tx:
            flags.append("DUPLICATE_PAYMENT_SUSPECTED")
            risk_score = max(risk_score, 0.70)
            safety_tips.append(f"A payment of ₹{amount:,.2f} was already sent to this recipient recently. Verify before confirming.")
            details["duplicate_reference_id"] = duplicate_tx.reference_id

        # 8. Ambiguous Recipient Name
        if not recipient_name or recipient_name.lower() in ["user", "unknown", "someone", "recipient"]:
            flags.append("AMBIGUOUS_RECIPIENT")
            risk_score = max(risk_score, 0.30)
            details["is_ambiguous"] = True

        # 9. Determine Overall Risk Level and Action
        if "SUSPICIOUS_IDENTIFIER" in flags:
            risk_level = "HIGH"
            action = "CONFIRM_WITH_WARNING"
            requires_strong = True
            title = "⚠️ Potential Scam Warning"
            message = (
                f"The recipient identifier '{ident}' contains suspicious keywords ({', '.join(matched_scam_keywords)}). "
                "Scammers often promise lottery winnings, gifts, or KYC reactivations. Never pay to receive money!"
            )
        elif "DUPLICATE_PAYMENT_SUSPECTED" in flags:
            risk_level = "HIGH"
            action = "CONFIRM_WITH_WARNING"
            requires_strong = True
            title = "⚠️ Repeated Payment Detected"
            message = (
                f"You already completed a transfer of ₹{amount:,.2f} to {ident} within the last 5 minutes. "
                "Confirming again might result in an unintended duplicate charge."
            )
        elif "NEW_RECIPIENT" in flags and "HIGH_AMOUNT" in flags:
            risk_level = "HIGH"
            action = "CONFIRM_WITH_WARNING"
            requires_strong = True
            title = "⚠️ High-Value First-Time Payment"
            message = (
                f"You are transferring a high amount of ₹{amount:,.2f} to a new recipient '{recipient_name or ident}' "
                "for the first time. Please verify carefully."
            )
        elif "NEW_RECIPIENT" in flags:
            risk_level = "MEDIUM"
            action = "CONFIRM_WITH_WARNING"
            requires_strong = True
            title = "Notice: New Recipient"
            message = f"'{recipient_name or ident}' is not in your saved contacts and you have not sent money to them before."
        elif "HIGH_AMOUNT" in flags:
            risk_level = "MEDIUM"
            action = "CONFIRM_WITH_WARNING"
            requires_strong = True
            title = "Notice: High Transfer Amount"
            message = f"You are sending ₹{amount:,.2f}. Please confirm this amount is accurate."
        else:
            risk_level = "LOW"
            action = "ALLOW"
            requires_strong = False
            title = "Verified Safe Transfer"
            message = f"Recipient is verified and transfer parameters are within normal limits."
            safety_tips.append("Everything looks good. You can review and confirm payment.")

        return cls._finalize_response(
            db=db, user=user, req=req,
            risk_level=risk_level, risk_score=round(risk_score, 2),
            flags=flags, action=action, is_safe=True, strong_confirm=requires_strong,
            title=title, message=message, tips=safety_tips, details=details,
            client_ip=client_ip, user_agent=user_agent
        )

    @classmethod
    def _finalize_response(
        cls,
        db: Session,
        user: User,
        req: PaymentSafetyCheckRequest,
        risk_level: str,
        risk_score: float,
        flags: List[str],
        action: str,
        is_safe: bool,
        strong_confirm: bool,
        title: str,
        message: str,
        tips: List[str],
        details: Dict[str, Any],
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> PaymentSafetyCheckResponse:
        """Helper to log security event in MySQL and return response."""
        # Log to security_events table for auditing (technical audit log)
        event_status = "SUCCESS" if risk_level == "LOW" else ("FAILURE" if risk_level == "CRITICAL" else "WARNING")
        try:
            sec_event = SecurityEvent(
                user_id=user.id,
                event_type="PAYMENT_SAFETY_CHECK",
                ip_address=client_ip or "127.0.0.1",
                user_agent=user_agent or "OneAbility-Client",
                status=event_status,
                details={
                    "risk_level": risk_level,
                    "risk_score": risk_score,
                    "risk_flags": flags,
                    "amount": req.amount,
                    "recipient_identifier": req.recipient_identifier,
                    "source": req.source,
                    "action": action
                }
            )
            db.add(sec_event)

            # If risk is critical or high, record an in-app user notification for safety warning
            if risk_level in ["CRITICAL", "HIGH"]:
                notif = Notification(
                    user_id=user.id,
                    title=f"AI Safety Warning: {title}",
                    message=f"Risk detected for transfer of ₹{req.amount:,.2f} to {req.recipient_identifier}. {message}",
                    notification_type="SAFETY_WARNING",
                    is_read=False
                )
                db.add(notif)

            db.commit()
        except Exception as e:
            db.rollback()
            # Do not block response if logging fails
            print(f"Warning: Failed to log safety audit or notification: {e}")

        return PaymentSafetyCheckResponse(
            risk_level=risk_level,
            risk_score=risk_score,
            risk_flags=flags,
            is_safe_to_proceed=is_safe,
            requires_strong_confirmation=strong_confirm,
            recommended_action=action,
            warning_title=title,
            warning_message=message,
            safety_tips=tips,
            details=details
        )
