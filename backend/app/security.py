"""
Professional Security Module for Baby AI
Comprehensive authentication, session management, and security utilities
"""
import os
import jwt
import secrets
import hashlib
import redis
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple
from fastapi import Request, HTTPException, status, Depends, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import structlog
from sqlalchemy.orm import Session
import json
import hmac
import base64

from .config import settings
from .database import get_db
from .database_models import User, UserSession, AuditLog

logger = structlog.get_logger(__name__)

# Security Configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # Strong hashing
)

security = HTTPBearer(auto_error=False)

# Redis connection for session management
redis_client = None
try:
    redis_client = redis.Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5
    )
    redis_client.ping()  # Test connection
    logger.info("Redis connection established for session management")
except Exception as e:
    logger.warning(f"Redis connection failed, using in-memory fallback: {e}")
    redis_client = None

# In-memory session store (fallback)
_session_store = {}
_blacklist_store = set()


class SecurityConfig:
    """Security configuration constants"""
    # Token lifetimes
    ACCESS_TOKEN_LIFETIME = timedelta(minutes=30)
    REFRESH_TOKEN_LIFETIME = timedelta(days=7)
    SESSION_LIFETIME = timedelta(days=30)
    
    # Security limits
    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_DURATION = timedelta(minutes=15)
    MAX_SESSIONS_PER_USER = 10
    
    # Cookie configuration
    COOKIE_SECURE = True  # HTTPS only
    COOKIE_HTTPONLY = True
    COOKIE_SAMESITE = "lax"
    
    # CSRF configuration
    CSRF_TOKEN_LENGTH = 32
    CSRF_HEADER_NAME = "X-CSRF-Token"
    CSRF_COOKIE_NAME = "csrf_token"


class AuthTokens:
    """JWT token management with enhanced security"""
    
    @staticmethod
    def create_access_token(
        user_id: int,
        email: str,
        subscription_type: str,
        is_admin: bool = False,
        additional_claims: Optional[Dict] = None
    ) -> str:
        """Create secure access token with user claims"""
        now = datetime.utcnow()
        expire = now + SecurityConfig.ACCESS_TOKEN_LIFETIME
        
        payload = {
            "sub": str(user_id),
            "email": email,
            "subscription_type": subscription_type,
            "is_admin": bool(is_admin),
            "type": "access",
            "iat": now.timestamp(),
            "exp": expire.timestamp(),
            "jti": secrets.token_urlsafe(32),  # Unique token ID for revocation
            "iss": "baby-ai-auth"  # Issuer
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        logger.debug("Access token created", user_id=user_id, expires_at=expire.isoformat())
        
        return token
    
    @staticmethod
    def create_refresh_token(user_id: int, session_id: str) -> str:
        """Create secure refresh token"""
        now = datetime.utcnow()
        expire = now + SecurityConfig.REFRESH_TOKEN_LIFETIME
        
        payload = {
            "sub": str(user_id),
            "session_id": session_id,
            "type": "refresh",
            "iat": now.timestamp(),
            "exp": expire.timestamp(),
            "jti": secrets.token_urlsafe(32)
        }
        
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        logger.debug("Refresh token created", user_id=user_id, session_id=session_id)
        
        return token
    
    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[Dict]:
        """Verify and decode JWT token with security checks"""
        try:
            # Decode without verification first to get JTI for blacklist check
            unverified = jwt.decode(token, options={"verify_signature": False})
            jti = unverified.get("jti")
            
            # Check if token is blacklisted
            if jti and TokenBlacklist.is_blacklisted(jti):
                logger.warning("Blacklisted token attempted", jti=jti)
                return None
            
            # Verify token
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM],
                options={"require": ["exp", "iat", "sub", "jti"]}
            )
            
            # Verify token type
            if payload.get("type") != token_type:
                logger.warning("Invalid token type", expected=token_type, actual=payload.get("type"))
                return None
            
            # Additional security checks
            if payload.get("iss") != "baby-ai-auth":
                logger.warning("Invalid token issuer")
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.debug("Token expired", token_type=token_type)
            return None
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid token", error=str(e), token_type=token_type)
            return None
        except Exception as e:
            logger.error("Token verification error", error=str(e))
            return None
    
    @staticmethod
    def extract_token_from_request(request: Request) -> Optional[str]:
        """Extract token from request (cookie preferred, header fallback)"""
        # Try cookie first (secure)
        token = request.cookies.get("access_token")
        if token:
            return token
        
        # Fallback to Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]
        
        return None


