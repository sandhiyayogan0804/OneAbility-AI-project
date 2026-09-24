from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from config.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reference_id = Column(String(64), unique=True, index=True, nullable=False)
    sender_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    receiver_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    sender_account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    receiver_account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_method = Column(String(30), nullable=False)  # 'UPI', 'BANK_TRANSFER', 'QR', 'BILL_PAY'
    status = Column(String(20), default="PENDING", nullable=False, index=True)  # 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    sender_user = relationship("User", foreign_keys=[sender_user_id])
    receiver_user = relationship("User", foreign_keys=[receiver_user_id])
    sender_account = relationship("BankAccount", foreign_keys=[sender_account_id])
    receiver_account = relationship("BankAccount", foreign_keys=[receiver_account_id])
