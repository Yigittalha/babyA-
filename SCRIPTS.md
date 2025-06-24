# 🚀 Baby AI - Otomatik Başlatma Scriptleri

Bu belgede Baby AI projesini hızlı ve kolay bir şekilde başlatmak için hazırlanan scriptler açıklanmaktadır.

## 📋 Script Listesi

### 🖥️ Yerel Development Scriptleri

| Script | Açıklama | Kullanım |
|--------|----------|----------|
| `./start.sh` | Tüm servisleri yerel olarak başlatır | `./start.sh` |
| `./stop.sh` | Tüm servisleri durdurur | `./stop.sh` |
| `./restart.sh` | Servisleri yeniden başlatır | `./restart.sh` |
| `./status.sh` | Sistem durumunu kontrol eder | `./status.sh` |

### 🐳 Docker Scriptleri

| Script | Açıklama | Kullanım |
|--------|----------|----------|
| `./start-docker.sh` | Docker ile tüm servisleri başlatır | `./start-docker.sh` |
| `./stop-docker.sh` | Docker containerlarını durdurur | `./stop-docker.sh` |

## 🚀 Hızlı Başlatma

### Yerel Development İçin:
```bash
# Tüm servisleri başlat
./start.sh

# Durumu kontrol et
./status.sh

# Durdur
./stop.sh
```

### Docker İle:
```bash
# Docker ile başlat
./start-docker.sh

# Docker containerları durdur
./stop-docker.sh
```

## 📊 Detaylı Açıklamalar

### `start.sh` - Ana Başlatma Scripti

Bu script:
- ✅ Eski servisleri otomatik temizler
- ✅ Virtual environment'ı kontrol eder ve gerekirse oluşturur
- ✅ Dependencies'leri günceller
- ✅ Backend'i (FastAPI) uvicorn ile başlatır
- ✅ Frontend'i (Vite) başlatır
- ✅ Health check'ler yapar
- ✅ Hata durumunda logları gösterir
- ✅ Başlatma süresini raporlar

**Çıktı:**
```
🚀 Baby AI Sistemi Başlatılıyor...
==================================
🧹 Eski servisleri temizleniyor...
✅ Port temizleme tamamlandı

🔧 Backend başlatılıyor...
   📦 Dependencies kontrol ediliyor...
   🚀 FastAPI server başlatılıyor...
   ✅ Backend başarıyla başlatıldı (PID: 1234)

🎨 Frontend başlatılıyor...
   🚀 Vite dev server başlatılıyor...
   ✅ Frontend başarıyla başlatıldı (PID: 5678)

🎉 BAŞLATMA TAMAMLANDI!
==========================
📊 Sistem Bilgileri:
   🔗 Frontend: http://localhost:5173
   🔗 Backend:  http://localhost:8000
   🔗 API Docs: http://localhost:8000/docs
   📁 Loglar:   /Users/yigit/Desktop/babysh/logs/
   ⏱️  Süre:     15 saniye

✨ Baby AI hazır! Geliştirmeye başlayabilirsiniz.
```

### `status.sh` - Durum Kontrol Scripti

Bu script:
- 🔍 Port durumlarını kontrol eder
- 🔍 Health endpoint'leri test eder
- 🔍 Process ID'leri gösterir
- 🔍 Sistem kaynaklarını raporlar
- 🔍 Log bilgilerini gösterir

**Çıktı:**
```
📊 Baby AI Sistem Durumu
========================
⏰ 2025-06-22 10:37:14

🔧 BACKEND DURUMU
==================
   Port 8000:     ✅
   Health Check:  ✅
   Process ID:    1234
   Endpoint:      http://localhost:8000
   API Docs:      http://localhost:8000/docs

🎨 FRONTEND DURUMU
==================
   Port 5173:     ✅
   Process ID:    5678
   Endpoint:      http://localhost:5173

🎯 GENEL DURUM
==============
🎉 Tüm servisler çalışıyor!
   Baby AI tam olarak hazır
```

