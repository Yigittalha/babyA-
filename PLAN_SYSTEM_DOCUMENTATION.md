# Plan Sistem Dokümantasyonu

## 🎯 Genel Bakış

Baby Name Generator uygulaması için kararlı ve güvenli bir plan sistemi oluşturuldu. Sistem, frontend-backend senkronizasyonu, oturum yönetimi ve gelir takibi konularında tam entegre çalışmaktadır.

## 📊 Plan Yapısı

### Sabit Plan Tipleri
```javascript
// Backend (Python)
class PlanType(Enum):
    FREE = "free"
    STANDARD = "standard"  
    PREMIUM = "premium"

// Frontend (JavaScript)
const PLAN_TYPES = {
  FREE: 'free',
  STANDARD: 'standard',
  PREMIUM: 'premium'
}
```

### Plan Detayları ve Fiyatlandırma
| Plan | ID | Fiyat | Günlük İsim | Favori Limiti | Özellikler |
|------|-----|-------|-------------|---------------|------------|
| Free Family | `free` | $0.00 | 5 | 3 | Temel özellikler |
| Standard Family | `standard` | $4.99 | 50 | 20 | + Kültürel içgörüler |
| Premium Family | `premium` | $8.99 | Sınırsız | Sınırsız | + Tüm özellikler |

## 🔐 Güvenlik ve Session Yönetimi

### Frontend SessionManager
- **Otomatik oturum doğrulama**: Token süresi kontrolü
- **Multi-tab senkronizasyon**: Storage event listener ile
- **Plan validasyonu**: Her plan değişiminde otomatik kontrol
- **Kullanıcı değişimi algılama**: Farklı kullanıcı girişinde otomatik temizlik

### Backend Güvenlik
- **JWT token doğrulama**: Her istekte token kontrolü
- **Plan-based access control**: Özellik erişimi plan tipine göre
- **Rate limiting**: Plan tipine göre istek limitleri
- **Session validation**: Database ile token uyumu kontrolü

## 📈 Gelir Takibi

### Otomatik Gelir Hesaplama
```sql
-- Aylık gelir hesaplama
SELECT SUM(
    CASE 
        WHEN subscription_type = 'standard' THEN 4.99
        WHEN subscription_type = 'premium' THEN 8.99
        ELSE 0
    END
) as monthly_revenue
FROM users
WHERE subscription_type IN ('standard', 'premium')
```

### Gerçek Zamanlı İstatistikler
- Toplam kullanıcı sayısı
- Plan bazlı kullanıcı dağılımı
- Aylık/yıllık gelir projeksiyonu
- Dönüşüm oranı (ücretli/toplam)

## 🔄 Plan Güncelleme Akışı

1. **Admin Panel'den Güncelleme**
   - Plan seçimi → API çağrısı
   - Database güncelleme
   - Subscription history kaydı
   - Revenue yeniden hesaplama

2. **Session Senkronizasyonu**
   - Aktif kullanıcı ise SessionManager güncelleme
   - LocalStorage güncelleme
   - UI component'leri otomatik yenileme
   - Multi-tab senkronizasyon

## 💻 Kullanım Örnekleri

### Frontend'de Plan Kontrolü
```javascript
import { isPremiumUser, hasFeature, hasReachedLimit } from './services/sessionManager';

// Premium kullanıcı kontrolü
if (isPremiumUser()) {
    // Premium özellikler aktif
}

// Özellik erişim kontrolü
if (hasFeature('cultural_insights')) {
    // Kültürel içgörüler göster
}

// Limit kontrolü
const currentFavorites = 5;
if (hasReachedLimit('maxFavorites', currentFavorites)) {
    // Limit aşıldı mesajı
}
```

### Backend'de Plan Validasyonu
```python
from app.auth_middleware import PlanAccessControl

# Özellik erişim kontrolü
if PlanAccessControl.has_access(user.subscription_type, 'name_analysis'):
    # İsim analizi yapılabilir

# Günlük limit kontrolü
if PlanAccessControl.check_daily_limit(user.subscription_type, 'generate_names', daily_count):
    # İsim üretilebilir
```

## 🚀 Sistem Özellikleri

### Kararlılık
- ✅ Sabit plan ID'leri (free/standard/premium)
- ✅ Otomatik plan validasyonu
- ✅ Database-frontend senkronizasyonu
- ✅ Hata durumunda otomatik fallback

### Güvenlik
- ✅ Token-based authentication
- ✅ Session integrity kontrolü
- ✅ Multi-tab güvenlik
- ✅ Plan-based access control

### Performans
- ✅ LocalStorage cache
- ✅ Lazy loading
- ✅ Optimized database queries
- ✅ Rate limiting

### Ölçeklenebilirlik
- ✅ Modüler yapı
- ✅ Kolay plan ekleme/güncelleme
- ✅ Esnek fiyatlandırma
- ✅ Detaylı logging

## 📝 Bakım ve İzleme

### Log Takibi
- Plan değişimleri
- Session hataları
- Revenue hesaplama
- Rate limit aşımları

### Metrikler
- Aktif kullanıcı sayısı
- Plan dönüşüm oranları
- Günlük/aylık gelir
- API kullanım istatistikleri

## 🔧 Troubleshooting

### Yaygın Sorunlar ve Çözümleri

1. **Plan güncelleme yansımıyor**
   - SessionManager cache temizle
   - Browser refresh
   - Token yenile

2. **Revenue hesaplama hatası**
   - Database plan consistency kontrolü
   - Subscription history temizliği
   - Manual recalculation

3. **Multi-tab sync sorunu**
   - Storage events kontrolü
   - Browser compatibility
   - Session integrity check

## 📚 API Referansı

### Plan Endpoints
- `GET /subscription/plans` - Mevcut planları listele
- `PUT /admin/users/{id}/plans` - Kullanıcı planı güncelle
- `GET /admin/analytics/plan-stats` - Plan istatistikleri
- `GET /api/user/plan-features` - Kullanıcı plan özellikleri

### Response Format
```json
{
  "success": true,
  "data": {
    "total_users": 100,
    "paid_users": 45,
    "monthly_revenue": 350.55,
    "plan_breakdown": [...]
  }
}
```

---

Bu dokümantasyon, sistemin tüm kritik bileşenlerini ve kullanım şekillerini kapsamaktadır. Herhangi bir sorun veya iyileştirme önerisi için lütfen geliştirme ekibiyle iletişime geçin. 