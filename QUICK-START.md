# 🚀 Quick Start Guide

## ⚡ 5-Minute Setup

### 1. **Clone & Setup**
```bash
git clone https://github.com/your-username/baby-name-generator.git
cd baby-name-generator
cp env.example .env
```

### 2. **Get OpenRouter API Key** (Free)
- Go to [OpenRouter.ai](https://openrouter.ai)
- Sign up for free account
- Get your API key from dashboard
- Edit `.env` file and add your key:
```env
OPENAI_API_KEY=your-openrouter-api-key-here
```

### 3. **Run with Docker** (Recommended)
```bash
docker-compose up -d
```

**That's it!** 🎉

- **App**: http://localhost:5174
- **Admin**: http://localhost:5174/admin (admin@babynamer.com / admin123)
- **API**: http://localhost:8000

## 🛠️ Development Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuration

### Required Environment Variables
```env
# OpenRouter API (Required)
OPENAI_API_KEY=your-openrouter-api-key-here

# Security (Required)
SECRET_KEY=your-super-secret-jwt-key-minimum-32-characters

# Optional
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
ENVIRONMENT=development
```

## 📱 Features Overview

### 🎯 **Main App** (`/`)
- Generate baby names with AI
- Multiple languages & themes
- Favorites system
- User authentication

### 👨‍💼 **Admin Panel** (`/admin`)
- User management
- Statistics dashboard
- System monitoring
- Default login: `admin@babynamer.com` / `admin123`

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild
docker-compose up -d --build
```

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Kill processes on ports
sudo lsof -ti:8000 | xargs kill -9  # Backend
sudo lsof -ti:5174 | xargs kill -9  # Frontend
```

### Database Issues
```bash
# Reset database
rm backend/baby_names.db
# Restart backend
```

### Frontend Build Issues
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 🔗 Useful Links

- **OpenRouter**: https://openrouter.ai (Free AI API)
- **FastAPI Docs**: http://localhost:8000/docs (when running)
- **React Router**: https://reactrouter.com
- **Tailwind CSS**: https://tailwindcss.com

## 📞 Need Help?

1. Check logs: `docker-compose logs -f`
2. Restart: `docker-compose restart`
3. Open issue on GitHub
4. Check `.env` configuration

---

**🎉 Happy Baby Naming!** 