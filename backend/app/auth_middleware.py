from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timezone
import logging
from typing import Optional, Dict, Any
from .config import SECRET_KEY, ALGORITHM

logger = logging.getLogger(__name__)

class JWTBearer(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super(JWTBearer, self).__init__(auto_error=auto_error)

    async def __call__(self, request: Request):
        credentials: HTTPAuthorizationCredentials = await super(JWTBearer, self).__call__(request)
        if credentials:
            if not credentials.scheme == "Bearer":
                raise HTTPException(status_code=403, detail="Invalid authentication scheme.")
            payload = self.verify_jwt(credentials.credentials)
            if not payload:
                raise HTTPException(status_code=403, detail="Invalid token or expired token.")
            
            # Add user info to request state
            request.state.user_id = payload.get("sub")
            request.state.user_role = payload.get("role", "user")
            request.state.is_admin = payload.get("is_admin", False)
            
            return payload
        else:
            raise HTTPException(status_code=403, detail="Invalid authorization code.")

    def verify_jwt(self, jwtoken: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return payload if valid"""
        try:
            payload = jwt.decode(jwtoken, SECRET_KEY, algorithms=[ALGORITHM])
            
            # Check expiration
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
                logger.warning(f"Token expired for user {payload.get('sub')}")
                return None
            
            return payload
        except JWTError as e:
            logger.error(f"JWT verification failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during JWT verification: {e}")
            return None

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