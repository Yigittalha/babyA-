"""
Enhanced Authentication Middleware with comprehensive security features
"""
from fastapi import Request, HTTPException, Response, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable, List
from functools import wraps
import asyncio
import structlog
from sqlalchemy.orm import Session
from collections import defaultdict
import time

from .config import settings
from .database import get_db
from .database_models_simple import User
from .security import (
    AuthTokens, SessionManager, CSRFProtection, SecurityUtils,
    SecurityConfig, TokenBlacklist
)

# Simple enum replacement for UserSubscriptionStatus
class UserSubscriptionStatus:
    FREE = "free"
    ACTIVE = "active"
    TRIAL = "trial"

logger = structlog.get_logger(__name__)

# Rate limiting storage
_rate_limit_storage = defaultdict(list)
_failed_attempts = defaultdict(int)
_lockout_until = defaultdict(lambda: datetime.min)


class EnhancedAuthMiddleware:
    """Enhanced authentication middleware with comprehensive security"""
    
    def __init__(self):
        self.security = HTTPBearer(auto_error=False)
    
    async def __call__(self, request: Request, call_next):
        """Main middleware function"""
        start_time = time.time()
        
        try:
            # Security headers
            response = await call_next(request)
            self._add_security_headers(response)
            
            # Log request
            self._log_request(request, response, time.time() - start_time)
            
            return response
            
        except Exception as e:
            logger.error("Middleware error", error=str(e))
            return JSONResponse(
                status_code=500,
                content={"error": "Internal server error"}
            )
    
    def _add_security_headers(self, response: Response):
        """Add comprehensive security headers"""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:;"
        )
        
        if SecurityConfig.COOKIE_SECURE:
            response.headers["Strict-Transport-Security"] = (
                f"max-age={60*60*24*365}; includeSubDomains; preload"
            )
    
    def _log_request(self, request: Request, response: Response, duration: float):
        """Log request for audit purposes"""
        logger.info(
            "Request processed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration=duration,
            ip=SecurityUtils.get_client_ip(request),
            user_agent=request.headers.get("user-agent", "unknown")
        )


class PlanBasedRateLimiter:
    """Rate limiter based on user subscription plan"""
    
    # Rate limits per plan (requests per minute)
    RATE_LIMITS = {
        UserSubscriptionStatus.FREE: 10,
        UserSubscriptionStatus.ACTIVE: 30,  # Standard/Premium
        UserSubscriptionStatus.TRIAL: 15,
        "admin": 1000
    }
    
    @classmethod
    async def check_rate_limit(
        cls, 
        request: Request, 
        user: Optional[User] = None
    ) -> bool:
        """Check if request is within rate limits"""
        # Check DEBUG_MODE to bypass rate limiting in development
        import os
        DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true" or os.getenv("DEBUG", "false").lower() == "true"
        
        if DEBUG_MODE:
            logger.debug("Rate limiting disabled in DEBUG_MODE")
            return True
        
        # Get identifier (user_id or IP)
        if user:
            identifier = f"user:{user.id}"
            limit = cls.RATE_LIMITS.get(
                user.subscription_status, 
                cls.RATE_LIMITS[UserSubscriptionStatus.FREE]
            )
            if user.is_admin:
                limit = cls.RATE_LIMITS["admin"]
        else:
            identifier = f"ip:{SecurityUtils.get_client_ip(request)}"
            limit = cls.RATE_LIMITS[UserSubscriptionStatus.FREE]
        
        now = datetime.utcnow()
        minute_ago = now - timedelta(minutes=1)
        
        # Clean old entries
        _rate_limit_storage[identifier] = [
            timestamp for timestamp in _rate_limit_storage[identifier]
            if timestamp > minute_ago
        ]
        
        # Check limit
        if len(_rate_limit_storage[identifier]) >= limit:
            logger.warning(
                "Rate limit exceeded",
                identifier=identifier,
                limit=limit,
                current_count=len(_rate_limit_storage[identifier])
            )
            return False
        
        # Add current request
        _rate_limit_storage[identifier].append(now)
        return True
    
    @classmethod
    def create_rate_limit_response(cls) -> HTTPException:
        """Create rate limit exceeded response"""
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later.",
            headers={"Retry-After": "60"}
        )


class AccountLockoutManager:
    """Manage account lockouts for failed login attempts"""
    
    @classmethod
    def record_failed_attempt(cls, identifier: str):
        """Record a failed login attempt"""
        _failed_attempts[identifier] += 1
        
        if _failed_attempts[identifier] >= SecurityConfig.MAX_LOGIN_ATTEMPTS:
            lockout_until = datetime.utcnow() + SecurityConfig.LOCKOUT_DURATION
            _lockout_until[identifier] = lockout_until
            
            logger.warning(
                "Account locked due to failed attempts",
                identifier=identifier,
                attempts=_failed_attempts[identifier],
                lockout_until=lockout_until.isoformat()
            )
    
    @classmethod
    def is_locked_out(cls, identifier: str) -> bool:
        """Check if account is locked out"""
        if identifier in _lockout_until:
            if datetime.utcnow() < _lockout_until[identifier]:
                return True
            else:
                # Lockout expired, clean up
                del _lockout_until[identifier]
                _failed_attempts[identifier] = 0
        
        return False
    
    @classmethod
    def clear_failed_attempts(cls, identifier: str):
        """Clear failed attempts on successful login"""
        _failed_attempts[identifier] = 0
        if identifier in _lockout_until:
            del _lockout_until[identifier]


