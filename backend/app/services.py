"""
AI servisleri ve iş mantığı
"""

import os
import asyncio
import json
import hashlib
import logging
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
from .models import NameGenerationRequest, NameSuggestion
from .utils import logger, sanitize_input, validate_api_key
from datetime import datetime

# Basit in-memory cache
_cache = {}

def sanitize_input(text: str) -> str:
    """Input sanitization"""
    if not text:
        return ""
    # HTML tag'lerini temizle
    import re
    text = re.sub(r'<[^>]+>', '', text)
    # Özel karakterleri temizle
    text = re.sub(r'[^\w\s\-.,!?]', '', text)
    return text.strip()

def validate_api_key(api_key: str) -> bool:
    """API key formatını kontrol et"""
    if not api_key or len(api_key) < 10:
        return False
    return True

class AIService:
    """AI servis sınıfı - OpenAI ve OpenRouter API'ler için"""
    
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        self.openrouter_base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """AI client'ını başlat - OpenRouter öncelikli"""
        # OpenRouter API key varsa onu kullan
        if self.openrouter_api_key and self.openrouter_api_key != "YOUR_OPENROUTER_API_KEY_HERE":
            try:
                self.client = AsyncOpenAI(
                    api_key=self.openrouter_api_key,
                    base_url=self.openrouter_base_url
                )
                logger.info("OpenRouter client initialized successfully")
                return
            except Exception as e:
                logger.error(f"Failed to initialize OpenRouter client: {e}")
        
        # Fallback olarak OpenAI kullan
        if self.openai_api_key and self.openai_api_key != "YOUR_OPENAI_API_KEY_HERE":
            if not validate_api_key(self.openai_api_key):
                logger.error("Invalid OpenAI API key format")
                return
            
            try:
                self.client = AsyncOpenAI(api_key=self.openai_api_key)
                logger.info("OpenAI client initialized successfully")
                return
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
        
        logger.error("No valid API key found")
    
    def _get_cache_key(self, prompt: str) -> str:
        """Cache key oluştur"""
        return hashlib.md5(prompt.encode()).hexdigest()
    
    def _get_from_cache(self, key: str) -> Optional[str]:
        """Cache'den veri al"""
        if key in _cache:
            cached_data = _cache[key]
            # Cache 1 saat geçerli
            if cached_data.get('timestamp', 0) + 3600 > asyncio.get_event_loop().time():
                return cached_data.get('data')
        return None
    
    def _set_cache(self, key: str, data: str):
        """Cache'e veri kaydet"""
        _cache[key] = {
            'data': data,
            'timestamp': asyncio.get_event_loop().time()
        }
        # Cache boyutunu kontrol et (max 100 item)
        if len(_cache) > 100:
            oldest_key = min(_cache.keys(), key=lambda k: _cache[k].get('timestamp', 0))
            del _cache[oldest_key]
    
    async def generate_names_openai(self, request: NameGenerationRequest) -> List[NameSuggestion]:
        """AI ile isim üret (OpenAI veya OpenRouter)"""
        if not self.client:
            raise Exception("AI client not initialized")
        
        # Prompt oluştur
        prompt = self._create_prompt(request)
        
        # Cache kontrolü
        cache_key = self._get_cache_key(prompt)
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            logger.info("Using cached name generation result")
            suggestions = self._parse_ai_response(cached_result, request)
            return suggestions
        
        try:
            logger.info(f"Generating names for gender: {request.gender}, language: {request.language}, theme: {request.theme}")
            
            # OpenRouter için model seçimi
            model = "openai/gpt-3.5-turbo" if self.openrouter_api_key and self.openrouter_api_key != "YOUR_OPENROUTER_API_KEY_HERE" else "gpt-3.5-turbo"
            
            response = await self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "Sen profesyonel bir bebek ismi uzmanısın. Verilen kriterlere göre anlamlı, güzel ve kültürel olarak uygun bebek isimleri önerirsin."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=3000,
                temperature=0.7,
                timeout=30
            )
            
            # Yanıtı parse et
            content = response.choices[0].message.content
            
            # Cache'e kaydet
            self._set_cache(cache_key, content)
            
            suggestions = self._parse_ai_response(content, request)
            
            logger.info(f"Generated {len(suggestions)} name suggestions")
            return suggestions
            
        except Exception as e:
            logger.error(f"AI API error: {e}")
            raise Exception(f"AI service error: {str(e)}")
    
    def _create_prompt(self, request: NameGenerationRequest) -> str:
        """AI için prompt oluştur"""
        gender_map = {
            "male": "erkek",
            "female": "kız", 
            "unisex": "unisex"
        }
        
        language_map = {
            "turkish": "Türkçe",
            "english": "İngilizce",
            "arabic": "Arapça",
            "persian": "Farsça",
            "kurdish": "Kürtçe",
            "azerbaijani": "Azerbaycan dili"
        }
        
        theme_map = {
            "nature": "doğa ile ilgili",
            "religious": "dini/ilahi",
            "historical": "tarihi",
            "modern": "modern",
            "traditional": "geleneksel",
            "unique": "benzersiz",
            "royal": "asil/kraliyet",
            "warrior": "savaşçı",
            "wisdom": "bilgelik",
            "love": "aşk/sevgi"
        }
        
        gender_text = gender_map.get(request.gender, request.gender)
        language_text = language_map.get(request.language, request.language)
        theme_text = theme_map.get(request.theme, request.theme)
        
        prompt = f"""
        Lütfen aşağıdaki kriterlere uygun 40-50 bebek ismi öner:

        Cinsiyet: {gender_text}
        Dil: {language_text}
        Tema: {theme_text}
        
        Ekstra bilgiler: {request.extra or "Yok"}
        
        Her isim için şu formatta yanıt ver:
        İsim - Anlamı ve açıklaması
        
        Örnek format:
        Ahmet - Cesur, güçlü, övülmüş
        Zeynep - Güzel, değerli taş
        
        Lütfen çeşitli, modern ve anlamlı isimler öner. Klasik isimlerin yanında daha az bilinen ama güzel isimler de dahil et. Farklı kategorilerde isimler ver (klasik, modern, nadir, popüler, geleneksel, çağdaş, uluslararası).
        """
        
        return prompt.strip()
    
    def _parse_ai_response(self, content: str, request: NameGenerationRequest = None) -> List[NameSuggestion]:
        """AI yanıtını parse et"""
        suggestions = []
        
        lines = content.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            # İsim ve anlamı ayır
            if ' - ' in line:
                name_part, meaning_part = line.split(' - ', 1)
                name = name_part.strip()
                meaning = meaning_part.strip()
                
                if name and meaning:
                    suggestion = NameSuggestion(
                        name=name,
                        meaning=meaning,
                        origin="AI Generated",
                        popularity="Modern"
                    )
                    
                    # Request bilgilerini ekle
                    if request:
                        suggestion.gender = request.gender
                        suggestion.language = request.language
                        suggestion.theme = request.theme
                    
                    suggestions.append(suggestion)
        
        return suggestions[:15]  # Maksimum 15 öneri
    
    async def generate_names_fallback(self, request: NameGenerationRequest) -> List[NameSuggestion]:
        """Fallback isim üretimi - AI çalışmazsa"""
        logger.warning("Using fallback name generation")
        
        # Genişletilmiş fallback isimler
        fallback_names = {
            "male": {
                "turkish": {
                    "nature": [
                        ("Deniz", "Okyanus, deniz"),
                        ("Rüzgar", "Hava akımı"),
                        ("Dağ", "Yüksek tepe"),
                        ("Orman", "Ağaç topluluğu"),
                        ("Güneş", "Güneş ışığı"),
                        ("Yıldız", "Gökyüzündeki parlak cisim"),
                        ("Nehir", "Akan su"),
                        ("Çiçek", "Güzel bitki"),
                        ("Kuş", "Uçan hayvan"),
                        ("Ağaç", "Uzun boylu bitki")
                    ],
                    "religious": [
                        ("Ahmet", "Cesur, güçlü, övülmüş"),
                        ("Mehmet", "Övülmüş, beğenilmiş"),
                        ("Ali", "Yüce, yüksek"),
                        ("Hasan", "Güzel, iyi"),
                        ("Hüseyin", "Güzel, iyi"),
                        ("İbrahim", "Baba olan"),
                        ("Yusuf", "Güzel yüzlü"),
                        ("Musa", "Su çocuğu"),
                        ("İsa", "Kurtarıcı"),
                        ("Davut", "Sevilen")
                    ],
                    "modern": [
                        ("Arda", "Orman, ağaç"),
                        ("Ege", "Ege denizi"),
                        ("Can", "Yaşam, ruh"),
                        ("Kaan", "Hükümdar"),
                        ("Alp", "Kahraman"),
                        ("Berk", "Güçlü, sağlam"),
                        ("Eren", "Ermiş, veli"),
                        ("Mert", "Yiğit, cesur"),
                        ("Ozan", "Şair"),
                        ("Taha", "Kur'an harfi")
                    ],
                    "persian": {
                        "nature": [
                            ("Ramin", "Yüksek, yüce"),
                            ("Soroush", "Melek, ilahi haberci"),
                            ("Shahin", "Şahin, yırtıcı kuş"),
                            ("Kourosh", "Güneş, parlak"),
                            ("Arash", "Kahraman okçu"),
                            ("Siavash", "Siyah at"),
                            ("Rostam", "Güçlü, kahraman"),
                            ("Bahram", "Zafer, galibiyet"),
                            ("Dariush", "İyi kral"),
                            ("Cyrus", "Güneş, taht")
                        ],
                        "royal": [
                            ("Shahriar", "Kral, hükümdar"),
                            ("Ardeshir", "Haklı kral"),
                            ("Khosrow", "İyi ün"),
                            ("Jamshid", "Güneş kralı"),
                            ("Fereydun", "Üç katlı güç"),
                            ("Keyvan", "Satürn gezegeni"),
                            ("Sohrab", "Parlak yüz"),
                            ("Esfandiar", "Kutsal ateş"),
                            ("Garshasp", "Güçlü at"),
                            ("Zal", "Beyaz saçlı")
                        ],
                        "wisdom": [
                            ("Hafez", "Koruyucu, hafız"),
                            ("Saadi", "Mutlu, şanslı"),
                            ("Rumi", "Roma'dan gelen"),
                            ("Omar", "Uzun ömürlü"),
                            ("Ferdowsi", "Cennet bahçesi"),
                            ("Nezami", "Şiir, nazım"),
                            ("Attar", "Eczacı, şifacı"),
                            ("Jami", "Toplayıcı"),
                            ("Khaqani", "Hükümdar"),
                            ("Sanai", "Yüksek yer")
                        ]
                    }
                },
                "english": {
                    "nature": [
                        ("River", "Nehir"),
                        ("Forest", "Orman"),
                        ("Sky", "Gökyüzü"),
                        ("Ocean", "Okyanus"),
                        ("Mountain", "Dağ"),
                        ("Storm", "Fırtına"),
                        ("Rain", "Yağmur"),
                        ("Sun", "Güneş"),
                        ("Moon", "Ay"),
                        ("Star", "Yıldız")
                    ],
                    "modern": [
                        ("Liam", "Güçlü irade"),
                        ("Noah", "Huzur"),
                        ("Oliver", "Zeytin ağacı"),
                        ("Elijah", "Tanrım"),
                        ("William", "İstekli koruyucu"),
                        ("James", "Takipçi"),
                        ("Benjamin", "Sağ el oğlu"),
                        ("Lucas", "Işık"),
                        ("Mason", "Taş ustası"),
                        ("Ethan", "Güçlü")
                    ]
                }
            },
            "female": {
                "turkish": {
                    "nature": [
                        ("Deniz", "Okyanus, deniz"),
                        ("Rüzgar", "Hava akımı"),
                        ("Dağ", "Yüksek tepe"),
                        ("Orman", "Ağaç topluluğu"),
                        ("Güneş", "Güneş ışığı"),
                        ("Yıldız", "Gökyüzündeki parlak cisim"),
                        ("Nehir", "Akan su"),
                        ("Çiçek", "Güzel bitki"),
                        ("Kuş", "Uçan hayvan"),
                        ("Ağaç", "Uzun boylu bitki")
                    ],
                    "religious": [
                        ("Fatma", "Sütten kesilmiş"),
                        ("Ayşe", "Yaşayan, canlı"),
                        ("Zeynep", "Güzel, değerli taş"),
                        ("Hatice", "Erken doğan"),
                        ("Meryem", "Deniz damlası"),
                        ("Havva", "Yaşam veren"),
                        ("Reyhan", "Fesleğen"),
                        ("Safiye", "Temiz, saf"),
                        ("Ümmü", "Anne"),
                        ("Esma", "İsimler")
                    ],
                    "modern": [
                        ("Elif", "Alfabenin ilk harfi"),
                        ("Defne", "Defne ağacı"),
                        ("Mira", "Mira yıldızı"),
                        ("Ada", "Ada"),
                        ("Ece", "Kraliçe"),
                        ("Selin", "Sel, su"),
                        ("Büşra", "Müjde"),
                        ("Zara", "Altın"),
                        ("Leyla", "Gece"),
                        ("Maya", "Su perisi")
                    ],
                    "persian": {
                        "nature": [
                            ("Shirin", "Tatlı, güzel"),
                            ("Parisa", "Peri yüzü"),
                            ("Anahita", "Su tanrıçası"),
                            ("Roxana", "Parlak, ışıltılı"),
                            ("Yasmin", "Yasemin çiçeği"),
                            ("Azar", "Ateş"),
                            ("Mehr", "Güneş, sevgi"),
                            ("Nahid", "Venüs gezegeni"),
                            ("Tara", "Yıldız"),
                            ("Saba", "Sabah rüzgarı")
                        ],
                        "royal": [
                            ("Shahrazad", "Şehir kraliçesi"),
                            ("Donya", "Dünya"),
                            ("Pari", "Peri"),
                            ("Banu", "Hanım, kadın"),
                            ("Shahin", "Şahin"),
                            ("Malek", "Kraliçe"),
                            ("Sultan", "Hükümdar"),
                            ("Shahla", "Koyu gözlü"),
                            ("Shahzad", "Prenses"),
                            ("Shahinaz", "Gururlu kraliçe")
                        ],
                        "love": [
                            ("Mahnaz", "Gurur, onur"),
                            ("Minoo", "Cennet"),
                            ("Mojgan", "Kirpik"),
                            ("Nazanin", "Nazlı, şirin"),
                            ("Neda", "Ses, çağrı"),
                            ("Negin", "Mücevher"),
                            ("Niloofar", "Nilüfer"),
                            ("Pantea", "Güçlü, güçlü"),
                            ("Raha", "Özgür"),
                            ("Roya", "Rüya")
                        ]
                    }
                },
                "english": {
                    "nature": [
                        ("Willow", "Söğüt"),
                        ("Rose", "Gül"),
                        ("Daisy", "Papatya"),
                        ("Iris", "Süsen"),
                        ("Lily", "Zambak"),
                        ("Violet", "Menekşe"),
                        ("Jasmine", "Yasemin"),
                        ("Lavender", "Lavanta"),
                        ("Sage", "Adaçayı"),
                        ("Autumn", "Sonbahar")
                    ],
                    "modern": [
                        ("Emma", "Evrensel"),
                        ("Olivia", "Zeytin ağacı"),
                        ("Ava", "Kuş"),
                        ("Isabella", "Tanrıma yemin"),
                        ("Sophia", "Bilgelik"),
                        ("Charlotte", "Küçük"),
                        ("Mia", "Benim"),
                        ("Amelia", "Çalışkan"),
                        ("Harper", "Arp çalan"),
                        ("Evelyn", "İstenen")
                    ]
                }
            }
        }
        
        # İlgili kategoriden isimleri al
        gender_names = fallback_names.get(request.gender, {})
        language_names = gender_names.get(request.language, {})
        theme_names = language_names.get(request.theme, [])
        
        # Eğer tema için özel isim yoksa, genel isimlerden al
        if not theme_names:
            theme_names = []
            for theme_names_list in language_names.values():
                theme_names.extend(theme_names_list)
        
        # Eğer hala isim yoksa, varsayılan isimler
        if not theme_names:
            default_names = {
                "male": [("Ahmet", "Cesur, güçlü"), ("Mehmet", "Övülmüş"), ("Ali", "Yüce")],
                "female": [("Zeynep", "Güzel"), ("Fatma", "Sütten kesilmiş"), ("Ayşe", "Yaşayan")]
            }
            theme_names = default_names.get(request.gender, [])
        
        suggestions = []
        for name, meaning in theme_names[:12]:  # Maksimum 12 isim
            suggestion = NameSuggestion(
                name=name,
                meaning=meaning,
                origin="Fallback",
                popularity="Traditional"
            )
            
            # Request bilgilerini ekle
            suggestion.gender = request.gender
            suggestion.language = request.language
            suggestion.theme = request.theme
            
            suggestions.append(suggestion)
        
        return suggestions

    async def generate_text(self, prompt: str, max_tokens: int = 1000) -> str:
        """Generate text using AI service"""
        try:
            if self.client:
                # Model seçimi
                model = "openai/gpt-3.5-turbo" if self.openrouter_api_key and self.openrouter_api_key != "YOUR_OPENROUTER_API_KEY_HERE" else "gpt-3.5-turbo"
                
                response = await self.client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=0.7
                )
                return response.choices[0].message.content.strip()
            else:
                return "AI servisi şu anda kullanılamıyor."
        except Exception as e:
            logger.error(f"AI text generation error: {e}")
            return "AI servisi hatası oluştu."

    async def get_name_suggestions_by_theme(self, theme: str, gender: str, count: int = 10) -> List[Dict]:
        """Tema bazlı isim önerileri"""
        prompt = f"""
        {theme} temasında {gender} bebek isimleri öner. {count} isim ver.
        
        Her isim için şu formatta yanıt ver:
        İsim - Anlamı
        
        Örnek:
        Deniz - Okyanus, deniz
        Rüzgar - Hava akımı
        
        Sadece isim ve anlam ver, başka açıklama yapma.
        """
        
        try:
            response = await self.generate_text(prompt, max_tokens=2000)
            return self._parse_theme_response(response, gender, None, theme)
        except Exception as e:
            logger.error(f"Theme-based name generation error: {e}")
            return []

    def _parse_theme_response(self, content: str, gender: str = None, language: str = None, theme: str = None) -> List[Dict]:
        """Tema bazlı AI yanıtını parse et"""
        try:
            import json
            # JSON bloğunu bul
            start_idx = content.find('{')
            end_idx = content.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                json_str = content[start_idx:end_idx + 1]
                data = json.loads(json_str)
                
                # Eğer data bir liste ise direkt döndür
                if isinstance(data, list):
                    # Gender, language ve theme bilgilerini ekle
                    for item in data:
                        if gender:
                            item['gender'] = gender
                        if language:
                            item['language'] = language
                        if theme:
                            item['theme'] = theme
                    return data
                
                # Eğer data bir dict ise ve names key'i varsa
                if isinstance(data, dict) and 'names' in data:
                    names = data['names']
                    # Gender, language ve theme bilgilerini ekle
                    for item in names:
                        if gender:
                            item['gender'] = gender
                        if language:
                            item['language'] = language
                        if theme:
                            item['theme'] = theme
                    return names
                
                # Diğer durumlar için boş liste döndür
                return []
            else:
                # JSON bulunamadı, manuel parse et
                lines = content.strip().split('\n')
                names = []
                
                for line in lines:
                    line = line.strip()
                    if ' - ' in line:
                        name_part, meaning_part = line.split(' - ', 1)
                        name = name_part.strip()
                        meaning = meaning_part.strip()
                        
                        if name and meaning:
                            name_obj = {
                                "name": name,
                                "meaning": meaning,
                                "origin": "AI Generated",
                                "popularity": "Modern"
                            }
                            
                            # Gender, language ve theme bilgilerini ekle
                            if gender:
                                name_obj['gender'] = gender
                            if language:
                                name_obj['language'] = language
                            if theme:
                                name_obj['theme'] = theme
                            
                            names.append(name_obj)
                
                return names
                
        except Exception as e:
            logger.error(f"Theme response parsing error: {e}")
            return []

    async def get_name_compatibility(self, name1: str, name2: str) -> Dict:
        """İki ismin uyumluluğunu analiz et"""
        prompt = f"""
        "{name1}" ve "{name2}" isimlerinin uyumluluğunu analiz et:
        - Ses uyumu
        - Anlam uyumu
        - Kültürel uyum
        - Modern uyum
        - Genel puan (1-10)
        
        Türkçe olarak detaylı analiz yap.
        """
        
        try:
            response = await self.generate_text(prompt, max_tokens=1000)
            return {
                "name1": name1,
                "name2": name2,
                "analysis": response,
                "compatibility_score": 8  # Placeholder
            }
        except Exception as e:
            logger.error(f"Name compatibility analysis error: {e}")
            return {"error": "Uyumluluk analizi yapılamadı"}

    async def get_name_trends(self) -> Dict:
        """Güncel isim trendlerini getir"""
        try:
            prompt = """
            Güncel bebek ismi trendlerini analiz et ve şu formatta JSON yanıt ver:
            
            {
                "global_trends": [
                    {
                        "name": "İsim",
                        "language": "Dil",
                        "gender": "Cinsiyet",
                        "trend_score": 0.85,
                        "popularity_change": "Yükselen",
                        "meaning": "Anlamı",
                        "origin": "Kökeni",
                        "cultural_context": "Kültürel bağlamı"
                    }
                ],
                "trends_by_language": {
                    "turkish": [
                        {
                            "name": "Türkçe İsim",
                            "gender": "erkek/kız",
                            "trend_score": 0.9,
                            "popularity_change": "Yükselen",
                            "meaning": "Anlamı",
                            "origin": "Kökeni",
                            "cultural_context": "Kültürel bağlamı"
                        }
                    ],
                    "english": [
                        {
                            "name": "English Name",
                            "gender": "male/female",
                            "trend_score": 0.8,
                            "popularity_change": "Stabil",
                            "meaning": "Meaning",
                            "origin": "Origin",
                            "cultural_context": "Cultural context"
                        }
                    ]
                },
                "analysis": "Genel trend analizi"
            }
            
            Sadece JSON formatında yanıt ver, başka açıklama ekleme.
            """
            
            response = await self.generate_text(prompt, max_tokens=2000)
            
            # JSON parse et
            try:
                trends_data = json.loads(response)
                return trends_data
            except json.JSONDecodeError:
                logger.error("Failed to parse trends JSON")
                return {"error": "Trend verisi parse edilemedi"}
                
        except Exception as e:
            logger.error(f"Get name trends error: {e}")
            return {"error": "Trend analizi yapılamadı"}

    async def get_global_trends(self) -> Dict:
        """Çoklu dil desteği ile global trendler"""
        try:
            languages = ["turkish", "english", "arabic", "persian", "french", "german", "spanish"]
            all_trends = {}
            
            for language in languages:
                prompt = f"""
                {language.capitalize()} dilindeki güncel bebek ismi trendlerini analiz et.
                En popüler 10 ismi şu formatta JSON olarak ver:
                
                {{
                    "language": "{language}",
                    "language_name": "{self._get_language_name(language)}",
                    "trends": [
                        {{
                            "name": "İsim",
                            "gender": "cinsiyet",
                            "trend_score": 0.85,
                            "popularity_change": "Yükselen/Stabil/Düşen",
                            "meaning": "Anlamı",
                            "origin": "Kökeni",
                            "cultural_context": "Kültürel bağlamı"
                        }}
                    ]
                }}
                
                Sadece JSON formatında yanıt ver.
                """
                
                try:
                    response = await self.generate_text(prompt, max_tokens=1500)
                    trends_data = json.loads(response)
                    all_trends[language] = trends_data
                except Exception as e:
                    logger.error(f"Failed to get trends for {language}: {e}")
                    continue
            
            # Global en popüler isimleri belirle
            global_prompt = """
            Tüm dillerdeki trend verilerini analiz ederek global olarak en popüler 15 bebek ismini belirle.
            Şu formatta JSON yanıt ver:
            
            {
                "global_top_names": [
                    {
                        "name": "İsim",
                        "language": "Dil",
                        "gender": "Cinsiyet",
                        "trend_score": 0.95,
                        "popularity_change": "Global Yükselen",
                        "meaning": "Anlamı",
                        "origin": "Kökeni",
                        "cultural_context": "Global kültürel bağlamı"
                    }
                ]
            }
            """
            
            try:
                global_response = await self.generate_text(global_prompt, max_tokens=1000)
                global_data = json.loads(global_response)
                all_trends["global"] = global_data
            except Exception as e:
                logger.error(f"Failed to get global trends: {e}")
            
            return {
                "success": True,
                "trends_by_language": list(all_trends.values()),
                "global_top_names": all_trends.get("global", {}).get("global_top_names", []),
                "last_updated": datetime.now().isoformat(),
                "total_languages": len(all_trends)
            }
            
        except Exception as e:
            logger.error(f"Get global trends error: {e}")
            return {"success": False, "error": "Global trend analizi yapılamadı"}

    def _get_language_name(self, language_code: str) -> str:
        """Dil kodunu dil adına çevir"""
        language_names = {
            "turkish": "Türkçe",
            "english": "İngilizce",
            "arabic": "Arapça",
            "persian": "Farsça",
            "kurdish": "Kürtçe",
            "azerbaijani": "Azerbaycan dili",
            "french": "Fransızca",
            "german": "Almanca",
            "spanish": "İspanyolca",
            "portuguese": "Portekizce",
            "russian": "Rusça",
            "chinese": "Çince",
            "japanese": "Japonca"
        }
        return language_names.get(language_code, language_code.capitalize())

    async def get_premium_name_suggestions(self, request: NameGenerationRequest, is_premium: bool = False) -> Dict:
        """Premium kullanıcılar için gelişmiş isim önerileri"""
        try:
            # Temel isim üretimi
            basic_names = await self.generate_names_openai(request)
            
            # Premium özellikler
            premium_features = {}
            
            if is_premium:
                # Detaylı analiz
                detailed_analysis = await self._get_detailed_name_analysis(basic_names[:5])
                premium_features["detailed_analysis"] = detailed_analysis
                
                # Kültürel bağlam
                cultural_context = await self._get_cultural_context(request)
                premium_features["cultural_context"] = cultural_context
                
                # Popülerlik tahmini
                popularity_prediction = await self._get_popularity_prediction(basic_names[:5])
                premium_features["popularity_prediction"] = popularity_prediction
                
                # Benzer isimler
                similar_names = await self._get_similar_names(basic_names[:3])
                premium_features["similar_names"] = similar_names
            
            return {
                "success": True,
                "names": [name.dict() for name in basic_names],
                "total_count": len(basic_names),
                "is_premium_required": not is_premium and len(basic_names) > 5,
                "premium_message": "Premium üye olarak daha fazla özellik ve analiz alın!" if not is_premium else None,
                "premium_features": premium_features if is_premium else None
            }
            
        except Exception as e:
            logger.error(f"Premium name suggestions error: {e}")
            return {"success": False, "error": "İsim önerileri oluşturulamadı"}

    async def _get_detailed_name_analysis(self, names: List[NameSuggestion]) -> List[Dict]:
        """İsimler için detaylı analiz"""
        try:
            analysis_results = []
            
            for name in names:
                prompt = f"""
                "{name.name}" ismi için detaylı analiz yap:
                
                1. Etimolojik köken
                2. Tarihsel kullanım
                3. Kültürel anlamı
                4. Modern algısı
                5. Uluslararası kullanımı
                6. Varyasyonları
                7. Ünlü kişiler
                8. Öneriler
                
                JSON formatında yanıt ver.
                """
                
                response = await self.generate_text(prompt, max_tokens=800)
                try:
                    analysis = json.loads(response)
                    analysis["name"] = name.name
                    analysis_results.append(analysis)
                except json.JSONDecodeError:
                    continue
            
            return analysis_results
            
        except Exception as e:
            logger.error(f"Detailed analysis error: {e}")
            return []

    async def _get_cultural_context(self, request: NameGenerationRequest) -> Dict:
        """Kültürel bağlam analizi"""
        try:
            prompt = f"""
            {request.language} dilinde {request.gender} bebek isimleri için kültürel bağlam analizi yap:
            
            1. Tarihsel gelişim
            2. Sosyal etkiler
            3. Dini faktörler
            4. Modern eğilimler
            5. Uluslararası etkiler
            
            JSON formatında yanıt ver.
            """
            
            response = await self.generate_text(prompt, max_tokens=600)
            return json.loads(response)
            
        except Exception as e:
            logger.error(f"Cultural context error: {e}")
            return {}

    async def _get_popularity_prediction(self, names: List[NameSuggestion]) -> List[Dict]:
        """Popülerlik tahmini"""
        try:
            predictions = []
            
            for name in names:
                prompt = f"""
                "{name.name}" isminin gelecek 5 yıldaki popülerlik trendini tahmin et:
                
                1. Mevcut durum
                2. Gelecek trendi
                3. Faktörler
                4. Öneriler
                
                JSON formatında yanıt ver.
                """
                
                response = await self.generate_text(prompt, max_tokens=400)
                try:
                    prediction = json.loads(response)
                    prediction["name"] = name.name
                    predictions.append(prediction)
                except json.JSONDecodeError:
                    continue
            
            return predictions
            
        except Exception as e:
            logger.error(f"Popularity prediction error: {e}")
            return []

    async def _get_similar_names(self, names: List[NameSuggestion]) -> List[Dict]:
        """Benzer isimler"""
        try:
            similar_names = []
            
            for name in names:
                prompt = f"""
                "{name.name}" ismine benzer 5 isim öner:
                
                Her isim için:
                - İsim
                - Benzerlik oranı
                - Benzerlik nedeni
                
                JSON formatında yanıt ver.
                """
                
                response = await self.generate_text(prompt, max_tokens=300)
                try:
                    similar = json.loads(response)
                    similar["original_name"] = name.name
                    similar_names.append(similar)
                except json.JSONDecodeError:
                    continue
            
            return similar_names
            
        except Exception as e:
            logger.error(f"Similar names error: {e}")
            return []


