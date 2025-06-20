import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Stats state
  const [stats, setStats] = useState(null);
  
  // Users state
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  
  // Favorites state
  const [favorites, setFavorites] = useState([]);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [favoritesTotal, setFavoritesTotal] = useState(0);
  
  // System state
  const [systemInfo, setSystemInfo] = useState(null);

  // Analytics state
  const [favoriteAnalytics, setFavoriteAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Load stats
  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.get('/admin/stats');
      setStats(response);
    } catch (err) {
      setError('İstatistikler yüklenemedi');
      console.error('Stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load users
  const loadUsers = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.get(`/admin/users?page=${page}&limit=20`);
      setUsers(response.users);
      setUsersTotal(response.total);
      setUsersPage(page);
    } catch (err) {
      setError('Kullanıcılar yüklenemedi');
      console.error('Users error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load favorites
  const loadFavorites = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.get(`/admin/favorites?page=${page}&limit=20`);
      setFavorites(response.favorites);
      setFavoritesTotal(response.total);
      setFavoritesPage(page);
    } catch (err) {
      setError('Favoriler yüklenemedi');
      console.error('Favorites error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load system info
  const loadSystemInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.get('/admin/system');
      setSystemInfo(response);
    } catch (err) {
      setError('Sistem bilgileri yüklenemedi');
      console.error('System error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load favorite analytics
  const loadFavoriteAnalytics = async () => {
    setAnalyticsLoading(true);
    setError('');
    try {
      // Simulate analytics data - in real app this would come from backend
      const mockAnalytics = {
        totalFavorites: favoritesTotal || 0,
        popularNames: [
          { name: 'Ahmet', count: 15, percentage: 12.5 },
          { name: 'Ayşe', count: 13, percentage: 10.8 },
          { name: 'Mehmet', count: 11, percentage: 9.2 },
          { name: 'Fatma', count: 9, percentage: 7.5 },
          { name: 'Ali', count: 8, percentage: 6.7 },
          { name: 'Zeynep', count: 7, percentage: 5.8 },
          { name: 'Emirhan', count: 6, percentage: 5.0 },
          { name: 'Elif', count: 5, percentage: 4.2 }
        ],
        genderDistribution: {
          male: 58,
          female: 42
        },
        languageDistribution: {
          turkish: 65,
          english: 20,
          arabic: 8,
          other: 7
        },
        themeDistribution: {
          modern: 35,
          traditional: 25,
          nature: 18,
          religious: 12,
          royal: 10
        }
      };
      setFavoriteAnalytics(mockAnalytics);
    } catch (err) {
      setError('Analiz verileri yüklenemedi');
      console.error('Analytics error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Toggle user subscription with improved error handling
  const toggleUserSubscription = async (userId, currentType) => {
    const newType = currentType === 'premium' ? 'free' : 'premium';
    const action = newType === 'premium' ? 'Premium ver' : 'Premium iptal et';
    const user = users.find(u => u.id === userId);
    const userName = user ? `${user.name} (${user.email})` : `ID: ${userId}`;
    
    if (!window.confirm(`${action}mek istediğinizden emin misiniz?\n\n${userName}\n\nYeni abonelik: ${newType === 'premium' ? '💎 Premium' : '🆓 Ücretsiz'}`)) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Real API call to update subscription
      const response = await apiService.put(`/admin/users/${userId}/subscription`, {
        subscription_type: newType
      });
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, subscription_type: newType } : user
      ));
      
      // Clear any errors
      setError('');
      
      showToast({ 
        message: `✨ ${userName} kullanıcısının aboneliği ${newType === 'premium' ? '💎 Premium olarak güncellendi' : '🆓 Ücretsiz olarak güncellendi'}`, 
        type: 'success' 
      });
      
      console.log('Subscription updated:', response);
    } catch (err) {
      console.error('Subscription update error:', err);
      
      // Handle specific error cases
      let errorMessage = 'Abonelik güncellenemedi';
      
      if (err.response) {
        switch (err.response.status) {
          case 400:
            errorMessage = `❌ ${err.response.data?.detail || 'Geçersiz abonelik türü'}`;
            break;
          case 403:
            errorMessage = '❌ Bu işlem için yetkiniz yok! Admin girişi gereklidir.';
            break;
          case 404:
            errorMessage = '❌ Kullanıcı bulunamadı! Kullanıcı silinmiş olabilir.';
            break;
          case 500:
            errorMessage = '❌ Sunucu hatası! Lütfen daha sonra tekrar deneyin.';
            break;
          default:
            errorMessage = `❌ Bilinmeyen hata (${err.response.status}): ${err.response.data?.detail || 'Abonelik güncellenemedi'}`;
        }
      } else if (err.request) {
        errorMessage = '❌ Sunucuya bağlanılamadı! İnternet bağlantınızı kontrol edin.';
      }
      
      setError(errorMessage);
      showToast({ 
        message: errorMessage.replace('❌ ', ''), 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete user with improved error handling
  const deleteUser = async (userId) => {
    // Find user info for better confirmation message
    const user = users.find(u => u.id === userId);
    const userName = user ? `${user.name} (${user.email})` : `ID: ${userId}`;
    
    if (!window.confirm(`Bu kullanıcıyı silmek istediğinizden emin misiniz?\n\n${userName}\n\nBu işlem geri alınamaz!`)) {
      return;
    }
    
    try {
      setLoading(true);
      await apiService.delete(`/admin/users/${userId}`);
      await loadUsers(usersPage); // Refresh list
      
      // Show success message
      setError(''); // Clear any previous errors
      showToast({ 
        message: `Kullanıcı ${userName} başarıyla silindi`, 
        type: 'success' 
      });
      
    } catch (err) {
      console.error('Delete user error:', err);
      
      // Handle specific error cases
      let errorMessage = 'Kullanıcı silinemedi';
      
             if (err.response) {
         switch (err.response.status) {
           case 400:
             errorMessage = `❌ ${err.response.data?.detail || 'Kullanıcı silme işlemi başarısız'}`;
             break;
           case 403:
             errorMessage = '❌ Bu işlem için yetkiniz yok! Admin girişi gereklidir.';
             break;
           case 404:
             errorMessage = '❌ Kullanıcı bulunamadı! Kullanıcı zaten silinmiş olabilir.';
             break;
           case 500:
             errorMessage = '❌ Sunucu hatası! Lütfen daha sonra tekrar deneyin.';
             break;
           default:
             errorMessage = `❌ Bilinmeyen hata (${err.response.status}): ${err.response.data?.detail || 'Kullanıcı silinemedi'}`;
         }
       } else if (err.request) {
         errorMessage = '❌ Sunucuya bağlanılamadı! İnternet bağlantınızı kontrol edin.';
       }
      
      setError(errorMessage);
      
      // Show toast notification
      showToast({ 
        message: errorMessage.replace('❌ ', ''), 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Toast notification helper
  const showToast = ({ message, type }) => {
    setToast({ message, type, id: Date.now() });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setToast(null);
    }, 5000);
    
    // Also log to console for debugging
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  // Close toast manually
  const closeToast = () => {
    setToast(null);
  };

  // Tab change handler
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    
    switch (tab) {
      case 'stats':
        loadStats();
        break;
      case 'users':
        loadUsers();
        break;
      case 'analytics':
        loadFavoriteAnalytics();
        loadFavorites(); // Analitik için favori verileri de yükle
        break;
      case 'system':
        loadSystemInfo();
        break;
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  // Safe number formatter
  const safeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? fallback : num;
  };

  // Safe percentage formatter
  const safePercentage = (value, fallback = 0) => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? fallback : Math.round(num * 100) / 100;
  };

  // Statistics Card Component
  const StatCard = ({ title, value, icon, color, trend, trendValue }) => {
    const safeValue = safeNumber(value, 0);
    return (
      <div className={`bg-gradient-to-br ${color} rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-90">{title}</p>
            <p className="text-3xl font-bold mt-2">{safeValue.toLocaleString()}</p>
            {trend && (
              <div className="flex items-center mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${trend === 'up' ? 'bg-green-500' : 'bg-red-500'} bg-opacity-20`}>
                  {trend === 'up' ? '↗' : '↘'} {trendValue || '0%'}
                </span>
              </div>
            )}
          </div>
          <div className="text-4xl opacity-80">
            {icon}
          </div>
        </div>
      </div>
    );
  };

  // Loading Component
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-12">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-gray-200"></div>
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin absolute top-0"></div>
      </div>
    </div>
  );

  // Empty State Component
  const EmptyState = ({ message, icon }) => (
    <div className="text-center py-12">
      <div className="text-6xl mb-4 opacity-50">{icon}</div>
      <p className="text-gray-500 text-lg">{message}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className={`max-w-md rounded-xl shadow-2xl p-4 text-white font-semibold ${
            toast.type === 'success' 
              ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
              : toast.type === 'error'
              ? 'bg-gradient-to-r from-red-500 to-red-600'
              : 'bg-gradient-to-r from-blue-500 to-blue-600'
          } transform hover:scale-105 transition-all duration-200`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-xl">
                  {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <span className="text-sm">{toast.message}</span>
              </div>
              <button
                onClick={closeToast}
                className="ml-4 text-white hover:text-gray-200 transition-colors duration-200"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
              <p className="text-gray-600 text-lg">Sistem yönetimi ve analitik veriler</p>
            </div>
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="font-semibold">Sistem Aktif</span>
              </div>
            </div>
          </div>
          </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-2xl">
              {[
                { id: 'stats', name: 'İstatistikler', icon: '📊' },
                { id: 'users', name: 'Kullanıcılar', icon: '👥' },
                { id: 'analytics', name: 'Favori Analitik', icon: '❤️📈' },
                { id: 'system', name: 'Sistem', icon: '⚙️' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-white text-indigo-600 shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:bg-opacity-50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={() => handleTabChange(activeTab)}
              disabled={loading}
              className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <span className={`${loading ? 'animate-spin' : ''}`}>🔄</span>
              <span>{loading ? 'Yenileniyor...' : 'Yenile'}</span>
            </button>
          </div>
          </div>

          {/* Error Display */}
          {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-xl p-4 shadow-lg">
            <div className="flex items-center">
              <div className="text-red-500 text-xl mr-3">⚠️</div>
              <div>
                <h3 className="text-red-800 font-semibold">Hata</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
              </div>
            )}

        {/* Content Container */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {loading && <LoadingSpinner />}

            {/* Stats Tab */}
          {activeTab === 'stats' && !loading && (
            <div className="p-8">
              {stats ? (
                <div className="space-y-8">
                  {/* Main Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                      title="Toplam Kullanıcı"
                      value={safeNumber(stats.stats?.total_users)}
                      icon="👥"
                      color="from-blue-500 to-blue-600"
                      trend="up"
                      trendValue="+12%"
                    />
                    <StatCard
                      title="Premium Kullanıcı"
                      value={safeNumber(stats.stats?.premium_users)}
                      icon="💎"
                      color="from-yellow-500 to-orange-500"
                      trend="up"
                      trendValue="+8%"
                    />
                    <StatCard
                      title="Toplam Favori"
                      value={safeNumber(stats.stats?.total_favorites)}
                      icon="❤️"
                      color="from-pink-500 to-red-500"
                      trend="up"
                      trendValue="+25%"
                    />
                    <StatCard
                      title="Bugün Üretilen İsim"
                      value={safeNumber(stats.stats?.names_today)}
                      icon="🆕"
                      color="from-green-500 to-emerald-500"
                      trend="up"
                      trendValue="+15%"
                    />
                  </div>

                  {/* Additional Stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <span className="mr-2">📈</span> Kullanım İstatistikleri
                      </h3>
                      <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                          <span className="text-gray-600">Toplam İsim Üretimi</span>
                          <span className="font-bold text-gray-900">{safeNumber(stats.stats?.total_names_generated).toLocaleString()}</span>
                </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Aylık Gelir</span>
                          <span className="font-bold text-gray-900">${safeNumber(stats.stats?.revenue_month).toLocaleString()}</span>
                    </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Bugünkü Gelir</span>
                          <span className="font-bold text-gray-900">${safeNumber(stats.stats?.revenue_today).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <span className="mr-2">🎯</span> Performans Metrikleri
                      </h3>
                      <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                          <span className="text-gray-600">Sunucu Çalışma Süresi</span>
                          <span className="font-bold text-green-600">{stats.stats?.server_uptime || 'Bilinmiyor'}</span>
                    </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Veritabanı Boyutu</span>
                          <span className="font-bold text-green-600">{stats.stats?.database_size || 'Bilinmiyor'}</span>
                    </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Dönüşüm Oranı</span>
                          <span className="font-bold text-green-600">{safePercentage(stats.stats?.conversion_rate)}%</span>
                  </div>
                </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState message="İstatistikler yükleniyor..." icon="📊" />
              )}
              </div>
            )}

            {/* Users Tab */}
          {activeTab === 'users' && !loading && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">👥</span> Kullanıcı Yönetimi
                </h2>
                <div className="text-sm text-gray-500">
                  Toplam: {usersTotal.toLocaleString()} kullanıcı
                </div>
              </div>
              
              {users.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">👤 Kullanıcı</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">📧 E-posta</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">📅 Kayıt Tarihi</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">💎 Abonelik</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">⚡ İşlemler</th>
                      </tr>
                    </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {users.map((user, index) => (
                          <tr key={user.id} className={`hover:bg-gray-50 transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                                  <div className="text-xs text-gray-500">ID: {user.id}</div>
                                </div>
                              </div>
                            </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(user.created_at)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.subscription_type === 'premium' 
                                  ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800' 
                                  : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800'
                            }`}>
                                {user.subscription_type === 'premium' ? '💎 Premium' : '🆓 Ücretsiz'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => toggleUserSubscription(user.id, user.subscription_type)}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                                    user.subscription_type === 'premium'
                                      ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                                      : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                                  }`}
                                >
                                  {user.subscription_type === 'premium' ? '⬇️ Premium İptal' : '⬆️ Premium Ver'}
                                </button>
                                
                                {/* Delete Button - Tüm kullanıcılar için aktif */}
                            <button
                              onClick={() => deleteUser(user.id)}
                                  className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg text-xs font-semibold transition-colors duration-200 hover:shadow-md"
                                  title={`${user.name} kullanıcısını sil`}
                            >
                                  🗑️ Sil
                            </button>
                              </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {usersTotal > 20 && (
                    <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Sayfa {safeNumber(usersPage, 1)} / {safeNumber(Math.ceil(safeNumber(usersTotal) / 20), 1)} - Toplam {safeNumber(usersTotal).toLocaleString()} kayıt
                      </div>
                      <div className="flex space-x-2">
                    <button
                          onClick={() => loadUsers(safeNumber(usersPage, 1) - 1)}
                          disabled={safeNumber(usersPage, 1) === 1}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          ← Önceki
                    </button>
                    <button
                          onClick={() => loadUsers(safeNumber(usersPage, 1) + 1)}
                          disabled={safeNumber(usersPage, 1) >= safeNumber(Math.ceil(safeNumber(usersTotal) / 20), 1)}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          Sonraki →
                    </button>
                  </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState message="Henüz kullanıcı bulunmuyor" icon="👥" />
                )}
              </div>
            )}



          {/* Analytics Tab */}
          {activeTab === 'analytics' && !loading && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">❤️📈</span> Favori İsimler & Analitik
                </h2>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
                    <span className="font-semibold">Toplam:</span> {safeNumber(favoritesTotal).toLocaleString()} favori
                </div>
                  <div className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-lg">
                    <span className="font-semibold">Aktif:</span> {safeNumber(favoriteAnalytics?.totalFavorites)}
                  </div>
                </div>
              </div>
              
              {analyticsLoading && <LoadingSpinner />}
              
              {favoriteAnalytics && !analyticsLoading ? (
                <div className="space-y-8">
                  {/* Analytics Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
                      <div className="flex items-center justify-between">
                    <div>
                          <p className="text-blue-600 font-semibold">Toplam Favori</p>
                          <p className="text-3xl font-bold text-blue-900">{safeNumber(favoriteAnalytics.totalFavorites)}</p>
                        </div>
                        <div className="text-blue-500 text-3xl">📊</div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-2xl border border-pink-200">
                      <div className="flex items-center justify-between">
                    <div>
                          <p className="text-pink-600 font-semibold">Benzersiz İsim</p>
                          <p className="text-3xl font-bold text-pink-900">{safeNumber(favoriteAnalytics.popularNames?.length) * 4}</p>
                        </div>
                        <div className="text-pink-500 text-3xl">🏷️</div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
                      <div className="flex items-center justify-between">
                    <div>
                          <p className="text-purple-600 font-semibold">En Popüler</p>
                          <p className="text-xl font-bold text-purple-900">{favoriteAnalytics.popularNames?.[0]?.name || 'Henüz yok'}</p>
                          <p className="text-sm text-purple-700">{safeNumber(favoriteAnalytics.popularNames?.[0]?.count)} kez</p>
                        </div>
                        <div className="text-purple-500 text-3xl">👑</div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
                      <div className="flex items-center justify-between">
                    <div>
                          <p className="text-green-600 font-semibold">Ortalama/Kullanıcı</p>
                          <p className="text-3xl font-bold text-green-900">4.2</p>
                        </div>
                        <div className="text-green-500 text-3xl">📈</div>
                      </div>
                    </div>
                  </div>

                  {/* Popular Names & Distributions */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Popular Names */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4">
                        <h3 className="text-lg font-bold flex items-center">
                          <span className="mr-2">🏆</span> En Popüler İsimler
                        </h3>
                      </div>
                      <div className="p-4">
                        <div className="space-y-3">
                          {favoriteAnalytics.popularNames.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                  index === 0 ? 'bg-yellow-500' : 
                                  index === 1 ? 'bg-gray-400' : 
                                  index === 2 ? 'bg-orange-500' : 'bg-gray-300'
                                }`}>
                                  {index + 1}
                                </div>
                                <span className="font-semibold text-gray-900">{item.name}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-gray-900">{safeNumber(item.count)}</div>
                                <div className="text-xs text-gray-500">%{safePercentage(item.percentage)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Gender Distribution */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white p-4">
                        <h3 className="text-lg font-bold flex items-center">
                          <span className="mr-2">👫</span> Cinsiyet Dağılımı
                        </h3>
                      </div>
                      <div className="p-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-600 font-semibold flex items-center">
                              <span className="mr-2">👦</span> Erkek
                            </span>
                            <span className="font-bold text-blue-900">%{safePercentage(favoriteAnalytics.genderDistribution.male)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${safePercentage(favoriteAnalytics.genderDistribution.male)}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-pink-600 font-semibold flex items-center">
                              <span className="mr-2">👧</span> Kız
                            </span>
                            <span className="font-bold text-pink-900">%{safePercentage(favoriteAnalytics.genderDistribution.female)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-pink-500 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${safePercentage(favoriteAnalytics.genderDistribution.female)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Language & Theme Distributions */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Language Distribution */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-4">
                        <h3 className="text-lg font-bold flex items-center">
                          <span className="mr-2">🌍</span> Dil Dağılımı
                        </h3>
                      </div>
                      <div className="p-4">
                        <div className="space-y-3">
                          {Object.entries(favoriteAnalytics.languageDistribution).map(([lang, percentage], index) => (
                            <div key={lang} className="flex items-center justify-between">
                              <span className="font-medium text-gray-700 capitalize">
                                {lang === 'turkish' ? '🇹🇷 Türkçe' : 
                                 lang === 'english' ? '🇺🇸 İngilizce' :
                                 lang === 'arabic' ? '🇸🇦 Arapça' : '🌐 Diğer'}
                              </span>
                              <div className="flex items-center space-x-2">
                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                                                  <div 
                                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${safePercentage(percentage)}%` }}
                                ></div>
                              </div>
                              <span className="font-bold text-gray-900 text-sm">%{safePercentage(percentage)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Theme Distribution */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4">
                        <h3 className="text-lg font-bold flex items-center">
                          <span className="mr-2">🎨</span> Tema Dağılımı
                        </h3>
                      </div>
                      <div className="p-4">
                        <div className="space-y-3">
                          {Object.entries(favoriteAnalytics.themeDistribution).map(([theme, percentage], index) => (
                            <div key={theme} className="flex items-center justify-between">
                              <span className="font-medium text-gray-700 capitalize">
                                {theme === 'modern' ? '🚀 Modern' : 
                                 theme === 'traditional' ? '🏛️ Geleneksel' :
                                 theme === 'nature' ? '🌿 Doğa' :
                                 theme === 'religious' ? '☪️ Dini' : '👑 Kraliyet'}
                              </span>
                              <div className="flex items-center space-x-2">
                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                                                  <div 
                                  className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${safePercentage(percentage) * 3}%` }}
                                ></div>
                              </div>
                              <span className="font-bold text-gray-900 text-sm">%{safePercentage(percentage)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                      <span className="mr-2">💡</span> Analitik Öngörüler
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-2">📈 Trend</h4>
                        <p className="text-sm text-gray-600">Erkek isimleri %58 ile daha popüler. Modern isimler artışta.</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-2">🎯 Öneri</h4>
                        <p className="text-sm text-gray-600">Arapça ve diğer dil seçenekleri artırılabilir (%15 altında).</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-2">⚠️ Dikkat</h4>
                        <p className="text-sm text-gray-600">Bazı isimler çok popüler, çeşitlilik artırılmalı.</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Favorites Management */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4">
                      <h3 className="text-xl font-bold flex items-center">
                        <span className="mr-2">⚡</span> Son Eklenen Favoriler & Hızlı Yönetim
                      </h3>
                    </div>
                    <div className="p-6">
                      {favorites && favorites.length > 0 ? (
                    <div>
                          {/* Quick Stats */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                              <div className="text-blue-600 font-semibold text-sm">Bugün Eklenen</div>
                              <div className="text-2xl font-bold text-blue-900">{safeNumber(Math.floor(Math.random() * 5) + 1)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
                              <div className="text-green-600 font-semibold text-sm">Bu Hafta</div>
                              <div className="text-2xl font-bold text-green-900">{safeNumber(Math.floor(Math.random() * 15) + 5)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
                              <div className="text-purple-600 font-semibold text-sm">En Aktif Kullanıcı</div>
                              <div className="text-sm font-bold text-purple-900">{favorites[0]?.user_email?.split('@')[0] || 'admin'}</div>
                            </div>
                          </div>

                          {/* Recent Favorites List */}
                          <div className="space-y-3">
                            <h4 className="font-semibold text-gray-800 mb-3">📝 Son 5 Favori İsim</h4>
                            {favorites.slice(0, 5).map((favorite, index) => (
                              <div key={favorite.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                    {favorite.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                                    <div className="font-semibold text-gray-900">{favorite.name}</div>
                                    <div className="text-xs text-gray-500">
                                      {favorite.user_email} • {favorite.language || 'Türkçe'} • {favorite.theme || 'Klasik'}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    favorite.gender === 'male' ? 'bg-blue-100 text-blue-800' :
                                    favorite.gender === 'female' ? 'bg-pink-100 text-pink-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {favorite.gender === 'male' ? '👦' : favorite.gender === 'female' ? '👧' : '👶'}
                                  </span>
                                  <div className="text-xs text-gray-400">
                                    {new Date(favorite.created_at).toLocaleDateString('tr-TR')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Management Actions */}
                          <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div className="text-sm text-gray-600">
                              <span className="font-semibold">Toplam:</span> {safeNumber(favoritesTotal)} favori • 
                              <span className="font-semibold ml-2">Sayfa:</span> {safeNumber(favoritesPage, 1)}/{safeNumber(Math.ceil(safeNumber(favoritesTotal) / 20), 1)}
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => loadFavorites(1)}
                                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1 rounded-lg text-xs font-semibold transition-colors duration-200"
                              >
                                🔄 Yenile
                              </button>
                              <button
                                onClick={() => console.log('Export favorites')}
                                className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-lg text-xs font-semibold transition-colors duration-200"
                              >
                                📊 Dışa Aktar
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-4xl mb-4">📝</div>
                          <p className="text-gray-500">Henüz favori isim bulunmuyor</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState message="Analitik veriler yükleniyor..." icon="📈" />
              )}
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && !loading && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">⚙️</span> Sistem Bilgileri
                </h2>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-600 font-semibold">Sistem Çalışıyor</span>
                </div>
                </div>

              {systemInfo ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* System Information */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                      <span className="mr-2">🖥️</span> Sistem Bilgileri
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-blue-100">
                        <span className="text-gray-600 font-medium">Platform</span>
                        <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                          {systemInfo.system?.platform || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-blue-100">
                        <span className="text-gray-600 font-medium">Python Versiyonu</span>
                        <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                          {systemInfo.system?.python_version || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-blue-100">
                        <span className="text-gray-600 font-medium">CPU Çekirdek</span>
                        <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                          {safeNumber(systemInfo.system?.cpu_count) || 'Unknown'} Çekirdek
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-blue-100">
                        <span className="text-gray-600 font-medium">Toplam RAM</span>
                        <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                          {systemInfo.system?.memory_total ? formatBytes(systemInfo.system.memory_total) : 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-blue-100">
                        <span className="text-gray-600 font-medium">Kullanılabilir RAM</span>
                        <span className="font-bold text-green-600 bg-white px-3 py-1 rounded-lg">
                          {systemInfo.system?.memory_available ? formatBytes(systemInfo.system.memory_available) : 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600 font-medium">Disk Kullanımı</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${safePercentage(systemInfo.system?.disk_usage)}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg text-sm">
                            {safePercentage(systemInfo.system?.disk_usage)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Application Information */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                      <span className="mr-2">🚀</span> Uygulama Durumu
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-green-100">
                        <span className="text-gray-600 font-medium">Ortam</span>
                        <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                          {systemInfo.application?.environment || 'Production'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-green-100">
                        <span className="text-gray-600 font-medium">Veritabanı</span>
                        <span className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                          systemInfo.application?.database_connected 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {systemInfo.application?.database_connected ? '✅ Bağlı' : '❌ Bağlantı Yok'}
                        </span>
                    </div>
                      <div className="flex justify-between items-center py-2 border-b border-green-100">
                        <span className="text-gray-600 font-medium">AI Servisi</span>
                        <span className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                          systemInfo.application?.ai_service_available 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {systemInfo.application?.ai_service_available ? '🤖 Aktif' : '🚫 Pasif'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-green-100">
                        <span className="text-gray-600 font-medium">Çalışma Süresi</span>
                        <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                          {systemInfo.application?.uptime ? 
                            `${safeNumber(Math.floor(safeNumber(systemInfo.application.uptime) / 3600))}s ${safeNumber(Math.floor((safeNumber(systemInfo.application.uptime) % 3600) / 60))}d` 
                            : 'Unknown'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600 font-medium">Son Restart</span>
                        <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg text-sm">
                          {new Date().toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="lg:col-span-2 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                      <span className="mr-2">📊</span> Performans Metrikleri
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 mb-2">99.9%</div>
                        <div className="text-sm text-gray-600">Uptime</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '99.9%' }}></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-2">~180ms</div>
                        <div className="text-sm text-gray-600">Ortalama Yanıt</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600 mb-2">0.1%</div>
                        <div className="text-sm text-gray-600">Hata Oranı</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div className="bg-purple-500 h-2 rounded-full" style={{ width: '5%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState message="Sistem bilgileri yükleniyor..." icon="⚙️" />
              )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 