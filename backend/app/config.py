"""
Professional configuration management for Baby AI application
"""
import os
from typing import Optional, List, Annotated
from pydantic_settings import BaseSettings
from pydantic import field_validator, BeforeValidator
from functools import lru_cache


def parse_cors_origins(v):
    """Parse CORS origins from string or list"""
    if isinstance(v, str):
        return [i.strip() for i in v.split(",") if i.strip()]
    return v


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application
    APP_NAME: str = "Baby AI - Professional Baby Name Generator"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"  # development, staging, production
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = False
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175"
    
    def get_cors_origins(self) -> List[str]:
        """Get CORS origins as list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    # Database
    DATABASE_URL: str = "sqlite:///./baby_names.db"
    DATABASE_ECHO: bool = False
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    REDIS_SSL: bool = False
    REDIS_DECODE_RESPONSES: bool = True
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_CALLS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds
    PREMIUM_RATE_LIMIT_CALLS: int = 1000
    ADMIN_RATE_LIMIT_CALLS: int = 10000
    
    # OpenRouter AI
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "anthropic/claude-3-haiku"
    
    # Email Configuration
    MAIL_USERNAME: Optional[str] = None
    MAIL_PASSWORD: Optional[str] = None
    MAIL_FROM: Optional[str] = None
    MAIL_PORT: int = 587
    MAIL_SERVER: Optional[str] = None
    MAIL_TLS: bool = True
    MAIL_SSL: bool = False
    
    # Monitoring & Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json, text
    ENABLE_METRICS: bool = True
    SENTRY_DSN: Optional[str] = None
    
    # CDN & Storage
    CDN_URL: Optional[str] = None
    STATIC_FILES_URL: str = "/static"
    UPLOAD_MAX_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Security Headers
    SECURITY_HEADERS_ENABLED: bool = True
    HTTPS_ONLY: bool = True
    HSTS_MAX_AGE: int = 31536000  # 1 year
    
    # Feature Flags
    ENABLE_ANALYTICS: bool = True
    ENABLE_CACHING: bool = True
    ENABLE_BACKGROUND_TASKS: bool = True
    

    
    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v):
        if v not in ["development", "staging", "production"]:
            raise ValueError("ENVIRONMENT must be one of: development, staging, production")
        return v
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()


# Environment-specific configurations
class DevelopmentConfig(Settings):
    DEBUG: bool = True
    DATABASE_ECHO: bool = True
    RELOAD: bool = True
    RATE_LIMIT_CALLS: int = 1000
    HTTPS_ONLY: bool = False


class ProductionConfig(Settings):
    DEBUG: bool = False
    DATABASE_ECHO: bool = False
    RELOAD: bool = False
    HTTPS_ONLY: bool = True
    SECURITY_HEADERS_ENABLED: bool = True


def get_config() -> Settings:
    """Get environment-specific configuration"""
    env = os.getenv("ENVIRONMENT", "production")
    
    if env == "development":
        return DevelopmentConfig()
    elif env == "staging":
        return Settings()
    else:
        return ProductionConfig() 