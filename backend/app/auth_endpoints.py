"""
Secure Authentication Endpoints
Professional authentication system with enhanced security features
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import structlog
from passlib.context import CryptContext

from .database import get_db
from .database_models import User, UserSession, AuditLog, UserStatus, UserSubscriptionStatus
from .security import (
    AuthTokens, SessionManager, CSRFProtection, SecurityUtils,
    SecurityConfig, TokenBlacklist
)
from .auth_middleware import (
    get_current_user_enhanced, AccountLockoutManager, 
    PlanBasedRateLimiter, require_csrf_protection
)
from .config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Password context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Request/Response Models
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    remember_me: bool = False
    device_name: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=2, max_length=100)
    confirm_password: str


class RefreshTokenRequest(BaseModel):
    pass  # Token will come from httpOnly cookie


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[Dict[str, Any]] = None
    requires_verification: bool = False


def _create_user_response_data(user: User) -> Dict[str, Any]:
    """Create safe user data for response"""
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "subscription_type": user.subscription_status.value,
        "subscription_expires": user.premium_until.isoformat() if user.premium_until else None,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat(),
        "last_activity": user.last_activity.isoformat()
    }


def _set_auth_cookies(
    response: Response, 
    access_token: str, 
    refresh_token: str, 
    csrf_token: str,
    remember_me: bool = False
):
    """Set secure authentication cookies"""
    # Calculate cookie max age
    access_max_age = int(SecurityConfig.ACCESS_TOKEN_LIFETIME.total_seconds())
    refresh_max_age = int(SecurityConfig.REFRESH_TOKEN_LIFETIME.total_seconds())
    
    if remember_me:
        refresh_max_age = int(timedelta(days=30).total_seconds())
    
    # Set access token cookie (shorter lifespan)
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=access_max_age,
        httponly=SecurityConfig.COOKIE_HTTPONLY,
        secure=SecurityConfig.COOKIE_SECURE,
        samesite=SecurityConfig.COOKIE_SAMESITE,
        path="/"
    )
    
    # Set refresh token cookie (longer lifespan, more secure)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=refresh_max_age,
        httponly=True,  # Always httpOnly for refresh tokens
        secure=SecurityConfig.COOKIE_SECURE,
        samesite=SecurityConfig.COOKIE_SAMESITE,
        path="/auth"  # Restrict to auth endpoints
    )
    
    # Set CSRF token cookie (readable by JavaScript)
    response.set_cookie(
        key=SecurityConfig.CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=access_max_age,
        httponly=False,  # Needs to be readable by JS
        secure=SecurityConfig.COOKIE_SECURE,
        samesite=SecurityConfig.COOKIE_SAMESITE,
        path="/"
    )


def _clear_auth_cookies(response: Response):
    """Clear all authentication cookies"""
    cookie_names = ["access_token", "refresh_token", SecurityConfig.CSRF_COOKIE_NAME]
    
    for cookie_name in cookie_names:
        response.delete_cookie(
            key=cookie_name,
            path="/" if cookie_name != "refresh_token" else "/auth",
            secure=SecurityConfig.COOKIE_SECURE,
            samesite=SecurityConfig.COOKIE_SAMESITE
        )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: Request,
    response: Response,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Secure user login with enhanced security features"""
    # Rate limiting check
    if not await PlanBasedRateLimiter.check_rate_limit(request):
        raise PlanBasedRateLimiter.create_rate_limit_response()
    
    # Check account lockout
    user_identifier = f"email:{login_data.email}"
    ip_identifier = f"ip:{SecurityUtils.get_client_ip(request)}"
    
    if (AccountLockoutManager.is_locked_out(user_identifier) or 
        AccountLockoutManager.is_locked_out(ip_identifier)):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to failed login attempts"
        )
    
    try:
        # Find user
        user = db.query(User).filter(
            User.email == login_data.email.lower(),
            User.status != UserStatus.DELETED
        ).first()
        
        if not user or not SecurityUtils.verify_password(login_data.password, user.password_hash):
            # Record failed attempt
            AccountLockoutManager.record_failed_attempt(user_identifier)
            AccountLockoutManager.record_failed_attempt(ip_identifier)
            
            # Log failed attempt
            logger.warning(
                "Failed login attempt",
                email=login_data.email,
                ip=SecurityUtils.get_client_ip(request),
                user_agent=request.headers.get("user-agent", "unknown")
            )
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Check user status
        if user.status == UserStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account suspended. Please contact support."
            )
        
        if user.status == UserStatus.PENDING:
            return AuthResponse(
                success=False,
                message="Account verification required",
                requires_verification=True
            )
        
        # Clear failed attempts on successful authentication
        AccountLockoutManager.clear_failed_attempts(user_identifier)
        AccountLockoutManager.clear_failed_attempts(ip_identifier)
        
        # Create session and tokens
        device_info = SecurityUtils.extract_device_info(request)
        if login_data.device_name:
            device_info["device_name"] = login_data.device_name
        
        access_token, refresh_token, csrf_token = await SessionManager.create_session(
            user, request, device_info
        )
        
        # Set secure cookies
        _set_auth_cookies(response, access_token, refresh_token, csrf_token, login_data.remember_me)
        
        # Update user last login
        user.last_login_attempt = datetime.utcnow()
        user.last_activity = datetime.utcnow()
        db.commit()
        
        # Log successful login
        logger.info(
            "User logged in successfully",
            user_id=user.id,
            email=user.email,
            ip=SecurityUtils.get_client_ip(request)
        )
        
        return AuthResponse(
            success=True,
            message="Login successful",
            user=_create_user_response_data(user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again."
        )


@router.post("/register", response_model=AuthResponse)
async def register(
    request: Request,
    response: Response,
    register_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    """Secure user registration"""
    # Rate limiting check
    if not await PlanBasedRateLimiter.check_rate_limit(request):
        raise PlanBasedRateLimiter.create_rate_limit_response()
    
    try:
        # Validate passwords match
        if register_data.password != register_data.confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Passwords do not match"
            )
        
        # Check if user already exists
        existing_user = db.query(User).filter(
            User.email == register_data.email.lower()
        ).first()
        
        if existing_user:
            if existing_user.status == UserStatus.PENDING:
                return AuthResponse(
                    success=False,
                    message="Account exists but requires verification",
                    requires_verification=True
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User with this email already exists"
                )
        
        # Create new user
        hashed_password = SecurityUtils.hash_password(register_data.password)
        
        new_user = User(
            email=register_data.email.lower(),
            password_hash=hashed_password,
            name=register_data.name.strip(),
            subscription_status=UserSubscriptionStatus.FREE,
            status=UserStatus.ACTIVE,  # or PENDING if email verification required
            is_verified=True,  # Set to False if email verification required
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create session and tokens for immediate login
        device_info = SecurityUtils.extract_device_info(request)
        access_token, refresh_token, csrf_token = await SessionManager.create_session(
            new_user, request, device_info
        )
        
        # Set secure cookies
        _set_auth_cookies(response, access_token, refresh_token, csrf_token)
        
        # Log successful registration
        logger.info(
            "User registered successfully",
            user_id=new_user.id,
            email=new_user.email,
            ip=SecurityUtils.get_client_ip(request)
        )
        
        return AuthResponse(
            success=True,
            message="Registration successful",
            user=_create_user_response_data(new_user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Registration error", error=str(e))
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token from httpOnly cookie"""
    try:
        # Get refresh token from cookie
        refresh_token = request.cookies.get("refresh_token")
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not found"
            )
        
        # Verify refresh token
        payload = AuthTokens.verify_token(refresh_token, "refresh")
        if not payload:
            # Clear invalid cookies
            _clear_auth_cookies(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user_id = int(payload["sub"])
        session_id = payload.get("session_id")
        
        # Verify session still exists
        if session_id:
            session_data = await SessionManager.get_session(session_id)
            if not session_data or not session_data.get("is_active"):
                _clear_auth_cookies(response)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired"
                )
        
        # Get user from database
        user = db.query(User).filter(
            User.id == user_id,
            User.is_active == True,
            User.status == UserStatus.ACTIVE
        ).first()
        
        if not user:
            _clear_auth_cookies(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Create new access token
        new_access_token = AuthTokens.create_access_token(
            user.id,
            user.email,
            user.subscription_status.value,
            user.is_admin
        )
        
        # Generate new CSRF token
        new_csrf_token = CSRFProtection.generate_csrf_token()
        
        # Update cookies with new tokens
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            max_age=int(SecurityConfig.ACCESS_TOKEN_LIFETIME.total_seconds()),
            httponly=SecurityConfig.COOKIE_HTTPONLY,
            secure=SecurityConfig.COOKIE_SECURE,
            samesite=SecurityConfig.COOKIE_SAMESITE,
            path="/"
        )
        
        response.set_cookie(
            key=SecurityConfig.CSRF_COOKIE_NAME,
            value=new_csrf_token,
            max_age=int(SecurityConfig.ACCESS_TOKEN_LIFETIME.total_seconds()),
            httponly=False,
            secure=SecurityConfig.COOKIE_SECURE,
            samesite=SecurityConfig.COOKIE_SAMESITE,
            path="/"
        )
        
        # Update session activity
        if session_id:
            await SessionManager.update_session_activity(session_id)
        
        # Update user last activity
        user.last_activity = datetime.utcnow()
        db.commit()
        
        return {
            "success": True,
            "message": "Token refreshed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Token refresh error", error=str(e))
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user_enhanced)
):
    """Secure logout with session cleanup"""
    try:
        # Get refresh token to identify session
        refresh_token = request.cookies.get("refresh_token")
        
        if refresh_token:
            # Verify and get session ID
            payload = AuthTokens.verify_token(refresh_token, "refresh")
            if payload:
                session_id = payload.get("session_id")
                if session_id:
                    # Revoke session
                    await SessionManager.revoke_session(session_id)
                
                # Blacklist refresh token
                jti = payload.get("jti")
                if jti:
                    expire_at = datetime.utcfromtimestamp(payload.get("exp", 0))
                    TokenBlacklist.blacklist_token(jti, expire_at)
        
        # Get and blacklist access token
        access_token = AuthTokens.extract_token_from_request(request)
        if access_token:
            payload = AuthTokens.verify_token(access_token, "access")
            if payload:
                jti = payload.get("jti")
                if jti:
                    expire_at = datetime.utcfromtimestamp(payload.get("exp", 0))
                    TokenBlacklist.blacklist_token(jti, expire_at)
        
        # Clear cookies
        _clear_auth_cookies(response)
        
        # Log logout
        logger.info(
            "User logged out",
            user_id=current_user.id,
            ip=SecurityUtils.get_client_ip(request)
        )
        
        return {
            "success": True,
            "message": "Logout successful"
        }
        
    except Exception as e:
        logger.error("Logout error", error=str(e))
        # Still clear cookies even if there's an error
        _clear_auth_cookies(response)
        
        return {
            "success": True,
            "message": "Logout completed"
        }


@router.post("/logout-all")
async def logout_all_devices(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user_enhanced)
):
    """Logout from all devices"""
    try:
        # Get current session ID to preserve it
        current_session_id = None
        refresh_token = request.cookies.get("refresh_token")
        
        if refresh_token:
            payload = AuthTokens.verify_token(refresh_token, "refresh")
            if payload:
                current_session_id = payload.get("session_id")
        
        # Revoke all user sessions except current one
        revoked_count = await SessionManager.revoke_all_user_sessions(
            current_user.id, 
            except_session_id=current_session_id
        )
        
        # Log action
        logger.info(
            "User logged out from all devices",
            user_id=current_user.id,
            revoked_sessions=revoked_count,
            ip=SecurityUtils.get_client_ip(request)
        )
        
        return {
            "success": True,
            "message": f"Logged out from {revoked_count} other devices",
            "revoked_sessions": revoked_count
        }
        
    except Exception as e:
        logger.error("Logout all error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout from all devices"
        )


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user_enhanced)
):
    """Get current user information"""
    return {
        "success": True,
        "user": _create_user_response_data(current_user)
    }


@router.get("/sessions")
async def get_user_sessions(
    current_user: User = Depends(get_current_user_enhanced)
):
    """Get user's active sessions"""
    try:
        sessions = await SessionManager.get_user_sessions(current_user.id)
        
        # Format sessions for response (remove sensitive data)
        formatted_sessions = []
        for session in sessions:
            formatted_sessions.append({
                "session_id": session.get("session_id"),
                "device_info": session.get("device_info", {}),
                "ip_address": session.get("ip_address"),
                "created_at": session.get("created_at"),
                "last_activity": session.get("last_activity")
            })
        
        return {
            "success": True,
            "sessions": formatted_sessions,
            "total": len(formatted_sessions)
        }
        
    except Exception as e:
        logger.error("Get sessions error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions"
        )


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user_enhanced)
):
    """Revoke a specific session"""
    try:
        # Verify session belongs to current user
        session_data = await SessionManager.get_session(session_id)
        if not session_data or session_data.get("user_id") != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Revoke session
        success = await SessionManager.revoke_session(session_id)
        
        if success:
            logger.info(
                "Session revoked",
                user_id=current_user.id,
                session_id=session_id
            )
            
            return {
                "success": True,
                "message": "Session revoked successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to revoke session"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Revoke session error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke session"
        ) 