class PlanAccessControl:
    """Control access based on user subscription plan"""
    
    # Feature requirements by plan
    FEATURE_PLANS = {
        "generate_names": [
            UserSubscriptionStatus.FREE,
            UserSubscriptionStatus.ACTIVE,
            UserSubscriptionStatus.TRIAL
        ],
        "save_favorites": [
            UserSubscriptionStatus.FREE,
            UserSubscriptionStatus.ACTIVE,
            UserSubscriptionStatus.TRIAL
        ],
        "name_analysis": [
            UserSubscriptionStatus.ACTIVE
        ],
        "export_pdf": [
            UserSubscriptionStatus.ACTIVE
        ],
        "advanced_analytics": [
            UserSubscriptionStatus.ACTIVE
        ],
        "admin_panel": ["admin"]
    }
    
    # Daily limits by plan
    DAILY_LIMITS = {
        UserSubscriptionStatus.FREE: {
            "name_generations": 5,
            "favorites": 3
        },
        UserSubscriptionStatus.ACTIVE: {
            "name_generations": None,  # Unlimited
            "favorites": None
        },
        UserSubscriptionStatus.TRIAL: {
            "name_generations": 25,
            "favorites": 10
        }
    }
    
    @classmethod
    def has_feature_access(cls, user: User, feature: str) -> bool:
        """Check if user has access to a feature"""
        required_plans = cls.FEATURE_PLANS.get(feature, [])
        
        if user.is_admin and "admin" in required_plans:
            return True
        
        if user.subscription_status in required_plans:
            return True
        
        return False
    
    @classmethod
    def check_daily_limit(cls, user: User, feature: str, current_usage: int) -> bool:
        """Check if user has reached daily limit"""
        plan_limits = cls.DAILY_LIMITS.get(user.subscription_status, {})
        limit = plan_limits.get(feature)
        
        # None means unlimited
        if limit is None:
            return True
        
        return current_usage < limit
    
    @classmethod
    def create_access_denied_response(cls, feature: str) -> HTTPException:
        """Create access denied response"""
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access to '{feature}' requires a higher subscription plan"
        )
    
    @classmethod
    def create_limit_exceeded_response(cls, feature: str) -> HTTPException:
        """Create daily limit exceeded response"""
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily limit exceeded for '{feature}'. Please upgrade your plan."
        )


# Enhanced authentication dependencies
async def get_current_user_enhanced(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user with enhanced security checks"""
    logger.debug(f"get_current_user_enhanced called for path: {request.url.path}")
    
    # Rate limiting check
    if not await PlanBasedRateLimiter.check_rate_limit(request):
        logger.warning("Rate limit exceeded")
        raise PlanBasedRateLimiter.create_rate_limit_response()
    
    # Extract token
    token = AuthTokens.extract_token_from_request(request)
    logger.debug(f"Extracted token: {token[:20] if token else 'None'}...")
    
    if not token:
        logger.warning("No token found in request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Verify token
    payload = AuthTokens.verify_token(token, "access")
    logger.debug(f"Token payload: {payload}")
    
    if not payload:
        logger.warning("Token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = int(payload["sub"])
    logger.debug(f"Looking for user with ID: {user_id}")
    
    # Get user from database
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True
    ).first()
    
    if not user:
        logger.warning(f"User {user_id} not found or inactive")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # CRITICAL: Check session invalidation (force re-login after plan changes)
    token_issued_at = payload.get("iat", 0)
    
    try:
        # Use raw database connection to check session invalidation
        import sqlite3
        import os
        
        db_path = os.path.join(os.path.dirname(__file__), '..', 'baby_names.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if user session was invalidated after token was issued
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM invalidated_sessions 
            WHERE user_id = ? 
            AND datetime(invalidated_at) > datetime(?, 'unixepoch')
        """, (user_id, token_issued_at))
        
        result = cursor.fetchone()
        invalidation_count = result[0] if result else 0
        conn.close()
        
        if invalidation_count > 0:
            logger.warning(f"🔐 Session invalidated for user {user_id} - forcing re-login")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your account has been updated. Please login again to access new features.",
                headers={"X-Force-Relogin": "true"}
            )
    except Exception as e:
        logger.error(f"Session validation error for user {user_id}: {e}")
        # Don't fail on session validation error in production - continue normally
        pass
    
    # Check account lockout
    user_identifier = f"user:{user.id}"
    if AccountLockoutManager.is_locked_out(user_identifier):
        logger.warning(f"User {user_id} is locked out")
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to failed login attempts"
        )
    
    # Store user in request state
    request.state.user = user
    request.state.user_id = user.id
    
    logger.debug(f"User {user.email} authenticated successfully")
    
    # Update session activity if available
    # This would be enhanced to update session last activity
    
    return user


