"""
Professional rate limiting system with Redis backend and user tiers
"""
import time
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
import structlog

from .config import settings
from .cache import redis_manager, CacheKeys, generate_cache_key
from .models import User

logger = structlog.get_logger(__name__)


class RateLimitExceeded(HTTPException):
    """Custom rate limit exception"""
    def __init__(self, detail: str, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry_after)}
        )


class RateLimiter:
    """Advanced rate limiter with Redis backend and user tiers"""
    
    def __init__(self):
        self.default_limits = {
            "anonymous": {"calls": 50, "period": 3600},  # 50 per hour
            "registered": {"calls": settings.RATE_LIMIT_CALLS, "period": settings.RATE_LIMIT_PERIOD},
            "premium": {"calls": settings.PREMIUM_RATE_LIMIT_CALLS, "period": settings.RATE_LIMIT_PERIOD},
            "admin": {"calls": settings.ADMIN_RATE_LIMIT_CALLS, "period": settings.RATE_LIMIT_PERIOD}
        }
    
    async def get_client_identifier(self, request: Request) -> str:
        """Get unique identifier for client"""
        # Try to get user ID from token
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        
        # Fallback to IP address
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"
        
        return f"ip:{ip}"
    
    async def get_user_tier(self, request: Request) -> str:
        """Determine user tier for rate limiting"""
        user = getattr(request.state, "user", None)
        
        if not user:
            return "anonymous"
        
        if user.is_admin:
            return "admin"
        elif user.subscription_status == "active":
            return "premium"
        else:
            return "registered"
    
    async def check_rate_limit(
        self, 
        request: Request, 
        endpoint: str,
        custom_limits: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Check rate limit for request
        Returns: {"allowed": bool, "remaining": int, "reset_time": int}
        """
        if not settings.RATE_LIMIT_ENABLED:
            return {"allowed": True, "remaining": 999999, "reset_time": 0}
        
        # Get client identifier and tier
        identifier = await self.get_client_identifier(request)
        tier = await self.get_user_tier(request)
        
        # Get limits for this tier
        limits = custom_limits or self.default_limits.get(tier, self.default_limits["anonymous"])
        max_calls = limits["calls"]
        period = limits["period"]
        
        # Generate cache key
        cache_key = generate_cache_key(
            CacheKeys.RATE_LIMIT + ":{endpoint}:{period}",
            identifier=identifier,
            endpoint=endpoint,
            period=period
        )
        
        current_time = int(time.time())
        window_start = current_time - period
        
        try:
            # Get current count
            current_count = await redis_manager.get(cache_key, 0)
            
            if isinstance(current_count, str):
                current_count = int(current_count)
            
            # Check if limit exceeded
            if current_count >= max_calls:
                # Calculate reset time
                reset_time = await self._get_reset_time(cache_key, period)
                
                logger.warning(
                    "Rate limit exceeded",
                    identifier=identifier,
                    tier=tier,
                    endpoint=endpoint,
                    count=current_count,
                    limit=max_calls
                )
                
                return {
                    "allowed": False,
                    "remaining": 0,
                    "reset_time": reset_time,
                    "retry_after": reset_time - current_time
                }
            
            # Increment counter
            new_count = await redis_manager.increment(cache_key, 1)
            if new_count == 1:
                # Set expiration for new key
                await redis_manager.expire(cache_key, period)
            
            remaining = max(0, max_calls - new_count)
            reset_time = current_time + period
            
            logger.debug(
                "Rate limit check passed",
                identifier=identifier,
                tier=tier,
                endpoint=endpoint,
                count=new_count,
                remaining=remaining
            )
            
            return {
                "allowed": True,
                "remaining": remaining,
                "reset_time": reset_time,
                "retry_after": 0
            }
            
        except Exception as e:
            logger.error("Rate limit check failed", error=str(e))
            # Allow request on Redis failure
            return {"allowed": True, "remaining": 999999, "reset_time": 0}
    
    async def _get_reset_time(self, cache_key: str, period: int) -> int:
        """Get reset time for rate limit window"""
        try:
            ttl = await redis_manager.redis_client.ttl(cache_key)
            if ttl > 0:
                return int(time.time()) + ttl
            else:
                return int(time.time()) + period
        except Exception:
            return int(time.time()) + period
    
    async def reset_user_limits(self, user_id: int):
        """Reset all rate limits for a user (admin function)"""
        pattern = f"rate_limit:user:{user_id}:*"
        deleted = await redis_manager.clear_pattern(pattern)
        
        logger.info("Rate limits reset for user", user_id=user_id, deleted_keys=deleted)
        return deleted
    
    async def get_user_usage_stats(self, user_id: int) -> Dict[str, Any]:
        """Get usage statistics for a user"""
        pattern = f"rate_limit:user:{user_id}:*"
        
        try:
            keys = redis_manager.redis_client.keys(pattern)
            usage_stats = {}
            
            for key in keys:
                key_str = key.decode() if isinstance(key, bytes) else key
                parts = key_str.split(":")
                
                if len(parts) >= 4:
                    endpoint = parts[3]
                    count = await redis_manager.get(key_str, 0)
                    ttl = redis_manager.redis_client.ttl(key_str)
                    
                    usage_stats[endpoint] = {
                        "current_usage": count,
                        "reset_in_seconds": ttl
                    }
            
            return usage_stats
            
        except Exception as e:
            logger.error("Failed to get usage stats", user_id=user_id, error=str(e))
            return {}


# Global rate limiter instance
rate_limiter = RateLimiter()


# Dependency for FastAPI
async def check_rate_limit_dependency(request: Request):
    """FastAPI dependency for rate limiting"""
    endpoint = request.url.path
    
    result = await rate_limiter.check_rate_limit(request, endpoint)
    
    if not result["allowed"]:
        raise RateLimitExceeded(
            detail=f"Rate limit exceeded. Try again in {result['retry_after']} seconds.",
            retry_after=result["retry_after"]
        )
    
    # Add rate limit headers to response
    request.state.rate_limit_headers = {
        "X-RateLimit-Limit": str(rate_limiter.default_limits.get(
            await rate_limiter.get_user_tier(request), 
            rate_limiter.default_limits["anonymous"]
        )["calls"]),
        "X-RateLimit-Remaining": str(result["remaining"]),
        "X-RateLimit-Reset": str(result["reset_time"])
    }
    
    return result


# Specific rate limiters for different endpoints
class EndpointRateLimits:
    """Endpoint-specific rate limits"""
    
    NAME_GENERATION = {
        "anonymous": {"calls": 10, "period": 3600},
        "registered": {"calls": 100, "period": 3600},
        "premium": {"calls": 1000, "period": 3600},
        "admin": {"calls": 10000, "period": 3600}
    }
    
    LOGIN_ATTEMPTS = {
        "anonymous": {"calls": 5, "period": 900},  # 5 attempts per 15 minutes
        "registered": {"calls": 5, "period": 900},
        "premium": {"calls": 5, "period": 900},
        "admin": {"calls": 20, "period": 900}
    }
    
    PASSWORD_RESET = {
        "anonymous": {"calls": 3, "period": 3600},  # 3 per hour
        "registered": {"calls": 3, "period": 3600},
        "premium": {"calls": 5, "period": 3600},
        "admin": {"calls": 10, "period": 3600}
    }
    
    API_CALLS = {
        "anonymous": {"calls": 50, "period": 3600},
        "registered": {"calls": 500, "period": 3600},
        "premium": {"calls": 5000, "period": 3600},
        "admin": {"calls": 50000, "period": 3600}
    }


async def name_generation_rate_limit(request: Request):
    """Rate limit for name generation endpoint"""
    result = await rate_limiter.check_rate_limit(
        request, 
        "name_generation", 
        EndpointRateLimits.NAME_GENERATION
    )
    
    if not result["allowed"]:
        raise RateLimitExceeded(
            detail="Name generation rate limit exceeded. Upgrade to premium for higher limits.",
            retry_after=result["retry_after"]
        )
    
    return result


async def login_rate_limit(request: Request):
    """Rate limit for login attempts"""
    result = await rate_limiter.check_rate_limit(
        request, 
        "login_attempts", 
        EndpointRateLimits.LOGIN_ATTEMPTS
    )
    
    if not result["allowed"]:
        raise RateLimitExceeded(
            detail="Too many login attempts. Please try again later.",
            retry_after=result["retry_after"]
        )
    
    return result


# Rate limit middleware
class RateLimitMiddleware:
    """Middleware to add rate limit headers to responses"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                
                # Add rate limit headers if available
                if hasattr(scope.get("state", {}), "rate_limit_headers"):
                    rate_headers = scope["state"].rate_limit_headers
                    for key, value in rate_headers.items():
                        headers[key.encode()] = value.encode()
                
                message["headers"] = list(headers.items())
            
            await send(message)
        
        await self.app(scope, receive, send_with_headers) 