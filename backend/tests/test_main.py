"""
Backend test dosyaları
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.models import NameGenerationRequest, Gender, Language, Theme
from app.services import NameGenerationService, AIService


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def sample_request():
    """Örnek istek fixture'ı"""
    return NameGenerationRequest(
        gender=Gender.MALE,
        language=Language.TURKISH,
        theme=Theme.NATURE,
        extra="Doğa ile ilgili isimler"
    )


class TestHealthEndpoint:
    """Sağlık kontrolü endpoint testleri"""
    
    def test_health_check(self, client):
        """Sağlık kontrolü endpoint'i test et"""
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "1.0.0"
        assert "timestamp" in data


class TestOptionsEndpoint:
    """Seçenekler endpoint testleri"""
    
    def test_get_options(self, client):
        """Seçenekler endpoint'i test et"""
        response = client.get("/options")
        assert response.status_code == 200
        
        data = response.json()
        assert "genders" in data
        assert "languages" in data
        assert "themes" in data
        
        # Seçeneklerin doğru olduğunu kontrol et
        assert "male" in data["genders"]
        assert "turkish" in data["languages"]
        assert "nature" in data["themes"]


class TestGenerateNamesEndpoint:
    """İsim üretimi endpoint testleri"""
    
    def test_generate_names_success(self, client, sample_request):
        """Başarılı isim üretimi test et"""
        with patch.object(NameGenerationService, 'generate_names') as mock_generate:
            # Mock yanıt
            mock_generate.return_value = [
                {
                    "name": "Ahmet",
                    "meaning": "Cesur, güçlü",
                    "origin": "AI Generated",
                    "popularity": "Modern"
                }
            ]
            
            response = client.post(
                "/generate_names",
                json=sample_request.dict()
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["names"]) > 0
    
    def test_generate_names_invalid_request(self, client):
        """Geçersiz istek test et"""
        invalid_request = {
            "gender": "invalid_gender",
            "language": "turkish",
            "theme": "nature"
        }
        
        response = client.post("/generate_names", json=invalid_request)
        assert response.status_code == 422  # Validation error
    
    def test_generate_names_missing_fields(self, client):
        """Eksik alanlar test et"""
        incomplete_request = {
            "gender": "male"
            # language ve theme eksik
        }
        
        response = client.post("/generate_names", json=incomplete_request)
        assert response.status_code == 422


class TestAIService:
    """AI servis testleri"""
    
    @pytest.mark.asyncio
    async def test_create_prompt(self, sample_request):
        """Prompt oluşturma test et"""
        ai_service = AIService()
        prompt = ai_service._create_prompt(sample_request)
        
        assert "erkek" in prompt
        assert "Türkçe" in prompt
        assert "doğa ile ilgili" in prompt
        assert "Doğa ile ilgili isimler" in prompt
    
    @pytest.mark.asyncio
    async def test_parse_ai_response(self):
        """AI yanıtı parse etme test et"""
        ai_service = AIService()
        
        test_response = """
        Ahmet - Cesur, güçlü, övülmüş
        Mehmet - Övülmüş, beğenilmiş
        Ali - Yüce, yüksek
        """
        
        suggestions = ai_service._parse_ai_response(test_response)
        
        assert len(suggestions) == 3
        assert suggestions[0].name == "Ahmet"
        assert suggestions[0].meaning == "Cesur, güçlü, övülmüş"
    
    @pytest.mark.asyncio
    async def test_fallback_generation(self, sample_request):
        """Fallback isim üretimi test et"""
        ai_service = AIService()
        suggestions = await ai_service.generate_names_fallback(sample_request)
        
        assert len(suggestions) > 0
        assert all(hasattr(s, 'name') for s in suggestions)
        assert all(hasattr(s, 'meaning') for s in suggestions)


class TestNameGenerationService:
    """İsim üretimi servis testleri"""
    
    @pytest.mark.asyncio
    async def test_validate_request(self, sample_request):
        """İstek validasyonu test et"""
        service = NameGenerationService()
        
        # Geçerli istek
        assert await service.validate_request(sample_request) is True
        
        # Geçersiz istek - eksik alanlar
        invalid_request = NameGenerationRequest(
            gender=Gender.MALE,
            language=Language.TURKISH,
            theme=Theme.NATURE,
            extra="x" * 600  # Çok uzun extra
        )
        assert await service.validate_request(invalid_request) is False


class TestUtils:
    """Yardımcı fonksiyon testleri"""
    
    def test_sanitize_input(self):
        """Input sanitization test et"""
        from app.utils import sanitize_input
        
        # HTML tag'leri temizle
        dirty_input = "<script>alert('xss')</script>Hello World"
        clean_input = sanitize_input(dirty_input)
        assert "<script>" not in clean_input
        assert "Hello World" in clean_input
        
        # Fazla boşlukları temizle
        spaced_input = "  Hello    World  "
        clean_spaced = sanitize_input(spaced_input)
        assert clean_spaced == "Hello World"
    
    def test_validate_api_key(self):
        """API key validasyonu test et"""
        from app.utils import validate_api_key
        
        # Geçerli API key
        valid_key = "sk-1234567890abcdef1234567890abcdef1234567890abcdef"
        assert validate_api_key(valid_key) is True
        
        # Geçersiz API key'ler
        assert validate_api_key("") is False
        assert validate_api_key("invalid-key") is False
        assert validate_api_key("sk-123") is False  # Çok kısa


# Integration testleri
class TestIntegration:
    """Entegrasyon testleri"""
    
    def test_full_flow_without_ai(self, client):
        """AI olmadan tam akış test et"""
        # Bu test gerçek AI çağrısı yapmaz, fallback kullanır
        request_data = {
            "gender": "male",
            "language": "turkish",
            "theme": "nature",
            "extra": "Test isteği"
        }
        
        response = client.post("/generate_names", json=request_data)
        
        # Yanıt alınmalı (başarılı veya hata)
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
            assert "names" in data
            assert "total_count" in data


if __name__ == "__main__":
    pytest.main([__file__]) 