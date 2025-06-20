"""
FastAPI ana uygulama - Baby Name Generator API
"""

import os
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends, status, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import time
import jwt
from jwt.exceptions import PyJWTError, ExpiredSignatureError
from typing import Dict, List
import asyncio
from collections import defaultdict

from .models import (
    NameGenerationRequest, 
    NameGenerationResponse, 
    ErrorResponse, 
    HealthResponse,
    Gender,
    Language,
    Theme,
    OptionsResponse,
    UserRegistration,
    UserLogin,
    UserProfile,
    FavoriteNameCreate,
    FavoriteNameResponse,
    FavoritesResponse
)
from .services import NameGenerationService, AIService
from .utils import (
    logger, 
    rate_limit, 
    validate_environment, 
    create_error_response,
    get_environment_config,
    get_cors_origins,
    rate_limit_check
)
from .database import DatabaseManager

# Environment değişkenlerini yükle
load_dotenv()

# FastAPI uygulamasını oluştur
app = FastAPI(
    title="Baby Name Generator API",
    description="AI-powered baby name generator with cultural and linguistic support",
    version="1.0.0",
    docs_url="/docs" if get_environment_config()["environment"] == "development" else None,
    redoc_url="/redoc" if get_environment_config()["environment"] == "development" else None
)

# CORS middleware ekle
config = get_environment_config()
cors_origins = config["cors_origins"].split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# Rate limit store uygulama başında tanımlı (global)
_rate_limit_store = defaultdict(list)

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    client_ip = request.client.host
    current_time = time.time()
    
    # Önceki istekleri temizle (1 dakika içerisindeki istekler kalacak)
    _rate_limit_store[client_ip] = [
        req_time for req_time in _rate_limit_store[client_ip] 
        if current_time - req_time < 60
    ]
    
    if len(_rate_limit_store[client_ip]) >= 30:
        return JSONResponse(
            status_code=429,
            content=create_error_response(
                "Rate limit exceeded. Please try again later.",
                "RATE_LIMIT_EXCEEDED"
            )
        )
    
    _rate_limit_store[client_ip].append(current_time)
    
    response = await call_next(request)
    return response

# Security
security = HTTPBearer()
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Servis instance'ı
name_service = NameGenerationService()
ai_service = AIService()
db_manager = DatabaseManager()

# Token oluşturma fonksiyonu
def create_access_token(data: dict):
    """JWT token oluştur"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # user_id'yi string'e çevir
    if "sub" in to_encode and isinstance(to_encode["sub"], int):
        to_encode["sub"] = str(to_encode["sub"])
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Token doğrulama
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Token doğrula"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(user_id)  # String'i int'e çevir
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Admin kontrolü
async def verify_admin(user_id: int = Depends(verify_token)):
    """Admin yetkisi kontrolü"""
    is_admin = await db_manager.is_user_admin(user_id)
    if not is_admin:
        raise HTTPException(
            status_code=403, 
            detail="Bu işlem için admin yetkisi gerekli"
        )
    return user_id

@app.on_event("startup")
async def startup_event():
    """Uygulama başlangıcında çalışacak kod"""
    logger.info("Starting Baby Name Generator API...")
    
    # Environment validasyonu
    if not validate_environment():
        logger.error("Environment validation failed")
        # Production'da uygulamayı durdur
        if config["environment"] == "production":
            raise Exception("Environment validation failed")
    
    # Veritabanı bağlantısını test et
    try:
        await db_manager.initialize()
        db_manager.start_time = time.time()  # Başlangıç zamanını kaydet
        logger.info("Database connection established")
        
        logger.info("Baby Name Generator API started successfully")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Uygulama kapanırken çalışacak kod"""
    try:
        # Database bağlantısını kapat
        await db_manager.close()
        logger.info("Baby Name Generator API shutdown complete")
    except Exception as e:
        logger.error(f"Shutdown error: {e}")

