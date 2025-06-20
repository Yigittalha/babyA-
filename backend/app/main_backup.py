"""
FastAPI ana uygulama - Baby Name Generator API
"""

import os
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends, status, Body
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

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    client_ip = request.client.host
    current_time = time.time()
    
    # Rate limit store'u temizle (eski kayıtları sil)
    _rate_limit_store = defaultdict(list)
    _rate_limit_store[client_ip] = [
        req_time for req_time in _rate_limit_store[client_ip] 
        if current_time - req_time < 60  # Son 1 dakika
    ]
    
    # Rate limit kontrolü (dakikada 30 istek)
    if len(_rate_limit_store[client_ip]) >= 30:
        return JSONResponse(
            status_code=429,
            content=create_error_response(
                "Rate limit exceeded. Please try again later.",
                "RATE_LIMIT_EXCEEDED"
            )
        )
    
    # İsteği kaydet
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

# Rate limiting
request_counts = {}

# Rate limiting için basit in-memory store
_rate_limit_store = defaultdict(list)
_rate_limit_cleanup_task = None


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
        logger.info("Database connection established")
        
        # Rate limit cleanup task'ını başlat
        global _rate_limit_cleanup_task
        _rate_limit_cleanup_task = asyncio.create_task(rate_limit_cleanup())
        
        logger.info("Baby Name Generator API started successfully")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Uygulama kapanırken çalışacak kod"""
    try:
        # Rate limit cleanup task'ını durdur
        if _rate_limit_cleanup_task:
            _rate_limit_cleanup_task.cancel()
        
        # Database bağlantısını kapat
        await db_manager.close()
        logger.info("Baby Name Generator API shutdown complete")
    except Exception as e:
        logger.error(f"Shutdown error: {e}")


async def rate_limit_cleanup():
    """Rate limit store'u periyodik olarak temizle"""
    while True:
        try:
            await asyncio.sleep(300)  # 5 dakikada bir
            current_time = time.time()
            
            for client_ip in list(_rate_limit_store.keys()):
                _rate_limit_store[client_ip] = [
                    req_time for req_time in _rate_limit_store[client_ip] 
                    if current_time - req_time < 60
                ]
                
                # Boş liste varsa sil
                if not _rate_limit_store[client_ip]:
                    del _rate_limit_store[client_ip]
                    
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Rate limit cleanup error: {e}")


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
        # E-posta kontrolü
        existing_user = await db_manager.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Bu e-posta adresi zaten kayıtlı"
            )
        
        # Kullanıcı oluştur
        user_id = await db_manager.create_user(user_data)
        
        # Token oluştur
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
        raise HTTPException(status_code=500, detail="Kayıt işlemi başarısız")


@app.post("/login")
async def login_user(login_data: UserLogin):
    """Kullanıcı girişi"""
    try:
        # Kullanıcıyı doğrula
        user = await db_manager.authenticate_user(login_data.email, login_data.password)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Geçersiz e-posta veya şifre"
            )
        
        # Token oluştur
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
        
    except Exception as e:
        logger.error(f"User login failed: {e}")
        raise HTTPException(status_code=500, detail="Giriş işlemi başarısız")


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
            is_premium=user.get("is_premium", False)
        )
        
    except Exception as e:
        logger.error(f"Get profile failed: {e}")
        raise HTTPException(status_code=500, detail="Profil bilgileri alınamadı")


