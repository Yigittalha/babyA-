"""
Pydantic modelleri - Veri validasyonu ve API şemaları
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime


class Gender(str, Enum):
    """Cinsiyet seçenekleri"""
    MALE = "male"
    FEMALE = "female"
    UNISEX = "unisex"


class Language(str, Enum):
    """Dil seçenekleri"""
    TURKISH = "turkish"
    ENGLISH = "english"
    ARABIC = "arabic"
    PERSIAN = "persian"
    KURDISH = "kurdish"
    AZERBAIJANI = "azerbaijani"
    FRENCH = "french"
    GERMAN = "german"
    SPANISH = "spanish"
    PORTUGUESE = "portuguese"
    RUSSIAN = "russian"
    CHINESE = "chinese"
    JAPANESE = "japanese"


class Theme(str, Enum):
    """Tema seçenekleri"""
    NATURE = "nature"
    RELIGIOUS = "religious"
    HISTORICAL = "historical"
    MODERN = "modern"
    TRADITIONAL = "traditional"
    UNIQUE = "unique"
    ROYAL = "royal"
    WARRIOR = "warrior"
    WISDOM = "wisdom"
    LOVE = "love"


class SubscriptionType(str, Enum):
    """Abonelik türleri"""
    FREE = "free"
    PREMIUM = "premium"
    PRO = "pro"


class NameGenerationRequest(BaseModel):
    """İsim üretimi için gelen istek modeli"""
    gender: Gender = Field(..., description="Bebeğin cinsiyeti")
    language: Language = Field(..., description="İsim dil tercihi")
    theme: Theme = Field(..., description="İsim teması")
    extra: Optional[str] = Field(
        default=None, 
        max_length=500,
        description="Ekstra bilgiler veya özel istekler"
    )

    @validator('extra')
    def validate_extra(cls, v):
        """Ekstra bilgileri temizle ve doğrula"""
        if v is not None:
            # HTML tag'lerini temizle
            import re
            v = re.sub(r'<[^>]+>', '', v)
            # Fazla boşlukları temizle
            v = ' '.join(v.split())
        return v


class NameSuggestion(BaseModel):
    """Tek bir isim önerisi"""
    name: str = Field(..., description="İsim")
    meaning: str = Field(..., description="İsmin anlamı")
    origin: str = Field(..., description="İsmin kökeni")
    popularity: Optional[str] = Field(default=None, description="Popülerlik durumu")
    gender: Optional[str] = Field(default=None, description="Cinsiyet")
    language: Optional[str] = Field(default=None, description="Dil")
    theme: Optional[str] = Field(default=None, description="Tema")


class NameGenerationResponse(BaseModel):
    """İsim üretimi yanıt modeli"""
    success: bool = Field(..., description="İşlem başarı durumu")
    names: List[NameSuggestion] = Field(..., description="Üretilen isimler")
    total_count: int = Field(..., description="Toplam isim sayısı")
    message: Optional[str] = Field(default=None, description="Bilgi mesajı")
    is_premium_required: bool = Field(default=False, description="Premium gerekli mi")
    premium_message: Optional[str] = Field(default=None, description="Premium mesajı")
    blurred_names: List[int] = Field(default=[], description="Bulanık gösterilecek isim indeksleri")


class ErrorResponse(BaseModel):
    """Hata yanıt modeli"""
    success: bool = Field(default=False, description="İşlem başarı durumu")
    error: str = Field(..., description="Hata mesajı")
    error_code: Optional[str] = Field(default=None, description="Hata kodu")


class HealthResponse(BaseModel):
    """Sağlık kontrolü yanıt modeli"""
    status: str = Field(..., description="Servis durumu")
    version: str = Field(..., description="API versiyonu")
    timestamp: str = Field(..., description="Kontrol zamanı")


class OptionsResponse(BaseModel):
    """Seçenekler yanıtı"""
    genders: List[dict]
    languages: List[dict]
    themes: List[dict]


class UserRegistration(BaseModel):
    """Kullanıcı kayıt isteği"""
    email: str = Field(..., description="E-posta adresi")
    password: str = Field(..., min_length=6, description="Şifre (en az 6 karakter)")
    name: str = Field(..., min_length=2, description="Ad soyad")
    
    @validator('email')
    def validate_email(cls, v):
        if '@' not in v or '.' not in v:
            raise ValueError('Geçerli bir e-posta adresi giriniz')
        return v.lower()


class UserLogin(BaseModel):
    """Kullanıcı giriş isteği"""
    email: str
    password: str


class UserProfile(BaseModel):
    """Kullanıcı profili"""
    id: int
    email: str
    name: str
    created_at: datetime
    favorite_count: int = 0
    subscription_type: SubscriptionType = SubscriptionType.FREE
    subscription_expires: Optional[datetime] = None
    is_premium: bool = False
    is_admin: bool = False


class FavoriteName(BaseModel):
    """Favori isim"""
    id: Optional[int] = None
    user_id: int
    name: str
    meaning: str
    gender: Gender
    language: Language
    theme: Theme
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class FavoriteNameCreate(BaseModel):
    """Favori isim oluşturma"""
    name: str
    meaning: str
    gender: Gender
    language: Language
    theme: Theme
    notes: Optional[str] = None


class FavoriteNameResponse(BaseModel):
    """Favori isim yanıtı"""
    id: int
    name: str
    meaning: str
    gender: str
    language: str
    theme: str
    notes: Optional[str]
    created_at: datetime


class FavoritesResponse(BaseModel):
    """Favoriler listesi yanıtı"""
    favorites: List[FavoriteNameResponse]
    total_count: int


class NameTrend(BaseModel):
    """İsim trendi"""
    name: str
    language: str
    gender: str
    trend_score: float
    popularity_change: str
    meaning: str
    origin: str
    cultural_context: str


class LanguageTrends(BaseModel):
    """Dil bazlı trendler"""
    language: str
    language_name: str
    trends: List[NameTrend]
    total_trends: int


class GlobalTrendsResponse(BaseModel):
    """Global trendler yanıtı"""
    success: bool
    trends_by_language: List[LanguageTrends]
    global_top_names: List[NameTrend]
    last_updated: datetime
    total_languages: int


class SubscriptionPlan(BaseModel):
    """Abonelik planı"""
    id: int
    name: str
    type: SubscriptionType
    price: float
    currency: str = "TRY"
    duration_days: int
    features: List[str]
    max_names_per_request: int
    unlimited_requests: bool = False


class SubscriptionResponse(BaseModel):
    """Abonelik yanıtı"""
    success: bool
    subscription_type: SubscriptionType
    expires_at: Optional[datetime]
    features: List[str]
    remaining_requests: Optional[int] = None


class HealthResponse(BaseModel):
    """Sağlık kontrolü yanıt modeli"""
    status: str = Field(..., description="Servis durumu")
    timestamp: datetime = Field(..., description="Kontrol zamanı")
    version: str = Field(..., description="API versiyonu") 