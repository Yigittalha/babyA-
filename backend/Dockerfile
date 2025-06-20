# Backend Dockerfile
FROM python:3.13-slim

# Çalışma dizinini ayarla
WORKDIR /app

# Sistem bağımlılıklarını yükle
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python bağımlılıklarını kopyala ve yükle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodlarını kopyala
COPY app/ ./app/

# Port'u aç
EXPOSE 8000

# Environment değişkenleri
ENV PYTHONPATH=/app
ENV ENVIRONMENT=production

# Uygulamayı çalıştır
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 