"""
Simplified SQLAlchemy database models for authentication only
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()


class User(Base):
    """Simplified User model for authentication"""
    __tablename__ = "users"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Authentication fields
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Profile information
    name = Column(String(100), nullable=False, index=True)
    
    # Subscription information (matching existing database schema)
    subscription_type = Column(String(50), default="free", nullable=False, index=True)
    subscription_expires = Column(DateTime, nullable=True, index=True)
    
    # Status and permissions (simplified to match existing schema)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_admin = Column(Boolean, default=False, nullable=False, index=True)
    is_verified = Column(Boolean, default=True, nullable=False)  # Default to True for existing users
    
    # Optional fields (will be null for existing users)
    last_login = Column(DateTime, nullable=True)  # Use last_login instead of last_login_attempt to match existing
    
    # Timestamps (matching existing schema)
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    
    # No relationships to avoid foreign key issues
    
    # Simplified indexes for existing schema
    __table_args__ = (
        Index('idx_user_email_subscription', 'email', 'subscription_type'),
        Index('idx_user_subscription_active', 'subscription_type', 'is_active'),
        Index('idx_user_admin', 'is_admin'),
    )
    
    def is_premium_active(self) -> bool:
        """Check if user has active premium subscription"""
        if self.subscription_type in ["standard", "premium"]:
            return self.subscription_expires is None or self.subscription_expires > datetime.utcnow()
        return False
    
    @staticmethod
    def validate_email(email):
        """Validate email format"""
        if not email or '@' not in email:
            raise ValueError("Invalid email format")
        return email.lower() 