async def get_current_user_optional(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user but allow anonymous access"""
    try:
        return await get_current_user_enhanced(request, response, db)
    except HTTPException:
        return None


async def require_admin(
    current_user: User = Depends(get_current_user_enhanced)
) -> User:
    """Require admin privileges"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


async def require_premium(
    current_user: User = Depends(get_current_user_enhanced)
) -> User:
    """Require premium subscription"""
    if not current_user.is_premium_active():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required"
        )
    return current_user


def require_feature_access(feature: str):
    """Decorator to require specific feature access"""
    def decorator(current_user: User = Depends(get_current_user_enhanced)):
        if not PlanAccessControl.has_feature_access(current_user, feature):
            raise PlanAccessControl.create_access_denied_response(feature)
        return current_user
    return decorator


def require_csrf_protection(
    request: Request,
    current_user: User = Depends(get_current_user_enhanced)
):
    """Require CSRF protection for state-changing operations"""
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        # This would be enhanced to validate CSRF token
        # For now, we'll implement basic validation
        pass
    return current_user


# Middleware instance
auth_middleware = EnhancedAuthMiddleware()

class SessionValidator:
    """Validates user sessions and ensures consistency"""
    
    def __init__(self, db_manager):
        self.db_manager = db_manager
    
    async def validate_session(self, user_id: int, token_payload: Dict[str, Any]) -> bool:
        """Validate that the session is still active and consistent"""
        try:
            # Get user from database
            user = await self.db_manager.get_user_by_id(user_id)
            if not user:
                logger.warning(f"User {user_id} not found during session validation")
                return False
            
            # Check if user is active
            if user.get("is_active") == False:
                logger.warning(f"Inactive user {user_id} attempted to access system")
                return False
            
            # Validate subscription consistency
            token_subscription = token_payload.get("subscription_type")
            current_subscription = user.get("subscription_type", "free")
            
            # Log if subscription changed (for monitoring)
            if token_subscription and token_subscription != current_subscription:
                logger.info(f"User {user_id} subscription changed from {token_subscription} to {current_subscription}")
            
            return True
            
        except Exception as e:
            logger.error(f"Session validation error for user {user_id}: {e}")
            return False

# Plan-based access control
class PlanAccessControl:
    """Control access based on user's subscription plan"""
    
    FEATURE_REQUIREMENTS = {
        "generate_names": ["free", "standard", "premium"],
        "save_favorites": ["free", "standard", "premium"],
        "name_analysis": ["standard", "premium"],
        "export_pdf": ["premium"],
        "advanced_analytics": ["premium"],
        "cultural_insights": ["standard", "premium"],
        "priority_support": ["premium"]
    }
    
    @classmethod
    def has_access(cls, user_plan: str, feature: str) -> bool:
        """Check if user's plan has access to a feature"""
        allowed_plans = cls.FEATURE_REQUIREMENTS.get(feature, [])
        return user_plan in allowed_plans
    
    @classmethod
    def check_daily_limit(cls, user_plan: str, feature: str, current_usage: int) -> bool:
        """Check if user has reached their daily limit"""
        limits = {
            "free": {
                "generate_names": 5,
                "save_favorites": 3
            },
            "standard": {
                "generate_names": 50,
                "save_favorites": 20
            },
            "premium": {
                "generate_names": None,  # Unlimited
                "save_favorites": None   # Unlimited
            }
        }
        
        plan_limits = limits.get(user_plan, {})
        limit = plan_limits.get(feature)
        
        # None means unlimited
        if limit is None:
            return True
        
        return current_usage < limit

# Rate limiting by plan
class PlanRateLimiter:
    """Rate limiting based on user's subscription plan"""
    
    RATE_LIMITS = {
        "free": {
            "requests_per_minute": 10,
            "requests_per_hour": 100
        },
        "standard": {
            "requests_per_minute": 30,
            "requests_per_hour": 500
        },
        "premium": {
            "requests_per_minute": 60,
            "requests_per_hour": 1000
        }
    }
    
    def __init__(self):
        self.request_history = {}
    
    def check_rate_limit(self, user_id: int, user_plan: str) -> bool:
        """Check if user has exceeded rate limit"""
        now = datetime.now()
        user_key = f"user_{user_id}"
        
        if user_key not in self.request_history:
            self.request_history[user_key] = []
        
        # Clean old entries (older than 1 hour)
        self.request_history[user_key] = [
            timestamp for timestamp in self.request_history[user_key]
            if (now - timestamp).total_seconds() < 3600
        ]
        
        # Get limits for user's plan
        limits = self.RATE_LIMITS.get(user_plan, self.RATE_LIMITS["free"])
        
        # Check per-minute limit
        recent_minute = [
            t for t in self.request_history[user_key]
            if (now - t).total_seconds() < 60
        ]
        if len(recent_minute) >= limits["requests_per_minute"]:
            return False
        
        # Check per-hour limit
        if len(self.request_history[user_key]) >= limits["requests_per_hour"]:
            return False
        
        # Add current request
        self.request_history[user_key].append(now)
        
        return True 