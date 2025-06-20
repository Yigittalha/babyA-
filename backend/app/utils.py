"""
Yardımcı fonksiyonlar ve güvenlik araçları
"""

import os
import logging
import time
from typing import Dict, Any, Optional, List
from functools import wraps
from datetime import datetime
import re


# Logging konfigürasyonu
def setup_logging():
    """Logging konfigürasyonu"""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('app.log')
        ]
    )
    
    return logging.getLogger(__name__)


logger = setup_logging()


def sanitize_input(text: str) -> str:
    """Kullanıcı girdisini temizle ve güvenli hale getir"""
    if not text:
        return ""
    
    # HTML tag'lerini temizle
    text = re.sub(r'<[^>]+>', '', text)
    
    # Tehlikeli karakterleri temizle
    text = re.sub(r'[<>"\']', '', text)
    
    # Fazla boşlukları temizle
    text = ' '.join(text.split())
    
    return text.strip()


def validate_api_key(api_key: str) -> bool:
    """API anahtarının geçerli olup olmadığını kontrol et"""
    if not api_key:
        return False
    
    # OpenAI API key formatı kontrolü (sk- ile başlamalı)
    if api_key.startswith('sk-'):
        # Minimum uzunluk kontrolü
        if len(api_key) < 20:
            return False
        return True
    
    # OpenRouter API key formatı kontrolü (sk-or- ile başlamalı)
    if api_key.startswith('sk-or-'):
        # Minimum uzunluk kontrolü
        if len(api_key) < 20:
            return False
        return True
    
    return False


def get_cors_origins() -> List[str]:
    """CORS origins listesini al"""
    cors_origins = os.getenv("CORS_ORIGINS", "*")
    if cors_origins == "*":
        return ["*"]
    return [origin.strip() for origin in cors_origins.split(",")]


def rate_limit_check(client_ip: str) -> bool:
    """Rate limit kontrolü"""
    # Basit in-memory rate limiting
    current_time = time.time()
    window_seconds = 60
    max_requests = 10
    
    # Global request counts (production'da Redis kullanılmalı)
    if not hasattr(rate_limit_check, 'request_counts'):
        rate_limit_check.request_counts = {}
    
    # Eski kayıtları temizle
    if client_ip in rate_limit_check.request_counts:
        rate_limit_check.request_counts[client_ip] = [
            req_time for req_time in rate_limit_check.request_counts[client_ip]
            if current_time - req_time < window_seconds
        ]
    else:
        rate_limit_check.request_counts[client_ip] = []
    
    # Rate limit kontrolü
    if len(rate_limit_check.request_counts[client_ip]) >= max_requests:
        logger.warning(f"Rate limit exceeded for {client_ip}")
        return False
    
    # İsteği kaydet
    rate_limit_check.request_counts[client_ip].append(current_time)
    return True


def rate_limit(max_requests: int = 10, window_seconds: int = 60):
    """Rate limiting decorator"""
    def decorator(func):
        # Basit in-memory rate limiting (production'da Redis kullanılmalı)
        request_counts = {}
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Client IP'sini al (gerçek uygulamada request'ten alınır)
            client_ip = "default"  # Basit implementasyon
            
            current_time = time.time()
            
            # Eski kayıtları temizle
            if client_ip in request_counts:
                request_counts[client_ip] = [
                    req_time for req_time in request_counts[client_ip]
                    if current_time - req_time < window_seconds
                ]
            else:
                request_counts[client_ip] = []
            
            # Rate limit kontrolü
            if len(request_counts[client_ip]) >= max_requests:
                logger.warning(f"Rate limit exceeded for {client_ip}")
                raise Exception("Rate limit exceeded. Please try again later.")
            
            # İsteği kaydet
            request_counts[client_ip].append(current_time)
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def create_error_response(error_message: str, error_code: Optional[str] = None) -> Dict[str, Any]:
    """Standart hata yanıtı oluştur"""
    return {
        "success": False,
        "error": error_message,
        "error_code": error_code,
        "timestamp": datetime.now().isoformat()
    }


def create_success_response(data: Dict[str, Any], message: Optional[str] = None) -> Dict[str, Any]:
    """Standart başarı yanıtı oluştur"""
    return {
        "success": True,
        "data": data,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }


def get_environment_config() -> Dict[str, str]:
    """Environment konfigürasyonunu al"""
    return {
        "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
        "openrouter_api_key": os.getenv("OPENROUTER_API_KEY", ""),
        "cors_origins": os.getenv("CORS_ORIGINS", "*"),
        "log_level": os.getenv("LOG_LEVEL", "INFO"),
        "environment": os.getenv("ENVIRONMENT", "development")
    }


def validate_environment() -> bool:
    """Environment değişkenlerinin doğru ayarlandığını kontrol et"""
    config = get_environment_config()
    
    # OpenRouter API key kontrolü (öncelikli)
    if config["openrouter_api_key"] and config["openrouter_api_key"] != "YOUR_OPENROUTER_API_KEY_HERE":
        if validate_api_key(config["openrouter_api_key"]):
            logger.info("OpenRouter API key validation passed")
            return True
        else:
            logger.error("Invalid OpenRouter API key format")
            return False
    
    # Fallback olarak OpenAI API key kontrolü
    if config["openai_api_key"] and config["openai_api_key"] != "YOUR_OPENAI_API_KEY_HERE":
        if validate_api_key(config["openai_api_key"]):
            logger.info("OpenAI API key validation passed")
            return True
        else:
            logger.error("Invalid OpenAI API key format")
            return False
    
    logger.error("No valid API key found")
    return False


def format_name_suggestions(raw_suggestions: str) -> list:
    """AI'dan gelen ham önerileri formatla"""
    suggestions = []
    
    # Basit parsing (gerçek uygulamada daha gelişmiş parsing gerekebilir)
    lines = raw_suggestions.strip().split('\n')
    
    for line in lines:
        if not line.strip():
            continue
            
        # İsim ve anlamı ayır (örnek: "Ahmet - Cesur, güçlü")
        if ' - ' in line:
            name_part, meaning_part = line.split(' - ', 1)
            name = name_part.strip()
            meaning = meaning_part.strip()
            
            suggestions.append({
                "name": name,
                "meaning": meaning,
                "origin": "AI Generated",
                "popularity": "Modern"
            })
    
    return suggestions[:10]  # Maksimum 10 öneri döndür 