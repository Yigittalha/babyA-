#!/bin/bash

# 🐳 Baby AI - Docker Durdurma Scripti
# Docker Compose containerlarını güvenli şekilde durdurur

echo "🐳 Baby AI Docker Servisleri Durduruluyor..."
echo "============================================"

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Docker kontrol
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker bulunamadı.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose bulunamadı.${NC}"
    exit 1
fi

# Containerları durdur
echo -e "${BLUE}🛑 Docker containerları durduruluyor...${NC}"
docker-compose -f docker-compose.dev.yml down

# Volume temizliği (isteğe bağlı)
read -p "🗑️  Docker volume'leri de silinsin mi? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧹 Docker volume'leri temizleniyor...${NC}"
    docker-compose -f docker-compose.dev.yml down -v
    docker volume prune -f
fi

# Kullanılmayan image'leri temizle
read -p "🗑️  Kullanılmayan Docker image'leri silinsin mi? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧹 Kullanılmayan image'ler temizleniyor...${NC}"
    docker image prune -f
fi

echo -e "\n${GREEN}🎉 DOCKER DURDURMA TAMAMLANDI!${NC}"
echo "   📊 Tüm containerlar durduruldu"

echo -e "\n${BLUE}📋 Docker Durumu:${NC}"
docker-compose -f docker-compose.dev.yml ps

echo -e "\n${GREEN}✨ Docker servisleri temizlendi! Yeniden başlatmak için ./start-docker.sh çalıştırın.${NC}" 