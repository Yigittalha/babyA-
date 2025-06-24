#!/bin/bash

# 🐳 Baby AI - Docker Başlatma Scripti
# Docker Compose ile tüm servisleri containerda çalıştırır

echo "🐳 Baby AI Docker Servisleri Başlatılıyor..."
echo "============================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Başlangıç zamanı
START_TIME=$(date +%s)

# Docker kontrol
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker bulunamadı. Lütfen Docker'ı yükleyin.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose bulunamadı. Lütfen Docker Compose'u yükleyin.${NC}"
    exit 1
fi

# .env dosyası kontrol
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env dosyası bulunamadı. env.example'dan kopyalanıyor...${NC}"
    cp env.example .env
fi

# Eski containerları temizle
echo -e "${BLUE}🧹 Eski containerlar temizleniyor...${NC}"
docker-compose -f docker-compose.dev.yml down

# Log klasörü oluştur
mkdir -p logs

# Servisleri başlat
echo -e "\n${BLUE}🚀 Docker servisleri başlatılıyor...${NC}"
docker-compose -f docker-compose.dev.yml up -d --build

# Servislerin başlaması için bekle
echo -e "\n${YELLOW}⏱️  Servisler başlatılıyor (30 saniye)...${NC}"
sleep 30

# Sağlık kontrolleri
echo -e "\n${BLUE}🔍 Sağlık kontrolleri yapılıyor...${NC}"

# Redis kontrol
if docker exec babyai_redis_dev redis-cli ping >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Redis çalışıyor${NC}"
else
    echo -e "   ${RED}❌ Redis çalışmıyor${NC}"
fi

# Backend kontrol
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Backend çalışıyor${NC}"
else
    echo -e "   ${RED}❌ Backend çalışmıyor${NC}"
    echo -e "   ${YELLOW}Backend logları:${NC}"
    docker logs babyai_backend_dev --tail 10
fi

# Frontend kontrol
if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Frontend çalışıyor${NC}"
else
    echo -e "   ${RED}❌ Frontend çalışmıyor${NC}"
    echo -e "   ${YELLOW}Frontend logları:${NC}"
    docker logs babyai_frontend_dev --tail 10
fi

# Toplam süre hesapla
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

# Başarı raporu
echo -e "\n${GREEN}🎉 DOCKER BAŞLATMA TAMAMLANDI!${NC}"
echo "=============================="
echo -e "${BLUE}📊 Servis Bilgileri:${NC}"
echo "   🔗 Frontend:     http://localhost:5173"
echo "   🔗 Backend:      http://localhost:8000"
echo "   🔗 API Docs:     http://localhost:8000/docs"
echo "   🔗 Redis Insight: http://localhost:8001"
echo "   ⏱️  Süre:        ${TOTAL_TIME} saniye"

echo -e "\n${YELLOW}📋 Docker Komutları:${NC}"
echo "   ./stop-docker.sh           - Servisleri durdur"
echo "   docker-compose -f docker-compose.dev.yml logs -f - Logları izle"
echo "   docker-compose -f docker-compose.dev.yml ps     - Container durumu"

echo -e "\n${GREEN}✨ Baby AI Docker'da hazır! Geliştirmeye başlayabilirsiniz.${NC}" 