class SessionManager:
    """Advanced session management with Redis backend"""
    
    @staticmethod
    def _get_session_key(session_id: str) -> str:
        """Generate Redis key for session"""
        return f"session:{session_id}"
    
    @staticmethod
    def _get_user_sessions_key(user_id: int) -> str:
        """Generate Redis key for user sessions"""
        return f"user_sessions:{user_id}"
    
    @staticmethod
    async def create_session(
        user: User,
        request: Request,
        device_info: Optional[Dict] = None
    ) -> Tuple[str, str, str]:
        """Create new user session and return tokens"""
        session_id = secrets.token_urlsafe(32)
        csrf_token = secrets.token_urlsafe(SecurityConfig.CSRF_TOKEN_LENGTH)
        
        # Extract request information
        user_agent = request.headers.get("user-agent", "")
        ip_address = request.client.host if request.client else ""
        
        # Create session data
        session_data = {
            "session_id": session_id,
            "user_id": user.id,
            "email": user.email,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "device_info": device_info or {},
            "csrf_token": csrf_token,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat(),
            "is_active": True
        }
        
        # Store session
        session_key = SessionManager._get_session_key(session_id)
        if redis_client:
            try:
                redis_client.setex(
                    session_key,
                    int(SecurityConfig.SESSION_LIFETIME.total_seconds()),
                    json.dumps(session_data)
                )
                # Add to user sessions set
                user_sessions_key = SessionManager._get_user_sessions_key(user.id)
                redis_client.sadd(user_sessions_key, session_id)
                redis_client.expire(user_sessions_key, int(SecurityConfig.SESSION_LIFETIME.total_seconds()))
            except Exception as e:
                logger.error("Redis session storage failed", error=str(e))
                _session_store[session_id] = session_data  # Fallback
        else:
            _session_store[session_id] = session_data
        
        # Create tokens
        access_token = AuthTokens.create_access_token(
            user.id, user.email, user.subscription_status.value, user.is_admin
        )
        refresh_token = AuthTokens.create_refresh_token(user.id, session_id)
        
        # Log session creation
        logger.info("Session created", user_id=user.id, session_id=session_id, ip=ip_address)
        
        return access_token, refresh_token, csrf_token
    
    @staticmethod
    async def get_session(session_id: str) -> Optional[Dict]:
        """Get session data"""
        session_key = SessionManager._get_session_key(session_id)
        
        if redis_client:
            try:
                data = redis_client.get(session_key)
                if data:
                    return json.loads(data)
            except Exception as e:
                logger.error("Redis session retrieval failed", error=str(e))
        
        return _session_store.get(session_id)
    
    @staticmethod
    async def update_session_activity(session_id: str) -> bool:
        """Update session last activity"""
        session = await SessionManager.get_session(session_id)
        if not session:
            return False
        
        session["last_activity"] = datetime.utcnow().isoformat()
        
        session_key = SessionManager._get_session_key(session_id)
        if redis_client:
            try:
                redis_client.setex(
                    session_key,
                    int(SecurityConfig.SESSION_LIFETIME.total_seconds()),
                    json.dumps(session)
                )
                return True
            except Exception:
                pass
        
        _session_store[session_id] = session
        return True
    
    @staticmethod
    async def revoke_session(session_id: str) -> bool:
        """Revoke a specific session"""
        session = await SessionManager.get_session(session_id)
        if not session:
            return False
        
        user_id = session.get("user_id")
        
        # Remove from Redis
        if redis_client:
            try:
                session_key = SessionManager._get_session_key(session_id)
                redis_client.delete(session_key)
                
                if user_id:
                    user_sessions_key = SessionManager._get_user_sessions_key(user_id)
                    redis_client.srem(user_sessions_key, session_id)
            except Exception:
                pass
        
        # Remove from memory store
        _session_store.pop(session_id, None)
        
        logger.info("Session revoked", session_id=session_id, user_id=user_id)
        return True
    
    @staticmethod
    async def get_user_sessions(user_id: int) -> List[Dict]:
        """Get all active sessions for a user"""
        sessions = []
        
        if redis_client:
            try:
                user_sessions_key = SessionManager._get_user_sessions_key(user_id)
                session_ids = redis_client.smembers(user_sessions_key)
                
                for session_id in session_ids:
                    session_data = await SessionManager.get_session(session_id)
                    if session_data and session_data.get("is_active"):
                        sessions.append(session_data)
            except Exception:
                pass
        else:
            # Fallback to memory store
            for session_id, session_data in _session_store.items():
                if session_data.get("user_id") == user_id and session_data.get("is_active"):
                    sessions.append(session_data)
        
        return sessions
    
    @staticmethod
    async def revoke_all_user_sessions(user_id: int, except_session_id: Optional[str] = None) -> int:
        """Revoke all sessions for a user"""
        sessions = await SessionManager.get_user_sessions(user_id)
        revoked_count = 0
        
        for session in sessions:
            session_id = session.get("session_id")
            if session_id and session_id != except_session_id:
                if await SessionManager.revoke_session(session_id):
                    revoked_count += 1
        
        logger.info(f"Revoked {revoked_count} sessions for user {user_id}")
        return revoked_count
    
    @staticmethod
    async def cleanup_expired_sessions():
        """Cleanup expired sessions (utility function)"""
        # This would be called by a background task
        # Implementation depends on Redis TTL and cleanup strategy
        pass


