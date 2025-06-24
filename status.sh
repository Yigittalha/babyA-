#!/bin/bash

# 📊 Baby AI - Durum Kontrol Scripti
# Tüm servislerin durumunu kontrol eder

echo "📊 Baby AI Sistem Durumu"
echo "========================"
echo "⏰ $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Servis durumları
BACKEND_STATUS="❌"
FRONTEND_STATUS="❌"
BACKEND_HEALTH="❌"

# Backend Port Kontrolü
if lsof -ti:8000 >/dev/null 2>&1; then
    BACKEND_STATUS="✅"
    # Health check
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        BACKEND_HEALTH="✅"
    fi
fi

# Frontend Port Kontrolü
if lsof -ti:5173 >/dev/null 2>&1; then
    FRONTEND_STATUS="✅"
fi

# Durum Raporu
echo -e "${BLUE}🔧 BACKEND DURUMU${NC}"
echo "=================="
echo -e "   Port 8000:     $BACKEND_STATUS"
echo -e "   Health Check:  $BACKEND_HEALTH"
if [ "$BACKEND_STATUS" = "✅" ]; then
    BACKEND_PID=$(lsof -ti:8000)
    echo -e "   Process ID:    $BACKEND_PID"
    echo -e "   Endpoint:      ${GREEN}http://localhost:8000${NC}"
    echo -e "   API Docs:      ${GREEN}http://localhost:8000/docs${NC}"
else
    echo -e "   ${RED}Backend çalışmıyor${NC}"
fi

echo -e "\n${BLUE}🎨 FRONTEND DURUMU${NC}"
echo "=================="
echo -e "   Port 5173:     $FRONTEND_STATUS"
if [ "$FRONTEND_STATUS" = "✅" ]; then
    FRONTEND_PID=$(lsof -ti:5173)
    echo -e "   Process ID:    $FRONTEND_PID"
    echo -e "   Endpoint:      ${GREEN}http://localhost:5173${NC}"
else
    echo -e "   ${RED}Frontend çalışmıyor${NC}"
fi

# Sistem Kaynakları
echo -e "\n${BLUE}💾 SİSTEM KAYNAKLARI${NC}"
echo "===================="

# RAM kullanımı
if command -v free >/dev/null 2>&1; then
    RAM_USAGE=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')
else
    # macOS için
    RAM_TOTAL=$(sysctl hw.memsize | awk '{print $2/1024/1024/1024}')
    RAM_USAGE="$(top -l 1 -s 0 | grep PhysMem | awk '{print $2}' | cut -d 'M' -f1)"
fi

# CPU kullanımı
if command -v top >/dev/null 2>&1; then
    CPU_USAGE=$(top -l 1 -s 0 | grep "CPU usage" | awk '{print $3}' | cut -d '%' -f1)
fi

echo "   💾 Disk Kullanımı: $(df -h . | awk 'NR==2{print $5}')"
echo "   ⚡ CPU Yükü:      ${CPU_USAGE:-"N/A"}%"

# Log Bilgileri
echo -e "\n${BLUE}📋 LOG BİLGİLERİ${NC}"
echo "================"
if [ -d "logs" ]; then
    echo "   📁 Log Klasörü:   $(pwd)/logs/"
    if [ -f "logs/backend.log" ]; then
        BACKEND_LOG_SIZE=$(ls -lah logs/backend.log | awk '{print $5}')
        echo "   📄 Backend Log:   $BACKEND_LOG_SIZE"
    fi
    if [ -f "logs/frontend.log" ]; then
        FRONTEND_LOG_SIZE=$(ls -lah logs/frontend.log | awk '{print $5}')
        echo "   📄 Frontend Log:  $FRONTEND_LOG_SIZE"
    fi
else
    echo -e "   ${YELLOW}Log klasörü bulunamadı${NC}"
fi

# Genel Durum
echo -e "\n${BLUE}🎯 GENEL DURUM${NC}"
echo "=============="

if [ "$BACKEND_STATUS" = "✅" ] && [ "$FRONTEND_STATUS" = "✅" ] && [ "$BACKEND_HEALTH" = "✅" ]; then
    echo -e "${GREEN}🎉 Tüm servisler çalışıyor!${NC}"
    echo -e "   ${GREEN}Baby AI tam olarak hazır${NC}"
elif [ "$BACKEND_STATUS" = "✅" ] || [ "$FRONTEND_STATUS" = "✅" ]; then
    echo -e "${YELLOW}⚠️  Bazı servisler çalışıyor${NC}"
    echo -e "   ${YELLOW}Eksik servisleri başlatın${NC}"
else
    echo -e "${RED}❌ Hiçbir servis çalışmıyor${NC}"
    echo -e "   ${RED}./start.sh ile başlatın${NC}"
fi

# Yararlı Komutlar
echo -e "\n${YELLOW}📋 YARALILI KOMUTLAR${NC}"
echo "==================="
echo "   ./start.sh   - Servisleri başlat"
echo "   ./stop.sh    - Servisleri durdur"
echo "   ./restart.sh - Yeniden başlat"
echo "   ./status.sh  - Bu raporu göster"

# Son backend logları (hata varsa)
if [ -f "logs/backend.log" ] && [ "$BACKEND_HEALTH" = "❌" ]; then
    echo -e "\n${RED}🔍 SON BACKEND HATALARI${NC}"
    echo "====================="
    tail -5 logs/backend.log
fi 