@app.get("/", response_model=dict)
async def root():
    """Ana endpoint"""
    return {
        "message": "Baby Name Generator API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        # Database durumunu kontrol et
        db_status = "healthy" if db_manager.is_connected() else "unhealthy"
        
        # AI servis durumunu kontrol et
        ai_status = "healthy" if name_service.ai_service.client else "unhealthy"
        
        # Genel durum
        overall_status = "healthy" if db_status == "healthy" and ai_status == "healthy" else "unhealthy"
        
        return HealthResponse(
            status=overall_status,
            timestamp=datetime.now().isoformat(),
            version="1.0.0"
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            timestamp=datetime.now().isoformat(),
            version="1.0.0"
        )

@app.get("/options", response_model=OptionsResponse)
async def get_options():
    """Mevcut seçenekleri döndür"""
    return OptionsResponse(
        genders=[
            {"value": "male", "label": "Erkek"},
            {"value": "female", "label": "Kız"},
            {"value": "unisex", "label": "Unisex"}
        ],
        languages=[
            {"value": "turkish", "label": "Türkçe"},
            {"value": "english", "label": "İngilizce"},
            {"value": "arabic", "label": "Arapça"},
            {"value": "persian", "label": "Farsça"},
            {"value": "kurdish", "label": "Kürtçe"},
            {"value": "azerbaijani", "label": "Azerbaycan dili"}
        ],
        themes=[
            {"value": "nature", "label": "Doğa"},
            {"value": "religious", "label": "Dini/İlahi"},
            {"value": "historical", "label": "Tarihi"},
            {"value": "modern", "label": "Modern"},
            {"value": "traditional", "label": "Geleneksel"},
            {"value": "unique", "label": "Benzersiz"},
            {"value": "royal", "label": "Asil/Kraliyet"},
            {"value": "warrior", "label": "Savaşçı"},
            {"value": "wisdom", "label": "Bilgelik"},
            {"value": "love", "label": "Aşk/Sevgi"}
        ]
    )

@app.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserRegistration):
    """Kullanıcı kaydı"""
    try:
        existing_user = await db_manager.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Bu e-posta adresi zaten kayıtlı"
            )
        
        user_id = await db_manager.create_user(user_data)
        access_token = create_access_token(data={"sub": user_id})
        
        return {
            "message": "Kullanıcı başarıyla kaydedildi",
            "access_token": access_token,
            "token_type": "bearer"
        }
        
    except HTTPException as http_exc:
        logger.error(f"User registration failed: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"User registration failed: {e}")
        raise

@app.post("/login")
async def login_user(login_data: UserLogin):
    """Kullanıcı girişi"""
    try:
        user = await db_manager.authenticate_user(login_data.email, login_data.password)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Geçersiz e-posta veya şifre"
            )
        
        access_token = create_access_token(data={"sub": user["id"]})
        
        return {
            "message": "Giriş başarılı",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"]
            }
        }
        
    except HTTPException:
        # HTTPException'ları tekrar fırlat (401, 400 vb.)
        raise
    except Exception as e:
        logger.error(f"User login failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Giriş işlemi sırasında bir hata oluştu"
        )

