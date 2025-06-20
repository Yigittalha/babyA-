"""
Professional SQLAlchemy database models with optimized indexing and relationships
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Float, 
    ForeignKey, Index, UniqueConstraint, CheckConstraint,
    Enum as SQLEnum, JSON, BigInteger, SmallInteger
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from datetime import datetime, timedelta
from typing import Optional
import enum

Base = declarative_base()


class UserSubscriptionStatus(str, enum.Enum):
    """User subscription status enum"""
    FREE = "free"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    TRIAL = "trial"


class UserStatus(str, enum.Enum):
    """User account status enum"""
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class User(Base):
    """Enhanced User model with indexing and security features"""
    __tablename__ = "users"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Authentication fields
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Profile information
    name = Column(String(100), nullable=False, index=True)
    
    # Status and permissions
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_admin = Column(Boolean, default=False, nullable=False, index=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Subscription information
    subscription_status = Column(
        SQLEnum(UserSubscriptionStatus), 
        default=UserSubscriptionStatus.FREE, 
        nullable=False,
        index=True
    )
    premium_until = Column(DateTime, nullable=True, index=True)
    subscription_plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=True)
    
    # Account status
    status = Column(
        SQLEnum(UserStatus), 
        default=UserStatus.ACTIVE, 
        nullable=False,
        index=True
    )
    
    # Security fields
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    last_login_attempt = Column(DateTime, nullable=True)
    account_locked_until = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Contact and preference fields
    preferred_language = Column(String(10), default="turkish", nullable=False)
    timezone = Column(String(50), default="Europe/Istanbul", nullable=False)
    
    # Usage tracking
    total_name_generations = Column(Integer, default=0, nullable=False)
    last_activity = Column(DateTime, default=func.now(), nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime, nullable=True, index=True)  # Soft delete
    
    # Relationships
    favorites = relationship("UserFavorite", back_populates="user", cascade="all, delete-orphan")
    name_generations = relationship("NameGeneration", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    subscription_plan = relationship("SubscriptionPlan", back_populates="users")
    user_sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_user_email_status', 'email', 'status'),
        Index('idx_user_subscription_active', 'subscription_status', 'is_active'),
        Index('idx_user_created_status', 'created_at', 'status'),
        Index('idx_user_activity', 'last_activity', 'is_active'),
        Index('idx_user_premium', 'premium_until', 'subscription_status'),
        CheckConstraint('failed_login_attempts >= 0', name='check_failed_attempts_positive'),
        CheckConstraint('total_name_generations >= 0', name='check_generations_positive'),
    )
    
    def is_premium_active(self) -> bool:
        """Check if user has active premium subscription"""
        if self.subscription_status == UserSubscriptionStatus.ACTIVE:
            return self.premium_until is None or self.premium_until > datetime.utcnow()
        return False
    
    def is_account_locked(self) -> bool:
        """Check if account is temporarily locked"""
        if self.account_locked_until:
            return self.account_locked_until > datetime.utcnow()
        return False
    
    @validates('email')
    def validate_email(self, key, email):
        """Validate email format"""
        if not email or '@' not in email:
            raise ValueError("Invalid email format")
        return email.lower()


class SubscriptionPlan(Base):
    """Subscription plans with features and limits"""
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    
    # Pricing
    price = Column(Float, nullable=False)
    currency = Column(String(3), default="TRY", nullable=False)
    billing_period_days = Column(Integer, nullable=False)
    
    # Limits and features
    max_names_per_request = Column(Integer, default=10, nullable=False)
    max_requests_per_day = Column(Integer, nullable=True)  # NULL = unlimited
    max_favorites = Column(Integer, nullable=True)  # NULL = unlimited
    
    # Feature flags
    has_advanced_features = Column(Boolean, default=False, nullable=False)
    has_analytics = Column(Boolean, default=False, nullable=False)
    has_priority_support = Column(Boolean, default=False, nullable=False)
    has_api_access = Column(Boolean, default=False, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="subscription_plan")
    
    __table_args__ = (
        Index('idx_plan_active_price', 'is_active', 'price'),
        CheckConstraint('price >= 0', name='check_price_positive'),
        CheckConstraint('billing_period_days > 0', name='check_billing_period_positive'),
        CheckConstraint('max_names_per_request > 0', name='check_max_names_positive'),
    )


class UserFavorite(Base):
    """User favorite names with enhanced tracking"""
    __tablename__ = "user_favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Name information
    name = Column(String(100), nullable=False, index=True)
    meaning = Column(Text, nullable=False)
    origin = Column(String(100), nullable=True)
    gender = Column(String(20), nullable=False, index=True)
    language = Column(String(50), nullable=False, index=True)
    theme = Column(String(50), nullable=False, index=True)
    
    # User notes and rating
    notes = Column(Text, nullable=True)
    user_rating = Column(SmallInteger, nullable=True)  # 1-5 stars
    
    # Tracking fields
    times_viewed = Column(Integer, default=0, nullable=False)
    shared_count = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    last_viewed = Column(DateTime, default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="favorites")
    
    __table_args__ = (
        # Prevent duplicate favorites for same user
        UniqueConstraint('user_id', 'name', 'gender', 'language', name='uq_user_favorite'),
        Index('idx_favorite_user_created', 'user_id', 'created_at'),
        Index('idx_favorite_name_gender', 'name', 'gender'),
        Index('idx_favorite_language_theme', 'language', 'theme'),
        Index('idx_favorite_user_rating', 'user_id', 'user_rating'),
        CheckConstraint('user_rating >= 1 AND user_rating <= 5', name='check_rating_range'),
        CheckConstraint('times_viewed >= 0', name='check_views_positive'),
    )


class NameGeneration(Base):
    """Track name generation requests for analytics"""
    __tablename__ = "name_generations"
    
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Request parameters
    gender = Column(String(20), nullable=False, index=True)
    language = Column(String(50), nullable=False, index=True)
    theme = Column(String(50), nullable=False, index=True)
    extra_requirements = Column(Text, nullable=True)
    
    # Response information
    names_generated = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, nullable=False)
    was_successful = Column(Boolean, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    
    # Request metadata
    ip_address = Column(String(45), nullable=True, index=True)  # Support IPv6
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(36), nullable=True, index=True)  # UUID
    
    # AI model information
    ai_model_used = Column(String(100), nullable=True)
    ai_tokens_used = Column(Integer, nullable=True)
    ai_cost = Column(Float, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="name_generations")
    
    __table_args__ = (
        Index('idx_generation_user_date', 'user_id', 'created_at'),
        Index('idx_generation_params', 'gender', 'language', 'theme'),
        Index('idx_generation_success_date', 'was_successful', 'created_at'),
        Index('idx_generation_ip_date', 'ip_address', 'created_at'),
        CheckConstraint('names_generated >= 0', name='check_names_positive'),
        CheckConstraint('response_time_ms >= 0', name='check_response_time_positive'),
    )


class PopularName(Base):
    """Popular names tracking and caching"""
    __tablename__ = "popular_names"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    meaning = Column(Text, nullable=False)
    origin = Column(String(100), nullable=True)
    
    # Demographics
    gender = Column(String(20), nullable=False, index=True)
    language = Column(String(50), nullable=False, index=True)
    theme = Column(String(50), nullable=False, index=True)
    
    # Popularity metrics
    popularity_score = Column(Float, nullable=False, index=True)
    trend_direction = Column(String(10), nullable=False)  # up, down, stable
    generation_count = Column(Integer, default=0, nullable=False)
    favorite_count = Column(Integer, default=0, nullable=False)
    
    # Regional data
    country_popularity = Column(JSON, nullable=True)  # Country-specific popularity
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False, index=True)
    
    __table_args__ = (
        UniqueConstraint('name', 'gender', 'language', name='uq_popular_name'),
        Index('idx_popular_score', 'popularity_score', 'updated_at'),
        Index('idx_popular_params', 'gender', 'language', 'theme'),
        Index('idx_popular_trend', 'trend_direction', 'popularity_score'),
        CheckConstraint('popularity_score >= 0', name='check_popularity_positive'),
        CheckConstraint('generation_count >= 0', name='check_generation_count_positive'),
        CheckConstraint('favorite_count >= 0', name='check_favorite_count_positive'),
    )


class UserSession(Base):
    """Track user sessions for security and analytics"""
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Session identification
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    refresh_token_hash = Column(String(255), nullable=True, index=True)
    
    # Session metadata
    ip_address = Column(String(45), nullable=True, index=True)
    user_agent = Column(Text, nullable=True)
    device_info = Column(JSON, nullable=True)
    location_info = Column(JSON, nullable=True)
    
    # Session status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    login_method = Column(String(50), default="password", nullable=False)  # password, oauth, etc.
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    last_activity = Column(DateTime, default=func.now(), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="user_sessions")
    
    __table_args__ = (
        Index('idx_session_user_active', 'user_id', 'is_active'),
        Index('idx_session_token_expires', 'session_token', 'expires_at'),
        Index('idx_session_ip_created', 'ip_address', 'created_at'),
        Index('idx_session_activity', 'last_activity', 'is_active'),
    )


class AuditLog(Base):
    """Comprehensive audit logging for security and compliance"""
    __tablename__ = "audit_logs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Action information
    action = Column(String(100), nullable=False, index=True)
    resource = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(100), nullable=True, index=True)
    
    # Request information
    ip_address = Column(String(45), nullable=True, index=True)
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(36), nullable=True, index=True)
    
    # Action details
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    additional_data = Column(JSON, nullable=True)
    
    # Result
    success = Column(Boolean, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    
    # Severity and categorization
    severity = Column(String(20), default="info", nullable=False, index=True)  # info, warning, error, critical
    category = Column(String(50), nullable=False, index=True)  # auth, user_action, admin, system
    
    # Timestamp
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    __table_args__ = (
        Index('idx_audit_user_action', 'user_id', 'action'),
        Index('idx_audit_resource', 'resource', 'resource_id'),
        Index('idx_audit_date_severity', 'created_at', 'severity'),
        Index('idx_audit_category_date', 'category', 'created_at'),
        Index('idx_audit_ip_date', 'ip_address', 'created_at'),
        Index('idx_audit_success_date', 'success', 'created_at'),
    )


class APIUsage(Base):
    """Track API usage for rate limiting and analytics"""
    __tablename__ = "api_usage"
    
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Request information
    endpoint = Column(String(200), nullable=False, index=True)
    method = Column(String(10), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True, index=True)
    
    # Response information
    status_code = Column(Integer, nullable=False, index=True)
    response_time_ms = Column(Integer, nullable=False)
    response_size_bytes = Column(Integer, nullable=True)
    
    # Usage tracking
    daily_usage_key = Column(String(50), nullable=False, index=True)  # user_id:date or ip:date
    request_count = Column(Integer, default=1, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    date_key = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD for partitioning
    
    __table_args__ = (
        Index('idx_api_usage_daily', 'daily_usage_key', 'date_key'),
        Index('idx_api_usage_endpoint_date', 'endpoint', 'date_key'),
        Index('idx_api_usage_user_date', 'user_id', 'date_key'),
        Index('idx_api_usage_status_date', 'status_code', 'date_key'),
        CheckConstraint('response_time_ms >= 0', name='check_response_time_positive'),
        CheckConstraint('request_count > 0', name='check_request_count_positive'),
    )


# Additional utility functions for model operations
def create_indexes():
    """Create additional database indexes for performance optimization"""
    # This would be called during database migration
    pass


# Database partitioning suggestions (for large scale)
"""
For high-traffic applications, consider partitioning these tables:

1. name_generations - partition by created_at (monthly)
2. audit_logs - partition by created_at (monthly) 
3. api_usage - partition by date_key (daily/weekly)

Example PostgreSQL partitioning:
CREATE TABLE name_generations_y2024m01 PARTITION OF name_generations
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
""" 