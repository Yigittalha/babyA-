#!/bin/bash

# 🔄 Baby AI - Yeniden Başlatma Scripti
# Tüm servisleri durdurur ve yeniden başlatır

echo "🔄 Baby AI Yeniden Başlatılıyor..."
echo "=================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Başlangıç zamanı
START_TIME=$(date +%s)

# Önce servisleri durdur
echo -e "${BLUE}🛑 Servisleri durduruyor...${NC}"
./stop.sh

# Kısa bekleme
echo -e "\n${YELLOW}⏱️  2 saniye bekleniyor...${NC}"
sleep 2

# Sonra servisleri başlat
echo -e "\n${BLUE}🚀 Servisleri başlatıyor...${NC}"
./start.sh

# Toplam süre hesapla
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo -e "\n${GREEN}🎉 YENİDEN BAŞLATMA TAMAMLANDI!${NC}"
echo "   ⏱️  Toplam Süre: ${TOTAL_TIME} saniye"
echo -e "\n${GREEN}✨ Baby AI yeniden hazır!${NC}" 