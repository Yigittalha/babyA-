#!/bin/bash

# Baby Name Generator - Test Setup Script
echo "🍼 Baby Name Generator - Test Setup Script"
echo "=========================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonksiyonlar
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Gereksinimleri kontrol et
check_requirements() {
    echo "🔍 Gereksinimler kontrol ediliyor..."
    
    # Python kontrolü
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION bulundu"
    else
        print_error "Python3 bulunamadı. Lütfen Python 3.13+ yükleyin."
        exit 1
    fi
    
    # Node.js kontrolü
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION bulundu"
    else
        print_error "Node.js bulunamadı. Lütfen Node.js 18+ yükleyin."
        exit 1
    fi
    
    # Docker kontrolü
    if command -v docker &> /dev/null; then
        print_success "Docker bulundu"
    else
        print_warning "Docker bulunamadı. Manuel kurulum gerekebilir."
    fi
    
    # Docker Compose kontrolü
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose bulundu"
    else
        print_warning "Docker Compose bulunamadı. Manuel kurulum gerekebilir."
    fi
}

# Environment dosyasını kontrol et
check_env_file() {
    echo "🔍 Environment dosyası kontrol ediliyor..."
    
    if [ -f ".env" ]; then
        print_success ".env dosyası bulundu"
        
        # OpenAI API key kontrolü
        if grep -q "OPENAI_API_KEY=sk-" .env; then
            print_success "OpenAI API key ayarlanmış"
        else
            print_warning "OpenAI API key ayarlanmamış veya geçersiz format"
            print_info "Lütfen .env dosyasında OPENAI_API_KEY=sk-your_key_here şeklinde ayarlayın"
        fi
    else
        print_warning ".env dosyası bulunamadı"
        print_info "env.example dosyasını .env olarak kopyalayın ve OpenAI API key'inizi ekleyin"
        if [ -f "env.example" ]; then
            cp env.example .env
            print_success "env.example .env olarak kopyalandı"
        fi
    fi
}

# Backend testi
test_backend() {
    echo "🔍 Backend test ediliyor..."
    
    cd backend
    
    # Virtual environment kontrolü
    if [ ! -d "venv" ]; then
        print_info "Virtual environment oluşturuluyor..."
        python3 -m venv venv
    fi
    
    # Virtual environment'ı aktifleştir
    source venv/bin/activate
    
    # Bağımlılıkları yükle
    print_info "Python bağımlılıkları yükleniyor..."
    pip install -r requirements.txt
    
    # Test çalıştır
    print_info "Backend testleri çalıştırılıyor..."
    if python -m pytest tests/ -v; then
        print_success "Backend testleri başarılı"
    else
        print_error "Backend testleri başarısız"
    fi
    
    cd ..
}

# Frontend testi
test_frontend() {
    echo "🔍 Frontend test ediliyor..."
    
    cd frontend
    
    # Node modules kontrolü
    if [ ! -d "node_modules" ]; then
        print_info "Node.js bağımlılıkları yükleniyor..."
        npm install
    fi
    
    # Build testi
    print_info "Frontend build testi..."
    if npm run build; then
        print_success "Frontend build başarılı"
    else
        print_error "Frontend build başarısız"
    fi
    
    cd ..
}

# Docker testi
test_docker() {
    echo "🔍 Docker test ediliyor..."
    
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        print_info "Docker build testi..."
        
        # Backend Docker build
        if docker build -t babysh-backend ./backend; then
            print_success "Backend Docker build başarılı"
        else
            print_error "Backend Docker build başarısız"
        fi
        
        # Frontend Docker build
        if docker build -t babysh-frontend ./frontend; then
            print_success "Frontend Docker build başarılı"
        else
            print_error "Frontend Docker build başarısız"
        fi
        
        # Docker Compose testi
        print_info "Docker Compose testi..."
        if docker-compose config; then
            print_success "Docker Compose konfigürasyonu geçerli"
        else
            print_error "Docker Compose konfigürasyonu hatalı"
        fi
    else
        print_warning "Docker bulunamadı, Docker testleri atlanıyor"
    fi
}

# Ana test fonksiyonu
main() {
    echo "🚀 Baby Name Generator test setup başlatılıyor..."
    echo ""
    
    check_requirements
    echo ""
    
    check_env_file
    echo ""
    
    test_backend
    echo ""
    
    test_frontend
    echo ""
    
    test_docker
    echo ""
    
    echo "🎉 Test setup tamamlandı!"
    echo ""
    echo "📋 Sonraki adımlar:"
    echo "1. .env dosyasında OpenAI API key'inizi ayarlayın"
    echo "2. docker-compose up --build ile uygulamayı başlatın"
    echo "3. http://localhost:5173 adresinden uygulamaya erişin"
    echo ""
    echo "📚 Daha fazla bilgi için README.md dosyasını okuyun"
}

# Scripti çalıştır
main 