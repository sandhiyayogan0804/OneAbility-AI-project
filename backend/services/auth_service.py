from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from models.user import User
from models.accessibility import AccessibilityPreference
from models.notification import Notification
from models.security import SecurityEvent
from schemas.auth import UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse
from security.password import hash_password, verify_password
from security.jwt import create_access_token
from config.settings import settings

class AuthService:

    @staticmethod
    def register_user(db: Session, req: UserRegisterRequest, client_ip: str = None) -> User:
        """Register a new user with validation, password hashing, and default preferences."""
        # 1. Check for duplicate phone number
        existing_phone = db.query(User).filter(User.phone_number == req.phone_number.strip()).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this mobile number already exists."
            )

        # 2. Check for duplicate email if provided
        if req.email:
            existing_email = db.query(User).filter(User.email == req.email.strip().lower()).first()
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this email address already exists."
                )

        # 3. Check for duplicate UPI ID if provided
        if req.upi_id:
            existing_upi = db.query(User).filter(User.upi_id == req.upi_id.strip()).first()
            if existing_upi:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This UPI ID is already registered."
                )

        # 4. Hash password
        hashed_pwd = hash_password(req.password)

        # 5. Create User entity
        new_user = User(
            full_name=req.full_name.strip(),
            phone_number=req.phone_number.strip(),
            email=req.email.strip().lower() if req.email else None,
            password_hash=hashed_pwd,
            upi_id=req.upi_id.strip() if req.upi_id else None,
            is_active=True
        )
        db.add(new_user)
        db.flush()  # Populates new_user.id

        # 6. Initialize default accessibility preferences for OneAbility AI
        default_pref = AccessibilityPreference(
            user_id=new_user.id,
            high_contrast=False,
            font_size_scale="medium",
            screen_reader_optimized=False,
            voice_guidance=True,
            haptic_feedback=True,
            color_blind_mode="none",
            preferred_language="en"
        )
        db.add(default_pref)

        # 7. Add Welcome Notification
        welcome_notice = Notification(
            user_id=new_user.id,
            title="Welcome to OneAbility AI",
            message="Your account has been registered successfully. Explore accessible voice and touch payments.",
            notification_type="SYSTEM",
            is_read=False
        )
        db.add(welcome_notice)

        # 8. Record Security Event audit log
        sec_event = SecurityEvent(
            user_id=new_user.id,
            event_type="USER_REGISTERED",
            ip_address=client_ip,
            status="SUCCESS",
            details={"phone_number": new_user.phone_number}
        )
        db.add(sec_event)

        db.commit()
        db.refresh(new_user)
        return new_user

    @staticmethod
    def authenticate_user(db: Session, req: UserLoginRequest, client_ip: str = None) -> TokenResponse:
        """Authenticate user by phone number or email and password, returning JWT token."""
        identifier = req.identifier.strip()

        # Lookup user by phone or email
        user = db.query(User).filter(
            or_(
                User.phone_number == identifier,
                User.email == identifier.lower()
            )
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid phone number/email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify bcrypt password hash
        if not verify_password(req.password, user.password_hash):
            # Log failed security attempt
            sec_event = SecurityEvent(
                user_id=user.id,
                event_type="LOGIN_FAILED",
                ip_address=client_ip,
                status="FAILURE",
                details={"reason": "Incorrect password"}
            )
            db.add(sec_event)
            db.commit()

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid phone number/email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact support."
            )

        # Log successful login (technical security event)
        sec_event = SecurityEvent(
            user_id=user.id,
            event_type="LOGIN_SUCCESS",
            ip_address=client_ip,
            status="SUCCESS",
            details={"method": "password"}
        )
        db.add(sec_event)

        # Record user notification for security alert
        login_notif = Notification(
            user_id=user.id,
            title="Security Alert: New Sign-in",
            message=f"Successful sign-in to your OneAbility AI account from {client_ip or 'current device'}.",
            notification_type="SECURITY",
            is_read=False
        )
        db.add(login_notif)
        db.commit()

        # Generate JWT Token
        token_data = {
            "sub": str(user.id),
            "phone": user.phone_number,
            "name": user.full_name,
        }
        access_token = create_access_token(data=token_data)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user)
        )