class NameGenerationService:
    """İsim üretimi ana servis sınıfı"""
    
    def __init__(self):
        self.ai_service = AIService()
    
    async def generate_names(self, request: NameGenerationRequest) -> List[NameSuggestion]:
        """İsim üretimi ana metodu"""
        try:
            # Input sanitization
            if request.extra:
                request.extra = sanitize_input(request.extra)
            
            # AI ile isim üret
            try:
                suggestions = await self.ai_service.generate_names_openai(request)
                if suggestions:
                    return suggestions
            except Exception as e:
                logger.warning(f"AI service failed, using fallback: {e}")
            
            # Fallback kullan
            return await self.ai_service.generate_names_fallback(request)
            
        except Exception as e:
            logger.error(f"Name generation failed: {e}")
            raise Exception(f"Name generation service error: {str(e)}")
    
    async def validate_request(self, request: NameGenerationRequest) -> bool:
        """İstek validasyonu"""
        if not request.gender or not request.language or not request.theme:
            return False
        
        if request.extra and len(request.extra) > 500:
            return False
        
        return True
    
    async def analyze_name(self, name: str, language: str = "turkish") -> dict:
        """İsmin detaylı analizini yap"""
        try:
            # AI ile detaylı analiz
            prompt = f"""
            \"{name}\" isminin detaylı analizini TÜRKÇE olarak yap. Aşağıdaki bilgileri TÜRKÇE olarak ver:

            1. **Köken ve Etimoloji**: İsmin kökeni, hangi dilden geldiği, tarihsel geçmişi
            2. **Anlam ve Yorumlama**: İsmin tam anlamı, farklı yorumları
            3. **Kültürel Bağlam**: Hangi kültürlerde kullanıldığı, kültürel önemi
            4. **Karakteristik Özellikler**: Bu ismi taşıyan kişilerin genel karakteristik özellikleri
            5. **Popülerlik ve Kullanım**: Günümüzdeki popülerliği, hangi ülkelerde yaygın
            6. **Varyasyonlar**: İsmin farklı dillerdeki versiyonları
            7. **Tarihi Figürler**: Bu ismi taşıyan ünlü tarihi kişiler
            8. **Modern Kullanım**: Günümüzde nasıl algılandığı, modern çağrışımları
            9. **Telaffuz**: Doğru telaffuz şekli
            10. **Öneriler**: Bu ismi kullanırken dikkat edilmesi gerekenler

            ÖNEMLİ: Tüm yanıtı TÜRKÇE olarak ver. Yanıtı JSON formatında ver:
            {{
                "origin": "Köken bilgisi (Türkçe)",
                "meaning": "Detaylı anlam (Türkçe)",
                "cultural_context": "Kültürel bağlam (Türkçe)",
                "characteristics": "Karakteristik özellikler (Türkçe)",
                "popularity": "Popülerlik durumu (Türkçe)",
                "variations": ["Varyasyon 1", "Varyasyon 2"],
                "famous_people": ["Ünlü kişi 1", "Ünlü kişi 2"],
                "modern_perception": "Modern algı (Türkçe)",
                "pronunciation": "Telaffuz (Türkçe)",
                "recommendations": "Öneriler (Türkçe)"
            }}
            """

            response = await self.ai_service.generate_text(prompt)
            logger.info(f"AI analyze_name yanıtı: {response}")
            
            # JSON parse etmeye çalış
            try:
                import json
                response_clean = response.strip()
                start_idx = response_clean.find('{')
                end_idx = response_clean.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    json_str = response_clean[start_idx:end_idx + 1]
                    analysis = json.loads(json_str)
                else:
                    analysis = json.loads(response_clean)
                required_fields = ["origin", "meaning", "cultural_context", "characteristics", 
                                 "popularity", "variations", "famous_people", "modern_perception", 
                                 "pronunciation", "recommendations"]
                for field in required_fields:
                    if field not in analysis:
                        analysis[field] = f"{field} bilgisi mevcut değil"
                return analysis
            except Exception as e:
                logger.warning(f"JSON parsing failed for name analysis: {e}, yanıt: {response}")
                # JSON parse edilemezse, response'u anlamlı parçalara böl
                lines = response.split('\n')
                analysis = {
                    "origin": f"{name} isminin kökeni analiz edilemedi",
                    "meaning": f"{name} isminin anlamı: {response[:200]}..." if len(response) > 200 else response,
                    "cultural_context": "Kültürel bağlam analiz edilemedi",
                    "characteristics": "Karakteristik özellikler analiz edilemedi",
                    "popularity": "Popülerlik durumu analiz edilemedi",
                    "variations": [],
                    "famous_people": [],
                    "modern_perception": "Modern algı analiz edilemedi",
                    "pronunciation": "Telaffuz analiz edilemedi",
                    "recommendations": "Öneriler analiz edilemedi"
                }
                return analysis
        except Exception as e:
            logger.error(f"Name analysis failed: {e}")
            return {
                "origin": f"{name} isminin kökeni analiz edilemedi",
                "meaning": f"{name} isminin anlamı hakkında detaylı bilgi bulunamadı",
                "cultural_context": "Kültürel bağlam bilgisi mevcut değil",
                "characteristics": "Karakteristik özellikler analiz edilemedi",
                "popularity": "Popülerlik durumu bilinmiyor",
                "variations": [],
                "famous_people": [],
                "modern_perception": "Modern algı bilgisi mevcut değil",
                "pronunciation": "Telaffuz bilgisi mevcut değil",
                "recommendations": "Öneriler mevcut değil"
            } 