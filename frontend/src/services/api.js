import axios from 'axios';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Axios instance oluştur
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 saniye timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - her istekte çalışır
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - her yanıtta çalışır
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    
    // Hata mesajını kullanıcı dostu hale getir
    if (error.response) {
      // Server yanıt verdi ama hata kodu döndü
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          error.userMessage = 'Geçersiz istek. Lütfen bilgilerinizi kontrol edin.';
          break;
        case 401:
          error.userMessage = data?.error || 'Geçersiz e-posta veya şifre';
          // 401 hatasında otomatik reload yapmıyoruz, component'ler handle etsin
          break;
        case 403:
          error.userMessage = 'Bu işlem için yetkiniz yok.';
          break;
        case 404:
          error.userMessage = 'İstenen kaynak bulunamadı.';
          break;
        case 429:
          error.userMessage = 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.';
          break;
        case 500:
          error.userMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
          break;
        default:
          error.userMessage = data?.error || 'Beklenmeyen bir hata oluştu.';
      }
    } else if (error.request) {
      // İstek gönderildi ama yanıt alınamadı
      error.userMessage = 'Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.';
    } else {
      // İstek oluşturulurken hata oluştu
      error.userMessage = 'İstek oluşturulamadı.';
    }
    
    return Promise.reject(error);
  }
);

// API fonksiyonları
export const apiService = {
  // Token alma fonksiyonu
  getToken() {
    return localStorage.getItem('token');
  },

  // Genel GET isteği
  async get(url) {
    const response = await api.get(url);
    return response.data;
  },

  // Genel POST isteği
  async post(url, data = {}) {
    const response = await api.post(url, data);
    return response.data;
  },

  // Genel PUT isteği
  async put(url, data = {}) {
    const response = await api.put(url, data);
    return response.data;
  },

  // Genel DELETE isteği  
  async delete(url) {
    const response = await api.delete(url);
    return response.data;
  },

  // Sağlık kontrolü
  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },

  // Mevcut seçenekleri al
  async getOptions() {
    const response = await api.get('/options');
    return response.data;
  },

  // İsim üretimi
  async generateNames(requestData) {
    const response = await api.post('/generate_names', requestData);
    return response.data;
  },

  // Test endpoint'i (sadece development)
  async testEndpoint() {
    const response = await api.get('/test');
    return response.data;
  },

  // Kullanıcı kaydı
  async register(userData) {
    const response = await api.post('/register', userData);
    return response.data;
  },

  // Kullanıcı girişi
  async login(credentials) {
    const response = await api.post('/login', credentials);
    return response.data;
  },

  // Kullanıcı profili
  async getProfile() {
    const response = await api.get('/profile');
    return response.data;
  },

  // Favori isim ekle
  async addFavorite(favoriteData) {
    const response = await api.post('/favorites', favoriteData);
    return response.data;
  },

  // Favori isimleri getir
  async getFavorites(page = 1, limit = 20) {
    const response = await api.get(`/favorites?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Favori ismi sil
  async deleteFavorite(favoriteId) {
    const response = await api.delete(`/favorites/${favoriteId}`);
    return response.data;
  },

  // Favori ismi güncelle
  async updateFavorite(favoriteId, favoriteData) {
    const response = await api.put(`/favorites/${favoriteId}`, favoriteData);
    return response.data;
  },

  // İsim analizi
  async analyzeName(name, language = 'turkish') {
    console.log('🚀 API: analyzeName called');
    console.log('📝 Request data:', { name, language });
    console.log('📊 Name type:', typeof name);
    console.log('📊 Name value:', JSON.stringify(name));
    
    const response = await api.post('/analyze_name', { name, language });
    console.log('✅ API: analyzeName response:', response.data);
    return response.data;
  },
};

// Hata sınıfları
export class APIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Yardımcı fonksiyonlar
export const formatError = (error) => {
  if (error.userMessage) {
    return error.userMessage;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  return 'Beklenmeyen bir hata oluştu.';
};

export default api;

export const getTrends = async () => {
  try {
    const response = await api.get('/api/trends');
    return response.data;
  } catch (error) {
    console.error('Trends API error:', error);
    throw error;
  }
};

export const getGlobalTrends = async () => {
  try {
    const response = await api.get('/api/trends/global');
    return response.data;
  } catch (error) {
    console.error('Global trends API error:', error);
    throw error;
  }
};

export const getPremiumNames = async (requestData) => {
  try {
    const response = await api.post('/api/names/premium', requestData);
    return response.data;
  } catch (error) {
    console.error('Premium names API error:', error);
    throw error;
  }
};

export const getSubscriptionPlans = async () => {
  try {
    const response = await api.get('/api/subscription/plans');
    return response.data;
  } catch (error) {
    console.error('Subscription plans API error:', error);
    throw error;
  }
};

export const getSubscriptionStatus = async () => {
  try {
    const response = await api.get('/api/subscription/status');
    return response.data;
  } catch (error) {
    console.error('Subscription status API error:', error);
    throw error;
  }
};

export const upgradeSubscription = async (planType, paymentMethod = 'credit_card') => {
  try {
    const response = await api.post('/api/subscription/upgrade', {
      plan_type: planType,
      payment_method: paymentMethod
    });
    return response.data;
  } catch (error) {
    console.error('Subscription upgrade API error:', error);
    throw error;
  }
};

export const getSubscriptionHistory = async () => {
  try {
    const response = await api.get('/api/subscription/history');
    return response.data;
  } catch (error) {
    console.error('Subscription history API error:', error);
    throw error;
  }
};

export const getNamesByTheme = async (theme, gender, count) => {
  try {
    const response = await api.post('/names/theme', {
      theme,
      gender,
      count
    });
    return response.data;
  } catch (error) {
    console.error('Theme names error:', error);
    return { success: false, error: 'Tema bazlı isimler alınamadı' };
  }
}; 