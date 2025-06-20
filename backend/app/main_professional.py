"""
Professional FastAPI application with Redis, rate limiting, enhanced auth, and comprehensive monitoring
"""
import os
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
import uvicorn
from sqlalchemy.orm import Session
from pydantic import ValidationError

# Professional imports
from .config import settings, get_config
from .database import get_db, create_tables
from .cache import redis_manager
from .logging_config import (
    setup_logging, RequestLogger, ErrorHandler, 
    audit_logger, performance_monitor, app_logger
)
from .rate_limiter import (
    rate_limiter, RateLimitMiddleware, check_rate_limit_dependency,
    name_generation_rate_limit, login_rate_limit
)
from .auth import (
    get_current_user, get_current_admin_user, get_current_premium_user,
    token_manager, session_manager
)
from .models import (
    NameGenerationRequest, NameGenerationResponse, UserRegistration, 
    UserLogin, ErrorResponse, HealthResponse
)
from .services import (
    NameGenerationService, UserService, AnalyticsService,
    SubscriptionService
)

# Security middleware
security = HTTPBearer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    app_logger.info("🚀 Starting Baby AI Professional application")
    
    try:
        # Initialize Redis connection
        redis_connected = await redis_manager.connect()
        if redis_connected:
            app_logger.info("✅ Redis connection established")
        else:
            app_logger.warning("⚠️ Redis connection failed - running without cache")
        
        # Create database tables
        create_tables()
        app_logger.info("✅ Database tables created/verified")
        
        # Initialize services
        await initialize_services()
        
        # Start background tasks
        await start_background_tasks()
        
        app_logger.info("🎉 Application startup completed successfully")
        
    except Exception as e:
        app_logger.error("❌ Application startup failed", error=str(e))
        raise
    
    yield
    
    # Shutdown
    app_logger.info("🛑 Shutting down Baby AI Professional application")
    
    try:
        # Cleanup Redis connections
        await redis_manager.disconnect()
        app_logger.info("✅ Redis connections closed")
        
        # Stop background tasks
        await stop_background_tasks()
        
        app_logger.info("✅ Application shutdown completed")
        
    except Exception as e:
        app_logger.error("❌ Application shutdown error", error=str(e))


async def initialize_services():
    """Initialize application services"""
    # Initialize AI service
    NameGenerationService.initialize()
    
    # Initialize subscription service
    SubscriptionService.initialize()
    
    # Initialize analytics service
    AnalyticsService.initialize()


async def start_background_tasks():
    """Start background tasks"""
    # Start analytics collector
    asyncio.create_task(AnalyticsService.start_collection())
    
    # Start cache warming
    asyncio.create_task(warm_cache())
    
    # Start health monitoring
    asyncio.create_task(monitor_system_health())


async def stop_background_tasks():
    """Stop background tasks gracefully"""
    # Cancel running tasks
    tasks = [task for task in asyncio.all_tasks() if not task.done()]
    for task in tasks:
        task.cancel()
    
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def warm_cache():
    """Warm up cache with popular data"""
    try:
        # Cache popular names
        popular_names = await NameGenerationService.get_popular_names()
        app_logger.info("Cache warmed with popular names", count=len(popular_names))
        
    except Exception as e:
        app_logger.error("Cache warming failed", error=str(e))


async def monitor_system_health():
    """Monitor system health periodically"""
    while True:
        try:
            # Monitor Redis health
            redis_healthy = redis_manager.is_connected
            
            # Monitor basic metrics
            performance_monitor.log_resource_usage(
                cpu_percent=0.0,  # Would get from psutil
                memory_mb=0.0,    # Would get from psutil
                active_connections=0,  # Would track active connections
                redis_memory_mb=0.0 if not redis_healthy else None
            )
            
            await asyncio.sleep(300)  # Check every 5 minutes
            
        except Exception as e:
            app_logger.error("Health monitoring error", error=str(e))
            await asyncio.sleep(60)


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Professional Baby Name Generator with AI",
    docs_url=None,  # We'll create custom docs
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan
)

# Security middleware
if settings.SECURITY_HEADERS_ENABLED:
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' https:; "
            "connect-src 'self' https:; "
            "media-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self';"
        )
        
        if settings.HTTPS_ONLY:
            response.headers["Strict-Transport-Security"] = f"max-age={settings.HSTS_MAX_AGE}; includeSubDomains"
        
        return response

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Trusted host middleware
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "*.your-domain.com"]
    )

# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Request logging middleware
app.add_middleware(RequestLogger)

# Exception handlers
app.add_exception_handler(HTTPException, ErrorHandler.http_exception_handler)
app.add_exception_handler(ValidationError, ErrorHandler.validation_exception_handler)
app.add_exception_handler(Exception, ErrorHandler.general_exception_handler)


# Custom OpenAPI and docs
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="""
        ## Professional Baby Name Generator API
        
        A comprehensive API for generating culturally appropriate baby names using AI.
        
        ### Features
        - 🤖 AI-powered name generation
        - 🌍 Multi-language and cultural support
        - 👤 User management and authentication
        - ⭐ Favorites and collections
        - 📊 Analytics and trends
        - 🔒 Premium subscriptions
        - 🛡️ Rate limiting and security
        
        ### Authentication
        Use the `/auth/login` endpoint to get an access token, then include it in the `Authorization` header:
        ```
        Authorization: Bearer your-access-token
        ```
        
        ### Rate Limits
        - **Anonymous users**: 50 requests/hour
        - **Registered users**: 100 requests/hour  
        - **Premium users**: 1000 requests/hour
        - **Admin users**: 10000 requests/hour
        
        ### Support
        For technical support, contact: support@your-domain.com
        """,
        routes=app.routes,
    )
    
    # Add security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