@app.get("/profile", response_model=UserProfile)
async def get_profile(user_id: int = Depends(verify_token)):
    """Kullanıcı profili"""
    try:
        user = await db_manager.get_user_by_id_with_subscription(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        favorite_count = await db_manager.get_favorite_count(user_id)
        
        return UserProfile(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            created_at=user["created_at"],
            favorite_count=favorite_count,
            subscription_type=user.get("subscription_type", "free"),
            subscription_expires=user.get("subscription_expires"),
            is_premium=user.get("is_premium", False),
            is_admin=user.get("is_admin", False)
        )
        
    except Exception as e:
        logger.error(f"Get profile failed: {e}")
        raise

@app.post("/generate_names", response_model=NameGenerationResponse)
@rate_limit(max_requests=10, window_seconds=60)
async def generate_names(request: NameGenerationRequest, user_id: int = Depends(verify_token)):
    """İsim önerileri üret"""
    start_time = time.time()
    
    if not await name_service.validate_request(request):
        raise HTTPException(
            status_code=400, 
            detail="Invalid request parameters"
        )
    
    is_premium = await db_manager.is_user_premium(user_id)
    
    suggestions = await name_service.generate_names(request)
    
    if not suggestions:
        raise HTTPException(
            status_code=500,
            detail="No names generated"
        )
    
    generation_time = time.time() - start_time
    
    is_premium_required = False
    premium_message = None
    blurred_names = []
    
    if len(suggestions) > 5 and not is_premium:
        blurred_names = list(range(5, len(suggestions)))
        is_premium_required = True
        premium_message = "Daha fazla isim önerisi için Premium üye olun! 🚀"
    
    response = NameGenerationResponse(
        success=True,
        names=suggestions,
        total_count=len(suggestions),
        message=f"Generated {len(suggestions)} names successfully",
        is_premium_required=is_premium_required,
        premium_message=premium_message,
        blurred_names=blurred_names
    )
    
    logger.info(f"Generated {len(suggestions)} names successfully in {generation_time:.2f} seconds")
    return response

@app.post("/favorites", response_model=FavoriteNameResponse, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    favorite_data: FavoriteNameCreate,
    user_id: int = Depends(verify_token)
):
    """Favori isim ekle"""
    try:
        favorite_id = await db_manager.add_favorite(user_id, favorite_data)
        favorite = await db_manager.get_favorite_by_id(favorite_id)
        if not favorite:
            raise HTTPException(status_code=404, detail="Favori bulunamadı")
        return FavoriteNameResponse(
            id=favorite["id"],
            name=favorite["name"],
            meaning=favorite["meaning"],
            gender=favorite["gender"],
            language=favorite["language"],
            theme=favorite["theme"],
            notes=favorite["notes"],
            created_at=favorite["created_at"]
        )
        
    except Exception as e:
        logger.error(f"Add favorite failed: {e}")
        raise

@app.get("/favorites", response_model=FavoritesResponse)
async def get_favorites(
    page: int = 1,
    limit: int = 20,
    user_id: int = Depends(verify_token)
):
    """Favori isimleri listele"""
    try:
        favorites = await db_manager.get_favorites(user_id, page, limit)
        total_count = await db_manager.get_favorite_count(user_id)
        
        return FavoritesResponse(
            favorites=favorites,
            total_count=total_count
        )
        
    except Exception as e:
        logger.error(f"Get favorites failed: {e}")

@app.delete("/favorites/{favorite_id}")
async def delete_favorite(
    favorite_id: int,
    user_id: int = Depends(verify_token)
):
    """Favori ismi sil"""
    try:
        favorite = await db_manager.get_favorite_by_id(favorite_id)
        if not favorite or favorite["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Favori bulunamadı veya yetkisiz erişim")
        await db_manager.delete_favorite(favorite_id)
        return {"message": "Favori başarıyla silindi"}
        
    except Exception as e:
        logger.error(f"Delete favorite failed: {e}")
        raise

@app.put("/favorites/{favorite_id}")
async def update_favorite(
    favorite_id: int,
    favorite_data: FavoriteNameCreate,
    user_id: int = Depends(verify_token)
):
    """Favori ismi güncelle"""
    try:
        favorite = await db_manager.get_favorite_by_id(favorite_id)
        if not favorite or favorite["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Favori bulunamadı veya yetkisiz erişim")
        await db_manager.update_favorite(favorite_id, favorite_data)
        return {"message": "Favori başarıyla güncellendi"}
        
    except Exception as e:
        logger.error(f"Update favorite failed: {e}")
        raise

@app.post("/analyze_name")
async def analyze_name(
    request: dict = Body(...),
    user_id: int = Depends(verify_token)
):
    """İsmin detaylı analizini yap"""
    try:
        name = request.get("name", "").strip()
        language = request.get("language", "turkish")
        if not name:
            raise HTTPException(status_code=400, detail="İsim gerekli")
        analysis = await name_service.analyze_name(name, language)
        return {
            "success": True,
            "analysis": analysis
        }
    except HTTPException as http_exc:
        logger.error(f"HTTP exception: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        import traceback
        logger.error(f"Name analysis error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="İsim analizi sırasında hata oluştu")

@app.get('/api/subscription/plans')
async def get_subscription_plans():
    return {
        "plans": [
            {"type": "free", "price": 0, "features": ["5 isim limiti"]},
            {"type": "premium", "price": 49.99, "features": ["Sınırsız isim", "Tüm analizler", "Favori sınırsız"]}
        ]
    }

@app.get('/api/subscription/status')
async def get_subscription_status(user_id: int = Depends(verify_token)):
    user = await db_manager.get_user_by_id_with_subscription(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return {
        "is_premium": user.get("subscription_type", "free") == "premium",
        "subscription_type": user.get("subscription_type", "free"),
        "subscription_expires": user.get("subscription_expires")
    }

@app.post('/api/subscription/upgrade')
async def upgrade_subscription(user_id: int = Depends(verify_token)):
    await db_manager.update_user_subscription(user_id, "premium")
    return {"success": True, "message": "Premium üyeliğe geçildi!"}

@app.get('/api/trends/global')
async def get_global_trends():
    """Global isim trendlerini döner"""
    return {
        "success": True,
        "trends_by_language": [
            {
                "language": "turkish",
                "language_name": "Türkçe",
                "trends": [
                    {
                        "name": "Aylin",
                        "meaning": "Ay ışığı, parlak",
                        "origin": "Türkçe kökenli",
                        "trend_score": 0.85,
                        "popularity_change": "Yükselen",
                        "cultural_context": "Modern Türk kültüründe popüler"
                    },
                    {
                        "name": "Arda",
                        "meaning": "Orman, ağaç",
                        "origin": "Türkçe kökenli",
                        "trend_score": 0.78,
                        "popularity_change": "Stabil",
                        "cultural_context": "Geleneksel Türk ismi"
                    },
                    {
                        "name": "Zeynep",
                        "meaning": "Güzel, süs",
                        "origin": "Arapça kökenli",
                        "trend_score": 0.92,
                        "popularity_change": "Yükselen",
                        "cultural_context": "Klasik İslami isim"
                    },
                    {
                        "name": "Deniz",
                        "meaning": "Deniz, okyanus",
                        "origin": "Türkçe kökenli",
                        "trend_score": 0.88,
                        "popularity_change": "Yükselen",
                        "cultural_context": "Doğa temalı modern isim"
                    },
                    {
                        "name": "Ege",
                        "meaning": "Ege denizi",
                        "origin": "Türkçe kökenli",
                        "trend_score": 0.82,
                        "popularity_change": "Stabil",
                        "cultural_context": "Coğrafi kökenli isim"
                    },
                    {
                        "name": "Cemre",
                        "meaning": "Ateşin üç kısmı",
                        "origin": "Türkçe kökenli",
                        "trend_score": 0.79,
                        "popularity_change": "Yükselen",
                        "cultural_context": "Bahar ve ısı ile ilişkili"
                    }
                ]
            },
            {
                "language": "english",
                "language_name": "İngilizce",
                "trends": [
                    {
                        "name": "Emma",
                        "meaning": "Evrensel, tam",
                        "origin": "Almanca kökenli",
                        "trend_score": 0.91,
                        "popularity_change": "Yükselen",
                        "cultural_context": "Klasik İngiliz ismi"
                    },
                    {
                        "name": "Liam",
                        "meaning": "Güçlü irade",
                        "origin": "İrlandaca kökenli",
                        "trend_score": 0.87,
                        "popularity_change": "Yükselen",
                        "cultural_context": "Modern popüler isim"
                    },
                    {
                        "name": "Olivia",
                        "meaning": "Zeytin ağacı",
                        "origin": "Latince kökenli",
                        "trend_score": 0.89,
                        "popularity_change": "Stabil",
                        "cultural_context": "Doğa temalı klasik isim"
                    }
                ]
            }
        ],
        "global_top_names": [
            {
                "name": "Aylin",
                "language": "turkish",
                "meaning": "Ay ışığı, parlak",
                "origin": "Türkçe kökenli",
                "popularity_change": "Yükselen"
            },
            {
                "name": "Zeynep",
                "language": "turkish",
                "meaning": "Güzel, süs",
                "origin": "Arapça kökenli",
                "popularity_change": "Yükselen"
            },
            {
                "name": "Emma",
                "language": "english",
                "meaning": "Evrensel, tam",
                "origin": "Almanca kökenli",
                "popularity_change": "Yükselen"
            },
            {
                "name": "Deniz",
                "language": "turkish",
                "meaning": "Deniz, okyanus",
                "origin": "Türkçe kökenli",
                "popularity_change": "Yükselen"
            },
            {
                "name": "Liam",
                "language": "english",
                "meaning": "Güçlü irade",
                "origin": "İrlandaca kökenli",
                "popularity_change": "Yükselen"
            }
        ],
        "total_languages": 2,
        "summary": "Modern ve doğa temalı isimler yükselişte"
    }

# Admin endpoints
@app.get("/admin/stats")
async def get_admin_stats(admin_user_id: int = Depends(verify_admin)):
    """Admin istatistikleri"""
    
    try:
        # Kullanıcı sayısı
        user_count = await db_manager.get_user_count()
        
        # Toplam favori sayısı
        favorite_count = await db_manager.get_favorite_count()
        
        # Son 24 saatteki kayıt sayısı
        recent_registrations = await db_manager.get_recent_registrations(24)
        
        # Sistem durumu
        system_status = {
            "database": "healthy" if db_manager.is_connected() else "unhealthy",
            "ai_service": "healthy" if name_service.ai_service.client else "unhealthy",
            "uptime": time.time() - db_manager.start_time if hasattr(db_manager, 'start_time') else 0
        }
        
        return {
            "user_count": user_count,
            "favorite_count": favorite_count,
            "recent_registrations": recent_registrations,
            "system_status": system_status,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Admin stats error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/admin/users")
async def get_admin_users(page: int = 1, limit: int = 20, admin_user_id: int = Depends(verify_admin)):
    """Admin kullanıcı listesi"""
    
    try:
        users = await db_manager.get_all_users(page, limit)
        total_users = await db_manager.get_user_count()
        
        return {
            "users": users,
            "total": total_users,
            "page": page,
            "limit": limit,
            "pages": (total_users + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Admin users error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/admin/users/{user_id}")
async def delete_admin_user(user_id: int, admin_user_id: int = Depends(verify_admin)):
    """Admin kullanıcı silme"""
    
    try:
        success = await db_manager.delete_user(user_id)
        if success:
            return {"message": f"User {user_id} deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        logger.error(f"Admin delete user error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/admin/favorites")
async def get_admin_favorites(page: int = 1, limit: int = 20, admin_user_id: int = Depends(verify_admin)):
    """Admin favori listesi"""
    
    try:
        favorites = await db_manager.get_all_favorites(page, limit)
        total_favorites = await db_manager.get_favorite_count()
        
        return {
            "favorites": favorites,
            "total": total_favorites,
            "page": page,
            "limit": limit,
            "pages": (total_favorites + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Admin favorites error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/admin/system")
async def get_admin_system(admin_user_id: int = Depends(verify_admin)):
    """Admin sistem bilgileri"""
    
    try:
        import psutil
        import platform
        
        # Sistem bilgileri
        system_info = {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "python_version": platform.python_version(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": psutil.virtual_memory().total,
            "memory_available": psutil.virtual_memory().available,
            "disk_usage": psutil.disk_usage('/').percent
        }
        
        # Uygulama bilgileri
        app_info = {
            "environment": config["environment"],
            "database_connected": db_manager.is_connected(),
            "ai_service_available": name_service.ai_service.client is not None,
            "uptime": time.time() - db_manager.start_time if hasattr(db_manager, 'start_time') else 0
        }
        
        return {
            "system": system_info,
            "application": app_info,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Admin system error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
 