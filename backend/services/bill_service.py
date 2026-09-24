import re
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from models.user import User
from models.bank_account import BankAccount
from models.transaction import Transaction
from models.notification import Notification
from models.security import SecurityEvent
from models.bill_payment import BillPayment
from services.dashboard_service import DashboardService
from schemas.bill import (
    BillCategory,
    BillerOption,
    BillFetchRequest,
    BillFetchResponse,
    BillPaymentRequest,
    BillPaymentResponse,
)

class BillService:

    CATEGORIES_CATALOG: List[Dict[str, Any]] = [
        {
            "id": "MOBILE_RECHARGE",
            "name": "Mobile Recharge",
            "icon": "📱",
            "description": "Prepaid and postpaid mobile top-ups",
            "billers": [
                {
                    "id": "jio",
                    "name": "Jio Prepaid",
                    "category": "MOBILE_RECHARGE",
                    "icon": "📶",
                    "input_label": "Mobile Number (10 digits)",
                    "input_placeholder": "e.g. 9876543210",
                    "quick_amounts": [299.0, 479.0, 666.0, 719.0, 2999.0],
                    "regex_pattern": r"^[6-9]\d{9}$",
                    "validation_hint": "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9",
                },
                {
                    "id": "airtel",
                    "name": "Airtel Prepaid",
                    "category": "MOBILE_RECHARGE",
                    "icon": "🔴",
                    "input_label": "Mobile Number (10 digits)",
                    "input_placeholder": "e.g. 9840123456",
                    "quick_amounts": [299.0, 549.0, 719.0, 839.0, 2999.0],
                    "regex_pattern": r"^[6-9]\d{9}$",
                    "validation_hint": "Enter a valid 10-digit Indian mobile number",
                },
                {
                    "id": "vi",
                    "name": "Vi (Vodafone Idea)",
                    "category": "MOBILE_RECHARGE",
                    "icon": "🟡",
                    "input_label": "Mobile Number (10 digits)",
                    "input_placeholder": "e.g. 9820123456",
                    "quick_amounts": [299.0, 479.0, 719.0, 1799.0],
                    "regex_pattern": r"^[6-9]\d{9}$",
                    "validation_hint": "Enter a valid 10-digit Indian mobile number",
                },
                {
                    "id": "bsnl",
                    "name": "BSNL Prepaid",
                    "category": "MOBILE_RECHARGE",
                    "icon": "🔵",
                    "input_label": "Mobile Number (10 digits)",
                    "input_placeholder": "e.g. 9444123456",
                    "quick_amounts": [199.0, 397.0, 599.0, 1999.0],
                    "regex_pattern": r"^[6-9]\d{9}$",
                    "validation_hint": "Enter a valid 10-digit Indian mobile number",
                },
            ],
        },
        {
            "id": "DTH",
            "name": "DTH Recharge",
            "icon": "📡",
            "description": "Direct-to-home satellite TV recharge",
            "billers": [
                {
                    "id": "tataplay",
                    "name": "Tata Play",
                    "category": "DTH",
                    "icon": "📺",
                    "input_label": "Subscriber ID / Registered Mobile",
                    "input_placeholder": "e.g. 1009876543",
                    "quick_amounts": [250.0, 350.0, 500.0, 1000.0],
                    "regex_pattern": r"^\d{8,12}$",
                    "validation_hint": "Enter your 10-digit Subscriber ID or Registered Mobile Number",
                },
                {
                    "id": "airtel_dth",
                    "name": "Airtel Digital TV",
                    "category": "DTH",
                    "icon": "📡",
                    "input_label": "Customer ID (10 digits)",
                    "input_placeholder": "e.g. 3009876543",
                    "quick_amounts": [280.0, 450.0, 650.0, 1200.0],
                    "regex_pattern": r"^\d{10}$",
                    "validation_hint": "Enter your 10-digit Customer ID starting with 3",
                },
                {
                    "id": "dishtv",
                    "name": "Dish TV",
                    "category": "DTH",
                    "icon": "🍽️",
                    "input_label": "Viewing Card (VC) / Mobile",
                    "input_placeholder": "e.g. 01598765432",
                    "quick_amounts": [200.0, 350.0, 500.0, 900.0],
                    "regex_pattern": r"^\d{10,12}$",
                    "validation_hint": "Enter 11-digit VC number",
                },
                {
                    "id": "sundirect",
                    "name": "Sun Direct",
                    "category": "DTH",
                    "icon": "☀️",
                    "input_label": "Smart Card Number (11 digits)",
                    "input_placeholder": "e.g. 40012345678",
                    "quick_amounts": [210.0, 320.0, 490.0, 990.0],
                    "regex_pattern": r"^\d{11}$",
                    "validation_hint": "Enter your 11-digit Smart Card Number",
                },
            ],
        },
        {
            "id": "ELECTRICITY",
            "name": "Electricity Bill",
            "icon": "⚡",
            "description": "State electricity distribution boards",
            "billers": [
                {
                    "id": "bescom",
                    "name": "BESCOM - Bengaluru",
                    "category": "ELECTRICITY",
                    "icon": "🏢",
                    "input_label": "Account ID / Consumer Number (10 digits)",
                    "input_placeholder": "e.g. 5421987654",
                    "quick_amounts": [850.0, 1450.0, 2200.0, 3800.0],
                    "regex_pattern": r"^\d{10}$",
                    "validation_hint": "Enter your 10-digit Account ID found on electricity bill",
                },
                {
                    "id": "tneb",
                    "name": "TANGEDCO / TNEB - Tamil Nadu",
                    "category": "ELECTRICITY",
                    "icon": "⚡",
                    "input_label": "Consumer Number (Section-District-Number)",
                    "input_placeholder": "e.g. 04123456789",
                    "quick_amounts": [620.0, 1150.0, 1850.0, 2900.0],
                    "regex_pattern": r"^\d{9,12}$",
                    "validation_hint": "Enter 9 to 12 digit Consumer Number",
                },
                {
                    "id": "bses_rajdhani",
                    "name": "BSES Rajdhani - Delhi",
                    "category": "ELECTRICITY",
                    "icon": "💡",
                    "input_label": "CA Number (9 digits)",
                    "input_placeholder": "e.g. 100987654",
                    "quick_amounts": [750.0, 1350.0, 2600.0],
                    "regex_pattern": r"^\d{9}$",
                    "validation_hint": "Enter your 9-digit CA Number",
                },
                {
                    "id": "adani_electricity",
                    "name": "Adani Electricity - Mumbai",
                    "category": "ELECTRICITY",
                    "icon": "🔌",
                    "input_label": "Consumer Account Number (9 digits)",
                    "input_placeholder": "e.g. 150987654",
                    "quick_amounts": [950.0, 1750.0, 3100.0],
                    "regex_pattern": r"^\d{9}$",
                    "validation_hint": "Enter 9-digit Consumer Account Number",
                },
            ],
        },
        {
            "id": "WATER",
            "name": "Water Bill",
            "icon": "💧",
            "description": "Municipal water supply and sewerage boards",
            "billers": [
                {
                    "id": "djb",
                    "name": "Delhi Jal Board",
                    "category": "WATER",
                    "icon": "🚰",
                    "input_label": "K Number (10 digits)",
                    "input_placeholder": "e.g. 5098765432",
                    "quick_amounts": [320.0, 650.0, 1100.0],
                    "regex_pattern": r"^\d{10}$",
                    "validation_hint": "Enter your 10-digit K Number from your water bill",
                },
                {
                    "id": "bwssb",
                    "name": "BWSSB - Bengaluru",
                    "category": "WATER",
                    "icon": "💧",
                    "input_label": "RR Number (e.g. E123456)",
                    "input_placeholder": "e.g. E987654",
                    "quick_amounts": [280.0, 520.0, 940.0],
                    "regex_pattern": r"^[A-Za-z0-9]{6,10}$",
                    "validation_hint": "Enter your 6-10 character RR Number",
                },
                {
                    "id": "cmwssb",
                    "name": "CMWSSB - Chennai Metro Water",
                    "category": "WATER",
                    "icon": "🌊",
                    "input_label": "Consumer Code (CMC Number)",
                    "input_placeholder": "e.g. 0501234567",
                    "quick_amounts": [250.0, 480.0, 850.0],
                    "regex_pattern": r"^\d{8,12}$",
                    "validation_hint": "Enter your CMC Number from water tax card",
                },
            ],
        },
        {
            "id": "GAS",
            "name": "Piped Gas / LPG",
            "icon": "🔥",
            "description": "Piped natural gas & cylinder booking",
            "billers": [
                {
                    "id": "igl",
                    "name": "Indraprastha Gas (IGL)",
                    "category": "GAS",
                    "icon": "🔥",
                    "input_label": "Business Partner (BP) Number",
                    "input_placeholder": "e.g. 4000987654",
                    "quick_amounts": [550.0, 950.0, 1450.0],
                    "regex_pattern": r"^\d{10}$",
                    "validation_hint": "Enter your 10-digit BP Number",
                },
                {
                    "id": "mgl",
                    "name": "Mahanagar Gas (MGL)",
                    "category": "GAS",
                    "icon": "🍳",
                    "input_label": "Customer Account Number (12 digits)",
                    "input_placeholder": "e.g. 100098765432",
                    "quick_amounts": [620.0, 1100.0, 1600.0],
                    "regex_pattern": r"^\d{12}$",
                    "validation_hint": "Enter your 12-digit Customer Account Number",
                },
                {
                    "id": "adani_gas",
                    "name": "Adani Total Gas",
                    "category": "GAS",
                    "icon": "⛽",
                    "input_label": "Customer ID (10 digits)",
                    "input_placeholder": "e.g. 2000987654",
                    "quick_amounts": [580.0, 1050.0, 1550.0],
                    "regex_pattern": r"^\d{10}$",
                    "validation_hint": "Enter your 10-digit Customer ID",
                },
            ],
        },
        {
            "id": "BROADBAND",
            "name": "Broadband & Landline",
            "icon": "🌐",
            "description": "High-speed home fiber and internet bills",
            "billers": [
                {
                    "id": "airtel_fiber",
                    "name": "Airtel Xstream Fiber",
                    "category": "BROADBAND",
                    "icon": "🔴",
                    "input_label": "DSL ID / Account Number",
                    "input_placeholder": "e.g. 08041234567_dsl",
                    "quick_amounts": [589.0, 943.0, 1179.0, 1769.0],
                    "regex_pattern": r"^[A-Za-z0-9_]{8,20}$",
                    "validation_hint": "Enter your DSL ID or Fixedline Number with STD code",
                },
                {
                    "id": "jiofiber",
                    "name": "JioFiber",
                    "category": "BROADBAND",
                    "icon": "📶",
                    "input_label": "JioFiber Number (10 digits)",
                    "input_placeholder": "e.g. 9876543210",
                    "quick_amounts": [470.0, 825.0, 1179.0, 1769.0],
                    "regex_pattern": r"^\d{10}$",
                    "validation_hint": "Enter your 10-digit JioFiber Service ID",
                },
                {
                    "id": "act",
                    "name": "ACT Fibernet",
                    "category": "BROADBAND",
                    "icon": "🚀",
                    "input_label": "ACT User ID / Account Number",
                    "input_placeholder": "e.g. 10987654321",
                    "quick_amounts": [649.0, 943.0, 1299.0],
                    "regex_pattern": r"^[A-Za-z0-9]{8,15}$",
                    "validation_hint": "Enter your ACT User Account Number",
                },
            ],
        },
        {
            "id": "FASTAG",
            "name": "FASTag Recharge",
            "icon": "🚗",
            "description": "National highway toll tag top-up",
            "billers": [
                {
                    "id": "sbi_fastag",
                    "name": "SBI FASTag",
                    "category": "FASTAG",
                    "icon": "🏦",
                    "input_label": "Vehicle Registration Number",
                    "input_placeholder": "e.g. KA01AB1234",
                    "quick_amounts": [500.0, 1000.0, 2000.0, 5000.0],
                    "regex_pattern": r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$",
                    "validation_hint": "Enter valid vehicle number without spaces (e.g. KA01AB1234 or TN09CD5678)",
                },
                {
                    "id": "icici_fastag",
                    "name": "ICICI Bank FASTag",
                    "category": "FASTAG",
                    "icon": "🚗",
                    "input_label": "Vehicle Registration Number",
                    "input_placeholder": "e.g. MH02CD5678",
                    "quick_amounts": [500.0, 1000.0, 2000.0],
                    "regex_pattern": r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$",
                    "validation_hint": "Enter valid vehicle number without spaces",
                },
                {
                    "id": "hdfc_fastag",
                    "name": "HDFC Bank FASTag",
                    "category": "FASTAG",
                    "icon": "💳",
                    "input_label": "Vehicle Registration Number",
                    "input_placeholder": "e.g. DL01EF9999",
                    "quick_amounts": [500.0, 1000.0, 2500.0],
                    "regex_pattern": r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$",
                    "validation_hint": "Enter valid vehicle number without spaces",
                },
            ],
        },
        {
            "id": "CREDIT_CARD",
            "name": "Credit Card Bill",
            "icon": "💳",
            "description": "Visa, Mastercard & RuPay credit card dues",
            "billers": [
                {
                    "id": "hdfc_cc",
                    "name": "HDFC Bank Credit Card",
                    "category": "CREDIT_CARD",
                    "icon": "💳",
                    "input_label": "Credit Card Number (16 digits)",
                    "input_placeholder": "e.g. 4111222233334444",
                    "quick_amounts": [2500.0, 5000.0, 12500.0, 25000.0],
                    "regex_pattern": r"^\d{16}$",
                    "validation_hint": "Enter your 16-digit Credit Card Number",
                },
                {
                    "id": "sbi_cc",
                    "name": "SBI Card",
                    "category": "CREDIT_CARD",
                    "icon": "💳",
                    "input_label": "Card Number (16 digits)",
                    "input_placeholder": "e.g. 5241222233334444",
                    "quick_amounts": [2000.0, 4500.0, 10000.0],
                    "regex_pattern": r"^\d{16}$",
                    "validation_hint": "Enter your 16-digit SBI Card Number",
                },
                {
                    "id": "icici_cc",
                    "name": "ICICI Bank Credit Card",
                    "category": "CREDIT_CARD",
                    "icon": "💳",
                    "input_label": "Card Number (16 digits)",
                    "input_placeholder": "e.g. 4315222233334444",
                    "quick_amounts": [3000.0, 7500.0, 15000.0],
                    "regex_pattern": r"^\d{16}$",
                    "validation_hint": "Enter your 16-digit Card Number",
                },
            ],
        },
        {
            "id": "INSURANCE",
            "name": "Insurance Premium",
            "icon": "🛡️",
            "description": "Life, health & vehicle insurance policies",
            "billers": [
                {
                    "id": "lic",
                    "name": "LIC of India",
                    "category": "INSURANCE",
                    "icon": "🏛️",
                    "input_label": "Policy Number (9 digits)",
                    "input_placeholder": "e.g. 845123456",
                    "quick_amounts": [2450.0, 6800.0, 14200.0],
                    "regex_pattern": r"^\d{9}$",
                    "validation_hint": "Enter your 9-digit LIC Policy Number",
                },
                {
                    "id": "hdfc_life",
                    "name": "HDFC Life Insurance",
                    "category": "INSURANCE",
                    "icon": "🛡️",
                    "input_label": "Policy Number (8 digits)",
                    "input_placeholder": "e.g. 21987654",
                    "quick_amounts": [3500.0, 8900.0, 18500.0],
                    "regex_pattern": r"^\d{8}$",
                    "validation_hint": "Enter your 8-digit Policy Number",
                },
                {
                    "id": "star_health",
                    "name": "Star Health Insurance",
                    "category": "INSURANCE",
                    "icon": "🏥",
                    "input_label": "Policy Number (16 characters)",
                    "input_placeholder": "e.g. P/123456/01/2026",
                    "quick_amounts": [5500.0, 12000.0, 24000.0],
                    "regex_pattern": r"^[A-Za-z0-9/]{10,20}$",
                    "validation_hint": "Enter your Star Health Policy Number",
                },
            ],
        },
        {
            "id": "LOAN_EMI",
            "name": "Loan / EMI Repayment",
            "icon": "💰",
            "description": "Personal, home, vehicle & consumer loan EMIs",
            "billers": [
                {
                    "id": "bajaj_finance",
                    "name": "Bajaj Finance Limited",
                    "category": "LOAN_EMI",
                    "icon": "🏦",
                    "input_label": "Loan Account Number (LAN)",
                    "input_placeholder": "e.g. 400LAN987654",
                    "quick_amounts": [2500.0, 4850.0, 8950.0, 15000.0],
                    "regex_pattern": r"^[A-Za-z0-9]{8,18}$",
                    "validation_hint": "Enter your Loan Account Number (LAN)",
                },
                {
                    "id": "hdfc_loan",
                    "name": "HDFC Bank Retail Loan",
                    "category": "LOAN_EMI",
                    "icon": "🏠",
                    "input_label": "Loan Agreement Number",
                    "input_placeholder": "e.g. 60098765432",
                    "quick_amounts": [5000.0, 12500.0, 25000.0],
                    "regex_pattern": r"^\d{8,16}$",
                    "validation_hint": "Enter your Loan Agreement Number",
                },
                {
                    "id": "tata_capital",
                    "name": "Tata Capital Financial Services",
                    "category": "LOAN_EMI",
                    "icon": "💼",
                    "input_label": "Loan Account Number",
                    "input_placeholder": "e.g. TC987654321",
                    "quick_amounts": [3200.0, 6800.0, 14000.0],
                    "regex_pattern": r"^[A-Za-z0-9]{8,16}$",
                    "validation_hint": "Enter your Tata Capital Loan Number",
                },
            ],
        },
    ]

    @classmethod
    def get_categories(cls) -> List[BillCategory]:
        """Returns all 10 bill payment categories with providers."""
        return [BillCategory(**cat) for cat in cls.CATEGORIES_CATALOG]

    @classmethod
    def get_category_by_id(cls, category_id: str) -> Optional[BillCategory]:
        for cat in cls.CATEGORIES_CATALOG:
            if cat["id"] == category_id:
                return BillCategory(**cat)
        return None

    @classmethod
    def find_biller(cls, category_id: str, biller_id: str) -> Optional[BillerOption]:
        cat = cls.get_category_by_id(category_id)
        if not cat:
            return None
        for b in cat.billers:
            if b.id == biller_id:
                return b
        return None

    @classmethod
    def fetch_bill_details(cls, db: Session, user: User, req: BillFetchRequest) -> BillFetchResponse:
        """Simulates bill fetch for a customer/account number."""
        biller = cls.find_biller(req.category, req.biller_id)
        if not biller:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Biller '{req.biller_id}' not found under category '{req.category}'."
            )

        account_num = req.account_number.strip().upper()

        # Validate format if regex exists
        if biller.regex_pattern and not re.match(biller.regex_pattern, account_num):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=biller.validation_hint or f"Invalid format for {biller.input_label}."
            )

        # Generate realistic simulated bill data
        consumer_name = user.full_name or "Alex Johnson"
        due_date = (datetime.now() + timedelta(days=7)).strftime("%d %b %Y")
        bill_period = (datetime.now() - timedelta(days=30)).strftime("%b %Y")

        # Amount determination based on category
        if req.category == "MOBILE_RECHARGE":
            # For mobile recharge, plans are chosen by user
            bill_amt = None
            is_editable = True
        elif req.category == "DTH":
            bill_amt = 350.0
            is_editable = True
        elif req.category == "ELECTRICITY":
            bill_amt = 1450.0
            is_editable = False
        elif req.category == "WATER":
            bill_amt = 520.0
            is_editable = False
        elif req.category == "GAS":
            bill_amt = 850.0
            is_editable = False
        elif req.category == "BROADBAND":
            bill_amt = 943.0
            is_editable = False
        elif req.category == "FASTAG":
            bill_amt = 500.0
            is_editable = True
        elif req.category == "CREDIT_CARD":
            bill_amt = 4850.0
            is_editable = True
        elif req.category == "INSURANCE":
            bill_amt = 6800.0
            is_editable = False
        elif req.category == "LOAN_EMI":
            bill_amt = 8950.0
            is_editable = False
        else:
            bill_amt = 500.0
            is_editable = True

        return BillFetchResponse(
            category=req.category,
            biller_id=biller.id,
            biller_name=biller.name,
            account_number=account_num,
            consumer_name=consumer_name,
            bill_amount=bill_amt,
            due_date=due_date,
            bill_period=bill_period,
            is_amount_editable=is_editable,
            metadata={
                "provider_icon": biller.icon,
                "input_label": biller.input_label,
                "quick_amounts": biller.quick_amounts,
            },
        )

    @classmethod
    def execute_bill_payment(
        cls,
        db: Session,
        user: User,
        req: BillPaymentRequest,
        client_ip: Optional[str] = None
    ) -> BillPaymentResponse:
        """
        Executes a simulated bill payment:
        - Validates biller and required fields
        - Checks primary bank account & balance
        - Handles simulate_failure flag
        - Generates unique reference ID (TXN_BILL_...)
        - On success: deducts balance, records Transaction (payment_method='BILL_PAY'), records BillPayment
        - On failure: leaves balance unchanged, records failed records
        - Never processes or handles UPI PIN
        """
        # Ensure demo bank account
        DashboardService.ensure_starter_demo_data(db, user)

        # 1. Fetch user's active primary bank account
        account = db.query(BankAccount).filter(
            BankAccount.user_id == user.id,
            BankAccount.is_active == True
        ).order_by(desc(BankAccount.is_primary)).first()

        if not account:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active primary bank account found for bill payment."
            )

        biller = cls.find_biller(req.category, req.biller_id)
        biller_name = biller.name if biller else req.biller_name
        account_num = req.account_number.strip().upper()

        # Validate format if pattern exists
        if biller and biller.regex_pattern and not re.match(biller.regex_pattern, account_num):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=biller.validation_hint or f"Invalid format for {biller.input_label}."
            )

        amount_decimal = Decimal(str(round(req.amount, 2)))
        fee_decimal = Decimal(str(round(req.convenience_fee, 2)))
        total_decimal = amount_decimal + fee_decimal
        masked_acc = f"•••• {account.account_number[-4:]}"
        ref_id = f"TXN_BILL_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"

        # 2. Case: Simulated Failure
        if req.simulate_failure:
            failed_tx = Transaction(
                reference_id=ref_id,
                sender_user_id=user.id,
                receiver_user_id=None,
                sender_account_id=account.id,
                amount=total_decimal,
                currency="INR",
                payment_method="BILL_PAY",
                status="FAILED",
                description=f"Bill Payment Declined (Simulated): {biller_name} ({account_num})"
            )
            db.add(failed_tx)

            bill_rec = BillPayment(
                reference_id=ref_id,
                user_id=user.id,
                category=req.category,
                biller_id=req.biller_id,
                biller_name=biller_name,
                account_number=account_num,
                account_holder_name=req.consumer_name or user.full_name,
                amount=amount_decimal,
                convenience_fee=fee_decimal,
                total_amount=total_decimal,
                debit_account_id=account.id,
                payment_method="UPI",
                status="FAILED",
                transaction_id=None,
                bill_details=req.bill_metadata or {},
            )
            db.add(bill_rec)

            notif = Notification(
                user_id=user.id,
                title="Bill Payment Declined",
                message=f"Simulated bill payment of ₹{total_decimal:,.2f} to {biller_name} failed.",
                notification_type="BILL_PAYMENT",
                is_read=False
            )
            db.add(notif)

            sec = SecurityEvent(
                user_id=user.id,
                event_type="BILL_PAYMENT_SIMULATED_DECLINE",
                ip_address=client_ip,
                status="FAILURE",
                details={"ref": ref_id, "category": req.category, "biller": biller_name, "amount": float(total_decimal)}
            )
            db.add(sec)
            db.commit()
            db.refresh(bill_rec)

            return BillPaymentResponse(
                id=bill_rec.id,
                reference_id=ref_id,
                category=req.category,
                biller_id=req.biller_id,
                biller_name=biller_name,
                account_number=account_num,
                consumer_name=req.consumer_name or user.full_name,
                amount=float(amount_decimal),
                convenience_fee=float(fee_decimal),
                total_amount=float(total_decimal),
                formatted_total=f"₹{float(total_decimal):,.2f}",
                status="FAILED",
                message="Bill payment was declined by the simulated biller gateway.",
                transaction_reference_id=ref_id,
                debit_bank=account.bank_name,
                debit_account_masked=masked_acc,
                remaining_balance=float(account.balance),
                created_at=bill_rec.created_at,
                bill_details=bill_rec.bill_details,
            )

        # 3. Case: Insufficient Funds
        if total_decimal > account.balance:
            failed_tx = Transaction(
                reference_id=ref_id,
                sender_user_id=user.id,
                receiver_user_id=None,
                sender_account_id=account.id,
                amount=total_decimal,
                currency="INR",
                payment_method="BILL_PAY",
                status="FAILED",
                description=f"Bill Payment Failed (Insufficient Balance): {biller_name} ({account_num})"
            )
            db.add(failed_tx)

            bill_rec = BillPayment(
                reference_id=ref_id,
                user_id=user.id,
                category=req.category,
                biller_id=req.biller_id,
                biller_name=biller_name,
                account_number=account_num,
                account_holder_name=req.consumer_name or user.full_name,
                amount=amount_decimal,
                convenience_fee=fee_decimal,
                total_amount=total_decimal,
                debit_account_id=account.id,
                payment_method="UPI",
                status="FAILED",
                transaction_id=None,
                bill_details={"error": "INSUFFICIENT_FUNDS"},
            )
            db.add(bill_rec)

            notif = Notification(
                user_id=user.id,
                title="Bill Payment Failed - Insufficient Balance",
                message=f"Attempted bill payment of ₹{total_decimal:,.2f} for {biller_name} failed due to insufficient funds.",
                notification_type="BILL_PAYMENT",
                is_read=False
            )
            db.add(notif)
            db.commit()
            db.refresh(bill_rec)

            return BillPaymentResponse(
                id=bill_rec.id,
                reference_id=ref_id,
                category=req.category,
                biller_id=req.biller_id,
                biller_name=biller_name,
                account_number=account_num,
                consumer_name=req.consumer_name or user.full_name,
                amount=float(amount_decimal),
                convenience_fee=float(fee_decimal),
                total_amount=float(total_decimal),
                formatted_total=f"₹{float(total_decimal):,.2f}",
                status="FAILED",
                message=f"Insufficient balance in {account.bank_name}. Available: ₹{float(account.balance):,.2f}",
                transaction_reference_id=ref_id,
                debit_bank=account.bank_name,
                debit_account_masked=masked_acc,
                remaining_balance=float(account.balance),
                created_at=bill_rec.created_at,
                bill_details=bill_rec.bill_details,
            )

        # 4. Case: Successful Bill Payment
        account.balance -= total_decimal

        succ_tx = Transaction(
            reference_id=ref_id,
            sender_user_id=user.id,
            receiver_user_id=None,
            sender_account_id=account.id,
            amount=total_decimal,
            currency="INR",
            payment_method="BILL_PAY",
            status="SUCCESS",
            description=f"Bill Payment: {biller_name} - {req.category.replace('_', ' ').title()} ({account_num})"
        )
        db.add(succ_tx)
        db.flush()

        bill_rec = BillPayment(
            reference_id=ref_id,
            user_id=user.id,
            category=req.category,
            biller_id=req.biller_id,
            biller_name=biller_name,
            account_number=account_num,
            account_holder_name=req.consumer_name or user.full_name,
            amount=amount_decimal,
            convenience_fee=fee_decimal,
            total_amount=total_decimal,
            debit_account_id=account.id,
            payment_method="UPI",
            status="SUCCESS",
            transaction_id=succ_tx.id,
            bill_details=req.bill_metadata or {"payment_channel": "OneAbility Simulated Rails"},
        )
        db.add(bill_rec)

        notif = Notification(
            user_id=user.id,
            title="Bill Payment Successful",
            message=f"Successfully paid ₹{total_decimal:,.2f} for {biller_name} ({account_num}). Ref: {ref_id}",
            notification_type="BILL_PAYMENT",
            is_read=False
        )
        db.add(notif)

        sec = SecurityEvent(
            user_id=user.id,
            event_type="BILL_PAYMENT_SUCCESS",
            ip_address=client_ip,
            status="SUCCESS",
            details={
                "ref": ref_id,
                "category": req.category,
                "biller": biller_name,
                "amount": float(total_decimal),
                "account_number": account_num,
            }
        )
        db.add(sec)
        db.commit()
        db.refresh(bill_rec)

        return BillPaymentResponse(
            id=bill_rec.id,
            reference_id=ref_id,
            category=req.category,
            biller_id=req.biller_id,
            biller_name=biller_name,
            account_number=account_num,
            consumer_name=req.consumer_name or user.full_name,
            amount=float(amount_decimal),
            convenience_fee=float(fee_decimal),
            total_amount=float(total_decimal),
            formatted_total=f"₹{float(total_decimal):,.2f}",
            status="SUCCESS",
            message=f"Bill payment of ₹{float(total_decimal):,.2f} to {biller_name} completed successfully.",
            transaction_reference_id=ref_id,
            debit_bank=account.bank_name,
            debit_account_masked=masked_acc,
            remaining_balance=float(account.balance),
            created_at=bill_rec.created_at,
            bill_details=bill_rec.bill_details,
        )

    @classmethod
    def get_user_bill_history(cls, db: Session, user: User, limit: int = 30) -> List[BillPaymentResponse]:
        """Returns recent bill payments for the authenticated user."""
        records = db.query(BillPayment).filter(
            BillPayment.user_id == user.id
        ).order_by(desc(BillPayment.created_at)).limit(limit).all()

        results = []
        for r in records:
            bank_name = r.debit_account.bank_name if r.debit_account else "State Bank of India"
            masked = f"•••• {r.debit_account.account_number[-4:]}" if r.debit_account else "•••• 4821"
            results.append(
                BillPaymentResponse(
                    id=r.id,
                    reference_id=r.reference_id,
                    category=r.category,
                    biller_id=r.biller_id,
                    biller_name=r.biller_name,
                    account_number=r.account_number,
                    consumer_name=r.account_holder_name,
                    amount=float(r.amount),
                    convenience_fee=float(r.convenience_fee),
                    total_amount=float(r.total_amount),
                    formatted_total=f"₹{float(r.total_amount):,.2f}",
                    status=r.status,
                    message=f"Bill payment to {r.biller_name} ({r.status})",
                    transaction_reference_id=r.reference_id,
                    debit_bank=bank_name,
                    debit_account_masked=masked,
                    remaining_balance=float(r.debit_account.balance) if r.debit_account else 0.0,
                    created_at=r.created_at,
                    bill_details=r.bill_details,
                )
            )
        return results
