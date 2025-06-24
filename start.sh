#!/bin/bash

# 🚀 Baby AI - Otomatik Başlatma Scripti
# Bu script tüm servisleri otomatik olarak başlatır

echo "🚀 Baby AI Sistemi Başlatılıyor..."
echo "=================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Başlangıç zamanı
START_TIME=$(date +%s)

# Log klasörü oluştur
mkdir -p logs

# Eski servisleri temizle
echo "🧹 Eski servisleri temizleniyor..."
for port in 8000 5173 3000 3001 4000 4001 5000 5001 9000 9001; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "   ⚠️  Port $port temizleniyor..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done

echo -e "${GREEN}✅ Port temizleme tamamlandı${NC}"

# Backend başlatma
echo -e "\n${BLUE}🔧 Backend başlatılıyor...${NC}"
cd backend

# Virtual environment kontrol
if [ ! -d "venv" ]; then
    echo "   📦 Virtual environment oluşturuluyor..."
    python3 -m venv venv
fi

# Dependencies kurulumu
echo "   📦 Dependencies kontrol ediliyor..."
source venv/bin/activate
pip install -r requirements.txt --quiet

# Backend başlat
echo "   🚀 FastAPI server başlatılıyor..."
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

# Backend kontrolü
sleep 3
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Backend başarıyla başlatıldı (PID: $BACKEND_PID)${NC}"
else
    echo -e "   ${RED}❌ Backend başlatılamadı${NC}"
    echo "   📋 Backend log:"
    tail -10 ../logs/backend.log
    exit 1
fi

# Frontend başlatma
echo -e "\n${BLUE}🎨 Frontend başlatılıyor...${NC}"
cd ../frontend

# Node modules kontrol
if [ ! -d "node_modules" ]; then
    echo "   📦 Node modules yükleniyor..."
    npm install --silent
fi

# Frontend başlat
echo "   🚀 Vite dev server başlatılıyor..."
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Frontend kontrolü
sleep 3
if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Frontend başarıyla başlatıldı (PID: $FRONTEND_PID)${NC}"
else
    echo -e "   ${RED}❌ Frontend başlatılamadı${NC}"
    echo "   📋 Frontend log:"
    tail -10 ../logs/frontend.log
fi

# Toplam süre hesapla
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

# Başarı raporu
echo -e "\n${GREEN}🎉 BAŞLATMA TAMAMLANDI!${NC}"
echo "=========================="
echo -e "${BLUE}📊 Sistem Bilgileri:${NC}"
echo "   🔗 Frontend: http://localhost:5173"
echo "   🔗 Backend:  http://localhost:8000"
echo "   🔗 API Docs: http://localhost:8000/docs"
echo "   📁 Loglar:   $(pwd)/../logs/"
echo "   ⏱️  Süre:     ${TOTAL_TIME} saniye"

echo -e "\n${YELLOW}📋 Yararlı Komutlar:${NC}"
echo "   ./stop.sh    - Servisleri durdur"
echo "   ./status.sh  - Durum kontrol et"
echo "   ./restart.sh - Yeniden başlat"

echo -e "\n${GREEN}✨ Baby AI hazır! Geliştirmeye başlayabilirsiniz.${NC}"

# PID'leri kaydet
cd ..
echo $BACKEND_PID > .backend_pid
echo $FRONTEND_PID > .frontend_pid 