### `stop.sh` - Durdurma Scripti

Bu script:
- 🛑 PID dosyalarından servisleri güvenli durdurur
- 🛑 Port tabanlı yedek temizlik yapar
- 🛑 Durdurma raporunu gösterir

### `restart.sh` - Yeniden Başlatma Scripti

Bu script:
- 🔄 `stop.sh` çalıştırır
- 🔄 2 saniye bekler
- 🔄 `start.sh` çalıştırır

## 🐳 Docker Scriptleri

### `start-docker.sh` - Docker Başlatma

Bu script:
- 🐳 Docker ve Docker Compose varlığını kontrol eder
- 🐳 `.env` dosyasını kontrol eder ve gerekirse oluşturur
- 🐳 `docker-compose.dev.yml` ile servisleri başlatır
- 🐳 Redis, Backend, Frontend sağlık kontrollerini yapar
- 🐳 Redis Insight monitoring'i başlatır

**Servisler:**
- **Redis**: `localhost:6379`
- **Backend**: `localhost:8000`
- **Frontend**: `localhost:5173`
- **Redis Insight**: `localhost:8001`

### `stop-docker.sh` - Docker Durdurma

Bu script:
- 🐳 Docker containerları durdurur
- 🐳 İsteğe bağlı volume temizliği
- 🐳 İsteğe bağlı image temizliği

## 🔧 Troubleshooting

### Port Zaten Kullanılıyor Hatası

```bash
# Manuel port temizleme
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Ya da restart script kullan
./restart.sh
```

### Backend Başlatılamıyor

```bash
# Backend loglarını kontrol et
tail -f logs/backend.log

# Manual başlatma testi
cd backend
source venv/bin/activate
python app/main.py
```

### Frontend Başlatılamıyor

```bash
# Frontend loglarını kontrol et
tail -f logs/frontend.log

# Manual başlatma testi
cd frontend
npm run dev
```

### Docker Sorunları

```bash
# Container durumunu kontrol et
docker-compose -f docker-compose.dev.yml ps

# Logları izle
docker-compose -f docker-compose.dev.yml logs -f

# Temiz başlat
./stop-docker.sh
docker system prune -f
./start-docker.sh
```

## 📁 Log Dosyaları

Tüm loglar `logs/` klasöründe saklanır:

- `logs/backend.log` - Backend logları
- `logs/frontend.log` - Frontend logları

## ⚡ Performans İpuçları

1. **İlk çalıştırma** daha uzun sürer (dependencies yükleme)
2. **Sonraki çalıştırmalar** çok daha hızlıdır
3. **Docker** biraz daha uzun sürer ama daha izole çalışır
4. **Yerel development** daha hızlı ama sistem ayarlarına bağlıdır

## 🔗 Faydalı Linkler

### Development
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Admin Panel**: http://localhost:8000/admin

### Docker (Ek)
- **Redis Insight**: http://localhost:8001

## 🎯 En İyi Pratikler

1. **Her geliştirme öncesi** `./status.sh` çalıştırın
2. **Hata durumunda** önce `./restart.sh` deneyin
3. **Log dosyalarını** düzenli kontrol edin
4. **Docker kullanırken** disk alanını izleyin
5. **Production'da** Docker scriptlerini kullanın

## 🆘 Hızlı Yardım

```bash
# Sistem durumu
./status.sh

# Hızlı yeniden başlatma
./restart.sh

# Tamamen temiz başlatma
./stop.sh
sleep 5
./start.sh

# Docker ile temiz başlatma
./stop-docker.sh
./start-docker.sh
```

---

**💡 Not**: Bu scriptler macOS ve Linux için optimize edilmiştir. Windows kullanıcılar WSL veya Git Bash kullanabilir.

**🔒 Güvenlik**: Production environment'da `.env` dosyasındaki SECRET_KEY'i mutlaka değiştirin. 