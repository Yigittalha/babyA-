import React, { useState, useEffect } from 'react';
import { User, Heart, Star, Calendar, Mail, Shield, Activity, Crown, Lock, Sparkles, Baby, Gift, Zap, TrendingUp, Settings, LogOut } from 'lucide-react';
import { apiService } from '../services/api';
import { onAuthStateChanged } from '../services/authStateManager';

const UserProfile = ({ user, onClose, onUpdate, onShowToast }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  // Reset favorites state when user changes
  useEffect(() => {
    if (user) {
      // Reset favorites state for new user
      setFavoritesLoaded(false);
      setFavorites([]);
      setError(null);
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // Only load favorites if we have a valid user, favorites tab is active, and not already loaded
    if (user && user.id && activeTab === 'favorites' && !favoritesLoaded && !loading) {
      console.log('🔐 UserProfile: Loading favorites for user:', user.email);
      loadFavorites();
    } else if (!user) {
      console.log('🔐 UserProfile: No user provided, skipping favorites load');
    }
  }, [user, activeTab, favoritesLoaded, loading]);

  // Monitor auth state changes (with debouncing to prevent loops)
  useEffect(() => {
    let timeout;
    const unsubscribe = onAuthStateChanged((currentUser, previousUser) => {
      console.log('🔐 UserProfile: Auth state change detected:', {
        currentUser: currentUser ? `${currentUser.email} (ID: ${currentUser.id})` : 'null',
        previousUser: previousUser ? `${previousUser.email} (ID: ${previousUser.id})` : 'null',
        propUser: user ? `${user.email} (ID: ${user.id})` : 'null'
      });
      
      // Clear previous timeout
      if (timeout) clearTimeout(timeout);
      
      // Debounce auth state changes to prevent rapid firing
      timeout = setTimeout(() => {
        // In development, be more conservative about closing the profile
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!currentUser && user) {
          if (isDevelopment) {
            // In development, don't close automatically - let user manually close
            console.log('🔐 UserProfile: User signed out detected in development, but keeping profile open for debugging');
            console.log('🔍 UserProfile: To manually close profile, user can click the close button');
          } else {
            // Only close if we previously had a user but now don't
            console.log('🔐 UserProfile: User signed out detected, closing profile');
            console.trace('🔍 UserProfile: Profile closing trace');
            // Reset all state before closing
            setFavoritesLoaded(false);
            setFavorites([]);
            setError(null);
            setLoading(false);
            onClose();
          }
        } else if (currentUser && !user) {
          console.log('🔐 UserProfile: User signed in but no prop user, staying open');
        } else if (currentUser && user && currentUser.id !== user.id) {
          console.log('🔐 UserProfile: Different user detected, closing profile');
          onClose();
        } else {
          console.log('🔐 UserProfile: Auth state change ignored (same user or both null)');
        }
      }, 500); // 500ms debounce
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      return unsubscribe();
    };
  }, [onClose, user]);

  const loadFavorites = async () => {
    // Don't load favorites if user is not authenticated or already loading
    if (!user || !user.id || loading) {
      console.log('🔐 UserProfile: No user or already loading, skipping favorites load');
      return;
    }

    // Prevent multiple simultaneous calls
    if (favoritesLoaded) {
      console.log('🔐 UserProfile: Favorites already loaded, skipping');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('📡 UserProfile: Fetching favorites for user:', user.email);
      const response = await apiService.getFavorites();
      
      if (response && Array.isArray(response.favorites)) {
        setFavorites(response.favorites);
        setFavoritesLoaded(true);
        console.log('✅ UserProfile: Loaded', response.favorites.length, 'favorites');
      } else {
        console.warn('⚠️ UserProfile: Invalid favorites response format');
        setFavorites([]);
        setFavoritesLoaded(true);
      }
    } catch (err) {
      console.error('❌ UserProfile: Favorites loading error:', err);
      
      // Handle specific error cases
      if (err.status === 401) {
        console.log('🔐 UserProfile: Authentication error, but keeping profile open');
        setError('Oturum süresi dolmuş olabilir. Lütfen yeniden giriş yapın.');
        // Don't close the profile immediately - let user decide
      } else if (err.status === 429) {
        console.log('⏰ UserProfile: Rate limited, will retry later');
        setError('Çok fazla istek gönderildi. Lütfen birkaç saniye bekleyin.');
      } else if (err.status >= 500) {
        setError('Sunucu hatası. Lütfen daha sonra tekrar deneyin.');
      } else {
        setError('Favoriler yüklenirken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteFavorite = async (favoriteId) => {
    // Don't proceed if user is not authenticated
    if (!user || !user.id) {
      console.log('🔐 UserProfile: No user, skipping favorite delete');
      return;
    }

    try {
      console.log('🗑️ UserProfile: Deleting favorite:', favoriteId);
      await apiService.deleteFavorite(favoriteId);
      const updatedFavorites = favorites.filter(fav => fav.id !== favoriteId);
      setFavorites(updatedFavorites);
      onShowToast({ message: 'Favori isim kaldırıldı ✨', type: 'success' });
    } catch (err) {
      console.error('❌ UserProfile: Delete favorite error:', err);
      
      // Handle specific error cases
      if (err.status === 401) {
        console.log('🔐 UserProfile: Authentication error for delete');
        onShowToast({ message: 'Oturum süresi dolmuş. Lütfen yeniden giriş yapın.', type: 'error' });
        // Don't close the profile immediately
      } else if (err.status === 429) {
        onShowToast({ message: 'Çok fazla istek. Lütfen bekleyin.', type: 'error' });
      } else {
        onShowToast({ message: 'Favori kaldırılırken hata oluştu', type: 'error' });
      }
    }
  };

  const getGenderLabel = (gender) => {
    const labels = {
      male: '👶 Erkek',
      female: '👧 Kız',
      unisex: '👶👧 Unisex'
    };
    return labels[gender] || gender;
  };

  const getLanguageLabel = (language) => {
    const labels = {
      'turkish': '🇹🇷 Türkçe',
      'english': '🇬🇧 İngilizce',
      'arabic': '🇸🇦 Arapça',
      'persian': '🇮🇷 Farsça',
      'kurdish': '🇮🇶 Kürtçe',
      'azerbaijani': '🇦🇿 Azerbaycan dili',
      'french': '🇫🇷 Fransızca',
      'german': '🇩🇪 Almanca',
      'spanish': '🇪🇸 İspanyolca',
      'portuguese': '🇵🇹 Portekizce',
      'russian': '🇷🇺 Rusça',
      'chinese': '🇨🇳 Çince',
      'japanese': '🇯🇵 Japonca'
    };
    return labels[language] || language;
  };

  const getThemeLabel = (theme) => {
    const labels = {
      nature: '🌿 Doğa',
      religious: '🙏 Dini/İlahi',
      historical: '🏛️ Tarihi',
      modern: '✨ Modern',
      traditional: '🏺 Geleneksel',
      unique: '💎 Benzersiz',
      royal: '👑 Asil/Kraliyet',
      warrior: '⚔️ Savaşçı',
      wisdom: '🧠 Bilgelik',
      love: '💕 Aşk/Sevgi'
    };
    return labels[theme] || theme;
  };

  const isPremium = user?.is_premium || 
                   user?.subscription_type === 'premium' || 
                   user?.subscription_type === 'standard';
  const isAdmin = user?.is_admin;
  
  // Get user plan display name
  const getPlanDisplayName = (subscriptionType) => {
    const planNames = {
      'free': 'Free Family',
      'standard': 'Standard Family', 
      'premium': 'Premium Family'
    };
    return planNames[subscriptionType] || 'Free Family';
  };
  
  const getPlanBadgeColor = (subscriptionType) => {
    if (subscriptionType === 'premium') {
      return 'bg-gradient-to-r from-purple-400 to-purple-600 text-purple-100 shadow-lg';
    } else if (subscriptionType === 'standard') {
      return 'bg-gradient-to-r from-blue-400 to-blue-600 text-blue-100 shadow-lg';
    }
    return 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700';
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Floating Baby Decorations */}
      <div className="absolute top-20 left-10 opacity-20 animate-bounce">
        <Baby className="w-6 h-6 text-pink-300" />
      </div>
      <div className="absolute top-32 right-16 opacity-20 animate-pulse">
        <Heart className="w-5 h-5 text-purple-300" />
      </div>
      <div className="absolute top-48 left-1/4 opacity-20 animate-bounce" style={{ animationDelay: '1s' }}>
        <Star className="w-4 h-4 text-yellow-300" />
      </div>

      {/* Hero Profile Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-3xl p-6 md:p-8 shadow-xl border border-white/50">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="grid grid-cols-12 gap-4 h-full">
            {[...Array(48)].map((_, i) => (
              <div key={i} className="flex items-center justify-center">
                <Baby className="w-4 h-4 text-pink-400" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center shadow-2xl">
                <User className="w-10 h-10 md:w-12 md:h-12 text-white" />
              </div>
              {isPremium && (
                <div className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-yellow-600 p-1.5 rounded-full shadow-lg animate-pulse">
                  <Crown className="w-4 h-4 text-yellow-900" />
                </div>
              )}
              {isAdmin && (
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-600 p-1.5 rounded-full shadow-lg">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                    {user.name}
                    {isPremium && <span className="ml-2">👑</span>}
                  </h1>
                  <div className="flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-4 text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">{user.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">
                        Üye: {new Date(user.created_at).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Membership Badge */}
                <div className="mt-4 md:mt-0">
                  <div className={`px-4 py-2 rounded-xl font-bold text-sm ${getPlanBadgeColor(user?.subscription_type)}`}>
                    <div className="flex items-center space-x-2">
                      {isPremium ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      <span>{getPlanDisplayName(user?.subscription_type)}</span>
                    </div>
                    {isPremium && user.subscription_expires && (
                      <div className="text-xs mt-1 opacity-90">
                        {new Date(user.subscription_expires).toLocaleDateString('tr-TR')} tarihine kadar
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-white/50">
                  <div className="text-xl font-bold text-pink-600">{favorites.length}</div>
                  <div className="text-xs text-gray-600">Favori İsim</div>
                </div>
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-white/50">
                  <div className="text-xl font-bold text-purple-600">
                    {user?.created_at ? Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0}
                  </div>
                  <div className="text-xs text-gray-600">Aktif Gün</div>
                </div>
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-white/50">
                  <div className="text-xl font-bold text-blue-600">
                    {favorites?.length ? new Set(favorites.map(fav => fav.language)).size : 0}
                  </div>
                  <div className="text-xs text-gray-600">Farklı Dil</div>
                </div>
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-white/50">
                  <div className="text-xl font-bold text-green-600">
                    {isAdmin ? '∞' : (isPremium ? '∞' : '5')}
                  </div>
                  <div className="text-xs text-gray-600">Günlük Limit</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-2 bg-white rounded-xl shadow-lg border border-gray-100">
        {[
          { id: 'profile', label: 'Profil Bilgileri', icon: User },
          { id: 'favorites', label: `Favoriler (${favorites?.length || 0})`, icon: Heart },
          { id: 'stats', label: 'İstatistikler', icon: TrendingUp },
          { id: 'settings', label: 'Ayarlar', icon: Settings }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              // Load favorites when favorites tab is clicked and not already loaded
              if (tab.id === 'favorites' && user && user.id && !favoritesLoaded && !loading) {
                loadFavorites();
              }
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Membership Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl">
                  <Crown className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Üyelik Bilgileri</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600 font-medium">Üyelik Türü:</span>
                    <div className={`px-3 py-1 rounded-lg font-bold text-sm ${
                      isPremium 
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {isPremium ? '👑 Premium' : '🆓 Ücretsiz'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600 font-medium">Durum:</span>
                    <span className="text-green-600 font-bold">✅ Aktif</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600 font-medium">Kayıt Tarihi:</span>
                    <span className="text-gray-800 font-medium">
                      {new Date(user.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {isPremium && user.subscription_expires && (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                      <span className="text-yellow-800 font-medium">Bitiş Tarihi:</span>
                      <span className="text-yellow-900 font-bold">
                        {new Date(user.subscription_expires).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600 font-medium">Rol:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      isAdmin 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {isAdmin ? '👨‍💻 Admin' : '👤 Kullanıcı'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600 font-medium">Toplam Favori:</span>
                    <span className="text-purple-600 font-bold">{favorites.length} isim</span>
                  </div>
                </div>
              </div>

              {/* Premium Features */}
              {isPremium ? (
                <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                  <h4 className="text-lg font-bold text-yellow-800 mb-3 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Premium Özellikleriniz
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl mb-1">∞</div>
                      <div className="text-xs text-yellow-700">Sınırsız İsim</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl mb-1">🔍</div>
                      <div className="text-xs text-yellow-700">Detaylı Analiz</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl mb-1">💎</div>
                      <div className="text-xs text-yellow-700">Özel İsimler</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl mb-1">⚡</div>
                      <div className="text-xs text-yellow-700">Öncelikli Destek</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Lock className="w-5 h-5 text-purple-400 opacity-50" />
                  </div>
                  <h4 className="text-lg font-bold text-purple-800 mb-3">
                    Premium'a Yükselt 🚀
                  </h4>
                  <p className="text-purple-700 mb-4">Sınırsız isim üretimi ve özel özellikler için Premium üye olun!</p>
                  <button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                    <Crown className="w-5 h-5 inline mr-2" />
                    Premium Ol - Sadece $7.99/ay
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Heart className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Favori İsimlerim</h3>
                      <p className="text-pink-100">Beğendiğiniz {favorites.length} ismi keşfedin</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFavoritesLoaded(false);
                      setError(null);
                      loadFavorites();
                    }}
                    className="bg-white/20 hover:bg-white/30 p-3 rounded-xl transition-all duration-300"
                    disabled={loading}
                    title="Favorileri yenile"
                  >
                    <Star className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Favoriler yükleniyor... 💫</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">😔</div>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                      onClick={loadFavorites}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all duration-300"
                    >
                      Tekrar Dene
                    </button>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">👶</div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Henüz favori isminiz yok</h4>
                    <p className="text-gray-600 mb-6">İsim üretirken kalp butonuna tıklayarak favorilere ekleyebilirsiniz</p>
                    <button
                      onClick={onClose}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-xl font-bold hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                      <Baby className="w-5 h-5 inline mr-2" />
                      İsim Üretmeye Başla
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {favorites.map((favorite) => (
                      <div
                        key={favorite.id}
                        className="group bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 rounded-xl p-4 hover:shadow-xl transition-all duration-300 hover:border-purple-200 hover:-translate-y-1"
                      >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-lg font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                            {favorite.name}
                          </h4>
                          <button
                            onClick={() => deleteFavorite(favorite.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                            title="Favorilerden kaldır"
                          >
                            <Heart className="w-4 h-4 fill-current" />
                          </button>
                        </div>
                        
                        {/* Meaning */}
                        <p className="text-gray-600 mb-3 leading-relaxed text-sm">{favorite.meaning}</p>
                        
                        {/* Tags */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">
                              {getGenderLabel(favorite.gender)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">
                              {getLanguageLabel(favorite.language)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-bold">
                              {getThemeLabel(favorite.theme)}
                            </span>
                          </div>
                        </div>

                        {/* Notes */}
                        {favorite.notes && (
                          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-xl border border-yellow-200 mb-3">
                            <p className="text-sm text-yellow-800">
                              <strong>Not:</strong> {favorite.notes}
                            </p>
                          </div>
                        )}

                        {/* Date */}
                        <div className="text-xs text-gray-400 border-t border-gray-100 pt-2">
                          💫 {new Date(favorite.created_at).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {/* Main Stats Card */}
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Kullanım İstatistikleri</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl border border-pink-200">
                  <div className="text-2xl font-bold text-pink-600 mb-2">{favorites.length}</div>
                  <div className="text-sm text-pink-700 font-medium">Favori İsim</div>
                  <div className="text-xs text-pink-600 mt-1">💕</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    {user?.created_at ? Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0}
                  </div>
                  <div className="text-sm text-blue-700 font-medium">Aktif Gün</div>
                  <div className="text-xs text-blue-600 mt-1">📅</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="text-2xl font-bold text-purple-600 mb-2">
                    {favorites?.length ? new Set(favorites.map(fav => fav.language)).size : 0}
                  </div>
                  <div className="text-sm text-purple-700 font-medium">Farklı Dil</div>
                  <div className="text-xs text-purple-600 mt-1">🌍</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {favorites?.length ? new Set(favorites.map(fav => fav.theme)).size : 0}
                  </div>
                  <div className="text-sm text-green-700 font-medium">Farklı Tema</div>
                  <div className="text-xs text-green-600 mt-1">🎨</div>
                </div>
              </div>
            </div>

            {/* Distribution Charts */}
            {favorites.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gender Distribution */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <Baby className="w-5 h-5 mr-2 text-blue-500" />
                    Cinsiyet Dağılımı
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(
                      favorites.reduce((acc, fav) => {
                        acc[fav.gender] = (acc[fav.gender] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([gender, count]) => (
                      <div key={gender} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700 font-medium">{getGenderLabel(gender)}</span>
                          <span className="text-sm text-gray-500 font-bold">{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${(count / favorites.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Language Distribution */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🌍</span>
                    Dil Dağılımı
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(
                      favorites.reduce((acc, fav) => {
                        acc[fav.language] = (acc[fav.language] || 0) + 1;
                        return acc;
                      }, {})
                    ).slice(0, 5).map(([language, count]) => (
                      <div key={language} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700 font-medium">{getLanguageLabel(language)}</span>
                          <span className="text-sm text-gray-500 font-bold">{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${(count / favorites.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl">
                  <Settings className="w-6 h-6 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Hesap Ayarları</h3>
              </div>

              <div className="space-y-6">
                {/* Account Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button className="p-4 text-left bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-300 group">
                    <div className="flex items-center space-x-3">
                      <User className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <h4 className="font-bold text-blue-800">Profil Düzenle</h4>
                        <p className="text-sm text-blue-600">İsim ve e-posta güncelle</p>
                      </div>
                    </div>
                  </button>

                  <button className="p-4 text-left bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-300 group">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-6 h-6 text-purple-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <h4 className="font-bold text-purple-800">Şifre Değiştir</h4>
                        <p className="text-sm text-purple-600">Güvenlik ayarları</p>
                      </div>
                    </div>
                  </button>

                  <button className="p-4 text-left bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-300 group">
                    <div className="flex items-center space-x-3">
                      <Star className="w-6 h-6 text-green-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <h4 className="font-bold text-green-800">Bildirimler</h4>
                        <p className="text-sm text-green-600">E-posta tercihleri</p>
                      </div>
                    </div>
                  </button>

                  <button className="p-4 text-left bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200 hover:shadow-lg transition-all duration-300 group">
                    <div className="flex items-center space-x-3">
                      <LogOut className="w-6 h-6 text-red-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <h4 className="font-bold text-red-800">Çıkış Yap</h4>
                        <p className="text-sm text-red-600">Hesaptan güvenli çıkış</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Privacy Section */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-bold text-gray-800 mb-4">Gizlilik ve Veri</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Profil görünürlüğü</span>
                      <span className="text-green-600 font-medium">Özel</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Veri yedekleme</span>
                      <span className="text-blue-600 font-medium">Aktif</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Analitik izni</span>
                      <span className="text-green-600 font-medium">Onaylandı</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile; 