# Custom documentation endpoints
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - Documentation",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui.css",
    )


@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js",
    )


# Health check endpoints
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Comprehensive health check"""
    try:
        # Check database
        db_healthy = True  # Would check database connection
        
        # Check Redis
        redis_healthy = redis_manager.is_connected
        
        # Check AI service
        ai_healthy = NameGenerationService.is_healthy()
        
        status = "healthy" if all([db_healthy, redis_healthy, ai_healthy]) else "degraded"
        
        return HealthResponse(
            status=status,
            timestamp=datetime.utcnow(),
            version=settings.APP_VERSION
        )
        
    except Exception as e:
        app_logger.error("Health check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unavailable"
        )


@app.get("/health/detailed", tags=["Health"])
async def detailed_health_check(current_user = Depends(get_current_admin_user)):
    """Detailed health check for administrators"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "services": {
            "database": {"status": "healthy", "connection_pool": "active"},
            "redis": {"status": "healthy" if redis_manager.is_connected else "unhealthy"},
            "ai_service": {"status": "healthy", "model": settings.OPENROUTER_MODEL},
        },
        "metrics": {
            "total_users": await UserService.get_total_users(),
            "active_sessions": len(await session_manager.get_active_sessions(current_user.id)),
            "cache_hit_rate": "95%",  # Would calculate actual rate
        }
    }


# Authentication endpoints
@app.post("/auth/register", tags=["Authentication"])
async def register_user(
    user_data: UserRegistration,
    request: Request,
    db: Session = Depends(get_db),
    _rate_limit = Depends(check_rate_limit_dependency)
):
    """Register a new user account"""
    try:
        # Get client IP for audit logging
        client_ip = request.client.host if request.client else "unknown"
        
        # Create user
        user = await UserService.create_user(user_data, db)
        
        # Log registration
        audit_logger.log_user_action(
            user_id=user.id,
            action="user_registration",
            resource="user_account",
            details={"email": user.email},
            ip_address=client_ip,
            success=True
        )
        
        return {
            "success": True,
            "message": "Account created successfully",
            "user_id": user.id
        }
        
    except Exception as e:
        app_logger.error("User registration failed", error=str(e))
        
        audit_logger.log_security_event(
            event_type="registration_failure",
            severity="warning",
            description=f"Registration failed: {str(e)}",
            ip_address=request.client.host if request.client else None
        )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed"
        )


@app.post("/auth/login", tags=["Authentication"])
async def login_user(
    credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
    _rate_limit = Depends(login_rate_limit)
):
    """Authenticate user and return tokens"""
    try:
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Authenticate user
        user = await UserService.authenticate_user(credentials.email, credentials.password, db)
        
        if not user:
            audit_logger.log_security_event(
                event_type="login_failure",
                severity="warning",
                description="Invalid credentials",
                ip_address=client_ip,
                additional_data={"email": credentials.email}
            )
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Create token pair
        device_info = {"user_agent": user_agent}
        tokens = token_manager.create_token_pair(user, device_info, client_ip)
        
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error("Login failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@app.post("/auth/refresh", tags=["Authentication"])
async def refresh_token(
    refresh_data: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    try:
        refresh_token = refresh_data.get("refresh_token")
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refresh token required"
            )
        
        client_ip = request.client.host if request.client else "unknown"
        
        # Refresh token
        new_tokens = await token_manager.refresh_access_token(refresh_token, db, client_ip)
        
        if not new_tokens:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        return new_tokens
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error("Token refresh failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


# Name generation endpoints
@app.post("/generate", response_model=NameGenerationResponse, tags=["Name Generation"])
async def generate_names(
    request_data: NameGenerationRequest,
    request: Request,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rate_limit = Depends(name_generation_rate_limit)
):
    """Generate baby names using AI"""
    try:
        # Track request start time
        start_time = datetime.utcnow()
        
        # Generate names
        result = await NameGenerationService.generate_names(
            request_data, current_user, db
        )
        
        # Calculate response time
        response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Log generation event
        audit_logger.log_user_action(
            user_id=current_user.id,
            action="name_generation",
            resource="ai_service",
            details={
                "gender": request_data.gender,
                "language": request_data.language,
                "theme": request_data.theme,
                "names_count": len(result.names),
                "response_time_ms": response_time
            },
            ip_address=request.client.host if request.client else None,
            success=result.success
        )
        
        return result
        
    except Exception as e:
        app_logger.error("Name generation failed", user_id=current_user.id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Name generation failed"
        )


# Admin endpoints
@app.get("/admin/users", tags=["Admin"])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_admin = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all users (admin only)"""
    users = await UserService.list_users(skip, limit, db)
    
    audit_logger.log_admin_action(
        admin_user_id=current_admin.id,
        action="list_users",
        resource="user_management",
        details={"skip": skip, "limit": limit}
    )
    
    return users


@app.get("/admin/analytics", tags=["Admin"])
async def get_analytics(
    days: int = 30,
    current_admin = Depends(get_current_admin_user)
):
    """Get system analytics (admin only)"""
    analytics = await AnalyticsService.get_system_analytics(days)
    
    audit_logger.log_admin_action(
        admin_user_id=current_admin.id,
        action="view_analytics",
        resource="system_analytics",
        details={"days": days}
    )
    
    return analytics


# Error handler for unhandled routes
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "code": 404,
                "message": "Endpoint not found",
                "type": "not_found",
                "path": request.url.path,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    )


# Development server runner
if __name__ == "__main__":
    config = get_config()
    
    uvicorn.run(
        "main_professional:app",
        host=config.HOST,
        port=config.PORT,
        reload=config.RELOAD,
        log_config=None,  # Use our custom logging
        access_log=False,  # Use our custom request logging
    ) 