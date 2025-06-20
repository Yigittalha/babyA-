# Frontend Dockerfile
FROM node:18-alpine as build

# Çalışma dizinini ayarla
WORKDIR /app

# Package.json ve package-lock.json kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci --only=production

# Kaynak kodları kopyala
COPY . .

# Production build oluştur
RUN npm run build

# Production stage
FROM nginx:alpine

# Nginx konfigürasyonu kopyala
COPY nginx.conf /etc/nginx/nginx.conf

# Build dosyalarını kopyala
COPY --from=build /app/dist /usr/share/nginx/html

# Port'u aç
EXPOSE 80

# Nginx'i başlat
CMD ["nginx", "-g", "daemon off;"] 