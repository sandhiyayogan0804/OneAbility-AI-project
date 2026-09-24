from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from config.database import Base

class BillPayment(Base):
    __tablename__ = "bill_payments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reference_id = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)  # MOBILE_RECHARGE, DTH, ELECTRICITY, etc.
    biller_id = Column(String(50), nullable=False)
    biller_name = Column(String(100), nullable=False)
    account_number = Column(String(100), nullable=False)
    account_holder_name = Column(String(100), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    convenience_fee = Column(Numeric(15, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(15, 2), nullable=False)
    debit_account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    payment_method = Column(String(30), default="UPI", nullable=False)
    status = Column(String(20), default="PENDING", nullable=False, index=True)  # SUCCESS, FAILED
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    bill_details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    debit_account = relationship("BankAccount", foreign_keys=[debit_account_id])
    transaction = relationship("Transaction", foreign_keys=[transaction_id])
