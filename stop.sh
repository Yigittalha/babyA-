#!/bin/bash

# 🛑 Baby AI - Durdurma Scripti
# Tüm servisleri güvenli şekilde durdurur

echo "🛑 Baby AI Servisleri Durduruluyor..."
echo "====================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

STOPPED_COUNT=0

# PID dosyalarından servisleri durdur
if [ -f ".backend_pid" ]; then
    BACKEND_PID=$(cat .backend_pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID
        echo -e "${GREEN}✅ Backend durduruldu (PID: $BACKEND_PID)${NC}"
        STOPPED_COUNT=$((STOPPED_COUNT + 1))
    fi
    rm -f .backend_pid
fi

if [ -f ".frontend_pid" ]; then
    FRONTEND_PID=$(cat .frontend_pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID
        echo -e "${GREEN}✅ Frontend durduruldu (PID: $FRONTEND_PID)${NC}"
        STOPPED_COUNT=$((STOPPED_COUNT + 1))
    fi
    rm -f .frontend_pid
fi

# Port tabanlı temizlik (yedek)
echo -e "\n${BLUE}🧹 Port temizliği yapılıyor...${NC}"
for port in 8000 5173; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "   ⚠️  Port $port'taki işlem durduruluyor..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        STOPPED_COUNT=$((STOPPED_COUNT + 1))
    fi
done

# Sonuç raporu
if [ $STOPPED_COUNT -gt 0 ]; then
    echo -e "\n${GREEN}🎉 DURDURMA TAMAMLANDI!${NC}"
    echo "   📊 $STOPPED_COUNT servis durduruldu"
else
    echo -e "\n${YELLOW}ℹ️  Çalışan servis bulunamadı${NC}"
fi

echo -e "\n${BLUE}📋 Portlar temizlendi:${NC}"
echo "   🔗 8000 - Backend"
echo "   🔗 5173 - Frontend"

echo -e "\n${GREEN}✨ Sistem temizlendi! Yeniden başlatmak için ./start.sh çalıştırın.${NC}" 