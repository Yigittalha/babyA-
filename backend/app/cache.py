"""
Redis cache manager with connection pooling and professional error handling
"""
import json
import pickle
from typing import Any, Optional, Union, Dict
from datetime import timedelta
import redis
from redis.connection import ConnectionPool
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError
import structlog
from contextlib import asynccontextmanager

from .config import settings

logger = structlog.get_logger(__name__)


class RedisManager:
    """Professional Redis manager with connection pooling and error handling"""
    
    def __init__(self):
        self.pool: Optional[ConnectionPool] = None
        self.redis_client: Optional[redis.Redis] = None
        self._is_connected = False
    
    async def connect(self) -> bool:
        """Initialize Redis connection with error handling"""
        try:
            # Create connection pool
            self.pool = ConnectionPool.from_url(
                settings.REDIS_URL,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                decode_responses=settings.REDIS_DECODE_RESPONSES,
                max_connections=20,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Create Redis client
            self.redis_client = redis.Redis(
                connection_pool=self.pool,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test connection
            await self._test_connection()
            self._is_connected = True
            
            logger.info("Redis connection established successfully")
            return True
            
        except Exception as e:
            logger.error("Failed to connect to Redis", error=str(e))
            self._is_connected = False
            return False
    
    async def disconnect(self):
        """Close Redis connections gracefully"""
        if self.redis_client:
            await self.redis_client.close()
        if self.pool:
            await self.pool.disconnect()
        self._is_connected = False
        logger.info("Redis connection closed")
    
    async def _test_connection(self):
        """Test Redis connection"""
        if not self.redis_client:
            raise RedisConnectionError("Redis client not initialized")
        
        # Test with ping
        result = self.redis_client.ping()
        if not result:
            raise RedisConnectionError("Redis ping failed")
    
    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected"""
        return self._is_connected and self.redis_client is not None
    
    async def get(self, key: str, default: Any = None) -> Any:
        """Get value from Redis with error handling"""
        if not self.is_connected:
            logger.warning("Redis not connected, returning default value")
            return default
        
        try:
            value = self.redis_client.get(key)
            if value is None:
                return default
            
            # Try to deserialize JSON first, then pickle
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                try:
                    return pickle.loads(value)
                except (pickle.PickleError, TypeError):
                    return value
                    
        except RedisError as e:
            logger.error("Redis get operation failed", key=key, error=str(e))
            return default
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        expire: Optional[Union[int, timedelta]] = None,
        serializer: str = "json"
    ) -> bool:
        """Set value in Redis with serialization and expiration"""
        if not self.is_connected:
            logger.warning("Redis not connected, skipping set operation")
            return False
        
        try:
            # Serialize value
            if serializer == "json":
                try:
                    serialized_value = json.dumps(value)
                except (TypeError, ValueError):
                    # Fallback to pickle for complex objects
                    serialized_value = pickle.dumps(value)
            else:
                serialized_value = pickle.dumps(value)
            
            # Set with expiration
            if expire:
                if isinstance(expire, timedelta):
                    expire = int(expire.total_seconds())
                return self.redis_client.setex(key, expire, serialized_value)
            else:
                return self.redis_client.set(key, serialized_value)
                
        except RedisError as e:
            logger.error("Redis set operation failed", key=key, error=str(e))
            return False
    
    async def delete(self, *keys: str) -> int:
        """Delete keys from Redis"""
        if not self.is_connected:
            return 0
        
        try:
            return self.redis_client.delete(*keys)
        except RedisError as e:
            logger.error("Redis delete operation failed", keys=keys, error=str(e))
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis"""
        if not self.is_connected:
            return False
        
        try:
            return bool(self.redis_client.exists(key))
        except RedisError as e:
            logger.error("Redis exists operation failed", key=key, error=str(e))
            return False
    
    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment counter in Redis"""
        if not self.is_connected:
            return None
        
        try:
            return self.redis_client.incrby(key, amount)
        except RedisError as e:
            logger.error("Redis increment operation failed", key=key, error=str(e))
            return None
    
    async def expire(self, key: str, time: Union[int, timedelta]) -> bool:
        """Set expiration for key"""
        if not self.is_connected:
            return False
        
        try:
            if isinstance(time, timedelta):
                time = int(time.total_seconds())
            return self.redis_client.expire(key, time)
        except RedisError as e:
            logger.error("Redis expire operation failed", key=key, error=str(e))
            return False
    
    async def get_multiple(self, keys: list[str]) -> Dict[str, Any]:
        """Get multiple values at once"""
        if not self.is_connected:
            return {}
        
        try:
            values = self.redis_client.mget(keys)
            result = {}
            
            for key, value in zip(keys, values):
                if value is not None:
                    try:
                        result[key] = json.loads(value)
                    except (json.JSONDecodeError, TypeError):
                        try:
                            result[key] = pickle.loads(value)
                        except (pickle.PickleError, TypeError):
                            result[key] = value
                            
            return result
            
        except RedisError as e:
            logger.error("Redis mget operation failed", keys=keys, error=str(e))
            return {}
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear keys matching pattern"""
        if not self.is_connected:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except RedisError as e:
            logger.error("Redis pattern clear failed", pattern=pattern, error=str(e))
            return 0


# Global Redis manager instance
redis_manager = RedisManager()


@asynccontextmanager
async def get_redis():
    """Context manager for Redis operations"""
    if not redis_manager.is_connected:
        await redis_manager.connect()
    
    try:
        yield redis_manager
    except Exception as e:
        logger.error("Redis operation error", error=str(e))
        raise


# Cache decorators and utilities
class CacheKeys:
    """Cache key constants"""
    USER_PROFILE = "user:profile:{user_id}"
    NAME_SUGGESTIONS = "names:suggestions:{theme}:{gender}:{culture}"
    RATE_LIMIT = "rate_limit:{identifier}"
    SESSION = "session:{token}"
    ANALYTICS = "analytics:{date}:{metric}"
    TRENDING_NAMES = "trending:names:{period}"


def generate_cache_key(template: str, **kwargs) -> str:
    """Generate cache key from template"""
    try:
        return template.format(**kwargs)
    except KeyError as e:
        logger.error("Missing key for cache template", template=template, missing_key=str(e))
        return f"invalid_key_{hash(template)}"


async def cached_function(
    cache_key: str,
    expire: Union[int, timedelta] = 3600,
    serializer: str = "json"
):
    """Decorator for caching function results"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Try to get from cache
            cached_result = await redis_manager.get(cache_key)
            if cached_result is not None:
                logger.debug("Cache hit", key=cache_key)
                return cached_result
            
            # Execute function and cache result
            logger.debug("Cache miss, executing function", key=cache_key)
            result = await func(*args, **kwargs)
            
            # Cache the result
            await redis_manager.set(cache_key, result, expire, serializer)
            return result
        
        return wrapper
    return decorator 