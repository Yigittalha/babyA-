"""
Professional service layer with business logic, caching, and error handling
"""
import json
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
import openai
import structlog

from .config import settings
from .cache import redis_manager, CacheKeys, generate_cache_key, cached_function
from .database_models import (
    User, UserFavorite, NameGeneration, PopularName, 
    SubscriptionPlan, AuditLog, UserSubscriptionStatus
)
from .models import (
    NameGenerationRequest, NameGenerationResponse, NameSuggestion,
    UserRegistration, FavoriteNameCreate
)
from .auth import get_password_hash, verify_password
from .logging_config import app_logger, audit_logger, performance_monitor

logger = structlog.get_logger(__name__)


class NameGenerationService:
    """AI-powered name generation service with caching and analytics"""
    
    def __init__(self):
        self.client = None
        self._is_initialized = False
    
    @classmethod
    def initialize(cls):
        """Initialize the AI client"""
        try:
            # Initialize OpenRouter client
            openai.api_key = settings.OPENROUTER_API_KEY
            openai.api_base = settings.OPENROUTER_BASE_URL
            
            cls._is_initialized = True
            logger.info("NameGenerationService initialized successfully")
            
            except Exception as e:
            logger.error("Failed to initialize NameGenerationService", error=str(e))
            cls._is_initialized = False
    
    @classmethod
    def is_healthy(cls) -> bool:
        """Check if service is healthy"""
        return cls._is_initialized and bool(settings.OPENROUTER_API_KEY)
    
    @classmethod
    async def generate_names(
        cls, 
        request_data: NameGenerationRequest, 
        user: User, 
        db: Session
    ) -> NameGenerationResponse:
        """Generate names using AI with caching and user limits"""
        
        start_time = datetime.utcnow()
        
        try:
            # Check user limits
            if not await cls._check_user_limits(user, db):
                return NameGenerationResponse(
                    success=False,
                    names=[],
                    total_count=0,
                    is_premium_required=True,
                    premium_message="Upgrade to premium for unlimited name generation"
                )
            
            # Generate cache key
            cache_key = generate_cache_key(
                CacheKeys.NAME_SUGGESTIONS,
                theme=request_data.theme,
                gender=request_data.gender,
                culture=request_data.language
            )
            
            # Try to get from cache first
            cached_names = await redis_manager.get(cache_key)
            if cached_names and settings.ENABLE_CACHING:
                logger.info("Using cached names", user_id=user.id, cache_key=cache_key)
                
                # Apply user-specific filtering
                filtered_names = await cls._apply_user_preferences(cached_names, user)
                
                # Record usage
                await cls._record_generation(request_data, user, db, len(filtered_names), True)
                
                return NameGenerationResponse(
                    success=True,
                    names=filtered_names[:10],  # Limit to 10 names
                    total_count=len(filtered_names),
                    message="Names generated successfully (cached)"
                )
            
            # Generate new names using AI
            ai_response = await cls._generate_with_ai(request_data, user)
            
            if not ai_response:
                return NameGenerationResponse(
                    success=False,
                    names=[],
                    total_count=0,
                    message="Failed to generate names. Please try again."
                )
            
            # Parse and validate names
            names = await cls._parse_ai_response(ai_response, request_data)
            
            # Cache the results
            if settings.ENABLE_CACHING:
                await redis_manager.set(cache_key, names, expire=timedelta(hours=6))
            
            # Apply user-specific filtering
            filtered_names = await cls._apply_user_preferences(names, user)
            
            # Record generation
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            await cls._record_generation(request_data, user, db, len(filtered_names), True, response_time)
            
            # Update popular names
            await cls._update_popular_names(filtered_names, db)
            
            return NameGenerationResponse(
                success=True,
                names=filtered_names[:10],
                total_count=len(filtered_names),
                message="Names generated successfully"
            )
            
        except Exception as e:
            logger.error("Name generation failed", user_id=user.id, error=str(e))
            
            # Record failed generation
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            await cls._record_generation(request_data, user, db, 0, False, response_time, str(e))
            
            return NameGenerationResponse(
                success=False,
                names=[],
                total_count=0,
                message="Name generation failed. Please try again later."
            )
    
    @classmethod
    async def _check_user_limits(cls, user: User, db: Session) -> bool:
        """Check if user can generate more names"""
        
        # Admin users have no limits
        if user.is_admin:
            return True
        
        # Premium users have higher limits
        if user.is_premium_active():
            daily_limit = 100
        else:
            daily_limit = 10
        
        # Check daily usage
        today = datetime.utcnow().date()
        daily_count = db.query(NameGeneration).filter(
            and_(
                NameGeneration.user_id == user.id,
                func.date(NameGeneration.created_at) == today,
                NameGeneration.was_successful == True
            )
        ).count()
        
        return daily_count < daily_limit
    
    @classmethod
    async def _generate_with_ai(cls, request_data: NameGenerationRequest, user: User) -> Optional[str]:
        """Generate names using AI service"""
        
        try:
            # Build the prompt
            prompt = cls._build_prompt(request_data, user)
            
            # Call AI service
            response = await asyncio.to_thread(
                openai.ChatCompletion.create,
                model=settings.OPENROUTER_MODEL,
                messages=[
                    {"role": "system", "content": "You are a professional baby name consultant with expertise in multicultural names."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error("AI generation failed", error=str(e))
            return None
    
    @classmethod
    def _build_prompt(cls, request_data: NameGenerationRequest, user: User) -> str:
        """Build AI prompt based on request"""
        
        prompt = f"""
        Generate 10 beautiful {request_data.gender} baby names with the following criteria:
        
        - Language/Culture: {request_data.language}
        - Theme: {request_data.theme}
        - Gender: {request_data.gender}
        """
        
        if request_data.extra:
            prompt += f"\n- Additional requirements: {request_data.extra}"
        
        prompt += """
        
        For each name, provide:
        1. The name itself
        2. Meaning and significance
        3. Cultural origin
        4. Popularity level (rare/common/trending)
        
        Format as JSON array:
        [
            {
                "name": "Example Name",
                "meaning": "Beautiful meaning description",
                "origin": "Cultural origin",
                "popularity": "common",
                "gender": "female",
                "language": "turkish",
                "theme": "nature"
            }
        ]
        """
        
        return prompt
    
    @classmethod
    async def _parse_ai_response(cls, response: str, request_data: NameGenerationRequest) -> List[NameSuggestion]:
        """Parse AI response into structured data"""
        
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if not json_match:
                raise ValueError("No JSON array found in response")
            
            json_str = json_match.group(0)
            names_data = json.loads(json_str)
            
            # Convert to NameSuggestion objects
            names = []
            for name_data in names_data:
                try:
                    name_suggestion = NameSuggestion(
                        name=name_data.get("name", ""),
                        meaning=name_data.get("meaning", ""),
                        origin=name_data.get("origin", ""),
                        popularity=name_data.get("popularity", "common"),
                        gender=request_data.gender,
                        language=request_data.language,
                        theme=request_data.theme
                    )
                    names.append(name_suggestion)
        except Exception as e:
                    logger.warning("Failed to parse name entry", error=str(e), data=name_data)
                    continue
            
            return names
            
        except Exception as e:
            logger.error("Failed to parse AI response", error=str(e))
            return []

    @classmethod
    async def _apply_user_preferences(cls, names: List[NameSuggestion], user: User) -> List[NameSuggestion]:
        """Apply user-specific preferences and filtering"""
        
        # For now, just return as-is
        # In the future, could filter based on user preferences, favorites, etc.
                    return names
                
    @classmethod
    async def _record_generation(
        cls, 
        request_data: NameGenerationRequest, 
        user: User, 
        db: Session,
        names_count: int,
        success: bool,
        response_time: float = 0,
        error_message: Optional[str] = None
    ):
        """Record name generation for analytics"""
        
        try:
            generation = NameGeneration(
                user_id=user.id,
                gender=request_data.gender,
                language=request_data.language,
                theme=request_data.theme,
                extra_requirements=request_data.extra,
                names_generated=names_count,
                response_time_ms=int(response_time),
                was_successful=success,
                error_message=error_message,
                ai_model_used=settings.OPENROUTER_MODEL
            )
            
            db.add(generation)
            db.commit()
            
            # Update user statistics
            if success:
                user.total_name_generations += 1
                user.last_activity = datetime.utcnow()
                db.commit()
                
        except Exception as e:
            logger.error("Failed to record generation", error=str(e))
    
    @classmethod
    async def _update_popular_names(cls, names: List[NameSuggestion], db: Session):
        """Update popular names statistics"""
        
        try:
            for name in names:
                # Find or create popular name entry
                popular_name = db.query(PopularName).filter(
                    and_(
                        PopularName.name == name.name,
                        PopularName.gender == name.gender,
                        PopularName.language == name.language
                    )
                ).first()
                
                if popular_name:
                    popular_name.generation_count += 1
                    popular_name.updated_at = datetime.utcnow()
                else:
                    popular_name = PopularName(
                        name=name.name,
                        meaning=name.meaning,
                        origin=name.origin,
                        gender=name.gender,
                        language=name.language,
                        theme=name.theme,
                        popularity_score=1.0,
                        trend_direction="stable",
                        generation_count=1
                    )
                    db.add(popular_name)
            
            db.commit()
            
        except Exception as e:
            logger.error("Failed to update popular names", error=str(e))
    
    @classmethod
    async def get_popular_names(cls, limit: int = 50) -> List[Dict[str, Any]]:
        """Get popular names for cache warming"""
        
        try:
            # This would query the database for popular names
            # For now, return empty list
            return []
                
        except Exception as e:
            logger.error("Failed to get popular names", error=str(e))
            return []


class UserService:
    """User management service with authentication and profile management"""
    
    @staticmethod
    async def create_user(user_data: UserRegistration, db: Session) -> User:
        """Create a new user account"""
        
        try:
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == user_data.email).first()
            if existing_user:
                raise ValueError("Email already registered")
            
            # Create new user
            hashed_password = get_password_hash(user_data.password)
            
            user = User(
                email=user_data.email,
                password_hash=hashed_password,
                name=user_data.name,
                is_active=True,
                subscription_status=UserSubscriptionStatus.FREE
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            logger.info("User created successfully", user_id=user.id, email=user.email)
            return user
            
        except Exception as e:
            db.rollback()
            logger.error("User creation failed", error=str(e))
            raise
    
    @staticmethod
    async def authenticate_user(email: str, password: str, db: Session) -> Optional[User]:
        """Authenticate user with email and password"""
        
        try:
            user = db.query(User).filter(User.email == email).first()
            
            if not user:
                return None
            
            if user.is_account_locked():
                logger.warning("Login attempt on locked account", user_id=user.id)
                return None
            
            if not verify_password(password, user.password_hash):
                # Increment failed attempts
                user.failed_login_attempts += 1
                user.last_login_attempt = datetime.utcnow()
                
                # Lock account after 5 failed attempts
                if user.failed_login_attempts >= 5:
                    user.account_locked_until = datetime.utcnow() + timedelta(minutes=30)
                    logger.warning("Account locked due to failed attempts", user_id=user.id)
                
                db.commit()
                return None
            
            # Reset failed attempts on successful login
            user.failed_login_attempts = 0
            user.last_login_attempt = datetime.utcnow()
            user.last_activity = datetime.utcnow()
            user.account_locked_until = None
            db.commit()
            
            logger.info("User authenticated successfully", user_id=user.id)
            return user
            
        except Exception as e:
            logger.error("Authentication failed", error=str(e))
            return None
    
    @staticmethod
    async def get_total_users() -> int:
        """Get total number of users"""
        # This would query the database
        return 0
    
    @staticmethod
    async def list_users(skip: int, limit: int, db: Session) -> List[Dict[str, Any]]:
        """List users with pagination"""
        
        try:
            users = db.query(User).offset(skip).limit(limit).all()
            
            return [
                {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "is_active": user.is_active,
                    "subscription_status": user.subscription_status.value,
                    "created_at": user.created_at.isoformat(),
                    "last_activity": user.last_activity.isoformat()
                }
                for user in users
            ]
            
        except Exception as e:
            logger.error("Failed to list users", error=str(e))
            return []


class AnalyticsService:
    """Analytics and reporting service"""
    
    @classmethod
    def initialize(cls):
        """Initialize analytics service"""
        logger.info("AnalyticsService initialized")
    
    @classmethod
    async def start_collection(cls):
        """Start background analytics collection"""
        try:
            while True:
                await cls._collect_metrics()
                await asyncio.sleep(3600)  # Collect every hour
                
        except asyncio.CancelledError:
            logger.info("Analytics collection stopped")
        except Exception as e:
            logger.error("Analytics collection failed", error=str(e))
    
    @classmethod
    async def _collect_metrics(cls):
        """Collect system metrics"""
        try:
            # Collect Redis metrics
            if redis_manager.is_connected:
                # Store daily metrics in Redis
                today = datetime.utcnow().strftime("%Y-%m-%d")
                metrics_key = generate_cache_key(CacheKeys.ANALYTICS, date=today, metric="daily_stats")
                
                metrics = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "active_users": 0,  # Would calculate from database
                    "name_generations": 0,  # Would calculate from database
                    "api_calls": 0,  # Would calculate from logs
                }
                
                await redis_manager.set(metrics_key, metrics, expire=timedelta(days=30))
            
        except Exception as e:
            logger.error("Metrics collection failed", error=str(e))
    
    @classmethod
    async def get_system_analytics(cls, days: int = 30) -> Dict[str, Any]:
        """Get system analytics for the last N days"""
        
        try:
            # This would aggregate data from the database and Redis
            return {
                "period_days": days,
                "total_users": 0,
                "active_users": 0,
                "name_generations": 0,
                "api_calls": 0,
                "top_languages": [],
                "top_themes": [],
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Failed to get analytics", error=str(e))
            return {}


class SubscriptionService:
    """Subscription and billing service"""
    
    @classmethod
    def initialize(cls):
        """Initialize subscription service"""
        logger.info("SubscriptionService initialized")
    
    @classmethod
    async def get_subscription_plans(cls, db: Session) -> List[SubscriptionPlan]:
        """Get available subscription plans"""
        
        try:
            plans = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.is_active == True
            ).order_by(SubscriptionPlan.price).all()
            
            return plans
            
        except Exception as e:
            logger.error("Failed to get subscription plans", error=str(e))
            return []

    @classmethod
    async def upgrade_user_subscription(
        cls, 
        user: User, 
        plan_id: int, 
        db: Session
    ) -> bool:
        """Upgrade user to premium subscription"""
        
        try:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
            if not plan:
                return False
            
            # Update user subscription
            user.subscription_status = UserSubscriptionStatus.ACTIVE
            user.premium_until = datetime.utcnow() + timedelta(days=plan.billing_period_days)
            user.subscription_plan_id = plan_id
            
            db.commit()
            
            # Log subscription upgrade
            audit_logger.log_user_action(
                user_id=user.id,
                action="subscription_upgrade",
                resource="subscription",
                details={"plan_id": plan_id, "plan_name": plan.name},
                success=True
            )
            
            logger.info("User subscription upgraded", user_id=user.id, plan_id=plan_id)
            return True
            
        except Exception as e:
            db.rollback()
            logger.error("Subscription upgrade failed", user_id=user.id, error=str(e))
            return False
        

class FavoriteService:
    """User favorites management service"""
    
    @staticmethod
    async def add_favorite(
        user: User,
        favorite_data: FavoriteNameCreate,
        db: Session
    ) -> Optional[UserFavorite]:
        """Add name to user favorites"""
        
        try:
            # Check if already favorited
            existing = db.query(UserFavorite).filter(
                and_(
                    UserFavorite.user_id == user.id,
                    UserFavorite.name == favorite_data.name,
                    UserFavorite.gender == favorite_data.gender,
                    UserFavorite.language == favorite_data.language
                )
            ).first()
            
            if existing:
                return existing
            
            # Create new favorite
            favorite = UserFavorite(
                user_id=user.id,
                name=favorite_data.name,
                meaning=favorite_data.meaning,
                gender=favorite_data.gender,
                language=favorite_data.language,
                theme=favorite_data.theme,
                notes=favorite_data.notes
            )
            
            db.add(favorite)
            db.commit()
            db.refresh(favorite)
            
            # Update popular names
            await cls._update_favorite_count(favorite_data.name, favorite_data.gender, favorite_data.language, db)
            
            logger.info("Favorite added", user_id=user.id, name=favorite_data.name)
            return favorite
            
        except Exception as e:
            db.rollback()
            logger.error("Failed to add favorite", user_id=user.id, error=str(e))
            return None
    
    @staticmethod
    async def _update_favorite_count(name: str, gender: str, language: str, db: Session):
        """Update favorite count in popular names"""
        
        try:
            popular_name = db.query(PopularName).filter(
                and_(
                    PopularName.name == name,
                    PopularName.gender == gender,
                    PopularName.language == language
                )
            ).first()
            
            if popular_name:
                popular_name.favorite_count += 1
                popular_name.updated_at = datetime.utcnow()
                db.commit()
                
            except Exception as e:
            logger.error("Failed to update favorite count", error=str(e)) 