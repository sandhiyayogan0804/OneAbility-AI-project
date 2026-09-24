from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from config.database import get_db
from models.user import User
from schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse, TokenResponse
from services.auth_service import AuthService
from security.dependencies import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Register a new user")
def register(req: UserRegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Registers a new user profile with hashed password and default accessibility preferences."""
    client_ip = request.client.host if request.client else None
    user = AuthService.register_user(db=db, req=req, client_ip=client_ip)
    return user

@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK, summary="Authenticate user and obtain JWT token")
def login(req: UserLoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticates credentials against phone number or email, returning a JWT Bearer token."""
    client_ip = request.client.host if request.client else None
    token_response = AuthService.authenticate_user(db=db, req=req, client_ip=client_ip)
    return token_response

@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK, summary="Get current authenticated user profile")
def get_authenticated_user_profile(current_user: User = Depends(get_current_user)):
    """Protected endpoint: Returns the profile data of the currently authenticated user."""
    return current_user

@router.get("/verify-token", status_code=status.HTTP_200_OK, summary="Verify JWT access token")
def verify_token(current_user: User = Depends(get_current_user)):
    """Protected endpoint: Validates token validity and returns basic confirmation."""
    return {
        "valid": True,
        "user_id": current_user.id,
        "full_name": current_user.full_name,
        "phone_number": current_user.phone_number,
        "is_active": current_user.is_active
    }
