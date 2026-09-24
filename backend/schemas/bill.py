from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any, Dict
from datetime import datetime
from decimal import Decimal

class BillerOption(BaseModel):
    id: str
    name: str
    category: str
    icon: str
    input_label: str
    input_placeholder: str
    quick_amounts: List[float] = Field(default_factory=list)
    regex_pattern: Optional[str] = None
    validation_hint: Optional[str] = None

class BillCategory(BaseModel):
    id: str
    name: str
    icon: str
    description: str
    billers: List[BillerOption]

class BillFetchRequest(BaseModel):
    category: str = Field(..., description="Bill category e.g. MOBILE_RECHARGE, ELECTRICITY")
    biller_id: str = Field(..., description="Biller ID e.g. jio, bescom")
    account_number: str = Field(..., min_length=2, max_length=50, description="Customer account / mobile number")

class BillFetchResponse(BaseModel):
    category: str
    biller_id: str
    biller_name: str
    account_number: str
    consumer_name: str
    bill_amount: Optional[float] = None
    due_date: Optional[str] = None
    bill_period: Optional[str] = None
    is_amount_editable: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)

class BillPaymentRequest(BaseModel):
    category: str = Field(..., description="Category: MOBILE_RECHARGE, DTH, ELECTRICITY, WATER, GAS, BROADBAND, FASTAG, CREDIT_CARD, INSURANCE, LOAN_EMI")
    biller_id: str
    biller_name: str
    account_number: str = Field(..., min_length=2, max_length=50)
    consumer_name: Optional[str] = None
    amount: float = Field(..., gt=0, description="Payment amount must be greater than zero")
    convenience_fee: float = Field(default=0.0, ge=0)
    simulate_failure: bool = False
    payment_method: str = "UPI"
    bill_metadata: Optional[Dict[str, Any]] = None

    @field_validator("amount")
    @classmethod
    def validate_positive_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        if v > 100000:
            raise ValueError("Maximum bill payment limit is ₹1,00,000")
        return round(v, 2)

class BillPaymentResponse(BaseModel):
    id: int
    reference_id: str
    category: str
    biller_id: str
    biller_name: str
    account_number: str
    consumer_name: Optional[str] = None
    amount: float
    convenience_fee: float = 0.0
    total_amount: float
    formatted_total: str
    status: str  # SUCCESS, FAILED
    message: str
    transaction_reference_id: Optional[str] = None
    debit_bank: str
    debit_account_masked: str
    remaining_balance: float
    created_at: datetime
    bill_details: Optional[Dict[str, Any]] = None

# Category Specific Detail Models
class MobileRechargeDetail(BaseModel):
    mobile_number: str
    operator: str
    circle: str = "National"
    plan_validity: str
    data_allowance: str
    talktime: str

class DTHRechargeDetail(BaseModel):
    subscriber_id: str
    operator: str
    current_pack: str
    monthly_rental: float

class ElectricityBillDetail(BaseModel):
    consumer_number: str
    board_name: str
    sub_division: str
    meter_number: str
    units_consumed: int
    due_date: str

class WaterBillDetail(BaseModel):
    consumer_number: str
    board_name: str
    premises_type: str = "Residential"
    bill_date: str

class GasBillDetail(BaseModel):
    customer_id: str
    provider_name: str
    connection_type: str = "Piped Gas"
    meter_reading: str

class BroadbandBillDetail(BaseModel):
    account_number: str
    isp_name: str
    plan_speed: str
    billing_cycle: str

class FASTagDetail(BaseModel):
    vehicle_number: str
    issuer_bank: str
    tag_id: str
    current_tag_balance: float

class CreditCardDetail(BaseModel):
    card_last_4: str
    card_issuer: str
    network: str
    minimum_amount_due: float
    total_amount_due: float
    due_date: str

class InsuranceDetail(BaseModel):
    policy_number: str
    insurer_name: str
    policy_type: str
    sum_assured: float
    due_date: str

class LoanEMIDetail(BaseModel):
    loan_account_number: str
    lender_name: str
    borrower_name: str
    loan_type: str
    monthly_emi: float
    due_date: str
