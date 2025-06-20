"""
Advanced authentication system with refresh tokens and secure session management
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import secrets
import hashlib
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User
from .cache import redis_manager, CacheKeys, generate_cache_key
from .logging_config import audit_logger, app_logger
import structlog

logger = structlog.get_logger(__name__)

# Password hashing
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # Increased rounds for better security
)

# Security scheme
security = HTTPBearer(auto_error=False)


class TokenManager:
    """Advanced token management with refresh tokens and session tracking"""
    
    def __init__(self):
        self.algorithm = settings.ALGORITHM
        self.secret_key = settings.SECRET_KEY
        self.access_token_expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        self.refresh_token_expire = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    def create_access_token(self, user_id: int, additional_claims: Optional[Dict] = None) -> str:
        """Create JWT access token with user claims"""
        now = datetime.utcnow()
        expire = now + self.access_token_expire
        
        # Base claims
        claims = {
            "sub": str(user_id),
            "type": "access",
            "iat": now,
            "exp": expire,
            "jti": secrets.token_urlsafe(32)  # JWT ID for revocation
        }
        
        # Add additional claims if provided
        if additional_claims:
            claims.update(additional_claims)
        
        token = jwt.encode(claims, self.secret_key, algorithm=self.algorithm)
        
        logger.debug("Access token created", user_id=user_id, expires_at=expire.isoformat())
        return token
    
    def create_refresh_token(self, user_id: int) -> str:
        """Create refresh token for long-term authentication"""
        now = datetime.utcnow()
        expire = now + self.refresh_token_expire
        
        claims = {
            "sub": str(user_id),
            "type": "refresh",
            "iat": now,
            "exp": expire,
            "jti": secrets.token_urlsafe(32)
        }
        
        token = jwt.encode(claims, self.secret_key, algorithm=self.algorithm)
        
        logger.debug("Refresh token created", user_id=user_id, expires_at=expire.isoformat())
        return token
    
    def create_token_pair(
        self, 
        user: User, 
        device_info: Optional[Dict] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create access and refresh token pair"""
        
        # Additional claims for access token
        claims = {
            "email": user.email,
            "is_admin": user.is_admin,
            "subscription_status": user.subscription_status,
            "premium_until": user.premium_until.isoformat() if user.premium_until else None
        }
        
        access_token = self.create_access_token(user.id, claims)
        refresh_token = self.create_refresh_token(user.id)
        
        # Store session information in Redis
        session_data = {
            "user_id": user.id,
            "email": user.email,
            "ip_address": ip_address,
            "device_info": device_info,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat()
        }
        
        # Cache session data
        session_key = generate_cache_key(CacheKeys.SESSION, token=refresh_token)
        redis_manager.set(session_key, session_data, expire=self.refresh_token_expire)
        
        # Log authentication event
        audit_logger.log_user_action(
            user_id=user.id,
            action="login",
            resource="authentication",
            details={
                "device_info": device_info,
                "ip_address": ip_address
            },
            ip_address=ip_address,
            success=True
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": int(self.access_token_expire.total_seconds()),
            "refresh_expires_in": int(self.refresh_token_expire.total_seconds())
        }
    
    def verify_token(self, token: str, token_type: str = "access") -> Optional[Dict]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Verify token type
            if payload.get("type") != token_type:
                logger.warning("Invalid token type", expected=token_type, actual=payload.get("type"))
                return None
            
            # Check if token is expired
            exp = payload.get("exp")
            if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
                logger.debug("Token expired", token_type=token_type)
                return None
            
            return payload
            
        except JWTError as e:
            logger.warning("JWT verification failed", error=str(e), token_type=token_type)
            return None
    
    async def refresh_access_token(
        self, 
        refresh_token: str, 
        db: Session,
        ip_address: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Refresh access token using refresh token"""
        
        # Verify refresh token
        payload = self.verify_token(refresh_token, "refresh")
        if not payload:
            return None
        
        user_id = int(payload["sub"])
        
        # Check if session exists in Redis
        session_key = generate_cache_key(CacheKeys.SESSION, token=refresh_token)
        session_data = await redis_manager.get(session_key)
        
        if not session_data:
            logger.warning("Session not found for refresh token", user_id=user_id)
            return None
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            logger.warning("User not found or inactive", user_id=user_id)
            return None
        
        # Update session activity
        session_data["last_activity"] = datetime.utcnow().isoformat()
        await redis_manager.set(session_key, session_data, expire=self.refresh_token_expire)
        
        # Create new access token
        claims = {
            "email": user.email,
            "is_admin": user.is_admin,
            "subscription_status": user.subscription_status,
            "premium_until": user.premium_until.isoformat() if user.premium_until else None
        }
        
        new_access_token = self.create_access_token(user.id, claims)
        
        # Log token refresh
        audit_logger.log_user_action(
            user_id=user.id,
            action="token_refresh",
            resource="authentication",
            details={"ip_address": ip_address},
            ip_address=ip_address,
            success=True
        )
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": int(self.access_token_expire.total_seconds())
        }
    
    async def revoke_token(self, token: str, token_type: str = "refresh"):
        """Revoke a token (add to blacklist)"""
        payload = self.verify_token(token, token_type)
        if not payload:
            return False
        
        jti = payload.get("jti")
        exp = payload.get("exp")
        
        if jti and exp:
            # Calculate TTL for blacklist entry
            expire_time = datetime.utcfromtimestamp(exp)
            ttl = int((expire_time - datetime.utcnow()).total_seconds())
            
            if ttl > 0:
                blacklist_key = f"blacklist:token:{jti}"
                await redis_manager.set(blacklist_key, True, expire=ttl)
                
                logger.info("Token revoked", jti=jti, token_type=token_type)
                return True
        
        return False
    
    async def is_token_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted"""
        payload = self.verify_token(token)
        if not payload:
            return True  # Invalid tokens are considered blacklisted
        
        jti = payload.get("jti")
        if not jti:
            return False
        
        blacklist_key = f"blacklist:token:{jti}"
        return await redis_manager.exists(blacklist_key)
    
    async def revoke_all_user_tokens(self, user_id: int):
        """Revoke all tokens for a user"""
        pattern = f"session:*"
        sessions = await redis_manager.get_multiple([pattern])
        
        revoked_count = 0
        for session_data in sessions.values():
            if isinstance(session_data, dict) and session_data.get("user_id") == user_id:
                # This would require storing session tokens, simplified approach
                revoked_count += 1
        
        # Clear all sessions for user (simplified)
        user_session_pattern = f"session:user:{user_id}:*"
        await redis_manager.clear_pattern(user_session_pattern)
        
        logger.info("All user tokens revoked", user_id=user_id, count=revoked_count)
        return revoked_count


class SessionManager:
    """Manage user sessions with Redis backend"""
    
    def __init__(self):
        self.token_manager = TokenManager()
    
    async def get_active_sessions(self, user_id: int) -> list[Dict[str, Any]]:
        """Get all active sessions for a user"""
        pattern = f"session:*"
        all_sessions = await redis_manager.get_multiple([pattern])
        
        user_sessions = []
        for session_data in all_sessions.values():
            if isinstance(session_data, dict) and session_data.get("user_id") == user_id:
                user_sessions.append(session_data)
        
        return user_sessions
    
    async def terminate_session(self, refresh_token: str) -> bool:
        """Terminate a specific session"""
        session_key = generate_cache_key(CacheKeys.SESSION, token=refresh_token)
        deleted = await redis_manager.delete(session_key)
        
        # Also revoke the refresh token
        await self.token_manager.revoke_token(refresh_token, "refresh")
        
        return deleted > 0
    
    async def terminate_all_sessions(self, user_id: int, except_current: Optional[str] = None) -> int:
        """Terminate all sessions for a user except current one"""
        sessions = await self.get_active_sessions(user_id)
        terminated = 0
        
        for session in sessions:
            # This is a simplified approach - in production you'd need to track tokens properly
            if except_current and "current_session_identifier" in session:
                continue
            
            terminated += 1
        
        # Revoke all user tokens
        await self.token_manager.revoke_all_user_tokens(user_id)
        
        return terminated


# Password utilities
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)


def generate_secure_token(length: int = 32) -> str:
    """Generate cryptographically secure random token"""
    return secrets.token_urlsafe(length)


# Authentication dependencies
async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    # Check if token is blacklisted
    token_manager = TokenManager()
    if await token_manager.is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify token
    payload = token_manager.verify_token(token, "access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = int(payload["sub"])
    
    # Get user from database
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )
    
    # Store user in request state for other middleware/dependencies
    request.state.user = user
    request.state.user_id = user.id
    
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user (additional check)"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current admin user"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_premium_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current premium user"""
    if not current_user.is_premium_active():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required"
        )
    return current_user


# Global instances
token_manager = TokenManager()
session_manager = SessionManager() 