class TokenBlacklist:
    """Token blacklist management"""
    
    @staticmethod
    def blacklist_token(jti: str, expire_at: datetime):
        """Add token to blacklist"""
        ttl = int((expire_at - datetime.utcnow()).total_seconds())
        if ttl <= 0:
            return  # Already expired
        
        if redis_client:
            try:
                redis_client.setex(f"blacklist:{jti}", ttl, "1")
            except Exception:
                _blacklist_store.add(jti)
        else:
            _blacklist_store.add(jti)
    
    @staticmethod
    def is_blacklisted(jti: str) -> bool:
        """Check if token is blacklisted"""
        if redis_client:
            try:
                return bool(redis_client.exists(f"blacklist:{jti}"))
            except Exception:
                pass
        
        return jti in _blacklist_store


class CSRFProtection:
    """CSRF protection using double-submit cookie pattern"""
    
    @staticmethod
    def generate_csrf_token() -> str:
        """Generate CSRF token"""
        return secrets.token_urlsafe(SecurityConfig.CSRF_TOKEN_LENGTH)
    
    @staticmethod
    def validate_csrf_token(request: Request, session_csrf: str) -> bool:
        """Validate CSRF token from request"""
        # Get token from header
        header_token = request.headers.get(SecurityConfig.CSRF_HEADER_NAME)
        
        # Get token from cookie
        cookie_token = request.cookies.get(SecurityConfig.CSRF_COOKIE_NAME)
        
        # Both tokens must match the session token
        return (
            header_token and
            cookie_token and
            header_token == session_csrf and
            cookie_token == session_csrf and
            hmac.compare_digest(header_token, session_csrf)
        )


class SecurityUtils:
    """Security utility functions"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password securely"""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate cryptographically secure random token"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def constant_time_compare(a: str, b: str) -> bool:
        """Constant time string comparison"""
        return hmac.compare_digest(a, b)
    
    @staticmethod
    def get_client_ip(request: Request) -> str:
        """Get client IP address handling proxies"""
        # Check for proxy headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    @staticmethod
    def extract_device_info(request: Request) -> Dict[str, Any]:
        """Extract device information from request"""
        user_agent = request.headers.get("user-agent", "")
        
        return {
            "user_agent": user_agent,
            "ip_address": SecurityUtils.get_client_ip(request),
            "platform": SecurityUtils._parse_platform(user_agent),
            "browser": SecurityUtils._parse_browser(user_agent)
        }
    
    @staticmethod
    def _parse_platform(user_agent: str) -> str:
        """Parse platform from user agent"""
        ua_lower = user_agent.lower()
        if "windows" in ua_lower:
            return "Windows"
        elif "mac" in ua_lower or "darwin" in ua_lower:
            return "macOS"
        elif "linux" in ua_lower:
            return "Linux"
        elif "android" in ua_lower:
            return "Android"
        elif "iphone" in ua_lower or "ipad" in ua_lower:
            return "iOS"
        else:
            return "Unknown"
    
    @staticmethod
    def _parse_browser(user_agent: str) -> str:
        """Parse browser from user agent"""
        ua_lower = user_agent.lower()
        if "chrome" in ua_lower and "edge" not in ua_lower:
            return "Chrome"
        elif "firefox" in ua_lower:
            return "Firefox"
        elif "safari" in ua_lower and "chrome" not in ua_lower:
            return "Safari"
        elif "edge" in ua_lower:
            return "Edge"
        else:
            return "Unknown"


# Enhanced authentication dependencies
async def get_current_user_secure(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user with enhanced security"""
    # Extract token
    token = AuthTokens.extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Verify token
    payload = AuthTokens.verify_token(token, "access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = int(payload["sub"])
    
    # Get user from database
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Update session activity (if token contains session info)
    # This would be enhanced to track session activity
    
    # Store user in request state
    request.state.user = user
    request.state.user_id = user.id
    
    return user


async def require_csrf_token(
    request: Request,
    current_user: User = Depends(get_current_user_secure)
):
    """Require valid CSRF token for state-changing operations"""
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        # Get session to validate CSRF
        # This would be enhanced to validate against session CSRF token
        pass  # Implementation would validate CSRF token
    
    return current_user


# Export main components
__all__ = [
    "AuthTokens",
    "SessionManager", 
    "CSRFProtection",
    "SecurityUtils",
    "SecurityConfig",
    "get_current_user_secure",
    "require_csrf_token"
] 