@app.post("/generate_names", response_model=NameGenerationResponse)
@rate_limit(max_requests=10, window_seconds=60)
async def generate_names(request: NameGenerationRequest, user_id: int = Depends(verify_token)):
    """İsim önerileri üret"""
    """
    start_time = time.time()
    
    # İstek validasyonu
    if not await name_service.validate_request(request):
        raise HTTPException(
            status_code=400, 
            detail="Invalid request parameters"
        )
    
    # Kullanıcının premium durumunu kontrol et
    is_premium = await db_manager.is_user_premium(user_id)
    
    # İsim üretimi
    suggestions = await name_service.generate_names(request)
    
    if not suggestions:
        raise HTTPException(
            status_code=500,
            detail="No names generated"
        )
    
    generation_time = time.time() - start_time
    
    # Premium kontrolü - tüm isimleri döndür ama premium olmayan kullanıcılar için bulanık isimleri belirt
    is_premium_required = False
    premium_message = None
    blurred_names = []
    
    if len(suggestions) > 5 and not is_premium:
        # İlk 5 isim normal, geri kalanı bulanık
        blurred_names = list(range(5, len(suggestions)))
        is_premium_required = True
        premium_message = "Daha fazla isim önerisi için Premium üye olun! 🚀"
    
    # Başarılı yanıt
    response = NameGenerationResponse(
        success=True,
        names=suggestions,
        total_count=len(suggestions),
        message=f"Generated {len(suggestions)} names successfully",
        is_premium_required=is_premium_required,
        premium_message=premium_message,
        blurred_names=blurred_names
    )
    
    logger.info(f"Generated {len(suggestions)} names successfully")
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
        raise HTTPException(status_code=500, detail="Favori eklenemedi")


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
        raise HTTPException(status_code=500, detail="Favoriler alınamadı")


@app.delete("/favorites/{favorite_id}")
async def delete_favorite(
    favorite_id: int,
    user_id: int = Depends(verify_token)
):
    """Favori ismi sil"""
    try:
        # Favorinin kullanıcıya ait olduğunu kontrol et
        favorite = await db_manager.get_favorite_by_id(favorite_id)
        if not favorite or favorite["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Favori bulunamadı")
        
        await db_manager.delete_favorite(favorite_id)
        
        return {"message": "Favori başarıyla silindi"}
        
    except Exception as e:
        logger.error(f"Delete favorite failed: {e}")
        raise HTTPException(status_code=500, detail="Favori silinemedi")


@app.put("/favorites/{favorite_id}")
async def update_favorite(
    favorite_id: int,
    favorite_data: FavoriteNameCreate,
    user_id: int = Depends(verify_token)
):
    """Favori ismi güncelle"""
    try:
        # Favorinin kullanıcıya ait olduğunu kontrol et
        favorite = await db_manager.get_favorite_by_id(favorite_id)
        if not favorite or favorite["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Favori bulunamadı")
        
        await db_manager.update_favorite(favorite_id, favorite_data)
        
        return {"message": "Favori başarıyla güncellendi"}
        
    except Exception as e:
        logger.error(f"Update favorite failed: {e}")
        raise HTTPException(status_code=500, detail="Favori güncellenemedi")


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
        
        # AI ile detaylı analiz
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


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global hata yakalayıcı"""
    logger.error(f"Unhandled exception: {exc}")
    
    return JSONResponse(
        status_code=500,
        content=create_error_response(
            "Internal server error",
            "INTERNAL_ERROR"
        )
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP hata yakalayıcı"""
    logger.error(f"HTTP exception: {exc.detail}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(
            exc.detail,
            f"HTTP_{exc.status_code}"
        )
    )


# Development için ek endpoint'ler
if config["environment"] == "development":
    
    @app.get("/test")
    async def test_endpoint():
        """Test endpoint'i - sadece development'ta"""
        return {
            "message": "Test endpoint working",
            "environment": config["environment"],
            "timestamp": datetime.now().isoformat()
        }
    
    @app.post("/test_generate")
    async def test_generate():
        """Test isim üretimi - sadece development'ta"""
        test_request = NameGenerationRequest(
            gender=Gender.MALE,
            language=Language.TURKISH,
            theme=Theme.NATURE,
            extra="Test isteği"
        )
        
        try:
            suggestions = await name_service.generate_names(test_request)
            return {
                "success": True,
                "test_names": [name.dict() for name in suggestions]
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/trends")
async def get_name_trends():
    """Güncel isim trendlerini getir"""
    try:
        trends = await ai_service.get_name_trends()
        return {"success": True, "trends": trends}
    except Exception as e:
        logger.error(f"Trends error: {e}")
        return {"success": False, "error": "Trend analizi yapılamadı"}

@app.get("/api/trends/global")
async def get_global_trends():
    """Çoklu dil desteği ile global trendler"""
    try:
        trends = await ai_service.get_global_trends()
        return trends
    except Exception as e:
        logger.error(f"Global trends error: {e}")
        return {"success": False, "error": "Global trend analizi yapılamadı"}

@app.post("/api/names/theme")
async def get_names_by_theme(request: dict):
    """Tema bazlı isim önerileri"""
    try:
        theme = request.get("theme", "genel")
        gender = request.get("gender", "unisex")
        count = request.get("count", 20)
        
        names = await ai_service.get_name_suggestions_by_theme(theme, gender, count)
        return {"success": True, "names": names}
    except Exception as e:
        logger.error(f"Theme names error: {e}")
        return {"success": False, "error": "Tema bazlı isimler oluşturulamadı"}

@app.post("/api/names/compatibility")
async def analyze_name_compatibility(request: dict):
    """İki ismin uyumluluğunu analiz et"""
    try:
        name1 = request.get("name1", "")
        name2 = request.get("name2", "")
        
        if not name1 or not name2:
            return {"success": False, "error": "İki isim de gerekli"}
        
        compatibility = await ai_service.get_name_compatibility(name1, name2)
        return {"success": True, "compatibility": compatibility}
    except Exception as e:
        logger.error(f"Compatibility error: {e}")
        return {"success": False, "error": "Uyumluluk analizi yapılamadı"}

@app.post("/api/names/premium")
async def get_premium_names(
    request: NameGenerationRequest,
    user_id: int = Depends(verify_token)
):
    """Premium kullanıcılar için gelişmiş isim önerileri"""
    try:
        # Kullanıcının premium durumunu kontrol et
        is_premium = await db_manager.is_user_premium(user_id)
        
        # Premium özelliklerle isim üretimi
        result = await ai_service.get_premium_name_suggestions(request, is_premium)
        
        return result
        
    except Exception as e:
        logger.error(f"Premium names error: {e}")
        return {"success": False, "error": "Premium isim önerileri oluşturulamadı"}

@app.get("/api/subscription/plans")
async def get_subscription_plans():
    """Mevcut abonelik planlarını getir"""
    plans = [
        {
            "id": 1,
            "name": "Ücretsiz",
            "type": "free",
            "price": 0,
            "currency": "TRY",
            "duration_days": 0,
            "features": [
                "Günde 5 isim önerisi",
                "Temel isim analizi",
                "Favori ekleme"
            ],
            "max_names_per_request": 5,
            "unlimited_requests": False
        },
        {
            "id": 2,
            "name": "Premium",
            "type": "premium",
            "price": 29.99,
            "currency": "TRY",
            "duration_days": 30,
            "features": [
                "Sınırsız isim önerisi",
                "Detaylı isim analizi",
                "Kültürel bağlam analizi",
                "Popülerlik tahmini",
                "Benzer isimler",
                "Gelişmiş trendler",
                "Öncelikli destek"
            ],
            "max_names_per_request": 50,
            "unlimited_requests": True
        },
        {
            "id": 3,
            "name": "Pro",
            "type": "pro",
            "price": 99.99,
            "currency": "TRY",
            "duration_days": 365,
            "features": [
                "Premium özelliklerin tümü",
                "Özel isim danışmanlığı",
                "Aile isim uyumluluğu",
                "İsim kombinasyonları",
                "Özel tema önerileri",
                "7/24 destek"
            ],
            "max_names_per_request": 100,
            "unlimited_requests": True
        }
    ]
    
    return {"success": True, "plans": plans}

@app.get("/api/subscription/status")
async def get_subscription_status(user_id: int = Depends(verify_token)):
    """Kullanıcının abonelik durumunu getir"""
    try:
        subscription = await db_manager.get_user_subscription(user_id)
        is_premium = await db_manager.is_user_premium(user_id)
        
        features = []
        if is_premium:
            features = [
                "Sınırsız isim önerisi",
                "Detaylı isim analizi",
                "Kültürel bağlam analizi",
                "Popülerlik tahmini",
                "Benzer isimler",
                "Gelişmiş trendler"
            ]
        else:
            features = [
                "Günde 5 isim önerisi",
                "Temel isim analizi",
                "Favori ekleme"
            ]
        
        return {
            "success": True,
            "subscription_type": subscription.get("subscription_type", "free"),
            "expires_at": subscription.get("subscription_expires"),
            "is_premium": is_premium,
            "features": features
        }
        
    except Exception as e:
        logger.error(f"Subscription status error: {e}")
        return {"success": False, "error": "Abonelik durumu alınamadı"}

@app.post("/api/subscription/upgrade")
async def upgrade_subscription(
    request: dict = Body(...),
    user_id: int = Depends(verify_token)
):
    """Abonelik yükseltme (simüle edilmiş)"""
    try:
        plan_type = request.get("plan_type")
        payment_method = request.get("payment_method", "credit_card")
        
        if plan_type not in ["premium", "pro"]:
            raise HTTPException(status_code=400, detail="Geçersiz plan türü")
        
        # Simüle edilmiş ödeme işlemi
        # Gerçek uygulamada burada ödeme işlemi yapılır
        
        # Abonelik süresini hesapla
        from datetime import datetime, timedelta
        if plan_type == "premium":
            expires_at = datetime.now() + timedelta(days=30)
        else:  # pro
            expires_at = datetime.now() + timedelta(days=365)
        
        # Veritabanını güncelle
        await db_manager.update_user_subscription(user_id, plan_type, expires_at)
        
        # Abonelik geçmişine ekle
        payment_amount = 29.99 if plan_type == "premium" else 99.99
        await db_manager.add_subscription_history(
            user_id, plan_type, expires_at, payment_amount
        )
        
        return {
            "success": True,
            "message": f"{plan_type.capitalize()} aboneliğiniz başarıyla aktifleştirildi!",
            "subscription_type": plan_type,
            "expires_at": expires_at.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Subscription upgrade error: {e}")
        return {"success": False, "error": "Abonelik yükseltme işlemi başarısız"}

@app.get("/api/subscription/history")
async def get_subscription_history(user_id: int = Depends(verify_token)):
    """Kullanıcının abonelik geçmişini getir"""
    try:
        history = await db_manager.get_subscription_history(user_id)
        return {"success": True, "history": history}
        
    except Exception as e:
        logger.error(f"Subscription history error: {e}")
        return {"success": False, "error": "Abonelik geçmişi alınamadı"} 
        
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
