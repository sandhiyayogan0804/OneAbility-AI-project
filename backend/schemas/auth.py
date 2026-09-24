from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime

class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of user")
    phone_number: str = Field(..., min_length=10, max_length=20, description="Mobile number (used as primary ID)")
    email: Optional[EmailStr] = Field(None, description="Optional email address")
    password: str = Field(..., min_length=6, max_length=128, description="Account password (min 6 characters)")
    upi_id: Optional[str] = Field(None, max_length=50, description="Optional UPI ID format name@bank")

class UserLoginRequest(BaseModel):
    identifier: str = Field(..., description="Phone number or registered email address")
    password: str = Field(..., description="Account password")

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    phone_number: str
    upi_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
