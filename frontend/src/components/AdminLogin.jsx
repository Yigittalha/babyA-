import React, { useState } from 'react';
import { Shield, Lock, User } from 'lucide-react';
import { apiService, tokenManager } from '../services/api';

const AdminLogin = ({ onSuccess }) => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiService.login(credentials);
      
      if (response.access_token) {
        // Use the TokenManager to properly store tokens
        tokenManager.setTokens(response.access_token, response.refresh_token || null);
        localStorage.setItem('token', response.access_token); // Keep for compatibility with apiService
        
        // Kullanıcı bilgilerini al
        const profile = await apiService.getProfile();
        
        // Admin kontrolü
        if (!profile.is_admin) {
          setError('Bu alan sadece admin kullanıcılar için. Normal kullanıcı girişi için ana sayfayı kullanın.');
          tokenManager.clearTokens();
          localStorage.removeItem('token');
          return;
        }
        
        // Admin giriş başarılı
        onSuccess({
          ...profile,
          access_token: response.access_token
        });
      }
    } catch (err) {
      console.error('Admin login error:', err);
      if (err.response?.status === 401) {
        setError('Geçersiz e-posta veya şifre');
      } else {
        setError(err.userMessage || 'Giriş yapılırken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-gradient-to-r from-red-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">Admin Paneli</h2>
          <p className="mt-2 text-gray-300">
            Yönetici girişi yapın
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                E-posta Adresi
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={credentials.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="admin@babynamer.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Şifre
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={credentials.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Giriş yapılıyor...
                </div>
              ) : (
                'Admin Girişi'
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-sm font-medium mb-2">Demo Bilgileri:</p>
            <p className="text-blue-200 text-xs">E-posta: admin@babynamer.com</p>
            <p className="text-blue-200 text-xs">Şifre: admin123</p>
          </div>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-gray-300 hover:text-white text-sm transition-colors duration-200"
            >
              ← Ana sayfaya dön
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 